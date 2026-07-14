import { state } from '../state.js';
import { platform } from '../platform/index.js';
import { showToast } from '../ui/toast.js';
import { showAlert } from '../ui/modals.js';
import { createNewStep, appendStep } from '../guides/steps.js';
import { drawShape } from '../editor/shapes.js';

// REGISTRAZIONE AUTOMATICA: ogni clic del mouse (o Invio) in qualunque
// applicazione crea un passaggio con lo screenshot e una freccia sul punto
// cliccato. L'hook globale vive nel main process di Electron; nel browser
// la funzione non è disponibile.

let recording = false;

export function isAutoRecording() {
  return recording;
}

async function startAutoRecord() {
  if (!state.currentSession) {
    showToast("Crea o apri una guida prima di avviare la registrazione!", true);
    return;
  }

  if (!platform.supportsClickRecording || !platform.supportsClickRecording()) {
    await showAlert(
      "La registrazione automatica dei clic è disponibile solo nell'app desktop di StepSnap: " +
      "il browser non può rilevare i clic fatti nelle altre applicazioni. " +
      "In alternativa usa la scorciatoia di cattura o la Finestra Fluttuante (PiP)."
    );
    return;
  }

  const ok = await platform.startClickRecording(onAutoRecordStep);
  if (!ok) {
    await showAlert("Impossibile avviare la registrazione automatica: il modulo di ascolto degli input non è disponibile su questo sistema.");
    return;
  }

  recording = true;
  updateRecordUi();
  showToast("Registrazione avviata: ogni clic o Invio crea un passaggio.");
}

export function stopAutoRecord() {
  if (!recording) return;
  recording = false;
  platform.stopClickRecording?.();
  updateRecordUi();
  showToast("Registrazione terminata.");
}

async function onAutoRecordStep({ kind, dataUrl, click }) {
  if (!recording || !state.currentSession || !dataUrl) return;

  const step = createNewStep(dataUrl);

  if (click) {
    try {
      const { annotation, flattened } = await buildClickArrow(dataUrl, click.nx, click.ny);
      step.annotations = [annotation]; // resta modificabile nell'editor
      step.image = flattened;
    } catch (err) {
      console.error('Impossibile disegnare la freccia sul clic:', err);
    }
  }

  appendStep(step);
  platform.updateFloatingCounter(state.currentSession.steps.length);
  showToast(kind === 'enter' ? "Passaggio registrato (Invio)." : "Passaggio registrato dal clic.");
}

// Crea l'annotazione freccia che punta al punto cliccato (coordinate
// normalizzate 0..1) e l'immagine appiattita corrispondente.
async function buildClickArrow(dataUrl, nx, ny) {
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const clickX = Math.max(0, Math.min(W, nx * W));
  const clickY = Math.max(0, Math.min(H, ny * H));

  // La coda sta dal lato del centro immagine, così la freccia resta sempre
  // dentro l'inquadratura e "entra" dal centro verso il punto cliccato.
  const dirX = clickX < W / 2 ? 1 : -1;
  const dirY = clickY < H / 2 ? 1 : -1;
  const len = Math.max(70, Math.min(W, H) * 0.12);
  const backoff = 10; // la punta non copre il controllo cliccato

  const width = Math.max(4, Math.round(Math.min(W, H) / 180));
  const annotation = {
    type: 'arrow',
    x1: clickX + dirX * len,
    y1: clickY + dirY * len,
    x2: clickX + dirX * backoff,
    y2: clickY + dirY * backoff,
    color: '#ef4444',
    width,
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  drawShape(ctx, annotation);

  return { annotation, flattened: canvas.toDataURL('image/png') };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Immagine non caricabile'));
    img.src = src;
  });
}

function updateRecordUi() {
  const btn = document.getElementById('btnAutoRecord');
  const hint = document.getElementById('autoRecordHint');
  if (!btn) return;

  btn.classList.toggle('recording', recording);
  btn.innerHTML = recording
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <rect x="7" y="7" width="10" height="10" rx="1"></rect>
       </svg>
       Ferma Registrazione`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <circle cx="12" cy="12" r="9"></circle>
         <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"></circle>
       </svg>
       Registra Clic Automatici`;

  if (hint) hint.classList.toggle('hidden', !recording);
}

export function initAutoRecord() {
  document.getElementById('btnAutoRecord').addEventListener('click', () => {
    if (recording) stopAutoRecord();
    else startAutoRecord();
  });
}
