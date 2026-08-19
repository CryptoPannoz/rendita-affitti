#!/usr/bin/env node
/**
 * build-stagionalita.mjs — genera data/stagionalita.js
 *
 * Scarica da Eurostat (dataset sperimentale TOUR_CE_OMN12: notti trascorse in
 * alloggi brevi prenotati via piattaforme — Airbnb, Booking, Expedia, Tripadvisor)
 * le notti mensili dell'ultimo anno solare completo per tutte le regioni NUTS-2
 * italiane, e calcola per ogni regione 12 moltiplicatori di stagionalità
 * (notti del mese / media mensile — la media dei 12 moltiplicatori è 1).
 *
 * Zero dipendenze: usa il fetch nativo di Node (>= 18).
 * Uso: node scripts/build-stagionalita.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'data', 'stagionalita.js');
const OMI_FILE = join(ROOT, 'data', 'omi-capoluoghi.js');

const DATASET = 'tour_ce_omn12';
const API_BASE = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${DATASET}`;

// Regioni NUTS-2 italiane (nomenclatura NUTS 2021/2024)
const REGIONI = {
  ITC1: 'Piemonte',
  ITC2: "Valle d'Aosta",
  ITC3: 'Liguria',
  ITC4: 'Lombardia',
  ITH1: 'Provincia Autonoma di Bolzano',
  ITH2: 'Provincia Autonoma di Trento',
  ITH3: 'Veneto',
  ITH4: 'Friuli-Venezia Giulia',
  ITH5: 'Emilia-Romagna',
  ITI1: 'Toscana',
  ITI2: 'Umbria',
  ITI3: 'Marche',
  ITI4: 'Lazio',
  ITF1: 'Abruzzo',
  ITF2: 'Molise',
  ITF3: 'Campania',
  ITF4: 'Puglia',
  ITF5: 'Basilicata',
  ITF6: 'Calabria',
  ITG1: 'Sicilia',
  ITG2: 'Sardegna',
};

// Sigla provinciale → regione NUTS-2. Copre tutte le sigle usate in
// data/omi-capoluoghi.js (campo "p"), incluse quelle storiche (FO = Forlì,
// PS = Pesaro) e le città che OMI mappa su sigle di vecchie province
// (Monza → MI, Fermo → AP, Andria/Barletta/Trani → BA, Carbonia/Iglesias/
// Sanluri/Villacidro → CA, Olbia/Tempio Pausania → SS, Tortolì → NU).
const PROVINCE = {
  // Piemonte
  TO: 'ITC1', VC: 'ITC1', NO: 'ITC1', CN: 'ITC1', AT: 'ITC1', AL: 'ITC1', BI: 'ITC1', VB: 'ITC1',
  // Valle d'Aosta
  AO: 'ITC2',
  // Liguria
  IM: 'ITC3', SV: 'ITC3', GE: 'ITC3', SP: 'ITC3',
  // Lombardia
  VA: 'ITC4', CO: 'ITC4', SO: 'ITC4', MI: 'ITC4', BG: 'ITC4', BS: 'ITC4', PV: 'ITC4',
  CR: 'ITC4', MN: 'ITC4', LC: 'ITC4', LO: 'ITC4', MB: 'ITC4',
  // Trentino-Alto Adige: due NUTS-2 distinte
  BZ: 'ITH1', TN: 'ITH2',
  // Veneto
  VR: 'ITH3', VI: 'ITH3', BL: 'ITH3', TV: 'ITH3', VE: 'ITH3', PD: 'ITH3', RO: 'ITH3',
  // Friuli-Venezia Giulia
  UD: 'ITH4', GO: 'ITH4', TS: 'ITH4', PN: 'ITH4',
  // Emilia-Romagna
  PC: 'ITH5', PR: 'ITH5', RE: 'ITH5', MO: 'ITH5', BO: 'ITH5', FE: 'ITH5', RA: 'ITH5',
  FO: 'ITH5', FC: 'ITH5', RN: 'ITH5',
  // Toscana
  MS: 'ITI1', LU: 'ITI1', PT: 'ITI1', FI: 'ITI1', LI: 'ITI1', PI: 'ITI1', AR: 'ITI1',
  SI: 'ITI1', GR: 'ITI1', PO: 'ITI1',
  // Umbria
  PG: 'ITI2', TR: 'ITI2',
  // Marche
  PS: 'ITI3', PU: 'ITI3', AN: 'ITI3', MC: 'ITI3', AP: 'ITI3', FM: 'ITI3',
  // Lazio
  VT: 'ITI4', RI: 'ITI4', RM: 'ITI4', LT: 'ITI4', FR: 'ITI4',
  // Abruzzo
  AQ: 'ITF1', TE: 'ITF1', PE: 'ITF1', CH: 'ITF1',
  // Molise
  CB: 'ITF2', IS: 'ITF2',
  // Campania
  CE: 'ITF3', BN: 'ITF3', NA: 'ITF3', AV: 'ITF3', SA: 'ITF3',
  // Puglia
  FG: 'ITF4', BA: 'ITF4', TA: 'ITF4', BR: 'ITF4', LE: 'ITF4', BT: 'ITF4',
  // Basilicata
  PZ: 'ITF5', MT: 'ITF5',
  // Calabria
  CS: 'ITF6', CZ: 'ITF6', RC: 'ITF6', KR: 'ITF6', VV: 'ITF6',
  // Sicilia
  TP: 'ITG1', PA: 'ITG1', ME: 'ITG1', AG: 'ITG1', CL: 'ITG1', EN: 'ITG1',
  CT: 'ITG1', RG: 'ITG1', SR: 'ITG1',
  // Sardegna (CA copre anche Sud Sardegna: Carbonia, Iglesias, Sanluri, Villacidro)
  SS: 'ITG2', NU: 'ITG2', CA: 'ITG2', OR: 'ITG2', SU: 'ITG2',
};

const MONTH_CODES = ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09', 'M10', 'M11', 'M12'];

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new Error(`Impossibile raggiungere l'API Eurostat (${err.message}). Controlla la connessione e riprova.`);
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`API Eurostat: HTTP ${res.status} ${res.statusText}\nURL: ${url}\nRisposta: ${body}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`API Eurostat ha risposto con un errore: ${JSON.stringify(data.error).slice(0, 300)}`);
  }
  return data;
}

/** Indice lineare di una cella nel value map JSON-stat (dimensioni in ordine `id`). */
function cellIndex(data, coords) {
  let idx = 0;
  for (let d = 0; d < data.id.length; d++) {
    const dim = data.id[d];
    const catIdx = data.dimension[dim].category.index;
    const pos = coords[dim] !== undefined ? catIdx[coords[dim]] : 0;
    if (pos === undefined) throw new Error(`Codice "${coords[dim]}" non trovato nella dimensione "${dim}"`);
    idx = idx * data.size[d] + pos;
  }
  return idx;
}

async function main() {
  const geoParams = Object.keys(REGIONI).map((g) => `geo=${g}`).join('&');

  // 1) Scopri gli anni disponibili (query leggera su una sola regione)
  const meta = await fetchJson(`${API_BASE}?format=JSON&lang=en&indic_to=NGT_SP&c_resid=TOTAL&unit=NR&geo=ITC1`);
  const years = Object.keys(meta.dimension.time.category.index).sort();
  if (years.length === 0) throw new Error(`Il dataset ${DATASET} non espone alcun anno.`);

  // 2) Trova l'ultimo anno solare COMPLETO (12 mesi valorizzati per tutte le regioni)
  let data = null;
  let anno = null;
  for (let i = years.length - 1; i >= 0; i--) {
    const y = years[i];
    const url = `${API_BASE}?format=JSON&lang=en&indic_to=NGT_SP&c_resid=TOTAL&unit=NR&time=${y}&${geoParams}`;
    const d = await fetchJson(url);
    const geoDisponibili = Object.keys(d.dimension.geo.category.index);
    const mancanti = Object.keys(REGIONI).filter((g) => !geoDisponibili.includes(g));
    if (mancanti.length > 0) {
      console.warn(`Anno ${y}: regioni assenti dal dataset (${mancanti.join(', ')}), provo l'anno precedente.`);
      continue;
    }
    const completo = Object.keys(REGIONI).every((g) =>
      MONTH_CODES.every((m) => {
        const v = d.value[String(cellIndex(d, { geo: g, month: m, time: y, indic_to: 'NGT_SP', c_resid: 'TOTAL', unit: 'NR', freq: 'A' }))];
        return typeof v === 'number' && v > 0;
      })
    );
    if (completo) {
      data = d;
      anno = y;
      break;
    }
    console.warn(`Anno ${y}: dati mensili incompleti, provo l'anno precedente.`);
  }
  if (!data) throw new Error(`Nessun anno con 12 mesi completi per tutte le regioni NUTS-2 in ${DATASET}.`);

  // 3) Calcola i moltiplicatori: notti_mese / media_mensile (media dei 12 = 1)
  const regioni = {};
  for (const [geo, nome] of Object.entries(REGIONI)) {
    const notti = MONTH_CODES.map(
      (m) => data.value[String(cellIndex(data, { geo, month: m, time: anno, indic_to: 'NGT_SP', c_resid: 'TOTAL', unit: 'NR', freq: 'A' }))]
    );
    const media = notti.reduce((a, b) => a + b, 0) / 12;
    const m = notti.map((n) => Math.round((n / media) * 100) / 100);
    regioni[geo] = { nome, m };
  }

  // 4) Verifica di sanità: media dei moltiplicatori arrotondati = 1.00 ± 0.01
  for (const [geo, { nome, m }] of Object.entries(regioni)) {
    const media = m.reduce((a, b) => a + b, 0) / 12;
    if (Math.abs(media - 1) > 0.01) {
      throw new Error(`Sanity check fallito per ${geo} (${nome}): media moltiplicatori = ${media.toFixed(4)}`);
    }
  }

  // 5) Verifica che la mappa province copra tutte le sigle di omi-capoluoghi.js
  if (existsSync(OMI_FILE)) {
    const omiSrc = readFileSync(OMI_FILE, 'utf8');
    const sigle = new Set([...omiSrc.matchAll(/"p":\s*"([A-Z]+)"/g)].map((x) => x[1]));
    const nonMappate = [...sigle].filter((s) => !PROVINCE[s]);
    if (nonMappate.length > 0) {
      throw new Error(`Sigle provinciali di omi-capoluoghi.js senza regione NUTS-2: ${nonMappate.join(', ')}`);
    }
  } else {
    console.warn('Avviso: data/omi-capoluoghi.js non trovato, salto la verifica di copertura delle province.');
  }

  // 6) Scrivi data/stagionalita.js
  const righeRegioni = Object.entries(regioni)
    .map(([geo, { nome, m }]) => `    '${geo}': { nome: '${nome.replace(/'/g, "\\'")}', m: [${m.map((v) => v.toFixed(2)).join(', ')}] }`)
    .join(',\n');
  const righeProvince = Object.entries(PROVINCE)
    .map(([sigla, geo]) => `'${sigla}': '${geo}'`)
    .join(', ');

  const out = `/* Generato da build-stagionalita.mjs · Fonte: Eurostat ${DATASET}, notti in alloggi via piattaforme, anno ${anno} */
window.STAGIONALITA = {
  fonte: 'Eurostat ${DATASET}, anno ${anno}',
  regioni: {
${righeRegioni}
  },
  province: { ${righeProvince} }
};
`;
  writeFileSync(OUT_FILE, out, 'utf8');

  // 7) Riepilogo
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  console.log(`\nStagionalità Eurostat ${DATASET} — notti trascorse (NGT_SP), anno ${anno}`);
  console.log(`Scritto: ${OUT_FILE}\n`);
  console.log('Regione'.padEnd(34) + MESI.map((x) => x.padStart(6)).join(''));
  for (const [geo, { nome, m }] of Object.entries(regioni)) {
    console.log(`${geo} ${nome}`.padEnd(34) + m.map((v) => v.toFixed(2).padStart(6)).join(''));
  }
  console.log(`\nRegioni: ${Object.keys(regioni).length} · Province mappate: ${Object.keys(PROVINCE).length}`);
}

main().catch((err) => {
  console.error(`\nErrore: ${err.message}`);
  process.exit(1);
});
