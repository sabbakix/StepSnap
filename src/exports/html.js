import { state } from '../state.js';
import { escapeHtml, parseMarkdown } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { showAlert } from '../ui/modals.js';
import { downloadFile, sessionFilename } from './download.js';

// Esporta un singolo HTML autonomo con immagini base64
export async function exportHtmlFile() {
  if (!state.currentSession) return;
  const session = state.currentSession;
  if (session.steps.length === 0) {
    await showAlert("Aggiungi almeno un passaggio con un'immagine per esportare la guida.");
    return;
  }

  let stepsHtml = '';
  session.steps.forEach((step, index) => {
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
  <title>${escapeHtml(session.title)} - Guida di Processo</title>
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
      <h1>${escapeHtml(session.title)}</h1>
      <p class="desc">${escapeHtml(session.description || '')}</p>
      <div class="meta">
        <span>Creato il: ${escapeHtml(session.createdAt)}</span>
        <span>Passaggi totali: ${session.steps.length}</span>
      </div>
    </header>

    ${stepsHtml}
  </div>
</body>
</html>`;

  downloadFile(htmlContent, 'text/html;charset=utf-8', sessionFilename(session, '_guida.html'));
  showToast("Guida esportata come HTML Autonomo!");
}
