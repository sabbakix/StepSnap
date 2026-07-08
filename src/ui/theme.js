// TEMA CHIARO/SCURO con persistenza in localStorage
export function initTheme() {
  const themeToggle = document.getElementById('themeToggleCheckbox');
  themeToggle.addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stepSnapTheme', theme);
  });

  // Carica tema salvato
  const savedTheme = localStorage.getItem('stepSnapTheme') || 'light';
  themeToggle.checked = savedTheme === 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}
