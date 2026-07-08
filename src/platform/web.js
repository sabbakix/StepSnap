// Implementazione piattaforma: BROWSER (PWA su GitHub Pages)
// Finestra fluttuante = Document Picture-in-Picture; SW + install prompt attivi.

let pipWindow = null;
let deferredInstallPrompt = null;

export const webPlatform = {
  isElectron: false,

  init() {},

  // Nel browser la richiesta di cattura arriva dal bottone dentro la finestra DocPiP,
  // già collegato in openFloatingWindow: qui non serve nulla.
  onCaptureRequest() {},

  // Hotkey globale di sistema non disponibile nel browser
  registerGlobalHotkey: null,

  getDisplayStream(constraints) {
    return navigator.mediaDevices.getDisplayMedia(constraints);
  },

  // Cattura nativa one-shot non disponibile nel browser
  captureNativeScreenshot: null,

  supportsFloatingWindow() {
    return 'documentPictureInPicture' in window;
  },

  isFloatingWindowOpen() {
    return pipWindow !== null;
  },

  async openFloatingWindow({ stepCount, onCapture }) {
    try {
      // Richiedi finestra PiP
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 180,
      });

      // Copia i fogli di stile CSS per la formattazione
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = pipWindow.document.createElement('style');
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          // Fallback per link esterni
          const link = pipWindow.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          pipWindow.document.head.appendChild(link);
        }
      });

      // Costruisci interfaccia interna della finestra fluttuante
      const body = pipWindow.document.body;
      body.className = "pip-body";
      body.innerHTML = `
        <div class="pip-container">
          <div class="pip-title">StepSnap Fluttuante</div>
          <div class="pip-status">Condivisione in corso...</div>
          <button class="pip-snap-btn" id="pipSnapBtn">
            📸 CATTURA PASSO
          </button>
          <div class="pip-counter" id="pipCounter">Passi acquisiti: ${stepCount}</div>
          <button class="pip-close-btn" id="pipCloseBtn">Ripristina</button>
        </div>
      `;

      // Aggiungi ascoltatori eventi nella finestra PiP
      pipWindow.document.getElementById('pipSnapBtn').addEventListener('click', () => {
        onCapture();
      });

      pipWindow.document.getElementById('pipCloseBtn').addEventListener('click', () => {
        pipWindow.close();
      });

      // Alla chiusura ripristina lo stato
      pipWindow.addEventListener('pagehide', () => {
        pipWindow = null;
      });

      return true;
    } catch (err) {
      console.error("Errore apertura Picture-in-Picture:", err);
      pipWindow = null;
      return false;
    }
  },

  closeFloatingWindow() {
    if (pipWindow) {
      pipWindow.close();
      pipWindow = null;
    }
  },

  updateFloatingCounter(count) {
    if (pipWindow) {
      const counterEl = pipWindow.document.getElementById('pipCounter');
      if (counterEl) {
        counterEl.textContent = `Passi acquisiti: ${count}`;
      }
    }
  },

  // PROGRESSIVE WEB APP (PWA) SUPPORT — solo browser
  initPWA() {
    registerServiceWorker();
    setupPWAInstall();
  },
};

// Registra il Service Worker per abilitare l'offline e l'installazione
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service Worker registrato con successo:', registration.scope);
      })
      .catch((error) => {
        console.warn('Registrazione Service Worker fallita:', error);
      });
  }
}

// Gestisce il prompt di installazione PWA
function setupPWAInstall() {
  const btnInstall = document.getElementById('btnInstallApp');
  if (!btnInstall) return;

  // Intercetta l'evento beforeinstallprompt del browser
  window.addEventListener('beforeinstallprompt', (e) => {
    // Impedisce la visualizzazione del mini-infobar automatico del browser
    e.preventDefault();
    // Salva l'evento per usarlo quando l'utente clicca il bottone
    deferredInstallPrompt = e;
    // Mostra il bottone "Installa App"
    btnInstall.classList.remove('hidden');
    btnInstall.classList.add('pwa-install-animate');
  });

  // Gestisce il clic sul bottone "Installa App"
  btnInstall.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;

    // Mostra il prompt di installazione nativo del browser
    deferredInstallPrompt.prompt();

    // Attende la risposta dell'utente
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('Scelta installazione PWA:', outcome);

    // Resetta il prompt (può essere usato solo una volta)
    deferredInstallPrompt = null;
    btnInstall.classList.add('hidden');
    btnInstall.classList.remove('pwa-install-animate');
  });

  // Rileva quando l'app è stata installata con successo
  window.addEventListener('appinstalled', () => {
    console.log('StepSnap installata come PWA!');
    deferredInstallPrompt = null;
    btnInstall.classList.add('hidden');
    btnInstall.classList.remove('pwa-install-animate');

    // Mostra una notifica di conferma
    const toast = document.getElementById('saveToast');
    if (toast) {
      toast.textContent = '✅ StepSnap installata come app!';
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        toast.textContent = 'Modifiche salvate!';
      }, 3000);
    }
  });
}
