import { state } from '../state.js';
import { saveCurrentSession } from '../storage/db.js';
import { escapeHtml } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/modals.js';
import { loadStepImage } from '../editor/canvas.js';
import { isCropActive } from '../editor/canvas.js';
import { disableCropMode } from '../editor/crop.js';
import { undo, redo } from '../editor/history.js';
import { stopScreenCapture } from '../capture/capture.js';
import { loadDashboard } from './dashboard.js';
import { enterScrollView, exitScrollView, highlightSidebarStep } from '../scrollview/scrollview.js';

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

export function closeWorkspace() {
  if (state.scrollViewMode) exitScrollView(true);
  state.currentSession = null;
  state.selectedStepId = null;
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
    let thumbHtml = '<div class="step-item-thumb-placeholder">📄</div>';
    if (step.image) {
      thumbHtml = `<img src="${step.image}" alt="Anteprima">`;
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
        <button class="btn-step-control delete" onclick="deleteStep('${step.id}', event)" title="Elimina passaggio">
          🗑️
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

// Cancellazione passaggio
export async function deleteStep(id, event) {
  if (event) event.stopPropagation();
  const ok = await showConfirm("Vuoi eliminare questo passaggio?", {
    confirmText: 'Elimina Passaggio',
    isDanger: true
  });
  if (ok) {
    const index = state.currentSession.steps.findIndex(s => s.id === id);
    if (index !== -1) {
      state.currentSession.steps.splice(index, 1);

      if (state.selectedStepId === id) {
        state.selectedStepId = null;
        if (state.currentSession.steps.length > 0) {
          // Seleziona il passo vicino
          const nextIndex = Math.min(index, state.currentSession.steps.length - 1);
          selectStep(state.currentSession.steps[nextIndex].id);
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
  state.currentSession.steps.push(newStep);
  renderStepsList();
  selectStep(newStep.id);
  saveCurrentSession();

  // Scroll sidebar al fondo
  const stepsList = document.getElementById('stepsList');
  stepsList.scrollTop = stepsList.scrollHeight;

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

  // Navigazione
  document.getElementById('btnDashboard').addEventListener('click', async () => {
    if (state.currentSession) {
      const ok = await showConfirm("Il tuo lavoro è salvato automaticamente. Vuoi tornare alla dashboard?", {
        confirmText: 'Torna alla Dashboard',
        cancelText: 'Rimani'
      });
      if (ok) closeWorkspace();
    } else {
      closeWorkspace();
    }
  });

  document.getElementById('btnBackToDashboard').addEventListener('click', async () => {
    const ok = await showConfirm("Il tuo lavoro è salvato automaticamente. Vuoi tornare alla dashboard?", {
      confirmText: 'Torna alla Dashboard',
      cancelText: 'Rimani'
    });
    if (ok) closeWorkspace();
  });

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
    const newStep = createNewStep();
    state.currentSession.steps.push(newStep);
    renderStepsList();
    selectStep(newStep.id);
    saveCurrentSession();

    // Auto-scroll sidebar al fondo
    const stepsList = document.getElementById('stepsList');
    stepsList.scrollTop = stepsList.scrollHeight;
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
