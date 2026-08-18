/**
 * Stime di mercato dell'affitto breve per città — DICHIARATE, NON MISURATE.
 *
 * adr    = tariffa media a notte in €, media degli annunci della città
 *          (GuestFavorites su dati Airbnb, agosto 2026; per Rimini AirROI
 *          TTM 2025-26, convertita da USD).
 * occAdj = occupazione sulle notti DISPONIBILI (esclude i giorni bloccati
 *          dall'host): GuestFavorites/AirDNA, ago 2026. Sovrastima un poco
 *          un immobile dedicato tutto l'anno.
 * occCal = occupazione sul CALENDARIO (notti vendute / 365, inclusi gli
 *          annunci part-time): AirROI, TTM ago 2025 – lug 2026. Sottostima
 *          un immobile dedicato.
 * Il tool precompila la media delle due: un punto di partenza prudente per
 * un immobile messo a reddito tutto l'anno. Se cambi un numero, cambia la fonte.
 *
 * Fonti:
 *  - https://www.guestfavorites.com/airbnb-occupancy-rates-by-city-in-italy
 *  - https://www.airroi.com/report/world/italy
 *  - https://www.airdna.co/vacation-rental-data/app/it/lazio/rome/overview
 *  - Benchmark nazionale AIGAB 2025: occupazione 63-65%, tariffa media 167 €.
 */
window.MERCATO_BREVE = {
  fonte: 'ADR e occupazione affitti brevi: GuestFavorites (dati Airbnb, ago 2026) e AirROI (TTM 2025-26)',
  citta: {
    'Roma':     { adr: 187, occAdj: 0.70, occCal: 0.47 },
    'Milano':   { adr: 151, occAdj: 0.65, occCal: 0.40 },
    'Firenze':  { adr: 181, occAdj: 0.66, occCal: 0.45 },
    'Venezia':  { adr: 215, occAdj: 0.64, occCal: 0.44 },
    'Bologna':  { adr: 146, occAdj: 0.68, occCal: 0.44 },
    'Napoli':   { adr: 118, occAdj: 0.61, occCal: 0.37 },
    'Torino':   { adr: 96,  occAdj: 0.61, occCal: 0.40 },
    'Palermo':  { adr: 101, occAdj: 0.63, occCal: 0.39 },
    'Bari':     { adr: 115, occAdj: 0.68, occCal: 0.39 },
    'Catania':  { adr: 86,  occAdj: 0.61, occCal: 0.37 },
    'Verona':   { adr: 155, occAdj: 0.60, occCal: 0.38 },
    'Trieste':  { adr: 119, occAdj: 0.60, occCal: 0.38 },
    'Genova':   { adr: 110, occAdj: 0.58, occCal: 0.36 },
    'Rimini':   { adr: 140, occAdj: null, occCal: 0.32 }
  }
};
