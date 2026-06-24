# StepSnap - Documentazione Processi Semplificata

https://sabbakix.github.io/StepSnap


**StepSnap** è una web application standalone progettata per creare guide passo-passo in modo rapido e interattivo. Pensata appositamente per ambienti aziendali Windows, non richiede installazione, ha zero dipendenze e funziona interamente offline per salvaguardare la privacy dei dati.
[Installazione come PWA] StepSnap può essere installata come vera e propria applicazione desktop sul tuo PC Windows. Clicca sul pulsante "Installa App" che appare in alto a destra e segui le istruzioni. Avrai un'icona dedicata sul desktop e non dovrai più aprire il browser per usarla.

## Funzionalità Chiave

1. **Condivisione & Cattura in Tempo Reale:** Collega lo schermo del PC all'applicazione e acquisisci screenshot al volo mentre navighi o esegui azioni.
2. **Finestra Fluttuante Sempre in Primo Piano (PiP):** Utilizza l'innovativa tecnologia Picture-in-Picture per posizionare un piccolo pannello fluttuante in un angolo dello schermo. Questo ti consente di cliccare "Cattura Passo" mentre lavori su SAP, Excel, browser o qualsiasi altro software, senza dover riaprire StepSnap.
3. **Incolla Veloce dagli Appunti (Ctrl+V):** Fai uno screenshot con lo strumento nativo di Windows (`Win + Shift + S`) e premi `Ctrl + V` in StepSnap: verrà generato istantaneamente un nuovo passaggio con l'immagine incollata.
4. **Editor di Annotazione Avanzato (Non Distruttivo):**
   - **Frecce:** Per indicare bottoni e menu.
   - **Rettangoli:** Per evidenziare campi o aree di inserimento.
   - **Censura Pixel (Pixelate):** Per nascondere credenziali, password, nomi e dati personali sensibili in conformità con il GDPR.
   - **Testo:** Per inserire etichette informative direttamente sopra lo screenshot.
   - **Ritaglio (Crop) Integrato:** Ritaglia le aree vuote dello schermo per concentrarti sul dettaglio del processo.
   - **Annulla/Ripristina (Undo/Redo):** Scorciatoie `Ctrl+Z` e `Ctrl+Y` supportate.
5. **Auto-Salvataggio (IndexedDB):** Tutte le guide in corso di scrittura vengono salvate in tempo reale nel database del browser locale, in modo da non perdere mai i progressi in caso di chiusura accidentale.
6. **Esportazione Multi-Formato:**
   - **HTML Autonomo (.html):** Genera un unico file leggero con immagini in base64 e stili embedded, ideale da inviare via e-mail e consultabile offline da chiunque.
   - **PDF / Stampa:** Foglio di stile dedicato che organizza i passaggi in un documento cartaceo pulito (una pagina per passaggio, layout a colori ottimizzato).
   - **Markdown (.md):** File markdown con immagini embedded in base64.
   - **Backup di Progetto (.json):** Consente di salvare lo stato del progetto per caricarlo di nuovo e continuare la modifica in un secondo momento.

---

## Come Iniziare (Nessuna Installazione Richiesta)

1. Scarica i file `index.html`, `styles.css` e `app.js` nella stessa cartella del tuo PC.
2. Fai **doppio clic** sul file `index.html`. Si aprirà immediatamente nel browser predefinito (consigliato l'uso di **Microsoft Edge** o **Google Chrome**).
3. **Modalità Scura (Dark Mode):** Clicca sul toggle in alto a destra per cambiare tema se preferisci l'interfaccia scura.

---

## Guida all'Uso Passo-dopo-Passo

### 1. Avviare un Progetto

- Inserisci il **Titolo del Processo** (es: _Registrazione Nuova Anagrafica in SAP_) e una descrizione generale.
- Clicca su **Inizia a Documentare**.

### 2. Catturare le Schermate

- Clicca su **Condividi Schermo/Finestra** a destra. Il browser ti chiederà quale schermo o finestra vuoi condividere. Seleziona lo schermo intero se intendi fare screenshot di applicazioni diverse, altrimenti seleziona la singola finestra dell'applicazione.
- **Metodo Fluttuante (Consigliato):** Clicca su **Finestra Fluttuante (PiP)**. Verrà aperta una mini finestra trasparente. Spostala dove preferisci (ad esempio in basso a destra). Apri l'applicazione da documentare e fai clic su **CATTURA PASSO** sulla finestrella ogni volta che compi un'operazione importante. Ogni clic creerà un nuovo passaggio in StepSnap.
  - **Scorciatoia Tastiera Personalizzabile:** Di default, puoi premere `Ctrl + Space` per acquisire la schermata all'istante (quando il browser è in focus). Puoi personalizzare questa combinazione facendo clic sul campo **Scorciatoia tastiera** nel pannello destro e premendo la combinazione desiderata (es. `Ctrl + Shift + K`).
  - **Metodo Tradizionale (Appunti):** Usa lo strumento di Cattura nativo di Windows (`Win + Shift + S`) per fotografare un'area dello schermo, quindi torna su StepSnap e premi `Ctrl + V` per incollare l'immagine e creare all'istante un nuovo passaggio.

### 3. Modificare e Annotare i Passaggi

- Seleziona un passaggio a sinistra (puoi riordinarli con le frecce `▲` / `▼` o cancellarli con `🗑️`).
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
  - **Salva come PDF / Stampa:** si aprirà il menu di stampa del browser. Imposta la stampante su **Salva come PDF** per ottenere un manuale stampabile ad altissima definizione.
  - **Esporta Progetto (JSON):** per salvare una copia modificabile in futuro.

---

## Privacy & GDPR Compliance

Nessun dato inserito, testo scritto o screenshot acquisito tramite StepSnap viene trasmesso via Internet. Il software funziona in locale: le immagini risiedono esclusivamente all'interno del database interno IndexedDB memorizzato nel browser del tuo PC. L'applicazione può essere eseguita offline (senza connessione Internet attiva).
