// Main process Electron (CommonJS: evita le complicazioni dell'entry ESM).
const { app, BrowserWindow, session, desktopCapturer, ipcMain, globalShortcut, screen } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const PRELOAD = path.join(__dirname, 'preload.cjs');

let mainWin = null;
let pipWin = null;
let pendingSourceResolve = null;

const secureWebPreferences = {
  preload: PRELOAD,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

function hardenWindow(win) {
  // Nessuna nuova finestra e nessuna navigazione fuori dall'app
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) e.preventDefault();
  });
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../dist/icon-512.png'),
    webPreferences: secureWebPreferences,
  });
  mainWin.setMenuBarVisibility(false);
  hardenWindow(mainWin);

  if (DEV_URL) {
    mainWin.loadURL(DEV_URL);
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWin.on('closed', () => {
    mainWin = null;
    if (pipWin) pipWin.close();
  });
}

// ---------------------------------------------------------------------------
// CATTURA SCHERMO NATIVA
// ---------------------------------------------------------------------------

// Fa funzionare il getDisplayMedia() del renderer senza modifiche:
// il main process fornisce la sorgente scelta dall'utente tramite un picker
// mostrato nel renderer (stile modali dell'app, in italiano).
function setupDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 200 },
      });

      if (sources.length === 0 || !mainWin) {
        callback();
        return;
      }

      const chosenId = await new Promise((resolve) => {
        pendingSourceResolve = resolve;
        mainWin.webContents.send(
          'capture:choose-source',
          sources.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail.toDataURL(),
          }))
        );
      });

      const source = sources.find((s) => s.id === chosenId);
      if (source) {
        callback({ video: source });
      } else {
        callback(); // annullato dall'utente → getDisplayMedia rifiuta
      }
    } catch (err) {
      console.error('Errore selezione sorgente di cattura:', err);
      callback();
    }
  });
}

ipcMain.on('capture:source-chosen', (e, id) => {
  if (pendingSourceResolve) {
    pendingSourceResolve(id);
    pendingSourceResolve = null;
  }
});

// Screenshot nativo one-shot dello schermo primario a piena risoluzione,
// senza stream video né picker: usato dalla finestra fluttuante e dalla hotkey globale.
ipcMain.handle('capture:screenshot', async () => {
  const display = screen.getPrimaryDisplay();
  const thumbnailSize = {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor),
  };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  return source ? source.thumbnail.toDataURL() : null;
});

// ---------------------------------------------------------------------------
// FINESTRA FLUTTUANTE (sostituisce il Document Picture-in-Picture del browser)
// ---------------------------------------------------------------------------

ipcMain.handle('pip:open', (e, stepCount) => {
  if (pipWin) {
    pipWin.focus();
    return;
  }

  pipWin = new BrowserWindow({
    width: 300,
    height: 230,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: secureWebPreferences,
  });
  // Livello 'screen-saver': resta sopra anche alle app fullscreen (come il DocPiP)
  pipWin.setAlwaysOnTop(true, 'screen-saver');
  hardenWindow(pipWin);

  if (DEV_URL) {
    pipWin.loadURL(DEV_URL + '/pip.html');
  } else {
    pipWin.loadFile(path.join(__dirname, '../dist/pip.html'));
  }

  pipWin.webContents.once('did-finish-load', () => {
    if (pipWin) pipWin.webContents.send('pip:counter-update', stepCount || 0);
  });

  pipWin.on('closed', () => {
    pipWin = null;
    if (mainWin) mainWin.webContents.send('pip:closed');
  });
});

ipcMain.handle('pip:close', () => {
  if (pipWin) pipWin.close();
});

ipcMain.on('pip:close-self', () => {
  if (pipWin) pipWin.close();
});

ipcMain.on('pip:counter', (e, count) => {
  if (pipWin) pipWin.webContents.send('pip:counter-update', count);
});

// Relay: bottone nella finestra fluttuante → cattura nella finestra principale
ipcMain.on('pip:capture-step', () => {
  if (mainWin) mainWin.webContents.send('capture-step');
});

// ---------------------------------------------------------------------------
// REGISTRAZIONE AUTOMATICA: hook globale mouse/tastiera (uiohook-napi).
// A ogni clic sinistro (o Invio) cattura lo schermo dove è avvenuto l'evento
// e invia al renderer screenshot + coordinate normalizzate del punto cliccato.
// ---------------------------------------------------------------------------

let uiohookLib = null; // caricato pigramente: è una dipendenza nativa opzionale
let uiohookListenersAttached = false;
let autoRecordActive = false;
let autoRecordBusy = false;
let lastAutoCaptureAt = 0;
const AUTO_CAPTURE_COOLDOWN_MS = 600;

function loadUiohook() {
  if (uiohookLib) return true;
  try {
    uiohookLib = require('uiohook-napi');
    return true;
  } catch (err) {
    console.warn('uiohook-napi non disponibile:', err.message);
    return false;
  }
}

// uiohook riporta pixel fisici del desktop virtuale; Electron ragiona in DIP
function toDipPoint(x, y) {
  return screen.screenToDipPoint ? screen.screenToDipPoint({ x, y }) : { x, y };
}

function pointInsideOwnWindows(dipPoint) {
  return [mainWin, pipWin].some((win) => {
    if (!win || win.isDestroyed()) return false;
    const b = win.getBounds();
    return dipPoint.x >= b.x && dipPoint.x <= b.x + b.width &&
           dipPoint.y >= b.y && dipPoint.y <= b.y + b.height;
  });
}

function ownWindowFocused() {
  return [mainWin, pipWin].some((win) => win && !win.isDestroyed() && win.isFocused());
}

// Cattura a piena risoluzione lo schermo che contiene il punto indicato
async function captureDisplayAtPoint(dipPoint) {
  const display = screen.getDisplayNearestPoint(dipPoint);
  const thumbnailSize = {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor),
  };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  if (!source) return null;
  return {
    dataUrl: source.thumbnail.toDataURL(),
    nx: (dipPoint.x - display.bounds.x) / display.bounds.width,
    ny: (dipPoint.y - display.bounds.y) / display.bounds.height,
  };
}

async function handleGlobalInput(kind, dipPoint, withArrow) {
  if (!autoRecordActive || autoRecordBusy || !mainWin) return;

  const now = Date.now();
  if (now - lastAutoCaptureAt < AUTO_CAPTURE_COOLDOWN_MS) return;

  // Le interazioni con le finestre di StepSnap non vanno documentate
  if (withArrow && pointInsideOwnWindows(dipPoint)) return;
  if (!withArrow && ownWindowFocused()) return;

  autoRecordBusy = true;
  lastAutoCaptureAt = now;
  try {
    const shot = await captureDisplayAtPoint(dipPoint);
    if (shot && autoRecordActive && mainWin) {
      mainWin.webContents.send('autorecord:step', {
        kind,
        dataUrl: shot.dataUrl,
        click: withArrow ? { nx: shot.nx, ny: shot.ny } : null,
      });
    }
  } catch (err) {
    console.error('Errore cattura registrazione automatica:', err);
  } finally {
    autoRecordBusy = false;
  }
}

ipcMain.handle('autorecord:start', () => {
  if (!loadUiohook()) return false;
  const { uIOhook, UiohookKey } = uiohookLib;

  if (!uiohookListenersAttached) {
    uIOhook.on('mousedown', (e) => {
      if (e.button !== 1) return; // solo tasto sinistro
      handleGlobalInput('click', toDipPoint(e.x, e.y), true);
    });
    uIOhook.on('keydown', (e) => {
      if (e.keycode !== UiohookKey.Enter && e.keycode !== UiohookKey.NumpadEnter) return;
      // Invio non ha coordinate: cattura lo schermo dove si trova il cursore, senza freccia
      handleGlobalInput('enter', screen.getCursorScreenPoint(), false);
    });
    uiohookListenersAttached = true;
  }

  try {
    uIOhook.start();
  } catch (err) {
    // start() dopo uno stop() può lamentarsi se il thread è già attivo: non fatale
    console.warn('uIOhook.start:', err.message);
  }
  autoRecordActive = true;
  return true;
});

ipcMain.handle('autorecord:stop', () => {
  autoRecordActive = false;
  if (uiohookLib) {
    try { uiohookLib.uIOhook.stop(); } catch (err) { console.warn('uIOhook.stop:', err.message); }
  }
  return true;
});

// ---------------------------------------------------------------------------
// HOTKEY GLOBALE DI SISTEMA (cattura anche quando StepSnap non ha il focus)
// ---------------------------------------------------------------------------

ipcMain.handle('hotkey:register', (e, accelerator) => {
  globalShortcut.unregisterAll();
  if (!accelerator) return false;
  try {
    return globalShortcut.register(accelerator, () => {
      if (mainWin) mainWin.webContents.send('capture-step');
    });
  } catch (err) {
    console.warn('Registrazione hotkey globale fallita:', accelerator, err.message);
    return false;
  }
});

// ---------------------------------------------------------------------------
// CICLO DI VITA APP
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  setupDisplayMediaHandler();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  autoRecordActive = false;
  if (uiohookLib) {
    try { uiohookLib.uIOhook.stop(); } catch { /* hook già fermo */ }
  }
});
