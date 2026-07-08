import { exportHtmlFile } from './html.js';
import { exportMarkdownFile } from './markdown.js';
import { exportJsonFile } from './json.js';
import { printPdf } from './pdf.js';

// AZIONI DI ESPORTAZIONE
export function initExports() {
  document.getElementById('btnExportHtml').addEventListener('click', exportHtmlFile);
  document.getElementById('btnPrintPdf').addEventListener('click', printPdf);
  document.getElementById('btnExportMarkdown').addEventListener('click', exportMarkdownFile);
  document.getElementById('btnExportJson').addEventListener('click', exportJsonFile);
}
