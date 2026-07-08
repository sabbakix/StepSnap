import { state } from '../state.js';
import { escapeHtml, parseMarkdown } from '../utils.js';

// Stampa come PDF (in Electron apre il dialog di stampa nativo con "Salva come PDF")
export function printPdf() {
  if (!state.currentSession) return;
  const session = state.currentSession;

  // Genera dinamicamente il layout di stampa pulito
  const printLayout = document.getElementById('printLayout');
  printLayout.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'print-header';
  header.innerHTML = `
    <h1>${escapeHtml(session.title)}</h1>
    <p>${escapeHtml(session.description || "Nessuna descrizione del processo fornita.")}</p>
    <div style="font-size: 11px; color: #666; margin-top: 10px; display: flex; justify-content: space-between;">
      <span>Data Documentazione: ${session.createdAt}</span>
      <span>Passaggi totali: ${session.steps.length}</span>
    </div>
  `;
  printLayout.appendChild(header);

  session.steps.forEach((step, index) => {
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
