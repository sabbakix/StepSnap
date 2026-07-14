// Font Outfit self-hosted (sostituisce i <link> Google Fonts) e fogli di stile
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import './styles/main.css';

import { initDB } from './storage/db.js';
import { initTheme } from './ui/theme.js';
import { initModals } from './ui/modals.js';
import { loadHotkeyConfig, initHotkeys } from './ui/hotkeys.js';
import { initDashboard, loadDashboard } from './guides/dashboard.js';
import { initSteps } from './guides/steps.js';
import { initEditor } from './editor/canvas.js';
import { initCapture } from './capture/capture.js';
import { initAutoRecord } from './capture/autorecord.js';
import { initExports } from './exports/index.js';
import { initJsonImport } from './exports/json.js';
import { initScrollView } from './scrollview/scrollview.js';
import { platform } from './platform/index.js';

// INIZIALIZZAZIONE APPLICAZIONE
window.addEventListener('DOMContentLoaded', async () => {
  platform.init();
  await initDB();
  loadHotkeyConfig();

  initTheme();
  initModals();
  initHotkeys();
  initDashboard();
  initSteps();
  initEditor();
  initCapture();
  initAutoRecord();
  initExports();
  initJsonImport();
  initScrollView();

  await loadDashboard();

  // Solo web: Service Worker + prompt di installazione PWA (no-op in Electron)
  platform.initPWA();
});
