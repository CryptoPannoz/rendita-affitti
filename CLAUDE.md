# Rendita immobiliare affitti — istruzioni per Claude

Calcolatore pubblico e open source: dato un immobile (città, metratura, valore),
confronta la rendita netta di quattro modi di affittarlo — breve turistico,
medio termine (transitorio), 4+4 canone libero, 3+2 canone concordato — con
IMU, cedolare secca, tassi di occupazione e costi di gestione.

- **Repo**: `CryptoPannoz/rendita-affitti` (pubblico)
- **Versione pubblica**: https://bebroggi.it/tools/rendita-affitti/ — vive dentro
  la repo `alberto-broggi-site`, sotto `tools/rendita-affitti/`.
- **Questa repo** è la fonte del codice e la copia open source. Dopo ogni modifica:
  `npm run deploy:site`, poi commit e push **anche** del sito.
- **Stack**: un solo `index.html` con CSS e JS inline (stesso pattern di
  `tools/affitto-vs-acquisto.html` del sito), più i dati in `data/`. Nessun
  framework, nessun build step, nessun login, nessuna raccolta dati.
- **Lingue**: italiano (sorgente, nell'HTML) e inglese, con interruttore in alto.
  L'EN sta nel dizionario `EN` (nodi statici, via `data-i18n`/`data-i18n-html`)
  e in `DYN.en` (stringhe generate dal motore). Cambiare lingua **non deve mai
  resettare i valori inseriti**: ritraduce e basta (`setStatic` + `notes` +
  `render`, mai `prefill`). Stesso design system del sito.

## Il modello economico (regole decise da Alberto, non toccarle senza chiedere)

- **Medio termine (transitorio)**: di norma canone = canone 4+4 (slider parte da 0),
  con **consumi inclusi** a carico del proprietario. Cedolare **21%**: il 10%
  esiste solo per il transitorio a canone concordato (canone da tabelle) in
  comune ATA, e non è modellato — è spiegato nel metodo.
- **Affitto breve**: **consumi inclusi** (utenze a carico host), condominio pieno,
  manutenzione +50%.
- **4+4 e 3+2**: utenze intestate all'inquilino, condominio al 20% (straordinaria).
- **3+2 concordato**: cedolare 10% **solo** nei comuni ad alta tensione abitativa
  (toggle), IMU al 75% ovunque.
- Il **netto** è il protagonista: nelle card sta nel blocco `.hero`, grande,
  prima del dettaglio.

## Regole del progetto

- **`data/` è generata o citata, mai inventata.** `omi-capoluoghi.js` viene
  dall'OMI (Agenzia Entrate) via `npm run build:omi`. `mercato-breve.js` contiene
  stime dichiarate di ADR e occupazione per città con fonte e anno nel file:
  se cambi un numero, cambia anche la fonte.
- **Ogni numero fiscale ha la sua data.** Aliquote di cedolare, IMU e regole del
  concordato valgono per l'anno indicato in `FISCO.anno` dentro l'HTML: a ogni
  legge di bilancio vanno riverificate e aggiornata la data mostrata in pagina.
- **Le stime sono dichiarate come stime.** Occupazione, ADR e sconto concordato
  precompilati sono punti di partenza modificabili, e la pagina lo dice. Non
  spacciare medie cittadine per previsioni sul singolo immobile.
- **Niente chiamate di rete a runtime.** Tutto statico, i dati viaggiano col sito.
- **Il tool non dà consigli d'investimento** e il disclaimer in pagina resta.

## Comandi

```bash
npm run dev            # server statico locale su :8080
npm run build:omi      # rigenera data/omi-capoluoghi.js dall'OMI
npm run deploy:site    # copia il tool dentro ../alberto-broggi-site/tools/rendita-affitti/
```
