// Entry della finestra fluttuante Electron (pip.html).
// Comunica con la finestra principale solo via IPC (preload → main → main window).
const api = window.electronAPI;

document.getElementById('pipSnapBtn').addEventListener('click', () => {
  api.pipCaptureStep();
});

document.getElementById('pipCloseBtn').addEventListener('click', () => {
  api.pipClose();
});

api.onPipCounter((count) => {
  document.getElementById('pipCounter').textContent = `Passi acquisiti: ${count}`;
});
