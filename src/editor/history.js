import { es } from './editor-state.js';
import { drawCanvas, saveFlattenedImage } from './canvas.js';

// UNDO / REDO
export function pushToHistory() {
  es.undoStack.push(JSON.parse(JSON.stringify(es.annotations)));
  es.redoStack = []; // Resetta redo
  updateUndoRedoButtons();
}

export function undo() {
  if (es.undoStack.length > 1) {
    const current = es.undoStack.pop();
    es.redoStack.push(current);
    es.annotations = JSON.parse(JSON.stringify(es.undoStack[es.undoStack.length - 1]));
    drawCanvas();
    saveFlattenedImage();
    updateUndoRedoButtons();
  } else if (es.undoStack.length === 1) {
    // Ritorna allo stato iniziale (senza annotazioni)
    const current = es.undoStack.pop();
    es.redoStack.push(current);
    es.annotations = [];
    drawCanvas();
    saveFlattenedImage();
    updateUndoRedoButtons();
  }
}

export function redo() {
  if (es.redoStack.length > 0) {
    const next = es.redoStack.pop();
    es.undoStack.push(next);
    es.annotations = JSON.parse(JSON.stringify(next));
    drawCanvas();
    saveFlattenedImage();
    updateUndoRedoButtons();
  }
}

export function updateUndoRedoButtons() {
  document.getElementById('btnUndo').disabled = es.undoStack.length <= 0;
  document.getElementById('btnRedo').disabled = es.redoStack.length <= 0;
}
