# Rendita immobiliare affitti 🏠 · Italian rental yield calculator

**Quanto rende davvero il tuo immobile?** Calcolatore gratuito e open source
(italiano + English) che confronta, sul **netto annuo**, i quattro modi di
mettere a reddito una casa in Italia:

| Regime | Cedolare secca | IMU | Consumi | Occupazione |
|---|---|---|---|---|
| **Affitto breve turistico** | 26% (21% per un solo immobile) | piena | **inclusi** (a carico host) | prezzo a notte × notti vendute |
| **Medio termine / transitorio** (1–18 mesi) | 21% | piena | **inclusi** | mesi affittati l'anno, canone ≈ 4+4 |
| **4+4 canone libero** | 21% | piena | all'inquilino | 12 mesi − sfitto |
| **3+2 canone concordato** | 10% nei comuni ATA (21% altrove) | **75%** | all'inquilino | 12 mesi − sfitto/2 |

Il transitorio a canone concordato (canone da tabelle, cedolare 10% nei comuni
ad alta tensione abitativa) esiste ma non è modellato: è spiegato nel metodo.

👉 **Prova subito: [bebroggi.it/tools/rendita-affitti](https://bebroggi.it/tools/rendita-affitti/)** (IT/EN)

Nessuna registrazione: i conti girano tutti nel browser. Il dettaglio dei
risultati si sblocca lasciando un'email (vedi «Il cancello dei risultati»).

## Cosa fa

- Scegli una città e la metratura: valore, canone di mercato e rendita catastale
  si precompilano dai **dati OMI dell'Agenzia delle Entrate** (110 capoluoghi);
  prezzo a notte e occupazione dell'affitto breve dalle medie di mercato
  pubbliche (dati Airbnb / AirROI 2025-26) per 14 città turistiche.
- **Ogni regime ha il suo box interattivo** (3+2, 4+4, medio termine, breve):
  regola il lordo mensile e leggi sulla stessa linea la **soglia oltre la quale
  lo scenario batte la migliore alternativa**. Canone e manutenzione sono
  indipendenti per ciascuno scenario, compreso il maggior costo del breve.
- **Calcolatore dei consumi trasparente**: kWh × tariffa per la luce, Smc ×
  tariffa per il gas, acqua, Wi-Fi e altre voci. Il totale viene scalato sulla
  presenza reale; **stagionalità mensile per regione** dal dataset Eurostat
  sugli alloggi via piattaforme (tour_ce_omn12).
- Output: netto annuo e mensile per ciascun regime, rendita netta in % del
  valore, **punto di pareggio dell'occupazione** per l'affitto breve e tabella
  di sensibilità. I parametri fiscali in `logic.mjs` portano ciascuno il
  proprio **riferimento normativo** (legge, articolo, comma).

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
npm test         # test del motore di calcolo (node --test, zero dipendenze)
```

Nessuna dipendenza, nessun build: `index.html` (interfaccia bilingue),
`logic.mjs` (il motore di calcolo, testato in `tests/`), due file di dati
in `data/`.

## Il cancello dei risultati (email + Firebase)

I risultati non compaiono in tempo reale: si compilano immobile e canoni, si
clicca **«Calcola il verdetto»** e il tool dice solo chi vince. Il dettaglio
(netti, grafico, pareggio, sensibilità), il PDF e la condivisione si sbloccano
lasciando un'email, salvata su **Cloud Firestore** (progetto `rendita-affitti`,
regione `eur3`, collezione `rendita-leads`). L'SDK viene importato solo al
momento dell'invio: fino ad allora la pagina non fa chiamate di rete.

La chiave web nel sorgente non è un segreto: identifica il progetto, non
autorizza nulla. A proteggere i dati sono le regole di Firestore — solo
`create` con email valida, niente letture dal browser:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    match /rendita-leads/{doc} {
      allow create: if request.resource.data.email is string
        && request.resource.data.email.matches('.+@.+[.].+')
        && request.resource.data.email.size() < 200
        && request.resource.data.keys().hasOnly(['email', 'lingua', 'citta', 'vincitore', 'netto', 'creato']);
    }
  }
}
```

Se il salvataggio fallisce (regole non pubblicate, rete assente), il visitatore
viene sbloccato comunque: meglio perdere un lead che rompere lo strumento.
Lo sblocco è ricordato in `localStorage` (`ra-email`).

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
