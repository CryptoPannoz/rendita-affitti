# Rendita immobiliare affitti 🏠

**Quanto rende davvero il tuo immobile?** Calcolatore gratuito e open source che
confronta, sul **netto annuo**, i quattro modi di mettere a reddito una casa in Italia:

| Regime | Cedolare secca | IMU | Occupazione |
|---|---|---|---|
| **Affitto breve turistico** | 26% (21% per un solo immobile) | piena | prezzo a notte × notti vendute |
| **Medio termine / transitorio** (1–18 mesi) | 21%, o 10% se concordato in comune ATA | piena | mesi affittati l'anno |
| **4+4 canone libero** | 21% | piena | 12 mesi − sfitto |
| **3+2 canone concordato** | 10% nei comuni ATA (21% altrove) | **75%** | 12 mesi − sfitto/2 |

👉 **Prova subito: [bebroggi.it/tools/rendita-affitti](https://bebroggi.it/tools/rendita-affitti/)**

Nessuna registrazione, nessun dato raccolto: i conti girano tutti nel browser.

## Cosa fa

- Scegli una città e la metratura: valore e canone di mercato si precompilano
  dai **dati OMI dell'Agenzia delle Entrate** (110 capoluoghi); la rendita
  catastale va invece copiata dalla visura;
  prezzo a notte e occupazione dell'affitto breve dalle medie di mercato
  pubbliche (dati Airbnb / AirROI 2025-26) per 14 città turistiche.
- Lo **step 1** separa immobile e regole locali e raccoglie una volta sola i
  costi comuni: condominio, manutenzione e consumi. Elettricità e gas sono
  calcolati come quantità annua × tariffa, insieme ad acqua e internet.
- Lo **step 2** raccoglie le quattro opzioni in box compatti. Canoni, mesi e
  trattamento fiscale restano indipendenti; i costi comuni sono applicati con
  la quota coerente per ogni scenario.
- Ogni box mostra netto annuo e mensile, rendimento e la propria **soglia di
  pareggio**: canone per 4+4 e 3+2, mesi per il transitorio, occupazione per il
  turistico.
- Il 3+2 usa il canone inserito dall'accordo locale, non uno sconto medio; il
  transitorio prende il 10% e l'IMU ridotta solo quando è concordato e conforme.
- Nel turistico tariffa e pulizia addebitata formano il lordo fiscale; costo
  pulizia, piattaforme e gestione restano voci separate e visibili.

## Cosa non fa

- Non prevede il futuro: le medie cittadine non valgono per il singolo annuncio.
- Non considera il mutuo (identico nei quattro scenari), l'IRPEF ordinaria in
  alternativa alla cedolare, né il regime d'impresa (dal 2026 obbligatorio dal
  **terzo** appartamento in affitto breve).
- Non è una consulenza fiscale: prima di firmare, verifica con il tuo
  commercialista e con la delibera IMU del tuo comune.

## Eseguirlo in locale

```bash
git clone https://github.com/CryptoPannoz/rendita-affitti.git
cd rendita-affitti
npm run dev      # server statico su http://localhost:8080
npm test         # verifica formule, aliquote e soglie di pareggio
```

Nessuna dipendenza e nessun build: `index.html`, il motore puro `logic.mjs` e
due file di dati in `data/`.

## I dati

- `data/omi-capoluoghi.js` — valori e canoni OMI (Agenzia delle Entrate),
  rigenerabile con `npm run build:omi`.
- `data/mercato-breve.js` — ADR e occupazione per città con fonte e metrica
  dichiarate nel file (GuestFavorites/dati Airbnb ago 2026, AirROI TTM 2025-26,
  benchmark AIGAB). Le due metriche di occupazione (calendario vs notti
  disponibili) divergono per costruzione: il tool precompila la media e lo dice.
- Parametri fiscali (cedolare, IMU, concordato) aggiornati alla **Legge di
  Bilancio 2026** e alla guida Agenzia delle Entrate sulle locazioni brevi
  (aprile 2026). A ogni legge di bilancio vanno riverificati.

## Licenza

[MIT](LICENSE) — usalo, clonalo, adattalo. Se trovi un errore nei numeri,
apri una issue: è il modo migliore per migliorare uno strumento che usano tutti.

Dello stesso autore: [Comprare o affittare casa?](https://bebroggi.it/tools/affitto-vs-acquisto.html)
· [Holiday Radar](https://bebroggi.it/tools/holiday-radar/)
