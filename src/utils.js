// UTILITY HELPER FUNCTIONS
export function escapeHtml(string) {
  const str = string ? String(string) : '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

export function hexToRgba(hex, alpha) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
  }
  return `rgba(239, 68, 68, ${alpha})`;
}

// Regex Markdown Parser elementare per formattare elenchi e grassetti nelle descrizioni
export function parseMarkdown(text) {
  if (!text) return '';

  // Escapa caratteri HTML sensibili
  let html = escapeHtml(text);

  // Grassetti: **testo**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Corsivi: *testo*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Elenchi puntati: - testo
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Sostituisce i ritorni a capo per visualizzarli in HTML
  html = html.replace(/\n/g, '<br>');

  return html;
}

export function normalizeCode(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.substring(3);
  if (code.startsWith('Digit')) return code.substring(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.substring(6);
  if (code === 'Space') return 'Space';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  return code;
}
