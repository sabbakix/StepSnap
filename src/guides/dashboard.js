import { state } from '../state.js';
import { dbSaveSession, dbGetSession, dbDeleteSession, dbGetAllSessions } from '../storage/db.js';
import { escapeHtml } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { showConfirm } from '../ui/modals.js';
import { openWorkspace } from './steps.js';

// CARICAMENTO DASHBOARD
export async function loadDashboard() {
  document.getElementById('dashboardSection').classList.add('active');
  document.getElementById('workspaceSection').classList.remove('active');

  const searchInput = document.getElementById('guidesSearchInput');
  if (searchInput) searchInput.value = '';

  state.allSessions = await dbGetAllSessions();
  renderGuideCards(state.allSessions);
}

export function renderGuideCards(sessions, query = '') {
  const grid = document.getElementById('guidesListGrid');
  grid.innerHTML = '';

  if (state.allSessions.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>Nessun processo salvato in questo browser. Crea una nuova guida sopra per iniziare!</p>
      </div>
    `;
    return;
  }

  if (sessions.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>Nessuna guida corrisponde a "<strong>${escapeHtml(query)}</strong>". Prova un termine diverso.</p>
      </div>
    `;
    return;
  }

  sessions.forEach(sess => {
    const card = document.createElement('div');
    card.className = 'guide-card-item';

    // Anteprima: prima schermata disponibile tra i passaggi della guida
    const firstImage = (sess.steps || []).find(s => s.image)?.image;
    const thumbHtml = firstImage
      ? `<img src="${escapeHtml(firstImage)}" alt="Anteprima di ${escapeHtml(sess.title)}" loading="lazy">`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

    card.innerHTML = `
      <div class="guide-card-thumb" onclick="loadSession('${sess.id}')" title="Apri la guida">
        ${thumbHtml}
      </div>
      <div class="guide-card-body">
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
      </div>
    `;
    grid.appendChild(card);
  });
}

export function initDashboard() {
  // Funzioni globali esterne caricate via onclick
  window.loadSession = async (id) => {
    const sess = await dbGetSession(id);
    if (sess) {
      state.currentSession = sess;
      state.selectedStepId = null;
      openWorkspace();
    }
  };

  window.deleteSessionConfirm = async (id) => {
    const ok = await showConfirm("Vuoi eliminare questa guida definitivamente? Questa azione non può essere annullata.", {
      confirmText: 'Elimina Definitivamente',
      isDanger: true
    });
    if (ok) {
      await dbDeleteSession(id);
      showToast("Guida eliminata con successo!");
      await loadDashboard();
    }
  };

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
    state.currentSession = session;
    state.selectedStepId = null;

    newGuideForm.reset();
    openWorkspace();
  });

  // Ricerca guide in dashboard
  document.getElementById('guidesSearchInput').addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    const filtered = query
      ? state.allSessions.filter(s =>
          s.title.toLowerCase().includes(query) ||
          (s.description || '').toLowerCase().includes(query))
      : state.allSessions;
    renderGuideCards(filtered, query);
  });
}
