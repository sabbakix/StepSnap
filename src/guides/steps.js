import { state } from '../state.js';
import { saveCurrentSession, flushPendingSave, dbGetSession, dbSaveSession } from '../storage/db.js';
import { escapeHtml } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { loadStepImage } from '../editor/canvas.js';
import { isCropActive } from '../editor/canvas.js';
import { disableCropMode } from '../editor/crop.js';
import { undo, redo } from '../editor/history.js';
import { stopScreenCapture } from '../capture/capture.js';
import { stopAutoRecord } from '../capture/autorecord.js';
import { loadDashboard } from './dashboard.js';
import { enterScrollView, exitScrollView, renderScrollView, updateScrollViewStepCard, highlightSidebarStep } from '../scrollview/scrollview.js';

// AZIONI WORKSPACE
export function openWorkspace() {
  if (state.scrollViewMode) exitScrollView(true);

  document.getElementById('dashboardSection').classList.remove('active');
  document.getElementById('workspaceSection').classList.add('active');

  document.getElementById('activeGuideTitle').textContent = state.currentSession.title;
  document.getElementById('activeGuideDesc').textContent = state.currentSession.description || "Fai clic per aggiungere una descrizione del processo...";

  renderStepsList();

  if (state.currentSession.steps.length > 0) {
    // Default: scroll view
    showEmptyEditor();
    enterScrollView();
  } else {
    showEmptyEditor();
  }
}

export async function closeWorkspace() {
  if (state.scrollViewMode) exitScrollView(true);
  // Scrive subito eventuali modifiche in attesa (il salvataggio è debounced)
  await flushPendingSave();
  state.currentSession = null;
  state.selectedStepId = null;
  stopAutoRecord();
  stopScreenCapture();
  loadDashboard();
}

// CREAZIONE PASSO
export function createNewStep(imageDataUrl = null) {
  const now = new Date();
  const stepNum = state.currentSession.steps.length + 1;
  return {
    id: 'step_' + now.getTime() + '_' + Math.floor(Math.random() * 1000),
    title: `Passaggio ${stepNum}`,
    description: '',
    rawImage: imageDataUrl,
    annotations: [],
    image: imageDataUrl // All'inizio l'immagine finale coincide con l'originale
  };
}

// Segnaposto per passi senza immagine (sidebar e vista scorrimento)
export const THUMB_PLACEHOLDER_HTML = `
  <div class="step-item-thumb-placeholder">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  </div>`;

// RENDERING SIDEBAR PASSAGGI
export function renderStepsList() {
  const stepsList = document.getElementById('stepsList');
  stepsList.innerHTML = '';

  document.getElementById('stepCountBadge').textContent = state.currentSession.steps.length;

  state.currentSession.steps.forEach((step, index) => {
    const card = document.createElement('div');
    card.className = `step-item-card ${step.id === state.selectedStepId ? 'active' : ''}`;
    card.setAttribute('data-id', step.id);
    card.setAttribute('data-index', index);
    card.setAttribute('draggable', 'true');

    // Anteprima Immagine
    let thumbHtml = THUMB_PLACEHOLDER_HTML;
    if (step.image) {
      thumbHtml = `<img src="${escapeHtml(step.image)}" alt="Anteprima">`;
    }

    card.innerHTML = `
      <div class="step-drag-handle" title="Trascina per riordinare">
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
          <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
          <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
        </svg>
      </div>
      <div class="step-item-thumb" onclick="selectStep('${step.id}')">
        ${thumbHtml}
      </div>
      <div class="step-item-info" onclick="selectStep('${step.id}')">
        <span class="step-item-num">Passo ${index + 1}</span>
        <span class="step-item-title">${escapeHtml(step.title || "Passaggio vuoto")}</span>
      </div>
      <div class="step-item-actions">
        <button class="btn-step-control delete" onclick="deleteStep('${step.id}', event)" title="Elimina passaggio"
          aria-label="Elimina passaggio">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    stepsList.appendChild(card);
  });
}

// Spostamento passaggio in alto/basso
export function moveStep(index, direction) {
  const steps = state.currentSession.steps;
  const targetIndex = index + direction;

  if (targetIndex >= 0 && targetIndex < steps.length) {
    // Scambia i passi nel modello
    const temp = steps[index];
    steps[index] = steps[targetIndex];
    steps[targetIndex] = temp;

    renderStepsList();
    saveCurrentSession();
  }
}

// Cancellazione passaggio: immediata, con "Annulla" nel toast per ripristinare
export function deleteStep(id, event) {
  if (event) event.stopPropagation();

  const index = state.currentSession.steps.findIndex(s => s.id === id);
  if (index === -1) return;

  const [removed] = state.currentSession.steps.splice(index, 1);
  const sessionId = state.currentSession.id;
  const wasScrollView = state.scrollViewMode;
  const wasSelected = state.selectedStepId === id;
  if (wasSelected) state.selectedStepId = null;

  renderStepsList();

  if (state.scrollViewMode) {
    if (state.currentSession.steps.length === 0) {
      exitScrollView(true);
      showEmptyEditor();
    } else {
      renderScrollView();
    }
  } else if (wasSelected) {
    if (state.currentSession.steps.length > 0) {
      // Seleziona il passo vicino
      const nextIndex = Math.min(index, state.currentSession.steps.length - 1);
      selectStep(state.currentSession.steps[nextIndex].id);
    } else {
      showEmptyEditor();
    }
  }

  saveCurrentSession();

  showToast("Passaggio eliminato.", false, {
    actionText: 'Annulla',
    onAction: async () => {
      // Caso normale: la stessa guida è ancora aperta, ripristina in place
      if (state.currentSession && state.currentSession.id === sessionId) {
        const steps = state.currentSession.steps;
        steps.splice(Math.min(index, steps.length), 0, removed);
        renderStepsList();

        if (state.scrollViewMode) {
          renderScrollView();
        } else if (wasScrollView) {
          // La vista scorrimento era stata chiusa eliminando l'ultimo passo
          enterScrollView();
        }
        selectStep(removed.id);
        saveCurrentSession();
        return;
      }

      // Guida chiusa nel frattempo: ripristina direttamente nell'archivio locale
      const sess = await dbGetSession(sessionId);
      if (!sess) return;
      sess.steps.splice(Math.min(index, sess.steps.length), 0, removed);
      sess.updatedAt = new Date().toISOString();
      await dbSaveSession(sess);
      showToast("Passaggio ripristinato nella guida.");
      if (document.getElementById('dashboardSection').classList.contains('active')) {
        loadDashboard(); // aggiorna conteggio passi e miniatura della card
      }
    }
  });
}

// Selezione del passaggio
export function selectStep(id) {
  if (state.scrollViewMode) {
    highlightSidebarStep(id);
    const stepEl = document.querySelector(`.scroll-view-step[data-step-id="${id}"]`);
    if (stepEl) stepEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  state.selectedStepId = id;

  // Aggiorna classi attive nella sidebar
  document.querySelectorAll('.step-item-card').forEach(card => {
    if (card.getAttribute('data-id') === id) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const step = state.currentSession.steps.find(s => s.id === id);
  if (!step) return;

  // Mostra pannello editor
  document.getElementById('emptyEditorState').classList.add('hidden');
  document.getElementById('stepEditorContent').classList.remove('hidden');

  // Compila i dati di testo
  document.getElementById('stepTitleInput').value = step.title || '';
  document.getElementById('stepDescInput').value = step.description || '';

  // Esci da eventuale modalità Crop
  if (isCropActive()) {
    disableCropMode();
  }

  // Carica immagine ed inizializza editor canvas
  loadStepImage(step);
}

export function showEmptyEditor() {
  document.getElementById('emptyEditorState').classList.remove('hidden');
  document.getElementById('stepEditorContent').classList.add('hidden');
  state.selectedStepId = null;
}

// Assegna un'immagine a un passo esistente e aggiorna la vista corrente
export function setStepImage(step, dataUrl) {
  step.rawImage = dataUrl;
  step.image = dataUrl;
  step.annotations = [];

  renderStepsList();
  if (state.scrollViewMode) {
    updateScrollViewStepCard(step.id);
  } else {
    loadStepImage(step);
  }
  saveCurrentSession();
}

// Aggiunge un passo in coda e lo mostra nella vista corrente.
// La Vista Scorrimento è quella predefinita: vi si entra al primo passo creato.
export function appendStep(step) {
  state.currentSession.steps.push(step);
  renderStepsList();

  if (state.scrollViewMode) {
    renderScrollView();
  } else if (state.currentSession.steps.length === 1) {
    enterScrollView();
  }
  selectStep(step.id);
  saveCurrentSession();

  // Scroll sidebar al fondo
  const stepsList = document.getElementById('stepsList');
  stepsList.scrollTop = stepsList.scrollHeight;
}

// CATTURA IMMAGINE O UPLOAD NEL CANVAS
export function handleImageUpload(dataUrl) {
  if (!state.currentSession) {
    showToast("Crea o apri una guida prima di caricare immagini!", true);
    return;
  }

  // Se c'è un passo selezionato ed è vuoto, inserisci l'immagine lì
  if (state.selectedStepId) {
    const step = state.currentSession.steps.find(s => s.id === state.selectedStepId);
    if (step && !step.rawImage) {
      setStepImage(step, dataUrl);
      showToast("Immagine assegnata al passaggio!");
      return;
    }
  }

  // Altrimenti, crea un nuovo passo alla fine
  appendStep(createNewStep(dataUrl));
  showToast("Nuovo passaggio creato con l'immagine!");
}

// DRAG-AND-DROP RIORDINAMENTO PASSI
export function setupDragAndDrop(stepsList) {
  let dragSrcIndex = -1;

  stepsList.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.step-item-card');
    if (!card) return;
    dragSrcIndex = parseInt(card.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    // Defer the class so the drag ghost captures the normal card appearance
    setTimeout(() => card.classList.add('dragging'), 0);
  });

  stepsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.step-item-card');
    if (!card || parseInt(card.dataset.index) === dragSrcIndex) return;
    stepsList.querySelectorAll('.step-item-card.drag-over')
      .forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });

  stepsList.addEventListener('dragleave', (e) => {
    const card = e.target.closest('.step-item-card');
    if (card && !card.contains(e.relatedTarget)) card.classList.remove('drag-over');
  });

  stepsList.addEventListener('drop', (e) => {
    e.preventDefault();
    const card = e.target.closest('.step-item-card');
    if (!card) return;
    const dropIndex = parseInt(card.dataset.index);
    if (dragSrcIndex === -1 || dragSrcIndex === dropIndex) return;

    const steps = state.currentSession.steps;
    const [moved] = steps.splice(dragSrcIndex, 1);
    steps.splice(dropIndex, 0, moved);

    renderStepsList();
    saveCurrentSession();
    dragSrcIndex = -1;
  });

  stepsList.addEventListener('dragend', () => {
    stepsList.querySelectorAll('.step-item-card.dragging, .step-item-card.drag-over')
      .forEach(c => c.classList.remove('dragging', 'drag-over'));
    dragSrcIndex = -1;
  });
}

export function initSteps() {
  // Le card generate dinamicamente usano onclick inline: servono funzioni globali
  window.selectStep = selectStep;
  window.deleteStep = deleteStep;
  window.moveStep = moveStep;

  // Navigazione: il lavoro è salvato automaticamente, si torna alla dashboard senza conferme
  document.getElementById('btnDashboard').addEventListener('click', closeWorkspace);
  document.getElementById('btnBackToDashboard').addEventListener('click', closeWorkspace);
  document.getElementById('headerLogo').addEventListener('click', closeWorkspace);

  // Modifica testi live con auto-save
  const activeTitle = document.getElementById('activeGuideTitle');
  activeTitle.addEventListener('blur', () => {
    if (state.currentSession) {
      state.currentSession.title = activeTitle.textContent.trim() || "Senza Titolo";
      saveCurrentSession();
    }
  });

  const activeDesc = document.getElementById('activeGuideDesc');
  activeDesc.addEventListener('blur', () => {
    if (state.currentSession) {
      state.currentSession.description = activeDesc.textContent.trim() || "";
      saveCurrentSession();
    }
  });

  // Aggiungi passo vuoto
  document.getElementById('btnAddEmptyStep').addEventListener('click', () => {
    if (!state.currentSession) return;
    appendStep(createNewStep());
  });

  // Modifiche Dettagli Passo (Titolo, Descrizione)
  document.getElementById('stepTitleInput').addEventListener('input', (e) => {
    if (!state.currentSession || !state.selectedStepId) return;
    const step = state.currentSession.steps.find(s => s.id === state.selectedStepId);
    if (step) {
      step.title = e.target.value;

      // Aggiorna titolo nella sidebar
      const cardTitleEl = document.querySelector(`.step-item-card[data-id="${state.selectedStepId}"] .step-item-title`);
      if (cardTitleEl) {
        cardTitleEl.textContent = e.target.value || `Passo vuoto`;
      }

      saveCurrentSession();
    }
  });

  document.getElementById('stepDescInput').addEventListener('input', (e) => {
    if (!state.currentSession || !state.selectedStepId) return;
    const step = state.currentSession.steps.find(s => s.id === state.selectedStepId);
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

  // Scorciatoie tastiera: Canvas (Ctrl+Z/Y) + navigazione passi (↑↓) + cancella (Canc)
  window.addEventListener('keydown', (e) => {
    const isEditing = document.activeElement.tagName === 'INPUT' ||
                      document.activeElement.tagName === 'TEXTAREA' ||
                      document.activeElement.isContentEditable;
    if (isEditing || document.querySelector('.modal-overlay.active')) return;

    if (state.selectedStepId) {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }
    }

    if (!state.currentSession || state.currentSession.steps.length === 0 || e.ctrlKey || e.altKey) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const steps = state.currentSession.steps;
      const currentIndex = steps.findIndex(s => s.id === state.selectedStepId);
      const newIndex = e.key === 'ArrowUp'
        ? Math.max(0, currentIndex - 1)
        : Math.min(steps.length - 1, currentIndex + 1);
      if (newIndex !== currentIndex) {
        selectStep(steps[newIndex].id);
        document.querySelector(`.step-item-card[data-id="${steps[newIndex].id}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      }
    }

    if (e.key === 'Delete' && state.selectedStepId) {
      deleteStep(state.selectedStepId);
    }
  });

  setupDragAndDrop(document.getElementById('stepsList'));
}
