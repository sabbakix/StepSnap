import { webPlatform } from './web.js';
import { electronPlatform } from './electron.js';

// Rilevamento a runtime: il preload di Electron espone window.electronAPI.
// Nessun flag di build: la stessa dist/ gira su GitHub Pages e dentro Electron.
export const platform = window.electronAPI ? electronPlatform : webPlatform;
