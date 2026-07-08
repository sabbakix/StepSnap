// Preload condiviso da finestra principale e finestra fluttuante.
// Espone al renderer solo l'API minima necessaria, via contextBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Finestra principale ---
  openPipWindow: (stepCount) => ipcRenderer.invoke('pip:open', stepCount),
  closePipWindow: () => ipcRenderer.invoke('pip:close'),
  updatePipCounter: (count) => ipcRenderer.send('pip:counter', count),
  captureScreenshot: () => ipcRenderer.invoke('capture:screenshot'),
  registerGlobalHotkey: (accelerator) => ipcRenderer.invoke('hotkey:register', accelerator),
  onCaptureStep: (cb) => ipcRenderer.on('capture-step', () => cb()),
  onPipClosed: (cb) => ipcRenderer.on('pip:closed', () => cb()),
  onChooseSource: (cb) => ipcRenderer.on('capture:choose-source', (e, sources) => cb(sources)),
  chooseSource: (id) => ipcRenderer.send('capture:source-chosen', id),

  // --- Finestra fluttuante (pip.html) ---
  pipCaptureStep: () => ipcRenderer.send('pip:capture-step'),
  pipClose: () => ipcRenderer.send('pip:close-self'),
  onPipCounter: (cb) => ipcRenderer.on('pip:counter-update', (e, count) => cb(count)),
});
