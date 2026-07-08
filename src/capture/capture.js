import { state } from '../state.js';
import { platform } from '../platform/index.js';
import { saveCurrentSession } from '../storage/db.js';
import { showToast } from '../ui/toast.js';
import { showAlert, showConfirm } from '../ui/modals.js';
import { getHotkeyConfig } from '../ui/hotkeys.js';
import { createNewStep, renderStepsList, selectStep } from '../guides/steps.js';
import { loadStepImage } from '../editor/canvas.js';

// Stato Screen Sharing (locale a questo modulo)
let mediaStream = null;

// SCREEN CAPTURE
export async function startScreenCapture(autoStartPip = false) {
  try {
    mediaStream = await platform.getDisplayStream({
      video: {
        displaySurface: "monitor",
      },
      audio: false
    });

    const video = document.getElementById('streamVideo');
    video.srcObject = mediaStream;
    video.onloadedmetadata = () => {
      video.play();
    };

    // Gestione chiusura della condivisione dall'overlay del browser
    mediaStream.getVideoTracks()[0].onended = () => {
      stopScreenCapture();
    };

    document.getElementById('captureInactive').classList.add('hidden');
    document.getElementById('captureActive').classList.remove('hidden');
    showToast("Schermo connesso! Clicca 'Cattura Passo' o premi Barra Spaziatrice.");

    // Se richiesto, avvia automaticamente il PiP fluttuante
    if (autoStartPip === true) {
      setTimeout(() => {
        startFloatingWindow();
      }, 500);
    }
  } catch (err) {
    console.error("Errore condivisione schermo:", err);
    await showAlert("Impossibile accedere allo schermo. Permesso negato o non supportato.");
  }
}

export function stopScreenCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  const video = document.getElementById('streamVideo');
  video.srcObject = null;

  document.getElementById('captureInactive').classList.remove('hidden');
  document.getElementById('captureActive').classList.add('hidden');

  platform.closeFloatingWindow();

  showToast("Condivisione schermo disattivata.");
}

// Ottiene un fotogramma: dallo stream se attivo, altrimenti screenshot nativo (solo desktop)
async function getFrameDataUrl() {
  if (mediaStream) {
    const video = document.getElementById('streamVideo');
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const snapCtx = snapCanvas.getContext('2d');

    // Scatta fotogramma
    snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    return snapCanvas.toDataURL('image/png');
  }

  if (platform.captureNativeScreenshot) {
    return await platform.captureNativeScreenshot();
  }

  return null;
}

export async function captureScreenshot(fromPip = false) {
  if (!state.currentSession) return;
  if (!mediaStream && !platform.captureNativeScreenshot) return;

  const dataUrl = await getFrameDataUrl();
  if (!dataUrl) return;

  if (fromPip) {
    // In PiP mode, aggiunge SEMPRE come nuovo passaggio alla fine per flusso continuo
    const newStep = createNewStep(dataUrl);
    state.currentSession.steps.push(newStep);
    renderStepsList();
    selectStep(newStep.id);
    saveCurrentSession();

    // Auto-scroll sidebar al fondo
    const stepsList = document.getElementById('stepsList');
    stepsList.scrollTop = stepsList.scrollHeight;

    // Aggiorna contatore nella finestra fluttuante
    platform.updateFloatingCounter(state.currentSession.steps.length);

    showToast("Nuovo passo acquisito via PiP fluttuante!");
  } else {
    // In app principale: se c'è un passo selezionato VUOTO, inserisci lì. Altrimenti crea nuovo.
    if (state.selectedStepId) {
      const step = state.currentSession.steps.find(s => s.id === state.selectedStepId);
      if (step) {
        if (!step.rawImage || await showConfirm("Vuoi sostituire l'immagine di questo passaggio con il nuovo screenshot?", { confirmText: 'Sostituisci' })) {
          step.rawImage = dataUrl;
          step.image = dataUrl;
          step.annotations = [];
          loadStepImage(step);
          renderStepsList();
          saveCurrentSession();
          showToast("Schermata salvata nel passaggio selezionato!");
        }
        return;
      }
    }

    // Altrimenti crea nuovo
    const newStep = createNewStep(dataUrl);
    state.currentSession.steps.push(newStep);
    renderStepsList();
    selectStep(newStep.id);
    saveCurrentSession();
    showToast("Catturato screenshot per un nuovo passaggio!");
  }
}

// FINESTRA FLUTTUANTE (Document PiP nel browser, BrowserWindow nativa in Electron)
export async function startFloatingWindow() {
  if (!platform.supportsFloatingWindow()) {
    await showAlert("La finestra fluttuante PiP non è supportata da questo browser. Si consiglia l'uso di Google Chrome o Microsoft Edge su Windows.");
    return;
  }

  // Toggle: se già aperta, chiudi
  if (platform.isFloatingWindowOpen()) {
    platform.closeFloatingWindow();
    return;
  }

  // Nel browser serve lo stream attivo; in Electron basta lo screenshot nativo
  if (!mediaStream && !platform.captureNativeScreenshot) {
    await showAlert("Avvia prima la condivisione dello schermo/finestra a sinistra.");
    return;
  }

  const ok = await platform.openFloatingWindow({
    stepCount: state.currentSession ? state.currentSession.steps.length : 0,
    onCapture: () => captureScreenshot(true),
  });

  if (ok) {
    showToast("Finestra fluttuante aperta! Spostala sopra l'app che vuoi documentare.");
  } else {
    await showAlert("Impossibile aprire la finestra fluttuante.");
  }
}

// Converte la configurazione hotkey (event.code) in un accelerator Electron
function toAccelerator(cfg) {
  const parts = [];
  if (cfg.ctrl) parts.push('CommandOrControl');
  if (cfg.alt) parts.push('Alt');
  if (cfg.shift) parts.push('Shift');
  if (cfg.meta) parts.push('Super');

  let key = cfg.code || '';
  if (key.startsWith('Key')) key = key.substring(3);
  else if (key.startsWith('Digit')) key = key.substring(5);
  else if (key.startsWith('Numpad')) key = 'num' + key.substring(6).toLowerCase();
  else if (key.startsWith('Arrow')) key = key.substring(5);
  if (!key) return null;

  parts.push(key);
  return parts.join('+');
}

export function initCapture() {
  // Eventi di cattura da finestra fluttuante nativa / hotkey globale (Electron)
  platform.onCaptureRequest(() => captureScreenshot(true));

  // Hotkey globale di sistema: cattura anche quando StepSnap non ha il focus
  if (platform.registerGlobalHotkey) {
    const registerHotkey = () => {
      const accelerator = toAccelerator(getHotkeyConfig());
      if (accelerator) platform.registerGlobalHotkey(accelerator);
    };
    registerHotkey();
    window.addEventListener('stepsnap:hotkey-changed', registerHotkey);
  }

  // Disabilita il pulsante PiP se la piattaforma non lo supporta
  const btnPip = document.getElementById('btnStartPip');
  if (!platform.supportsFloatingWindow()) {
    btnPip.disabled = true;
    btnPip.title = "Non supportato su questo browser (Usa Edge o Chrome)";
  }

  // SCREEN CAPTURE EVENT LISTENERS
  document.getElementById('btnStartCapture').addEventListener('click', () => startScreenCapture(false));
  document.getElementById('btnStartPipInactive').addEventListener('click', () => {
    if (mediaStream) {
      startFloatingWindow();
    } else if (platform.isElectron) {
      // Su desktop la finestra fluttuante funziona anche senza stream (screenshot nativo)
      startFloatingWindow();
    } else {
      startScreenCapture(true);
    }
  });
  document.getElementById('btnStopCapture').addEventListener('click', stopScreenCapture);
  document.getElementById('btnSnap').addEventListener('click', () => captureScreenshot(false));
  document.getElementById('btnStartPip').addEventListener('click', startFloatingWindow);

  // Scorciatoia personalizzata per catturare quando l'app ha il focus ed è attiva la registrazione
  window.addEventListener('keydown', (e) => {
    // Evita conflitti con la registrazione della scorciatoia stessa
    if (document.activeElement === document.getElementById('hotkeyInput')) {
      return;
    }

    // Ignora se l'utente sta scrivendo in un campo di testo
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    const hotkeyConfig = getHotkeyConfig();
    const matchCtrl = e.ctrlKey === hotkeyConfig.ctrl;
    const matchAlt = e.altKey === hotkeyConfig.alt;
    const matchShift = e.shiftKey === hotkeyConfig.shift;
    const matchMeta = e.metaKey === hotkeyConfig.meta;
    const matchCode = e.code === hotkeyConfig.code;

    if (matchCtrl && matchAlt && matchShift && matchMeta && matchCode) {
      e.preventDefault();
      if (mediaStream || (platform.captureNativeScreenshot && state.currentSession)) {
        captureScreenshot(false);
      } else {
        showToast("Attiva la condivisione schermo prima di scattare!", true);
      }
    }
  });
}
