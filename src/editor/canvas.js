import { es } from './editor-state.js';
import { state } from '../state.js';
import { saveCurrentSession } from '../storage/db.js';
import { showConfirm, showPrompt } from '../ui/modals.js';
import { drawShape } from './shapes.js';
import { pushToHistory, undo, redo, updateUndoRedoButtons } from './history.js';
import { toggleCropMode, disableCropMode, drawCropOverlay } from './crop.js';

// Inizializza riferimenti canvas, toolbar e listener mouse/touch
export function initEditor() {
  es.canvas = document.getElementById('editorCanvas');
  es.ctx = es.canvas.getContext('2d');

  // CANVAS TOOLBAR EVENT LISTENERS
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const toolId = btn.id;
      if (toolId === 'toolSelect') es.currentTool = 'select';
      else if (toolId === 'toolArrow') es.currentTool = 'arrow';
      else if (toolId === 'toolRect') es.currentTool = 'rect';
      else if (toolId === 'toolPixel') es.currentTool = 'pixel';
      else if (toolId === 'toolText') es.currentTool = 'text';

      // Esci da Crop se attivo
      if (es.isCropping) {
        disableCropMode();
      }
    });
  });

  // Colori Toolbar
  const colorSwatches = document.querySelectorAll('.color-swatch');
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      es.currentColor = swatch.getAttribute('data-color');
    });
  });

  // Spessore Toolbar
  document.getElementById('lineThickness').addEventListener('change', (e) => {
    es.currentThickness = parseInt(e.target.value);
  });

  // Azioni Canvas Toolbar
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);

  document.getElementById('btnResetImage').addEventListener('click', async () => {
    const ok = await showConfirm("Vuoi rimuovere tutte le annotazioni da questa immagine? L'immagine originale rimarrà intatta.", {
      confirmText: 'Rimuovi Annotazioni',
      isDanger: true
    });
    if (ok) {
      es.annotations = [];
      pushToHistory();
      drawCanvas();
      saveFlattenedImage();
    }
  });

  // Ritaglio
  document.getElementById('btnCrop').addEventListener('click', toggleCropMode);

  // GESTIONE EVENTI MOUSE / TOUCH SUL CANVAS
  es.canvas.addEventListener('mousedown', startDrawing);
  es.canvas.addEventListener('mousemove', draw);
  es.canvas.addEventListener('mouseup', stopDrawing);
  es.canvas.addEventListener('mouseleave', stopDrawing);

  es.canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    es.canvas.dispatchEvent(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  es.canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    es.canvas.dispatchEvent(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  es.canvas.addEventListener('touchend', (e) => {
    const mouseEvent = new MouseEvent('mouseup', {});
    es.canvas.dispatchEvent(mouseEvent);
    e.preventDefault();
  }, { passive: false });
}

// CARICAMENTO IMMAGINE SUL CANVAS ED EDITOR GRAFICO
export function loadStepImage(step) {
  if (!step.rawImage) {
    // Mostra placeholder
    document.getElementById('canvasPlaceholder').classList.remove('hidden');
    document.getElementById('canvasContainer').classList.add('hidden');
    return;
  }

  document.getElementById('canvasPlaceholder').classList.add('hidden');
  document.getElementById('canvasContainer').classList.remove('hidden');

  es.rawImageObj = new Image();
  es.rawImageObj.onload = () => {
    // Imposta dimensioni interne del canvas a quelle reali dell'immagine
    es.canvas.width = es.rawImageObj.naturalWidth;
    es.canvas.height = es.rawImageObj.naturalHeight;

    // Ripristina annotazioni e history
    es.annotations = step.annotations || [];
    es.undoStack = [JSON.parse(JSON.stringify(es.annotations))];
    es.redoStack = [];
    updateUndoRedoButtons();

    drawCanvas();
  };
  es.rawImageObj.src = step.rawImage;
}

// Ridisegna l'intero Canvas
export function drawCanvas() {
  if (!es.rawImageObj.src) return;

  // Svuota
  es.ctx.clearRect(0, 0, es.canvas.width, es.canvas.height);

  // 1. Disegna screenshot originale
  es.ctx.drawImage(es.rawImageObj, 0, 0);

  // 2. Disegna tutte le annotazioni esistenti in ordine cronologico
  es.annotations.forEach(shape => {
    drawShape(es.ctx, shape);
  });

  // 3. Se l'utente sta disegnando attivamente, disegna la sagoma del tracciato in tempo reale
  if (es.isDrawing) {
    if (es.isCropping) {
      drawCropOverlay(es.ctx, es.startX, es.startY, es.currentX, es.currentY);
    } else {
      const activeShape = {
        type: es.currentTool,
        x1: es.startX,
        y1: es.startY,
        x2: es.currentX,
        y2: es.currentY,
        color: es.currentColor,
        width: es.currentThickness
      };
      drawShape(es.ctx, activeShape);
    }
  }
}

export function saveFlattenedImage() {
  if (!state.currentSession || !state.selectedStepId) return;
  const step = state.currentSession.steps.find(s => s.id === state.selectedStepId);
  if (!step) return;

  step.annotations = [...es.annotations];

  // Esporta il contenuto attuale del canvas come immagine finale
  const dataUrl = es.canvas.toDataURL('image/png');
  step.image = dataUrl;

  saveCurrentSession();

  // Aggiorna anteprima miniatura sidebar
  const cardThumb = document.querySelector(`.step-item-card[data-id="${state.selectedStepId}"] .step-item-thumb`);
  if (cardThumb) {
    cardThumb.innerHTML = `<img src="${dataUrl}" alt="Anteprima">`;
  }
}

// MOUSE EVENTS SUL CANVAS (DISEGNO INTERATTIVO)
function getCanvasMouseCoords(e) {
  const rect = es.canvas.getBoundingClientRect();
  const scaleX = es.canvas.width / rect.width;
  const scaleY = es.canvas.height / rect.height;

  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

async function startDrawing(e) {
  if (es.currentTool === 'select' && !es.isCropping) return;

  const coords = getCanvasMouseCoords(e);
  es.startX = coords.x;
  es.startY = coords.y;
  es.currentX = coords.x;
  es.currentY = coords.y;

  es.isDrawing = true;

  if (es.currentTool === 'text') {
    es.isDrawing = false;
    const txt = await showPrompt();
    if (txt && txt.trim()) {
      es.annotations.push({
        type: 'text',
        x1: es.startX,
        y1: es.startY,
        text: txt.trim(),
        color: es.currentColor,
        width: es.currentThickness
      });
      pushToHistory();
      drawCanvas();
      saveFlattenedImage();
    }
  }
}

function draw(e) {
  if (!es.isDrawing) return;

  const coords = getCanvasMouseCoords(e);
  es.currentX = coords.x;
  es.currentY = coords.y;

  drawCanvas();
}

function stopDrawing(e) {
  if (!es.isDrawing) return;
  es.isDrawing = false;

  const coords = getCanvasMouseCoords(e);
  es.currentX = coords.x;
  es.currentY = coords.y;

  if (es.isCropping) {
    // Salva le coordinate del box di ritaglio
    es.cropX1 = es.startX;
    es.cropY1 = es.startY;
    es.cropX2 = es.currentX;
    es.cropY2 = es.currentY;
    return;
  }

  // Evita piccoli trascinamenti accidentali o punti minuscoli
  const dist = Math.sqrt(Math.pow(es.currentX - es.startX, 2) + Math.pow(es.currentY - es.startY, 2));
  if (dist < 4) return;

  // Salva l'annotazione
  es.annotations.push({
    type: es.currentTool,
    x1: es.startX,
    y1: es.startY,
    x2: es.currentX,
    y2: es.currentY,
    color: es.currentColor,
    width: es.currentThickness
  });

  pushToHistory();
  drawCanvas();
  saveFlattenedImage();
}

// Espone lo stato "crop attivo" ai moduli esterni (guides/steps)
export function isCropActive() {
  return es.isCropping;
}
