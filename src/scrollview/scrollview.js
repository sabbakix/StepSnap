import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { saveCurrentSession } from '../storage/db.js';
import { selectStep, showEmptyEditor, THUMB_PLACEHOLDER_HTML } from '../guides/steps.js';
import { saveFlattenedImage } from '../editor/canvas.js';

// Stato interno Vista Scorrimento
let scrollViewScrollHandler = null;
let scrollSpyRafId = null;

// Stato Overlay Modifica Immagine (Vista Scorrimento)
let svEditStepId = null;
let svEditOriginalParent = null;

// VISTA SCORRIMENTO
export function enterScrollView() {
  if (!state.currentSession || state.currentSession.steps.length === 0) {
    showToast("Aggiungi almeno un passaggio per usare la Vista Scorrimento.", true);
    return;
  }

  state.scrollViewMode = true;

  const btn = document.getElementById('btnToggleScrollView');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    Vista Modifica`;
  btn.classList.add('btn-scroll-view-active');

  document.getElementById('emptyEditorState').classList.add('hidden');
  document.getElementById('stepEditorContent').classList.add('hidden');

  renderScrollView();

  // Event delegation for inline editing and image button
  const container = document.getElementById('scrollViewContainer');
  container.addEventListener('input', onScrollViewInput);
  container.addEventListener('click', onScrollViewClick);

  const editorEl = document.getElementById('workspaceEditor');
  scrollViewScrollHandler = () => {
    if (scrollSpyRafId) cancelAnimationFrame(scrollSpyRafId);
    scrollSpyRafId = requestAnimationFrame(updateScrollSpy);
  };
  editorEl.addEventListener('scroll', scrollViewScrollHandler, { passive: true });

  // Highlight the first (or currently selected) step
  const firstId = state.selectedStepId || state.currentSession.steps[0].id;
  highlightSidebarStep(firstId);
}

export function exitScrollView(silent = false) {
  state.scrollViewMode = false;

  const btn = document.getElementById('btnToggleScrollView');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
    Vista Scorrimento`;
  btn.classList.remove('btn-scroll-view-active');

  const editorEl = document.getElementById('workspaceEditor');
  if (scrollViewScrollHandler) {
    editorEl.removeEventListener('scroll', scrollViewScrollHandler);
    scrollViewScrollHandler = null;
  }
  if (scrollSpyRafId) { cancelAnimationFrame(scrollSpyRafId); scrollSpyRafId = null; }

  const container = document.getElementById('scrollViewContainer');
  container.removeEventListener('input', onScrollViewInput);
  container.removeEventListener('click', onScrollViewClick);
  container.classList.add('hidden');
  container.innerHTML = '';

  if (!silent) {
    if (state.selectedStepId) {
      selectStep(state.selectedStepId);
    } else {
      showEmptyEditor();
    }
  }
}

export function renderScrollView() {
  const container = document.getElementById('scrollViewContainer');
  container.innerHTML = '';
  container.classList.remove('hidden');

  state.currentSession.steps.forEach((step, index) => {
    const el = document.createElement('div');
    el.className = 'scroll-view-step';
    el.dataset.stepId = step.id;

    const imgSection = step.image
      ? `<div class="scroll-view-img-wrapper">
           <img src="${escapeHtml(step.image)}" alt="Passo ${index + 1}">
           <button class="btn btn-secondary btn-sm scroll-view-edit-img-btn" data-id="${step.id}">
             <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
             </svg>
             Modifica annotazioni
           </button>
         </div>`
      : `<div class="scroll-view-no-img-area">
           <span>Nessuna schermata</span>
           <button class="btn btn-secondary btn-sm scroll-view-edit-img-btn" data-id="${step.id}">+ Aggiungi immagine</button>
         </div>`;

    el.innerHTML = `
      <div class="scroll-view-step-header">
        <span class="scroll-view-step-num">Passo ${index + 1}</span>
        <input class="scroll-view-title-input" type="text"
          value="${escapeHtml(step.title || '')}"
          placeholder="Titolo passaggio…">
      </div>
      <textarea class="scroll-view-desc-input"
        placeholder="Descrizione del passaggio…">${escapeHtml(step.description || '')}</textarea>
      ${imgSection}
    `;

    container.appendChild(el);
  });

  // Auto-resize all textareas to fit their initial content
  container.querySelectorAll('.scroll-view-desc-input').forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
}

function onScrollViewInput(e) {
  const stepEl = e.target.closest('.scroll-view-step');
  if (!stepEl) return;
  const step = state.currentSession.steps.find(s => s.id === stepEl.dataset.stepId);
  if (!step) return;

  if (e.target.classList.contains('scroll-view-title-input')) {
    step.title = e.target.value;
    const cardTitle = document.querySelector(`.step-item-card[data-id="${step.id}"] .step-item-title`);
    if (cardTitle) cardTitle.textContent = e.target.value || 'Passaggio vuoto';
  }

  if (e.target.classList.contains('scroll-view-desc-input')) {
    step.description = e.target.value;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  saveCurrentSession();
}

function onScrollViewClick(e) {
  const btn = e.target.closest('.scroll-view-edit-img-btn');
  if (!btn) return;
  openSvImageEditor(btn.dataset.id);
}

export function highlightSidebarStep(id) {
  if (state.selectedStepId === id) return;
  state.selectedStepId = id;
  document.querySelectorAll('.step-item-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-id') === id);
  });
  document.querySelector(`.step-item-card[data-id="${id}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}

function openSvImageEditor(stepId) {
  const step = state.currentSession.steps.find(s => s.id === stepId);
  if (!step) return;

  svEditStepId = stepId;

  // Move #stepEditorContent into overlay slot (keeps all event listeners)
  const editorContent = document.getElementById('stepEditorContent');
  svEditOriginalParent = editorContent.parentNode;
  document.getElementById('svEditorSlot').appendChild(editorContent);

  // Update header labels
  const idx = state.currentSession.steps.indexOf(step);
  document.getElementById('svEditStepNum').textContent = `Passo ${idx + 1}`;
  document.getElementById('svEditStepTitle').textContent = step.title || '';

  // Show overlay
  document.getElementById('svEditOverlay').classList.remove('hidden');

  // Load step into canvas, bypassing the scrollViewMode guard
  state.scrollViewMode = false;
  selectStep(stepId);
  state.scrollViewMode = true;
}

function closeSvImageEditor() {
  // Only flush canvas to step.image if the canvas has actual content
  // (avoids writing a blank PNG when the step has no image yet)
  if (!document.getElementById('canvasContainer').classList.contains('hidden')) {
    saveFlattenedImage();
  }

  // Update the image card in the scroll view
  updateScrollViewStepCard(svEditStepId);

  // Move #stepEditorContent back to its original parent
  const editorContent = document.getElementById('stepEditorContent');
  editorContent.classList.add('hidden');
  if (svEditOriginalParent) svEditOriginalParent.appendChild(editorContent);

  // Hide overlay
  document.getElementById('svEditOverlay').classList.add('hidden');

  svEditStepId = null;
  svEditOriginalParent = null;
}

export function updateScrollViewStepCard(stepId) {
  const step = state.currentSession.steps.find(s => s.id === stepId);
  if (!step) return;

  const card = document.querySelector(`.scroll-view-step[data-step-id="${stepId}"]`);
  if (!card) return;

  const idx = state.currentSession.steps.indexOf(step);
  const oldSection = card.querySelector('.scroll-view-img-wrapper, .scroll-view-no-img-area');

  const editBtnSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`;

  const newSection = document.createElement('div');
  if (step.image) {
    newSection.className = 'scroll-view-img-wrapper';
    newSection.innerHTML = `
      <img src="${escapeHtml(step.image)}" alt="Passo ${idx + 1}">
      <button class="btn btn-secondary btn-sm scroll-view-edit-img-btn" data-id="${step.id}">
        ${editBtnSvg} Modifica annotazioni
      </button>`;
  } else {
    newSection.className = 'scroll-view-no-img-area';
    newSection.innerHTML = `
      <span>Nessuna schermata</span>
      <button class="btn btn-secondary btn-sm scroll-view-edit-img-btn" data-id="${step.id}">+ Aggiungi immagine</button>`;
  }

  if (oldSection) {
    oldSection.replaceWith(newSection);
  } else {
    card.appendChild(newSection);
  }

  // Update sidebar thumbnail too
  const thumb = document.querySelector(`.step-item-card[data-id="${stepId}"] .step-item-thumb`);
  if (thumb) {
    thumb.innerHTML = step.image
      ? `<img src="${escapeHtml(step.image)}" alt="Anteprima">`
      : THUMB_PLACEHOLDER_HTML;
  }
}

function updateScrollSpy() {
  const editorEl = document.getElementById('workspaceEditor');
  const stepEls = editorEl.querySelectorAll('.scroll-view-step');
  if (stepEls.length === 0) return;

  const editorTop = editorEl.getBoundingClientRect().top;
  let closestId = null;
  let closestDist = Infinity;

  stepEls.forEach(el => {
    const dist = Math.abs(el.getBoundingClientRect().top - editorTop - 48);
    if (dist < closestDist) { closestDist = dist; closestId = el.dataset.stepId; }
  });

  if (closestId) highlightSidebarStep(closestId);
}

export function initScrollView() {
  // Toggle Vista Scorrimento
  document.getElementById('btnToggleScrollView').addEventListener('click', () => {
    if (state.scrollViewMode) exitScrollView(); else enterScrollView();
  });

  // Overlay modifica immagine — pulsante Salva & Torna
  document.getElementById('btnSvSave').addEventListener('click', closeSvImageEditor);

  // Overlay modifica immagine — clic sul backdrop (fuori dal pannello)
  document.getElementById('svEditOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('svEditOverlay')) closeSvImageEditor();
  });
}
