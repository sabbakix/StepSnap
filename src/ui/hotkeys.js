import { normalizeCode } from '../utils.js';
import { showToast } from './toast.js';

// Stato della scorciatoia da tastiera personalizzata (Ctrl + Space di default)
let hotkeyConfig = {
  ctrl: true,
  alt: false,
  shift: false,
  meta: false,
  code: 'Space',
  display: 'Ctrl + Space'
};

export function getHotkeyConfig() {
  return hotkeyConfig;
}

export function loadHotkeyConfig() {
  const savedHotkey = localStorage.getItem('stepSnapHotkey');
  if (savedHotkey) {
    try {
      hotkeyConfig = JSON.parse(savedHotkey);
    } catch(e) {
      console.error(e);
    }
  }
  updateHotkeyDisplays();
}

export function updateHotkeyDisplays() {
  const hotkeyDisplay = document.getElementById('hotkeyDisplay');
  if (hotkeyDisplay) {
    hotkeyDisplay.textContent = hotkeyConfig.display;
  }
  const hotkeyInput = document.getElementById('hotkeyInput');
  if (hotkeyInput) {
    hotkeyInput.value = hotkeyConfig.display;
  }
}

// Registrazione scorciatoia personalizzata
export function initHotkeys() {
  const hotkeyInput = document.getElementById('hotkeyInput');
  hotkeyInput.addEventListener('focus', () => {
    hotkeyInput.value = 'Premi i tasti...';
    hotkeyInput.classList.add('recording');
  });

  hotkeyInput.addEventListener('blur', () => {
    hotkeyInput.classList.remove('recording');
    hotkeyInput.value = hotkeyConfig.display;
  });

  hotkeyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const code = e.code;

    // Ignora tasti modificatori da soli per completare la combo
    if (['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight', 'CapsLock'].includes(code)) {
      const tempParts = [];
      if (e.ctrlKey) tempParts.push('Ctrl');
      if (e.altKey) tempParts.push('Alt');
      if (e.shiftKey) tempParts.push('Shift');
      if (e.metaKey) tempParts.push('Meta');
      hotkeyInput.value = tempParts.join(' + ') + ' + ...';
      return;
    }

    const ctrl = e.ctrlKey;
    const alt = e.altKey;
    const shift = e.shiftKey;
    const meta = e.metaKey;

    const parts = [];
    if (ctrl) parts.push('Ctrl');
    if (alt) parts.push('Alt');
    if (shift) parts.push('Shift');
    if (meta) parts.push('Meta');

    parts.push(normalizeCode(code));

    hotkeyConfig = {
      ctrl,
      alt,
      shift,
      meta,
      code,
      display: parts.join(' + ')
    };

    localStorage.setItem('stepSnapHotkey', JSON.stringify(hotkeyConfig));
    // Notifica i moduli interessati (es. registrazione hotkey globale su desktop)
    window.dispatchEvent(new CustomEvent('stepsnap:hotkey-changed'));
    updateHotkeyDisplays();
    hotkeyInput.blur();
    showToast("Scorciatoia aggiornata: " + hotkeyConfig.display);
  });
}
