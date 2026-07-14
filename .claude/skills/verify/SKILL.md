---
name: verify
description: Come compilare, avviare e pilotare StepSnap (PWA Vite) per verificare modifiche end-to-end in Chrome headless via CDP.
---

# Verifica end-to-end di StepSnap

App browser (PWA) servita da Vite; nessun framework, moduli ES vanilla. Su questa macchina non c'è Playwright: si usa Chrome headless + Chrome DevTools Protocol con Node ≥22 (WebSocket e fetch integrati, niente dipendenze).

## Avvio

```bash
# 1. Dev server su porta fissa (in background)
npx vite --port 5199 --strictPort

# 2. Chrome headless con CDP (profilo usa-e-getta nello scratchpad)
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new \
  --remote-debugging-port=9333 --user-data-dir=<dir-temporanea> \
  --no-first-run --disable-gpu --window-size=1440,900 about:blank
```

## Pilotaggio (script Node .mjs, zero dipendenze)

- Target: `GET http://127.0.0.1:9333/json` → `webSocketDebuggerUrl` del target `type:"page"`, poi `new WebSocket(url)` (globale in Node ≥22).
- Comandi utili: `Page.navigate` + evento `Page.loadEventFired`, `Runtime.evaluate` (con `awaitPromise:true, returnByValue:true`), `Page.captureScreenshot`, `Input.dispatchKeyEvent`/`dispatchMouseEvent` (input reali/attendibili — `el.click()` via evaluate NON muove il focus né conta per `:focus-visible`).
- Upload immagini reale: `DOM.getDocument` → `DOM.querySelector` su `#stepImageFileInput` → `DOM.setFileInputFiles` (percorso Windows con backslash).
- Stato pulito: `Storage.clearDataForOrigin {origin:'http://localhost:5199', storageTypes:'indexeddb'}` poi ricarica (l'app usa IndexedDB `StepSnapDB`).
- Errori JS: abilitare `Runtime.enable` e raccogliere gli eventi `Runtime.exceptionThrown`.
- Attendere ~1200 ms dopo il load: l'init (IndexedDB + listener) parte su DOMContentLoaded.

## Flussi che vale la pena pilotare

1. Dashboard → crea guida (`#guideTitle` + `requestSubmit()` su `#newGuideForm`) → si apre il workspace.
2. `#btnAddEmptyStep`, poi upload immagine via `#stepImageFileInput` (se un passo vuoto è selezionato l'immagine va lì, altrimenti crea un passo).
3. Eliminazione passo (`.btn-step-control.delete`) → toast `#saveToast` con `.toast-action-btn` (Annulla, finestra 5 s).
4. Navigazione `#btnDashboard` (nessuna conferma; il salvataggio debounced viene flushato da `closeWorkspace`).
5. Riapertura guida con passi → entra in Vista Scorrimento (`#scrollViewContainer` visibile).

## Cattura schermo in headless

Per pilotare il flusso di cattura (`getDisplayMedia`) avviare Chrome con
`--use-fake-ui-for-media-stream --auto-select-desktop-capture-source="Entire screen"`:
lo stream viene auto-approvato. Attendere che `streamVideo.readyState === HAVE_ENOUGH_DATA`
(~1-2 s) prima di cliccare `#btnSnap`, altrimenti lo scatto è un no-op silenzioso;
fare scatti singoli con attese, non retry-loop (rischio doppi scatti).

## Verifica in Electron (app desktop)

```bash
unset ELECTRON_RUN_AS_NODE && npx electron . --remote-debugging-port=9555
```
CDP funziona come in Chrome sul target page `dist/index.html`, MA il dominio `Browser`
non supporta `getWindowForTarget`/`setWindowBounds`: spostare la finestra via PowerShell
`MoveWindow` sull'hwnd di `Get-Process electron | Where MainWindowHandle -ne 0`
(NON cercare per titolo `*StepSnap*`: aggancia la console che ospita npx).
L'app usa l'IndexedDB reale dell'utente: niente `clearDataForOrigin`; creare una guida
di test con titolo univoco ed eliminarla a fine verifica dalla dashboard.

Per testare la registrazione automatica (uiohook) servono input REALI del SO:
`mouse_event`/`SendInput` via PowerShell li genera e l'hook li vede; **`SetCursorPos`
NON genera eventi** per gli hook low-level (usalo solo per posizionare il cursore prima
del clic). Bersaglio sicuro per i clic: un Blocco Note (`$env:SystemRoot\System32\notepad.exe`,
il nome nudo `notepad` fallisce con Start-Process) posizionato con MoveWindow lontano
dalla finestra di StepSnap — i clic sulle finestre proprie vengono filtrati by design.

## Insidie note

- Gli screenshot CDP in headless possono richiedere secondi: non inserirli dentro finestre temporali strette (es. i 5 s del toast di undo).
- Il salvataggio è debounced (500 ms in `src/storage/db.js`): verifiche di persistenza vanno fatte dopo la navigazione (che flusha) o dopo >500 ms.
- Heredoc bash mangla gli script con template literal/escape: scrivere i .mjs con il tool Write, non con `cat <<EOF`.
- Su Windows, fermare il task in background della shell NON termina il figlio `node` di Vite: la porta resta occupata. Liberarla con `Get-NetTCPConnection -LocalPort 5199` → `taskkill /PID <pid> /T /F`.
