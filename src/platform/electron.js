// Implementazione piattaforma: ELECTRON (desktop Windows/Linux/Mac)
// Finestra fluttuante = BrowserWindow nativa alwaysOnTop; niente SW né install prompt.
// window.electronAPI è esposta dal preload via contextBridge.

let floatingOpen = false;

export const electronPlatform = {
  isElectron: true,

  init() {
    window.electronAPI.onPipClosed(() => {
      floatingOpen = false;
    });
    // Il main process chiede all'utente quale schermo/finestra condividere
    window.electronAPI.onChooseSource(showSourcePicker);
  },

  // La chiamata è identica al web: nel main process
  // session.setDisplayMediaRequestHandler la fa funzionare con desktopCapturer.
  getDisplayStream(constraints) {
    return navigator.mediaDevices.getDisplayMedia(constraints);
  },

  // Screenshot nativo one-shot dello schermo (full-res, senza stream)
  captureNativeScreenshot() {
    return window.electronAPI.captureScreenshot();
  },

  // Eventi di cattura provenienti da finestra fluttuante e hotkey globale
  onCaptureRequest(cb) {
    window.electronAPI.onCaptureStep(cb);
  },

  registerGlobalHotkey(accelerator) {
    return window.electronAPI.registerGlobalHotkey(accelerator);
  },

  // --- Registrazione automatica dei clic (hook globale nel main process) ---
  supportsClickRecording() {
    return true;
  },

  async startClickRecording(onStep) {
    const ok = await window.electronAPI.startAutoRecord();
    if (ok && !this._autoRecordListenerAttached) {
      // Il listener IPC resta registrato una sola volta; il main invia eventi
      // solo mentre la registrazione è attiva.
      window.electronAPI.onAutoRecordStep(onStep);
      this._autoRecordListenerAttached = true;
    }
    return ok;
  },

  stopClickRecording() {
    return window.electronAPI.stopAutoRecord();
  },

  supportsFloatingWindow() {
    return true;
  },

  isFloatingWindowOpen() {
    return floatingOpen;
  },

  async openFloatingWindow({ stepCount }) {
    await window.electronAPI.openPipWindow(stepCount);
    floatingOpen = true;
    return true;
  },

  closeFloatingWindow() {
    if (floatingOpen) {
      window.electronAPI.closePipWindow();
      floatingOpen = false;
    }
  },

  updateFloatingCounter(count) {
    if (floatingOpen) {
      window.electronAPI.updatePipCounter(count);
    }
  },

  // Il Service Worker e il prompt di installazione PWA non servono nel desktop
  initPWA() {},
};

// Picker sorgenti di cattura: riusa le classi dei modali esistenti dell'app
function showSourcePicker(sources) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';

  const grid = sources.map((s) => `
    <button class="capture-source-item" data-id="${s.id}" style="-webkit-app-region:no-drag;display:flex;flex-direction:column;gap:6px;align-items:center;padding:10px;border:1px solid var(--border-color);border-radius:10px;background:var(--bg-color);cursor:pointer;width:100%;">
      <img src="${s.thumbnail}" alt="" style="width:100%;height:110px;object-fit:contain;border-radius:6px;background:#0f172a;">
      <span style="font-size:12px;color:var(--text-primary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeText(s.name)}</span>
    </button>
  `).join('');

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Cosa vuoi condividere?</h2>
        <button class="close-btn" id="sourcePickerCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;max-height:50vh;overflow-y:auto;">
          ${grid}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="sourcePickerCancelBtn">Annulla</button>
      </div>
    </div>
  `;

  const finish = (id) => {
    overlay.remove();
    window.electronAPI.chooseSource(id);
  };

  overlay.querySelectorAll('.capture-source-item').forEach((btn) => {
    btn.addEventListener('click', () => finish(btn.dataset.id));
  });
  overlay.querySelector('#sourcePickerCancel').addEventListener('click', () => finish(null));
  overlay.querySelector('#sourcePickerCancelBtn').addEventListener('click', () => finish(null));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish(null);
  });

  document.body.appendChild(overlay);
}

function escapeText(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}
