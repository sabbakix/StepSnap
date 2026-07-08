import { state } from '../state.js';
import { dbSaveSession } from '../storage/db.js';
import { showToast } from '../ui/toast.js';
import { showAlert } from '../ui/modals.js';
import { downloadFile, sessionFilename } from './download.js';
import { openWorkspace } from '../guides/steps.js';

// Esporta file JSON di progetto modificabile
export function exportJsonFile() {
  if (!state.currentSession) return;

  downloadFile(
    JSON.stringify(state.currentSession),
    'application/json;charset=utf-8',
    sessionFilename(state.currentSession, '_progetto.json')
  );
  showToast("File di progetto JSON scaricato!");
}

// Importa file JSON di progetto
export function importJsonProject(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const session = JSON.parse(e.target.result);

      // Controllo validità minimale
      if (session.id && session.title && Array.isArray(session.steps)) {
        session.updatedAt = new Date().toISOString();
        await dbSaveSession(session);
        state.currentSession = session;
        state.selectedStepId = null;

        openWorkspace();
        showToast("Progetto importato con successo!");
      } else {
        await showAlert("Struttura del file JSON non valida. Assicurati che sia un progetto esportato da StepSnap.");
      }
    } catch (err) {
      console.error("Errore importazione JSON:", err);
      await showAlert("Impossibile leggere il file JSON. Assicurati che non sia corrotto.");
    }
  };
  reader.readAsText(file);
}

// Gestione Drop file JSON sulla Dashboard
export function initJsonImport() {
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

  jsonUploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    jsonUploadZone.style.borderColor = 'var(--border-color)';
    jsonUploadZone.style.backgroundColor = 'var(--bg-color)';
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      importJsonProject(file);
    } else {
      await showAlert("Carica solo file di progetto .json validi.");
    }
  });

  document.getElementById('jsonFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importJsonProject(file);
    }
  });
}
