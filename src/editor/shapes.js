import { hexToRgba } from '../utils.js';

// Disegna una singola forma
export function drawShape(targetCtx, shape) {
  targetCtx.strokeStyle = shape.color || '#ef4444';
  targetCtx.lineWidth = shape.width || 6;
  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';

  if (shape.type === 'arrow') {
    drawArrow(targetCtx, shape.x1, shape.y1, shape.x2, shape.y2, shape.color, shape.width);
  } else if (shape.type === 'rect') {
    targetCtx.beginPath();
    targetCtx.rect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
    targetCtx.stroke();

    // Riempimento soft trasparente
    targetCtx.fillStyle = hexToRgba(shape.color || '#ef4444', 0.15);
    targetCtx.fill();
  } else if (shape.type === 'pixel') {
    const x = Math.min(shape.x1, shape.x2);
    const y = Math.min(shape.y1, shape.y2);
    const w = Math.abs(shape.x2 - shape.x1);
    const h = Math.abs(shape.y2 - shape.y1);
    if (w > 0 && h > 0) {
      pixelateArea(targetCtx, x, y, w, h, 14);
    }
  } else if (shape.type === 'text') {
    const fontSize = (shape.width * 3) + 12;
    targetCtx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
    const textWidth = targetCtx.measureText(shape.text).width;
    const padding = 6;

    // Disegna box di sfondo bianco
    targetCtx.fillStyle = '#ffffff';
    targetCtx.strokeStyle = shape.color || '#ef4444';
    targetCtx.lineWidth = 2;

    const bx = shape.x1;
    const by = shape.y1 - fontSize;
    const bw = textWidth + (padding * 2);
    const bh = fontSize + (padding * 2);

    targetCtx.beginPath();
    targetCtx.rect(bx - padding, by - padding, bw, bh);
    targetCtx.fill();
    targetCtx.stroke();

    // Disegna testo in nero
    targetCtx.fillStyle = '#0f172a';
    targetCtx.fillText(shape.text, shape.x1, shape.y1);
  }
}

// Algoritmo disegno freccia vettoriale
export function drawArrow(targetCtx, fromx, fromy, tox, toy, color, width) {
  targetCtx.strokeStyle = color || '#ef4444';
  targetCtx.lineWidth = width || 6;
  targetCtx.lineCap = 'round';

  targetCtx.beginPath();
  targetCtx.moveTo(fromx, fromy);
  targetCtx.lineTo(tox, toy);
  targetCtx.stroke();

  // Calcola angoli della punta della freccia
  const angle = Math.atan2(toy - fromy, tox - fromx);
  const headLength = 15 + (width * 1.5);

  targetCtx.fillStyle = color || '#ef4444';
  targetCtx.beginPath();
  targetCtx.moveTo(tox, toy);
  targetCtx.lineTo(tox - headLength * Math.cos(angle - Math.PI / 6), toy - headLength * Math.sin(angle - Math.PI / 6));
  targetCtx.lineTo(tox - headLength * Math.cos(angle + Math.PI / 6), toy - headLength * Math.sin(angle + Math.PI / 6));
  targetCtx.closePath();
  targetCtx.fill();
}

// Algoritmo Censura / Pixelazione
export function pixelateArea(targetCtx, x, y, w, h, pixelSize = 14) {
  try {
    // Cattura la porzione corretta dell'immagine dal canvas a quel livello di rendering
    const imgData = targetCtx.getImageData(x, y, w, h);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.max(1, w / pixelSize);
    tempCanvas.height = Math.max(1, h / pixelSize);
    const tempCtx = tempCanvas.getContext('2d');

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = w;
    sourceCanvas.height = h;
    sourceCanvas.getContext('2d').putImageData(imgData, 0, 0);

    // Ridimensiona in piccolo disattivando l'antialias
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, tempCanvas.width, tempCanvas.height);

    // Ridimensiona in grande sul canvas finale
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, x, y, w, h);
    targetCtx.imageSmoothingEnabled = true;
  } catch (e) {
    console.error("Errore pixelazione area:", e);
  }
}
