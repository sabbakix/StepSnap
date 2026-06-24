// CONFIGURAZIONE DATABASE LOCALE INDEXEDDB
const DB_NAME = 'StepSnapDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let db = null;
let currentSession = null;
let selectedStepId = null;

// Stato Media Recorder e Screen Sharing
let mediaStream = null;
let pipWindow = null;

// Stato Canvas Editor
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
let rawImageObj = new Image();
let annotations = [];
let undoStack = [];
let redoStack = [];

let currentTool = 'select'; // select, arrow, rect, pixel, text, crop
let currentColor = '#ef4444'; // rosso default
let currentThickness = 6;

// Stato di trascinamento/disegno sul Canvas
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// Stato Ritaglio (Crop)
let isCropping = false;
let cropX1 = 0, cropY1 = 0, cropX2 = 0, cropY2 = 0;

// PWA Install Prompt
let deferredInstallPrompt = null;

// Stato della scorciatoia da tastiera personalizzata (Ctrl + Space di default)
let hotkeyConfig = {
  ctrl: true,
  alt: false,
  shift: false,
  meta: false,
  code: 'Space',
  display: 'Ctrl + Space'
};

// INIZIALIZZAZIONE APPLICAZIONE
window.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  loadHotkeyConfig();
  setupEventListeners();
  await loadDashboard();
  checkPipSupport();
  registerServiceWorker();
  setupPWAInstall();
});

// 1. INIZIALIZZAZIONE INDEXED DB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (e) => {
      console.error("Errore IndexedDB:", e);
      reject(e);
    };
    
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// 2. FUNZIONI OPERATIVE DB
async function dbSaveSession(session) {
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(session);
    
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

async function dbGetSession(id) {
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

async function dbGetAllSessions() {
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      // Ordina per data decrescente
      const results = request.result || [];
      results.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      resolve(results);
    };
    request.onerror = (e) => reject(e);
  });
}

async function dbDeleteSession(id) {
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

// 3. GESTIONE EVENTI GENERALI
function setupEventListeners() {
  // Theme Toggle
  const themeToggle = document.getElementById('themeToggleCheckbox');
  themeToggle.addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stepSnapTheme', theme);
  });
  
  // Carica tema salvato
  const savedTheme = localStorage.getItem('stepSnapTheme') || 'light';
  themeToggle.checked = savedTheme === 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Creazione Nuova Guida
  const newGuideForm = document.getElementById('newGuideForm');
  newGuideForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('guideTitle').value.trim();
    const description = document.getElementById('guideDesc').value.trim();
    
    if (!title) return;
    
    const now = new Date();
    const session = {
      id: 'session_' + now.getTime(),
      title: title,
      description: description,
      createdAt: now.toLocaleString('it-IT'),
      updatedAt: now.toISOString(),
      steps: []
    };
    
    await dbSaveSession(session);
    currentSession = session;
    selectedStepId = null;
    
    newGuideForm.reset();
    openWorkspace();
  });

  // Navigazione
  document.getElementById('btnDashboard').addEventListener('click', async () => {
    if (currentSession) {
      if (confirm("Vuoi tornare alla dashboard? Il tuo lavoro corrente è salvato automaticamente.")) {
        closeWorkspace();
      }
    } else {
      closeWorkspace();
    }
  });

  document.getElementById('btnBackToDashboard').addEventListener('click', () => {
    if (confirm("Tornare alla dashboard?")) {
      closeWorkspace();
    }
  });

  // Gestione Modale Istruzioni
  const helpModal = document.getElementById('helpModal');
  document.getElementById('btnHelp').addEventListener('click', () => {
    helpModal.classList.add('active');
  });
  document.getElementById('btnCloseHelp').addEventListener('click', () => {
    helpModal.classList.remove('active');
  });
  document.getElementById('btnConfirmCloseHelp').addEventListener('click', () => {
    helpModal.classList.remove('active');
  });
  
  // Modifica testi live con auto-save
  const activeTitle = document.getElementById('activeGuideTitle');
  activeTitle.addEventListener('blur', () => {
    if (currentSession) {
      currentSession.title = activeTitle.textContent.trim() || "Senza Titolo";
      saveCurrentSession();
    }
  });
  
  const activeDesc = document.getElementById('activeGuideDesc');
  activeDesc.addEventListener('blur', () => {
    if (currentSession) {
      currentSession.description = activeDesc.textContent.trim() || "";
      saveCurrentSession();
    }
  });

  // Aggiungi passo vuoto
  document.getElementById('btnAddEmptyStep').addEventListener('click', () => {
    if (!currentSession) return;
    const newStep = createNewStep();
    currentSession.steps.push(newStep);
    renderStepsList();
    selectStep(newStep.id);
    saveCurrentSession();
    
    // Auto-scroll sidebar al fondo
    const stepsList = document.getElementById('stepsList');
    stepsList.scrollTop = stepsList.scrollHeight;
  });

  // Modifiche Dettagli Passo (Titolo, Descrizione)
  document.getElementById('stepTitleInput').addEventListener('input', (e) => {
    if (!currentSession || !selectedStepId) return;
    const step = currentSession.steps.find(s => s.id === selectedStepId);
    if (step) {
      step.title = e.target.value;
      
      // Aggiorna titolo nella sidebar
      const cardTitleEl = document.querySelector(`.step-item-card[data-id="${selectedStepId}"] .step-item-title`);
      if (cardTitleEl) {
        cardTitleEl.textContent = e.target.value || `Passo vuoto`;
      }
      
      saveCurrentSession();
    }
  });

  document.getElementById('stepDescInput').addEventListener('input', (e) => {
    if (!currentSession || !selectedStepId) return;
    const step = currentSession.steps.find(s => s.id === selectedStepId);
    if (step) {
      step.description = e.target.value;
      saveCurrentSession();
    }
  });

  // Sfoglia file immagine locale per il passo corrente
  document.getElementById('btnBrowseImage').addEventListener('click', () => {
    document.getElementById('stepImageFileInput').click();
  });
  
  document.getElementById('stepImageFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleImageUpload(event.target.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input file
  });

  // Incolla da appunti locale (Ctrl+V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          handleImageUpload(event.target.result);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  });

  // Gestione Drop file JSON sulla Dashboard
  const jsonUploadZone = document.getElementById('jsonUploadZone');
  jsonUploadZone.addEventListener('click', () => {
    document.getElementById('jsonFileInput').click();
  });
  
  jsonUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    jsonUploadZone.style.borderColor = 'var(--primary-color)';
    jsonUploadZone.style.backgroundColor = 'var(--primary-light)';
  });
  
  jsonUploadZone.addEventListener('dragleave', () => {
    jsonUploadZone.style.borderColor = 'var(--border-color)';
    jsonUploadZone.style.backgroundColor = 'var(--bg-color)';
  });
  
  jsonUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    jsonUploadZone.style.borderColor = 'var(--border-color)';
    jsonUploadZone.style.backgroundColor = 'var(--bg-color)';
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      importJsonProject(file);
    } else {
      alert("Carica solo file di progetto .json validi.");
    }
  });
  
  document.getElementById('jsonFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importJsonProject(file);
    }
  });

  // SCREEN CAPTURE EVENT LISTENERS
  document.getElementById('btnStartCapture').addEventListener('click', () => startScreenCapture(false));
  document.getElementById('btnStartPipInactive').addEventListener('click', () => {
    if (mediaStream) {
      startPip();
    } else {
      startScreenCapture(true);
    }
  });
  document.getElementById('btnStopCapture').addEventListener('click', stopScreenCapture);
  document.getElementById('btnSnap').addEventListener('click', () => captureScreenshot(false));
  document.getElementById('btnStartPip').addEventListener('click', startPip);

  // Scorciatoia personalizzata per catturare quando l'app ha il focus ed è attiva la registrazione
  window.addEventListener('keydown', (e) => {
    // Evita conflitti con la registrazione della scorciatoia stessa
    if (document.activeElement === document.getElementById('hotkeyInput')) {
      return;
    }
    
    // Ignora se l'utente sta scrivendo in un campo di testo
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA') {
      return;
    }
    
    const matchCtrl = e.ctrlKey === hotkeyConfig.ctrl;
    const matchAlt = e.altKey === hotkeyConfig.alt;
    const matchShift = e.shiftKey === hotkeyConfig.shift;
    const matchMeta = e.metaKey === hotkeyConfig.meta;
    const matchCode = e.code === hotkeyConfig.code;
    
    if (matchCtrl && matchAlt && matchShift && matchMeta && matchCode) {
      e.preventDefault();
      if (mediaStream) {
        captureScreenshot(false);
      } else {
        showToast("Attiva la condivisione schermo prima di scattare!", true);
      }
    }
  });

  // CANVAS TOOLBAR EVENT LISTENERS
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const toolId = btn.id;
      if (toolId === 'toolSelect') currentTool = 'select';
      else if (toolId === 'toolArrow') currentTool = 'arrow';
      else if (toolId === 'toolRect') currentTool = 'rect';
      else if (toolId === 'toolPixel') currentTool = 'pixel';
      else if (toolId === 'toolText') currentTool = 'text';
      
      // Esci da Crop se attivo
      if (isCropping) {
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
      currentColor = swatch.getAttribute('data-color');
    });
  });

  // Spessore Toolbar
  document.getElementById('lineThickness').addEventListener('change', (e) => {
    currentThickness = parseInt(e.target.value);
  });

  // Azioni Canvas Toolbar
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);
  
  // Scorciatoie tastiera standard per Canvas (Ctrl+Z / Ctrl+Y)
  window.addEventListener('keydown', (e) => {
    if (selectedStepId && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    }
  });

  document.getElementById('btnResetImage').addEventListener('click', () => {
    if (confirm("Sei sicuro di voler rimuovere tutte le annotazioni fatte su questa immagine? L'immagine originale rimarrà intatta.")) {
      annotations = [];
      pushToHistory();
      drawCanvas();
      saveFlattenedImage();
    }
  });

  // Ritaglio
  document.getElementById('btnCrop').addEventListener('click', toggleCropMode);

  // GESTIONE EVENTI MOUSE / TOUCH SUL CANVAS
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  // AZIONI DI ESPORTAZIONE
  document.getElementById('btnExportHtml').addEventListener('click', exportHtmlFile);
  document.getElementById('btnPrintPdf').addEventListener('click', printPdf);
  document.getElementById('btnExportMarkdown').addEventListener('click', exportMarkdownFile);
  document.getElementById('btnExportJson').addEventListener('click', exportJsonFile);

  // Registrazione scorciatoia personalizzata
  const hotkeyInput = document.getElementById('hotkeyInput');
  hotkeyInput.addEventListener('focus', () => {
    hotkeyInput.value = 'Premi i tasti...';
    hotkeyInput.classList.add('recording');
  });

  hotkeyInput.addEventListener('blur', () => {
    hotkeyInput.classList.remove('recording');
    hotkeyInput.value = hotkeyConfig.display;
  });

  hotkeyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const code = e.code;
    
    // Ignora tasti modificatori da soli per completare la combo
    if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight', 'CapsLock'].includes(code)) {
      const tempParts = [];
      if (e.ctrlKey) tempParts.push('Ctrl');
      if (e.altKey) tempParts.push('Alt');
      if (e.shiftKey) tempParts.push('Shift');
      if (e.metaKey) tempParts.push('Meta');
      hotkeyInput.value = tempParts.join(' + ') + ' + ...';
      return;
    }

    const ctrl = e.ctrlKey;
    const alt = e.altKey;
    const shift = e.shiftKey;
    const meta = e.metaKey;

    const parts = [];
    if (ctrl) parts.push('Ctrl');
    if (alt) parts.push('Alt');
    if (shift) parts.push('Shift');
    if (meta) parts.push('Meta');
    
    parts.push(normalizeCode(code));

    hotkeyConfig = {
      ctrl,
      alt,
      shift,
      meta,
      code,
      display: parts.join(' + ')
    };

    localStorage.setItem('stepSnapHotkey', JSON.stringify(hotkeyConfig));
    updateHotkeyDisplays();
    hotkeyInput.blur();
    showToast("Scorciatoia aggiornata: " + hotkeyConfig.display);
  });
}

// 4. CARICAMENTO DASHBOARD
async function loadDashboard() {
  document.getElementById('dashboardSection').classList.add('active');
  document.getElementById('workspaceSection').classList.remove('active');
  
  const sessions = await dbGetAllSessions();
  const grid = document.getElementById('guidesListGrid');
  grid.innerHTML = '';
  
  if (sessions.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>Nessun processo salvato in questo browser. Crea una nuova guida sopra per iniziare!</p>
      </div>
    `;
    return;
  }
  
  sessions.forEach(sess => {
    const card = document.createElement('div');
    card.className = 'guide-card-item';
    card.innerHTML = `
      <div class="guide-card-info">
        <h4>${escapeHtml(sess.title)}</h4>
        <p>${escapeHtml(sess.description || "Nessuna descrizione specificata.")}</p>
      </div>
      <div class="guide-card-meta">
        <span>Passaggi: ${sess.steps ? sess.steps.length : 0}</span>
        <span>Modificato: ${new Date(sess.updatedAt || sess.createdAt).toLocaleDateString('it-IT')}</span>
      </div>
      <div class="guide-card-actions">
        <button class="btn btn-primary btn-sm" onclick="loadSession('${sess.id}')">Modifica</button>
        <button class="btn btn-secondary-outline btn-sm btn-icon" onclick="deleteSessionConfirm('${sess.id}')" title="Elimina Guida">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Funzioni globali esterne caricate via onclick
window.loadSession = async (id) => {
  const sess = await dbGetSession(id);
  if (sess) {
    currentSession = sess;
    selectedStepId = null;
    openWorkspace();
  }
};

window.deleteSessionConfirm = async (id) => {
  if (confirm("Sei sicuro di voler eliminare questa guida permanentemente dal PC? Questa azione non può essere annullata.")) {
    await dbDeleteSession(id);
    showToast("Guida eliminata con successo!");
    await loadDashboard();
  }
};

// 5. AZIONI WORKSPACE
function openWorkspace() {
  document.getElementById('dashboardSection').classList.remove('active');
  document.getElementById('workspaceSection').classList.add('active');
  
  // Popola metadati attivi
  document.getElementById('activeGuideTitle').textContent = currentSession.title;
  document.getElementById('activeGuideDesc').textContent = currentSession.description || "Fai clic per aggiungere una descrizione del processo...";
  
  renderStepsList();
  
  // Seleziona il primo passo se esiste, altrimenti mostra stato vuoto
  if (currentSession.steps.length > 0) {
    selectStep(currentSession.steps[0].id);
  } else {
    showEmptyEditor();
  }
}

function closeWorkspace() {
  currentSession = null;
  selectedStepId = null;
  stopScreenCapture();
  loadDashboard();
}

// 6. CREAZIONE PASSO
function createNewStep(imageDataUrl = null) {
  const now = new Date();
  const stepNum = currentSession.steps.length + 1;
  return {
    id: 'step_' + now.getTime() + '_' + Math.floor(Math.random() * 1000),
    title: `Passaggio ${stepNum}`,
    description: '',
    rawImage: imageDataUrl,
    annotations: [],
    image: imageDataUrl // All'inizio l'immagine finale coincide con l'originale
  };
}

// 7. RENDERING SIDEBAR PASSAGGI
function renderStepsList() {
  const stepsList = document.getElementById('stepsList');
  stepsList.innerHTML = '';
  
  document.getElementById('stepCountBadge').textContent = currentSession.steps.length;
  
  currentSession.steps.forEach((step, index) => {
    const card = document.createElement('div');
    card.className = `step-item-card ${step.id === selectedStepId ? 'active' : ''}`;
    card.setAttribute('data-id', step.id);
    
    // Anteprima Immagine
    let thumbHtml = '<div class="step-item-thumb-placeholder">📄</div>';
    if (step.image) {
      thumbHtml = `<img src="${step.image}" alt="Anteprima">`;
    }
    
    card.innerHTML = `
      <div class="step-item-thumb" onclick="selectStep('${step.id}')">
        ${thumbHtml}
      </div>
      <div class="step-item-info" onclick="selectStep('${step.id}')">
        <span class="step-item-num">Passo ${index + 1}</span>
        <span class="step-item-title">${escapeHtml(step.title || "Passaggio vuoto")}</span>
      </div>
      <div class="step-item-actions">
        <button class="btn-step-control" onclick="moveStep(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Sposta su">
          ▲
        </button>
        <button class="btn-step-control" onclick="moveStep(${index}, 1)" ${index === currentSession.steps.length - 1 ? 'disabled' : ''} title="Sposta giù">
          ▼
        </button>
        <button class="btn-step-control delete" onclick="deleteStep('${step.id}', event)" title="Elimina passaggio">
          🗑️
        </button>
      </div>
    `;
    stepsList.appendChild(card);
  });
}

// Spostamento passaggio in alto/basso
window.moveStep = (index, direction) => {
  const steps = currentSession.steps;
  const targetIndex = index + direction;
  
  if (targetIndex >= 0 && targetIndex < steps.length) {
    // Scambia i passi nel modello
    const temp = steps[index];
    steps[index] = steps[targetIndex];
    steps[targetIndex] = temp;
    
    renderStepsList();
    saveCurrentSession();
  }
};

// Cancellazione passaggio
window.deleteStep = (id, event) => {
  if (event) event.stopPropagation();
  if (confirm("Vuoi eliminare questo passaggio?")) {
    const index = currentSession.steps.findIndex(s => s.id === id);
    if (index !== -1) {
      currentSession.steps.splice(index, 1);
      
      if (selectedStepId === id) {
        selectedStepId = null;
        if (currentSession.steps.length > 0) {
          // Seleziona il passo vicino
          const nextIndex = Math.min(index, currentSession.steps.length - 1);
          selectStep(currentSession.steps[nextIndex].id);
        } else {
          showEmptyEditor();
        }
      } else {
        renderStepsList();
      }
      
      saveCurrentSession();
      showToast("Passaggio eliminato.");
    }
  }
};

// Selezione del passaggio
window.selectStep = (id) => {
  selectedStepId = id;
  
  // Aggiorna classi attive nella sidebar
  document.querySelectorAll('.step-item-card').forEach(card => {
    if (card.getAttribute('data-id') === id) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const step = currentSession.steps.find(s => s.id === id);
  if (!step) return;

  // Mostra pannello editor
  document.getElementById('emptyEditorState').classList.add('hidden');
  document.getElementById('stepEditorContent').classList.remove('hidden');

  // Compila i dati di testo
  document.getElementById('stepTitleInput').value = step.title || '';
  document.getElementById('stepDescInput').value = step.description || '';

  // Esci da eventuale modalità Crop
  if (isCropping) {
    disableCropMode();
  }

  // Carica immagine ed inizializza editor canvas
  loadStepImage(step);
};

function showEmptyEditor() {
  document.getElementById('emptyEditorState').classList.remove('hidden');
  document.getElementById('stepEditorContent').classList.add('hidden');
  selectedStepId = null;
}

// 8. CATTURA IMMAGINE O UPLOAD NEL CANVAS
function handleImageUpload(dataUrl) {
  if (!currentSession) {
    showToast("Crea o apri una guida prima di caricare immagini!", true);
    return;
  }

  // Se c'è un passo selezionato ed è vuoto, inserisci l'immagine lì
  if (selectedStepId) {
    const step = currentSession.steps.find(s => s.id === selectedStepId);
    if (step && !step.rawImage) {
      step.rawImage = dataUrl;
      step.image = dataUrl;
      step.annotations = [];
      loadStepImage(step);
      renderStepsList();
      saveCurrentSession();
      showToast("Immagine assegnata al passaggio!");
      return;
    }
  }

  // Altrimenti, crea un nuovo passo alla fine
  const newStep = createNewStep(dataUrl);
  currentSession.steps.push(newStep);
  renderStepsList();
  selectStep(newStep.id);
  saveCurrentSession();

  // Scroll sidebar al fondo
  const stepsList = document.getElementById('stepsList');
  stepsList.scrollTop = stepsList.scrollHeight;

  showToast("Nuovo passaggio creato con l'immagine!");
}

// 9. CARICAMENTO IMMAGINE SUL CANVAS ED EDITOR GRAFICO
function loadStepImage(step) {
  if (!step.rawImage) {
    // Mostra placeholder
    document.getElementById('canvasPlaceholder').classList.remove('hidden');
    document.getElementById('canvasContainer').classList.add('hidden');
    return;
  }

  document.getElementById('canvasPlaceholder').classList.add('hidden');
  document.getElementById('canvasContainer').classList.remove('hidden');

  rawImageObj = new Image();
  rawImageObj.onload = () => {
    // Imposta dimensioni interne del canvas a quelle reali dell'immagine
    canvas.width = rawImageObj.naturalWidth;
    canvas.height = rawImageObj.naturalHeight;

    // Ripristina annotazioni e history
    annotations = step.annotations || [];
    undoStack = [JSON.parse(JSON.stringify(annotations))];
    redoStack = [];
    updateUndoRedoButtons();
    
    drawCanvas();
  };
  rawImageObj.src = step.rawImage;
}

// Ridisegna l'intero Canvas
function drawCanvas() {
  if (!rawImageObj.src) return;
  
  // Svuota
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 1. Disegna screenshot originale
  ctx.drawImage(rawImageObj, 0, 0);
  
  // 2. Disegna tutte le annotazioni esistenti in ordine cronologico
  annotations.forEach(shape => {
    drawShape(ctx, shape);
  });
  
  // 3. Se l'utente sta disegnando attivamente, disegna la sagoma del tracciato in tempo reale
  if (isDrawing) {
    if (isCropping) {
      drawCropOverlay(ctx, startX, startY, currentX, currentY);
    } else {
      const activeShape = {
        type: currentTool,
        x1: startX,
        y1: startY,
        x2: currentX,
        y2: currentY,
        color: currentColor,
        width: currentThickness
      };
      drawShape(ctx, activeShape);
    }
  }
}

// Disegna una singola forma
function drawShape(targetCtx, shape) {
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
function drawArrow(targetCtx, fromx, fromy, tox, toy, color, width) {
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
function pixelateArea(targetCtx, x, y, w, h, pixelSize = 14) {
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

// 10. MOUSE EVENTS SUL CANVAS (DISEGNO INTERATTIVO)
function getCanvasMouseCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  if (currentTool === 'select' && !isCropping) return;
  
  const coords = getCanvasMouseCoords(e);
  startX = coords.x;
  startY = coords.y;
  currentX = coords.x;
  currentY = coords.y;
  
  isDrawing = true;
  
  if (currentTool === 'text') {
    isDrawing = false;
    const txt = prompt("Inserisci il testo da posizionare:");
    if (txt && txt.trim()) {
      annotations.push({
        type: 'text',
        x1: startX,
        y1: startY,
        text: txt.trim(),
        color: currentColor,
        width: currentThickness
      });
      pushToHistory();
      drawCanvas();
      saveFlattenedImage();
    }
  }
}

function draw(e) {
  if (!isDrawing) return;
  
  const coords = getCanvasMouseCoords(e);
  currentX = coords.x;
  currentY = coords.y;
  
  drawCanvas();
}

function stopDrawing(e) {
  if (!isDrawing) return;
  isDrawing = false;
  
  const coords = getCanvasMouseCoords(e);
  currentX = coords.x;
  currentY = coords.y;
  
  if (isCropping) {
    // Salva le coordinate del box di ritaglio
    cropX1 = startX;
    cropY1 = startY;
    cropX2 = currentX;
    cropY2 = currentY;
    return;
  }
  
  // Evita piccoli trascinamenti accidentali o punti minuscoli
  const dist = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
  if (dist < 4) return;
  
  // Salva l'annotazione
  annotations.push({
    type: currentTool,
    x1: startX,
    y1: startY,
    x2: currentX,
    y2: currentY,
    color: currentColor,
    width: currentThickness
  });
  
  pushToHistory();
  drawCanvas();
  saveFlattenedImage();
}

// 11. UNDO / REDO / FLATTEN
function pushToHistory() {
  undoStack.push(JSON.parse(JSON.stringify(annotations)));
  redoStack = []; // Resetta redo
  updateUndoRedoButtons();
}

function undo() {
  if (undoStack.length > 1) {
    const current = undoStack.pop();
    redoStack.push(current);
    annotations = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
    drawCanvas();
    saveFlattenedImage();
    updateUndoRedoButtons();
  } else if (undoStack.length === 1) {
    // Ritorna allo stato iniziale (senza annotazioni)
    const current = undoStack.pop();
    redoStack.push(current);
    annotations = [];
    drawCanvas();
    saveFlattenedImage();
    updateUndoRedoButtons();
  }
}

function redo() {
  if (redoStack.length > 0) {
    const next = redoStack.pop();
    undoStack.push(next);
    annotations = JSON.parse(JSON.stringify(next));
    drawCanvas();
    saveFlattenedImage();
    updateUndoRedoButtons();
  }
}

function updateUndoRedoButtons() {
  document.getElementById('btnUndo').disabled = undoStack.length <= 0;
  document.getElementById('btnRedo').disabled = redoStack.length <= 0;
}

function saveFlattenedImage() {
  if (!currentSession || !selectedStepId) return;
  const step = currentSession.steps.find(s => s.id === selectedStepId);
  if (!step) return;
  
  step.annotations = [...annotations];
  
  // Esporta il contenuto attuale del canvas come immagine finale
  const dataUrl = canvas.toDataURL('image/png');
  step.image = dataUrl;
  
  saveCurrentSession();
  
  // Aggiorna anteprima miniatura sidebar
  const cardThumb = document.querySelector(`.step-item-card[data-id="${selectedStepId}"] .step-item-thumb`);
  if (cardThumb) {
    cardThumb.innerHTML = `<img src="${dataUrl}" alt="Anteprima">`;
  }
}

// 12. RITAGLIO (CROP) INTERATTIVO
function toggleCropMode() {
  const btn = document.getElementById('btnCrop');
  
  if (!isCropping) {
    // Attiva Crop
    isCropping = true;
    currentTool = 'crop';
    btn.innerHTML = '✔️ Conferma';
    btn.classList.add('active');
    
    // Disattiva gli altri strumenti
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    
    // Resetta coordinate
    cropX1 = cropY1 = cropX2 = cropY2 = 0;
    
    drawCanvas();
    showToast("Modalità Ritaglio: trascina per selezionare la zona e clicca 'Conferma'");
  } else {
    // Applica Ritaglio se l'area è definita
    if (cropX1 !== cropX2 && cropY1 !== cropY2) {
      applyCrop(cropX1, cropY1, cropX2, cropY2);
    } else {
      disableCropMode();
      showToast("Ritaglio annullato (nessuna area selezionata).");
    }
  }
}

function disableCropMode() {
  isCropping = false;
  currentTool = 'select';
  
  const btn = document.getElementById('btnCrop');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>
    Ritaglia
  `;
  btn.classList.remove('active');
  document.getElementById('toolSelect').classList.add('active');
  drawCanvas();
}

function drawCropOverlay(targetCtx, x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  
  // Sfondo scurito semi-trasparente
  targetCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  
  // Rettangolo superiore
  targetCtx.fillRect(0, 0, canvas.width, y);
  // Rettangolo inferiore
  targetCtx.fillRect(0, y + h, canvas.width, canvas.height - (y + h));
  // Rettangolo sinistro
  targetCtx.fillRect(0, y, x, h);
  // Rettangolo destro
  targetCtx.fillRect(x + w, y, canvas.width - (x + w), h);
  
  // Bordo bianco tratteggiato dell'area di taglio
  targetCtx.strokeStyle = '#ffffff';
  targetCtx.lineWidth = 2;
  targetCtx.setLineDash([6, 6]);
  targetCtx.strokeRect(x, y, w, h);
  targetCtx.setLineDash([]); // Ripristina linea continua
}

function applyCrop(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  
  if (w < 10 || h < 10) {
    alert("Area selezionata troppo piccola per il ritaglio.");
    disableCropMode();
    return;
  }
  
  // Ritaglia partendo dall'immagine originale (senza annotazioni vecchie)
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = w;
  cropCanvas.height = h;
  const cropCtx = cropCanvas.getContext('2d');
  
  cropCtx.drawImage(rawImageObj, x, y, w, h, 0, 0, w, h);
  const croppedDataUrl = cropCanvas.toDataURL('image/png');
  
  // Salva nel modello del passo corrente
  const step = currentSession.steps.find(s => s.id === selectedStepId);
  if (step) {
    step.rawImage = croppedDataUrl;
    step.image = croppedDataUrl;
    // Rimuove vecchie annotazioni perché le coordinate cambiano
    step.annotations = [];
    annotations = [];
    
    // Ricarica immagine ritagliata
    rawImageObj = new Image();
    rawImageObj.onload = () => {
      canvas.width = rawImageObj.naturalWidth;
      canvas.height = rawImageObj.naturalHeight;
      undoStack = [[]];
      redoStack = [];
      updateUndoRedoButtons();
      drawCanvas();
      saveFlattenedImage();
      showToast("Immagine ritagliata. Le annotazioni precedenti sono state rimosse.");
    };
    rawImageObj.src = croppedDataUrl;
  }
  
  disableCropMode();
}

// 13. SCREEN CAPTURE (MEDIA DEVICES API)
async function startScreenCapture(autoStartPip = false) {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "monitor",
      },
      audio: false
    });
    
    const video = document.getElementById('streamVideo');
    video.srcObject = mediaStream;
    video.onloadedmetadata = () => {
      video.play();
    };
    
    // Gestione chiusura della condivisione dall'overlay del browser
    mediaStream.getVideoTracks()[0].onended = () => {
      stopScreenCapture();
    };
    
    document.getElementById('captureInactive').classList.add('hidden');
    document.getElementById('captureActive').classList.remove('hidden');
    showToast("Schermo connesso! Clicca 'Cattura Passo' o premi Barra Spaziatrice.");
    
    // Se richiesto, avvia automaticamente il PiP fluttuante
    if (autoStartPip === true) {
      setTimeout(() => {
        startPip();
      }, 500);
    }
  } catch (err) {
    console.error("Errore condivisione schermo:", err);
    alert("Impossibile accedere allo schermo. Permesso negato o non supportato.");
  }
}

function stopScreenCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  const video = document.getElementById('streamVideo');
  video.srcObject = null;
  
  document.getElementById('captureInactive').classList.remove('hidden');
  document.getElementById('captureActive').classList.add('hidden');
  
  if (pipWindow) {
    pipWindow.close();
    pipWindow = null;
  }
  
  showToast("Condivisione schermo disattivata.");
}

function captureScreenshot(fromPip = false) {
  if (!mediaStream) return;
  
  const video = document.getElementById('streamVideo');
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
  
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = video.videoWidth;
  snapCanvas.height = video.videoHeight;
  const snapCtx = snapCanvas.getContext('2d');
  
  // Scatta fotogramma
  snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
  const dataUrl = snapCanvas.toDataURL('image/png');
  
  if (fromPip) {
    // In PiP mode, aggiunge SEMPRE come nuovo passaggio alla fine per flusso continuo
    const newStep = createNewStep(dataUrl);
    currentSession.steps.push(newStep);
    renderStepsList();
    selectStep(newStep.id);
    saveCurrentSession();
    
    // Auto-scroll sidebar al fondo
    const stepsList = document.getElementById('stepsList');
    stepsList.scrollTop = stepsList.scrollHeight;
    
    // Aggiorna contatore nella finestra PiP
    if (pipWindow) {
      const counterEl = pipWindow.document.getElementById('pipCounter');
      if (counterEl) {
        counterEl.textContent = `Passi acquisiti: ${currentSession.steps.length}`;
      }
    }
    
    showToast("Nuovo passo acquisito via PiP fluttuante!");
  } else {
    // In app principale: se c'è un passo selezionato VUOTO, inserisci lì. Altrimenti crea nuovo.
    if (selectedStepId) {
      const step = currentSession.steps.find(s => s.id === selectedStepId);
      if (step) {
        if (!step.rawImage || confirm("Vuoi sostituire l'immagine attuale di questo passaggio con il nuovo screenshot?")) {
          step.rawImage = dataUrl;
          step.image = dataUrl;
          step.annotations = [];
          loadStepImage(step);
          renderStepsList();
          saveCurrentSession();
          showToast("Schermata salvata nel passaggio selezionato!");
        }
        return;
      }
    }
    
    // Altrimenti crea nuovo
    const newStep = createNewStep(dataUrl);
    currentSession.steps.push(newStep);
    renderStepsList();
    selectStep(newStep.id);
    saveCurrentSession();
    showToast("Catturato screenshot per un nuovo passaggio!");
  }
}

// 14. DOCUMENT PICTURE-IN-PICTURE (FINESTRA FLUTTUANTE SEMPRE IN PRIMO PIANO)
function checkPipSupport() {
  const btn = document.getElementById('btnStartPip');
  if (!('documentPictureInPicture' in window)) {
    btn.disabled = true;
    btn.title = "Non supportato su questo browser (Usa Edge o Chrome)";
  }
}

async function startPip() {
  if (!('documentPictureInPicture' in window)) {
    alert("La finestra fluttuante PiP non è supportata da questo browser. Si consiglia l'uso di Google Chrome o Microsoft Edge su Windows.");
    return;
  }
  
  if (pipWindow) {
    pipWindow.close();
    return;
  }
  
  if (!mediaStream) {
    alert("Avvia prima la condivisione dello schermo/finestra a sinistra.");
    return;
  }

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
        <div class="pip-counter" id="pipCounter">Passi acquisiti: ${currentSession.steps.length}</div>
        <button class="pip-close-btn" id="pipCloseBtn">Ripristina</button>
      </div>
    `;

    // Aggiungi ascoltatori eventi nella finestra PiP
    pipWindow.document.getElementById('pipSnapBtn').addEventListener('click', () => {
      captureScreenshot(true);
    });

    pipWindow.document.getElementById('pipCloseBtn').addEventListener('click', () => {
      pipWindow.close();
    });

    // Alla chiusura ripristina lo stato
    pipWindow.addEventListener('pagehide', () => {
      pipWindow = null;
    });

    showToast("Finestra fluttuante aperta! Spostala sopra l'app che vuoi documentare.");
  } catch (err) {
    console.error("Errore apertura Picture-in-Picture:", err);
    alert("Impossibile aprire la finestra fluttuante.");
  }
}

// 15. AUTO-SALVATAGGIO E NOTIFICHE TOAST
let saveTimeout = null;

function saveCurrentSession() {
  if (!currentSession) return;
  
  // Aggiorna timestamp
  currentSession.updatedAt = new Date().toISOString();
  
  // Mostra stato nel badge "Salvataggio in corso..."
  const indicator = document.getElementById('autoSaveIndicator');
  const dot = indicator.querySelector('.status-dot');
  dot.classList.add('saving');
  indicator.innerHTML = `<span class="status-dot saving"></span> Salvataggio in corso...`;
  
  // Debounce salvataggio su database locale per prestazioni ottimali
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await dbSaveSession(currentSession);
    
    // Ripristina badge salvato
    const activeIndicator = document.getElementById('autoSaveIndicator');
    activeIndicator.innerHTML = `<span class="status-dot"></span> Salvato in locale`;
  }, 500);
}

function showToast(message, isError = false) {
  const toast = document.getElementById('saveToast');
  toast.textContent = message;
  
  if (isError) {
    toast.style.backgroundColor = 'var(--danger-color)';
    toast.style.color = '#ffffff';
  } else {
    toast.style.backgroundColor = 'var(--text-primary)';
    toast.style.color = 'var(--bg-color)';
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// 16. EXPORTS ED IMPORTAZIONI
// Esporta file JSON di progetto modificabile
function exportJsonFile() {
  if (!currentSession) return;
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentSession));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  
  // Normalizza nome file
  const filename = currentSession.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_progetto.json';
  downloadAnchor.setAttribute("download", filename);
  downloadAnchor.click();
  showToast("File di progetto JSON scaricato!");
}

// Importa file JSON di progetto
function importJsonProject(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const session = JSON.parse(e.target.result);
      
      // Controllo validità minimale
      if (session.id && session.title && Array.isArray(session.steps)) {
        session.updatedAt = new Date().toISOString();
        await dbSaveSession(session);
        currentSession = session;
        selectedStepId = null;
        
        openWorkspace();
        showToast("Progetto importato con successo!");
      } else {
        alert("Struttura del file JSON non valida. Assicurati che sia un progetto esportato da StepSnap.");
      }
    } catch (err) {
      console.error("Errore importazione JSON:", err);
      alert("Impossibile leggere il file JSON. Assicurati che non sia corrotto.");
    }
  };
  reader.readAsText(file);
}

// Esporta un singolo HTML autonomo con immagini base64
function exportHtmlFile() {
  if (!currentSession) return;
  if (currentSession.steps.length === 0) {
    alert("Aggiungi almeno un passaggio con un'immagine per esportare la guida.");
    return;
  }
  
  let stepsHtml = '';
  currentSession.steps.forEach((step, index) => {
    const descHtml = parseMarkdown(step.description);
    const imgHtml = step.image 
      ? `<div class="step-image"><img src="${step.image}" alt="Passo ${index + 1}"></div>`
      : '<div class="step-image-empty">Nessuna schermata associata.</div>';
      
    stepsHtml += `
      <div class="step-card">
        <div class="step-header">
          <span class="step-number">Passo ${index + 1}</span>
          <h2 class="step-title">${escapeHtml(step.title || `Passo ${index + 1}`)}</h2>
        </div>
        ${step.description ? `<div class="step-description">${descHtml}</div>` : ''}
        ${imgHtml}
      </div>
    `;
  });
  
  const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(currentSession.title)} - Guida di Processo</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #7c3aed;
      --bg: #f8fafc;
      --text: #0f172a;
      --text-muted: #475569;
      --card-bg: #ffffff;
      --border: #cbd5e1;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 40px 20px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    header {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    
    h1 {
      color: var(--primary);
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      border-bottom: 2px solid #ddd6fe;
      padding-bottom: 12px;
    }
    
    .desc {
      color: var(--text-muted);
      font-size: 15px;
      margin-bottom: 20px;
      white-space: pre-wrap;
    }
    
    .meta {
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
    }
    
    .step-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .step-number {
      background-color: #f5f3ff;
      color: var(--primary);
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid #ddd6fe;
    }
    
    .step-title {
      font-size: 20px;
      font-weight: 700;
    }
    
    .step-description {
      font-size: 14px;
      color: #334155;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    
    .step-description ul, .step-description ol {
      padding-left: 20px;
      margin: 10px 0;
    }
    
    .step-description li {
      margin-bottom: 6px;
    }
    
    .step-image {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f1f5f9;
    }
    
    .step-image img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    .step-image-empty {
      padding: 20px;
      text-align: center;
      background-color: #f1f5f9;
      border: 1px dashed var(--border);
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 13px;
    }
    
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .step-card {
        box-shadow: none;
        border-color: #cbd5e1;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(currentSession.title)}</h1>
      <p class="desc">${escapeHtml(currentSession.description || '')}</p>
      <div class="meta">
        <span>Creato il: ${escapeHtml(currentSession.createdAt)}</span>
        <span>Passaggi totali: ${currentSession.steps.length}</span>
      </div>
    </header>
    
    ${stepsHtml}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", url);
  
  const filename = currentSession.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_guida.html';
  downloadAnchor.setAttribute("download", filename);
  downloadAnchor.click();
  
  URL.revokeObjectURL(url);
  showToast("Guida esportata come HTML Autonomo!");
}

// Esporta come Markdown con immagini incorporate in Base64
function exportMarkdownFile() {
  if (!currentSession) return;
  
  let md = `# ${currentSession.title}\n\n`;
  if (currentSession.description) {
    md += `${currentSession.description}\n\n`;
  }
  
  md += `*   **Data Creazione:** ${currentSession.createdAt}\n`;
  md += `*   **Passaggi totali:** ${currentSession.steps.length}\n\n`;
  md += `---\n\n`;
  
  currentSession.steps.forEach((step, index) => {
    md += `## Passo ${index + 1}: ${step.title || `Passaggio ${index + 1}`}\n\n`;
    if (step.description) {
      md += `${step.description}\n\n`;
    }
    if (step.image) {
      md += `![Passo ${index + 1}](${step.image})\n\n`;
    } else {
      md += `*(Nessuna schermata associata a questo passaggio)*\n\n`;
    }
    md += `---\n\n`;
  });
  
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", url);
  
  const filename = currentSession.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_guida.md';
  downloadAnchor.setAttribute("download", filename);
  downloadAnchor.click();
  
  URL.revokeObjectURL(url);
  showToast("Guida esportata come file Markdown!");
}

// Stampa come PDF
function printPdf() {
  if (!currentSession) return;
  
  // Genera dinamicamente il layout di stampa pulito
  const printLayout = document.getElementById('printLayout');
  printLayout.innerHTML = '';
  
  const header = document.createElement('div');
  header.className = 'print-header';
  header.innerHTML = `
    <h1>${escapeHtml(currentSession.title)}</h1>
    <p>${escapeHtml(currentSession.description || "Nessuna descrizione del processo fornita.")}</p>
    <div style="font-size: 11px; color: #666; margin-top: 10px; display: flex; justify-content: space-between;">
      <span>Data Documentazione: ${currentSession.createdAt}</span>
      <span>Passaggi totali: ${currentSession.steps.length}</span>
    </div>
  `;
  printLayout.appendChild(header);
  
  currentSession.steps.forEach((step, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'print-step-item';
    
    const descHtml = parseMarkdown(step.description);
    const imgHtml = step.image 
      ? `<div class="print-step-img-container"><img src="${step.image}" alt="Passo ${index + 1}"></div>`
      : '<div style="padding: 10px; border: 1px dashed #ccc; text-align: center; color: #666; font-size: 12px;">Nessuna schermata.</div>';
      
    stepEl.innerHTML = `
      <div class="print-step-header">
        <span class="print-step-num">Passo ${index + 1}</span>
        <span class="print-step-title">${escapeHtml(step.title || `Passaggio ${index + 1}`)}</span>
      </div>
      ${step.description ? `<div class="print-step-desc">${descHtml}</div>` : ''}
      ${imgHtml}
    `;
    printLayout.appendChild(stepEl);
  });
  
  // Avvia dialogo stampa nativo
  window.print();
}

// 17. UTILITY HELPER FUNCTIONS
function escapeHtml(string) {
  const str = string ? String(string) : '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function hexToRgba(hex, alpha) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
  }
  return `rgba(239, 68, 68, ${alpha})`;
}

// Regex Markdown Parser elementare per formattare elenchi e grassetti nelle descrizioni
function parseMarkdown(text) {
  if (!text) return '';
  
  // Escapa caratteri HTML sensibili
  let html = escapeHtml(text);
  
  // Grassetti: **testo**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Corsivi: *testo*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Elenchi puntati: - testo
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  // Sostituisce i ritorni a capo per visualizzarli in HTML
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// FUNZIONI DI GESTIONE SCORCIATOIE TASTIERA
function loadHotkeyConfig() {
  const savedHotkey = localStorage.getItem('stepSnapHotkey');
  if (savedHotkey) {
    try {
      hotkeyConfig = JSON.parse(savedHotkey);
    } catch(e) {
      console.error(e);
    }
  }
  updateHotkeyDisplays();
}

function updateHotkeyDisplays() {
  const hotkeyDisplay = document.getElementById('hotkeyDisplay');
  if (hotkeyDisplay) {
    hotkeyDisplay.textContent = hotkeyConfig.display;
  }
  const hotkeyInput = document.getElementById('hotkeyInput');
  if (hotkeyInput) {
    hotkeyInput.value = hotkeyConfig.display;
  }
}

function normalizeCode(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.substring(3);
  if (code.startsWith('Digit')) return code.substring(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.substring(6);
  if (code === 'Space') return 'Space';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  return code;
}

// ========================================
// PROGRESSIVE WEB APP (PWA) SUPPORT
// ========================================

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
