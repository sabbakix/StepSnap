import { es } from './editor-state.js';
import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { showAlert } from '../ui/modals.js';
import { drawCanvas, saveFlattenedImage } from './canvas.js';
import { updateUndoRedoButtons } from './history.js';

// RITAGLIO (CROP) INTERATTIVO
export async function toggleCropMode() {
  const btn = document.getElementById('btnCrop');

  if (!es.isCropping) {
    // Attiva Crop
    es.isCropping = true;
    es.currentTool = 'crop';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Conferma
    `;
    btn.classList.add('active');

    // Disattiva gli altri strumenti
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

    // Resetta coordinate
    es.cropX1 = es.cropY1 = es.cropX2 = es.cropY2 = 0;

    drawCanvas();
    showToast("Modalità Ritaglio: trascina per selezionare la zona e clicca 'Conferma'");
  } else {
    // Applica Ritaglio se l'area è definita
    if (es.cropX1 !== es.cropX2 && es.cropY1 !== es.cropY2) {
      await applyCrop(es.cropX1, es.cropY1, es.cropX2, es.cropY2);
    } else {
      disableCropMode();
      showToast("Ritaglio annullato (nessuna area selezionata).");
    }
  }
}

export function disableCropMode() {
  es.isCropping = false;
  es.currentTool = 'select';

  const btn = document.getElementById('btnCrop');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>
    Ritaglia
  `;
  btn.classList.remove('active');
  document.getElementById('toolSelect').classList.add('active');
  drawCanvas();
}

export function drawCropOverlay(targetCtx, x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  // Sfondo scurito semi-trasparente
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';

  // Rettangolo superiore
  targetCtx.fillRect(0, 0, es.canvas.width, y);
  // Rettangolo inferiore
  targetCtx.fillRect(0, y + h, es.canvas.width, es.canvas.height - (y + h));
  // Rettangolo sinistro
  targetCtx.fillRect(0, y, x, h);
  // Rettangolo destro
  targetCtx.fillRect(x + w, y, es.canvas.width - (x + w), h);

  // Bordo bianco tratteggiato dell'area di taglio
  targetCtx.strokeStyle = '#ffffff';
  targetCtx.lineWidth = 2;
  targetCtx.setLineDash([6, 6]);
  targetCtx.strokeRect(x, y, w, h);
  targetCtx.setLineDash([]); // Ripristina linea continua
}

export async function applyCrop(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  if (w < 10 || h < 10) {
    await showAlert("Area selezionata troppo piccola per il ritaglio.");
    disableCropMode();
    return;
  }

  // Ritaglia partendo dall'immagine originale (senza annotazioni vecchie)
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = w;
  cropCanvas.height = h;
  const cropCtx = cropCanvas.getContext('2d');

  cropCtx.drawImage(es.rawImageObj, x, y, w, h, 0, 0, w, h);
  const croppedDataUrl = cropCanvas.toDataURL('image/png');

  // Salva nel modello del passo corrente
  const step = state.currentSession.steps.find(s => s.id === state.selectedStepId);
  if (step) {
    step.rawImage = croppedDataUrl;
    step.image = croppedDataUrl;
    // Rimuove vecchie annotazioni perché le coordinate cambiano
    step.annotations = [];
    es.annotations = [];

    // Ricarica immagine ritagliata
    es.rawImageObj = new Image();
    es.rawImageObj.onload = () => {
      es.canvas.width = es.rawImageObj.naturalWidth;
      es.canvas.height = es.rawImageObj.naturalHeight;
      es.undoStack = [[]];
      es.redoStack = [];
      updateUndoRedoButtons();
      drawCanvas();
      saveFlattenedImage();
      showToast("Immagine ritagliata. Le annotazioni precedenti sono state rimosse.");
    };
    es.rawImageObj.src = croppedDataUrl;
  }

  disableCropMode();
}
