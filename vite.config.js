import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// base './' è la riga chiave del doppio target: gli asset restano relativi,
// quindi la stessa build funziona su GitHub Pages (/StepSnap/) e in Electron (file://).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pip: resolve(__dirname, 'pip.html'),
      },
    },
  },
});
