// Stato interno dell'editor canvas, condiviso tra i moduli editor/*.
// Non va importato al di fuori di src/editor/.
export const es = {
  canvas: null,
  ctx: null,
  rawImageObj: new Image(),
  annotations: [],
  undoStack: [],
  redoStack: [],

  currentTool: 'select', // select, arrow, rect, pixel, text, crop
  currentColor: '#ef4444', // rosso default
  currentThickness: 6,

  // Stato di trascinamento/disegno sul Canvas
  isDrawing: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,

  // Stato Ritaglio (Crop)
  isCropping: false,
  cropX1: 0, cropY1: 0, cropX2: 0, cropY2: 0,
};
