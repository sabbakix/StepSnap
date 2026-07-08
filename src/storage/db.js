import { state } from '../state.js';

// CONFIGURAZIONE DATABASE LOCALE INDEXEDDB
const DB_NAME = 'StepSnapDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let db = null;

// 1. INIZIALIZZAZIONE INDEXED DB
export function initDB() {
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
export async function dbSaveSession(session) {
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(session);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

export async function dbGetSession(id) {
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

export async function dbGetAllSessions() {
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

export async function dbDeleteSession(id) {
  if (!db) return;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e);
  });
}

// AUTO-SALVATAGGIO con debounce e badge di stato
let saveTimeout = null;

export function saveCurrentSession() {
  if (!state.currentSession) return;

  // Aggiorna timestamp
  state.currentSession.updatedAt = new Date().toISOString();

  // Mostra stato nel badge "Salvataggio in corso..."
  const indicator = document.getElementById('autoSaveIndicator');
  const dot = indicator.querySelector('.status-dot');
  dot.classList.add('saving');
  indicator.innerHTML = `<span class="status-dot saving"></span> Salvataggio in corso...`;

  // Debounce salvataggio su database locale per prestazioni ottimali
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await dbSaveSession(state.currentSession);

    // Ripristina badge salvato
    const activeIndicator = document.getElementById('autoSaveIndicator');
    activeIndicator.innerHTML = `<span class="status-dot"></span> Salvato in locale`;
  }, 500);
}
