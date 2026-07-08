// Stato condiviso tra i moduli dell'applicazione.
// I moduli mutano le proprietà di questo singleton, mai la variabile stessa.
export const state = {
  currentSession: null,
  selectedStepId: null,
  allSessions: [],

  // Vista Scorrimento attiva
  scrollViewMode: false,
};
