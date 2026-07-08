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
});
