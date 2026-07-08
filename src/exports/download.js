// Helper condiviso: scarica un contenuto testuale come file.
// In Electron l'anchor-download apre il dialog di salvataggio nativo.
export function downloadFile(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", url);
  downloadAnchor.setAttribute("download", filename);
  downloadAnchor.click();
  URL.revokeObjectURL(url);
}

// Normalizza il titolo della guida in un nome file sicuro
export function sessionFilename(session, suffix) {
  return session.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + suffix;
}
