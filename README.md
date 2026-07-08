# StepSnap - Documentazione Processi Semplificata

https://sabbakix.github.io/StepSnap

**StepSnap** è un'applicazione per creare guide passo-passo in modo rapido e interattivo. Pensata appositamente per ambienti aziendali Windows, ha zero dipendenze a runtime e funziona interamente offline per salvaguardare la privacy dei dati.

È disponibile in **due versioni** dallo stesso codice sorgente:

- **Web / PWA** — su https://sabbakix.github.io/StepSnap, installabile dal browser con il pulsante "Installa App".
- **Desktop (Electron)** — installer nativi per **Windows, Linux e macOS** con cattura schermo nativa, screenshot one-shot senza condivisione schermo, scorciatoia globale di sistema e finestra fluttuante sempre in primo piano.

## Funzionalità Chiave

1. **Condivisione & Cattura in Tempo Reale:** Collega lo schermo del PC all'applicazione e acquisisci screenshot al volo mentre navighi o esegui azioni.
2. **Finestra Fluttuante Sempre in Primo Piano (PiP):** Un piccolo pannello fluttuante in un angolo dello schermo con il pulsante "Cattura Passo": documenti SAP, Excel, browser o qualsiasi altro software senza riaprire StepSnap. Nel browser usa la tecnologia Document Picture-in-Picture; nella versione desktop è una finestra nativa che resta sopra anche alle app a schermo intero.
3. **Incolla Veloce dagli Appunti (Ctrl+V):** Fai uno screenshot con lo strumento nativo di Windows (`Win + Shift + S`) e premi `Ctrl + V` in StepSnap: verrà generato istantaneamente un nuovo passaggio con l'immagine incollata.
4. **Editor di Annotazione Avanzato (Non Distruttivo):**
   - **Frecce:** Per indicare bottoni e menu.
   - **Rettangoli:** Per evidenziare campi o aree di inserimento.
   - **Censura Pixel (Pixelate):** Per nascondere credenziali, password, nomi e dati personali sensibili in conformità con il GDPR.
   - **Testo:** Per inserire etichette informative direttamente sopra lo screenshot.
   - **Ritaglio (Crop) Integrato:** Ritaglia le aree vuote dello schermo per concentrarti sul dettaglio del processo.
   - **Annulla/Ripristina (Undo/Redo):** Scorciatoie `Ctrl+Z` e `Ctrl+Y` supportate.
5. **Auto-Salvataggio (IndexedDB):** Tutte le guide in corso di scrittura vengono salvate in tempo reale nel database locale, in modo da non perdere mai i progressi in caso di chiusura accidentale.
6. **Esportazione Multi-Formato:**
   - **HTML Autonomo (.html):** Genera un unico file leggero con immagini in base64 e stili embedded, ideale da inviare via e-mail e consultabile offline da chiunque.
   - **PDF / Stampa:** Foglio di stile dedicato che organizza i passaggi in un documento cartaceo pulito.
   - **Markdown (.md):** File markdown con immagini embedded in base64.
   - **Backup di Progetto (.json):** Consente di salvare lo stato del progetto per caricarlo di nuovo e continuare la modifica in un secondo momento.

### In più nella versione Desktop

- **Cattura nativa senza prompt del browser:** la selezione dello schermo/finestra usa un picker integrato nell'app.
- **Screenshot one-shot:** la finestra fluttuante e la scorciatoia funzionano anche **senza** avviare la condivisione schermo (screenshot nativo a piena risoluzione).
- **Scorciatoia globale di sistema:** la combinazione di cattura (default `Ctrl + Space`) funziona anche quando StepSnap non ha il focus.

> **Nota:** le guide salvate nel browser e quelle salvate nell'app desktop risiedono in database locali separati. Per trasferirle usa **Esporta Progetto (JSON)** da una versione e importa il file nell'altra.

---

## Sviluppo e Build

Requisiti: Node.js ≥ 20.

```bash
npm install          # installa le dipendenze

# Web
npm run dev          # dev server Vite (http://localhost:5173)
npm run build        # build di produzione in dist/
npm run preview      # anteprima della build

# Desktop (Electron)
npm run dev:electron # avvia Electron sul dev server Vite (con HMR)
npm run dist:win     # installer NSIS per Windows (in release/)
npm run dist:linux   # AppImage + .deb per Linux
npm run dist:mac     # DMG per macOS
```

Struttura del progetto:

- `src/` — codice dell'app in moduli ES (ui, guides, editor, capture, exports, scrollview, storage) con un layer `src/platform/` che a runtime seleziona l'implementazione web o Electron.
- `electron/` — main process (`main.cjs`) e preload (`preload.cjs`).
- `public/` — asset serviti così come sono (manifest PWA, service worker, icona).
- `.github/workflows/pages.yml` — deploy automatico della versione web su GitHub Pages.
- `.github/workflows/release.yml` — build degli installer per i 3 sistemi operativi su tag `v*` (artifact scaricabili dalla run di GitHub Actions).

Gli installer non sono firmati: al primo avvio Windows SmartScreen chiede conferma ("Esegui comunque") e su macOS serve tasto destro → Apri.

---

## Guida all'Uso Passo-dopo-Passo

### 1. Avviare un Progetto

- Inserisci il **Titolo del Processo** (es: _Registrazione Nuova Anagrafica in SAP_) e una descrizione generale.
- Clicca su **Inizia a Documentare**.

### 2. Catturare le Schermate

- Clicca su **Condividi Schermo/Finestra** a destra e seleziona quale schermo o finestra condividere. Seleziona lo schermo intero se intendi fare screenshot di applicazioni diverse, altrimenti seleziona la singola finestra dell'applicazione.
- **Metodo Fluttuante (Consigliato):** Clicca su **Finestra Fluttuante (PiP)**. Verrà aperta una mini finestra sempre in primo piano. Spostala dove preferisci (ad esempio in basso a destra). Apri l'applicazione da documentare e fai clic su **CATTURA PASSO** sulla finestrella ogni volta che compi un'operazione importante. Ogni clic creerà un nuovo passaggio in StepSnap.
  - **Scorciatoia Tastiera Personalizzabile:** Di default, puoi premere `Ctrl + Space` per acquisire la schermata all'istante (nella versione desktop funziona anche quando StepSnap non è in focus). Puoi personalizzare la combinazione facendo clic sul campo **Scorciatoia tastiera** nel pannello destro e premendo la combinazione desiderata (es. `Ctrl + Shift + K`).
  - **Metodo Tradizionale (Appunti):** Usa lo strumento di Cattura nativo di Windows (`Win + Shift + S`) per fotografare un'area dello schermo, quindi torna su StepSnap e premi `Ctrl + V` per incollare l'immagine e creare all'istante un nuovo passaggio.

### 3. Modificare e Annotare i Passaggi

- Seleziona un passaggio a sinistra (puoi riordinarli trascinandoli o cancellarli con `🗑️`).
- Digita un titolo specifico per la schermata e aggiungi note dettagliate nella descrizione (puoi usare la formattazione markdown per elenchi o grassetti).
- Usa l'editor dell'immagine:
  - Clicca sull'icona della **Freccia** ↗️ o del **Rettangolo** ⬜, scegli il colore e lo spessore, quindi trascina il mouse sopra l'immagine.
  - Seleziona lo strumento **Censura** 🌫️ e trascina per nascondere dati personali, indirizzi o password.
  - Clicca su **Testo** 🔤, fai clic sul punto dell'immagine in cui vuoi posizionarlo ed inserisci la dicitura desiderata.
  - Clicca su **Ritaglia** ✂️, trascina per impostare i limiti dell'immagine e clicca `✔️ Conferma` per applicare il ritaglio.
  - Usa **Annulla** (`Ctrl+Z`) se hai commesso un errore.

### 4. Esportare il Risultato

- A processo terminato, scegli uno dei formati a destra:
  - **Esporta HTML Autonomo:** per un file unico completo da condividere con i colleghi.
  - **Salva come PDF / Stampa:** si aprirà il menu di stampa. Imposta la stampante su **Salva come PDF** per ottenere un manuale stampabile ad altissima definizione.
  - **Esporta Progetto (JSON):** per salvare una copia modificabile in futuro.

---

## Privacy & GDPR Compliance

Nessun dato inserito, testo scritto o screenshot acquisito tramite StepSnap viene trasmesso via Internet. Il software funziona in locale: le immagini risiedono esclusivamente all'interno del database interno IndexedDB memorizzato sul tuo PC. L'applicazione funziona offline (senza connessione Internet attiva).
