import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { downloadFile, sessionFilename } from './download.js';

// Esporta come Markdown con immagini incorporate in Base64
export function exportMarkdownFile() {
  if (!state.currentSession) return;
  const session = state.currentSession;

  let md = `# ${session.title}\n\n`;
  if (session.description) {
    md += `${session.description}\n\n`;
  }

  md += `*   **Data Creazione:** ${session.createdAt}\n`;
  md += `*   **Passaggi totali:** ${session.steps.length}\n\n`;
  md += `---\n\n`;

  session.steps.forEach((step, index) => {
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

  downloadFile(md, 'text/markdown;charset=utf-8', sessionFilename(session, '_guida.md'));
  showToast("Guida esportata come file Markdown!");
}
