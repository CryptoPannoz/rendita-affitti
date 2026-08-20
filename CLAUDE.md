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
- **Stack**: `index.html` (interfaccia, CSS e i18n inline) + **`logic.mjs`**
  (il motore di calcolo, modulo ES puro senza DOM, coperto dai test in
  `tests/`) + i dati in `data/`. Nessun framework, nessun build step, nessun
  login. **La matematica vive solo in `logic.mjs`**:
  se tocchi il motore, `npm test` deve passare prima di committare, e se
  cambi una regola aggiorna anche il test che la fissa.
- **Lingue**: italiano (sorgente, nell'HTML) e inglese, con interruttore in alto.
  L'EN sta nel dizionario `EN` (nodi statici, via `data-i18n`/`data-i18n-html`)
  e in `DYN.en` (stringhe generate dal motore). Cambiare lingua **non deve mai
  resettare i valori inseriti**: ritraduce e basta (`setStatic` + `notes` +
  `render`, mai `prefill`). Stesso design system del sito.

## Layout (deciso da Alberto il 19/08/2026)

- **Un box "L'immobile"** in cima (città, mq, valore, rendita catastale con
  info ⓘ sulla stima, aliquota IMU, occupanti→consumi, condominio, manutenzione).
- **Quattro card scenario interattive**, nell'ordine **3+2 → 4+4 → medio →
  breve**: ogni parametro tipico di un regime sta DENTRO la sua card (sconto
  e alta tensione nel 3+2; canone e sfitto nel 4+4; premio e mesi nel medio;
  ADR, occupazione, OTA, gestione, unico-immobile e stagionalità nel breve).
  Le card sono HTML statico: `render()` aggiorna solo i nodi `[data-out]`,
  mai l'innerHTML dei contenitori con input (si perderebbero focus e handler).

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
- **Consumi dagli occupanti**: pieni = 600 € + 450 €/occupante l'anno, poi
  scalati sulla presenza con quota fissa 30% (`CONSUMI` in logic.mjs). Nel
  breve la presenza è l'occupazione, nel medio i mesi/12, nei lunghi zero.
- **Stagionalità (Eurostat tour_ce_omn12)**: `data/stagionalita.js` è
  generata da `npm run build:stagionalita` (21 regioni NUTS-2, moltiplicatori
  mensili a media 1). È solo visualizzazione nel box del breve: non cambia
  il totale annuo.
- **Riferimenti normativi**: ogni voce di `FISCO` in logic.mjs ha il suo
  riferimento (legge/articolo/comma) nel commento, verificato ad ago 2026.
  Se aggiorni un'aliquota, aggiorna il riferimento.

## Il cancello dei risultati (deciso da Alberto il 20/08/2026)

- **Tre fasi**: `compila` (risultati nascosti via `body.bloccato`, il verdetto
  mostra il bottone «Calcola il verdetto») → `teaser` (solo «Vince X», form
  email) → `sbloccato` (verdetto completo, card, grafico, KPI, sensibilità,
  bottoni PDF e condivisione). Stato in `fase`, sblocco ricordato in
  `localStorage['ra-email']`.
- **Lead su Firestore**: progetto Firebase `rendita-affitti` (eur3), collezione
  `rendita-leads`, campi `email, lingua, citta, vincitore, netto, creato`.
  Le regole (nel README) permettono solo `create` con email valida; si leggono
  dalla console. L'SDK (CDN gstatic 10.14.1) è importato **solo al submit**:
  prima di allora nessuna chiamata di rete. Se `addDoc` fallisce si sblocca
  comunque: il visitatore non paga per un backend rotto.
- **PDF** = `window.print()` con il foglio `@media print` (solo risultati);
  **Condividi** = `navigator.share` con fallback copia-link.
- I testi del cancello stanno nel dizionario `GATE` (it/en), separato da `EN`
  e `DYN`.

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
- **Niente chiamate di rete a runtime**, con un'unica eccezione dichiarata:
  l'SDK Firebase caricato al submit dell'email del cancello. Tutto il resto è
  statico, i dati viaggiano col sito.
- **Il tool non dà consigli d'investimento** e il disclaimer in pagina resta.

## Comandi

```bash
npm test               # test del motore (obbligatori prima di ogni commit)
npm run dev            # server statico locale su :8080
npm run build:omi      # rigenera data/omi-capoluoghi.js dall'OMI
npm run deploy:site    # copia il tool dentro ../alberto-broggi-site/tools/rendita-affitti/
```
