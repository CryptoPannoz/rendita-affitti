#!/usr/bin/env node
// Costruisce il dataset dei capoluoghi da un file "VALORI" delle Quotazioni Immobiliari OMI.
//
//   node tools/data/build-omi-capoluoghi.mjs <file_VALORI.csv> <etichetta_periodo>
//   es. node tools/data/build-omi-capoluoghi.mjs QI_..._20251_VALORI.csv "2025/1"
//
// Il file si scarica gratis dall'area riservata dell'Agenzia delle Entrate
// (accesso con SPID, CIE, CNS o credenziali Fisconline/Entratel):
//   Servizi ipotecari e catastali, OMI → Forniture OMI - Quotazioni Immobiliari
// Fonte da citare: "Agenzia Entrate - OMI".
import { readFileSync, writeFileSync } from 'node:fs';

const [file, periodo] = process.argv.slice(2);
if (!file || !periodo) {
  console.error('uso: node build-omi-capoluoghi.mjs <file_VALORI.csv> <periodo, es. 2025/1>');
  process.exit(1);
}

// I 107 capoluoghi di provincia e città metropolitane.
const CAPOLUOGHI = [
  'Agrigento','Alessandria','Ancona','Aosta','Arezzo','Ascoli Piceno','Asti','Avellino',
  'Bari','Barletta','Belluno','Benevento','Bergamo','Biella','Bologna','Bolzano','Brescia','Brindisi',
  'Cagliari','Caltanissetta','Campobasso','Caserta','Catania','Catanzaro','Chieti','Como','Cosenza',
  'Cremona','Crotone','Cuneo','Enna','Fermo','Ferrara','Firenze','Foggia','Forlì','Frosinone',
  'Genova','Gorizia','Grosseto','Imperia','Isernia','L\'Aquila','La Spezia','Latina','Lecce','Lecco',
  'Livorno','Lodi','Lucca','Macerata','Mantova','Massa','Matera','Messina','Milano','Modena','Monza',
  'Napoli','Novara','Nuoro','Oristano','Padova','Palermo','Parma','Pavia','Perugia','Pesaro','Pescara',
  'Piacenza','Pisa','Pistoia','Pordenone','Potenza','Prato','Ragusa','Ravenna','Reggio Calabria',
  'Reggio Emilia','Rieti','Rimini','Roma','Rovigo','Salerno','Sassari','Savona','Siena','Siracusa',
  'Sondrio','Taranto','Teramo','Terni','Torino','Trapani','Trento','Treviso','Trieste','Udine',
  'Varese','Venezia','Verbania','Vercelli','Verona','Vibo Valentia','Vicenza','Viterbo',
  'Andria','Trani','Carbonia','Iglesias','Sanluri','Villacidro','Olbia','Tempio Pausania','Lanusei','Tortolì'
];

// Alcuni capoluoghi nel file OMI hanno la denominazione ufficiale completa.
const ALIAS = {
  'Bolzano': 'BOLZANO .BOZEN.',
  'Reggio Calabria': 'REGGIO DI  CALABRIA',
  'Reggio Emilia': 'REGGIO NELL`EMILIA'
};

// I nomi nel file OMI sono maiuscoli, senza accenti e con apostrofi resi come backtick o punto.
const norm = s => s.toUpperCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[`'’.]/g, ' ')
  .replace(/[^A-Z ]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const raw = readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

// L'export ufficiale ha una riga di titolo prima dell'header; il mirror onData no.
// L'header è la riga che contiene i nomi delle colonne.
const headIdx = lines.findIndex(l => l.includes('Comune_descrizione') && l.includes('Compr_min'));
if (headIdx < 0) { throw new Error('header non trovato: il file non sembra un export VALORI delle quotazioni OMI'); }
const headLine = lines[headIdx];
const sep = (headLine.match(/;/g) || []).length > (headLine.match(/,/g) || []).length ? ';' : ',';

// Parser CSV minimale: gestisce i campi fra doppi apici (i decimali italiani sono quotati)
function parse(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}
const head = parse(headLine).map(h => h.trim());
const col = n => { const i = head.indexOf(n); if (i < 0) { throw new Error('colonna assente: ' + n); } return i; };
const [cCom, cProv, cTip, cStato, cCmin, cCmax, cLmin, cLmax, cZona] =
  ['Comune_descrizione','Prov','Descr_Tipologia','Stato','Compr_min','Compr_max','Loc_min','Loc_max','Zona'].map(col);

const num = s => { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) && v > 0 ? v : null; };
const target = new Map(CAPOLUOGHI.map(c => [norm(ALIAS[c] || c), c]));
const acc = new Map();   // nome normalizzato -> { nome, prov, compr:[], loc:[], zone:Set }

for (let i = headIdx + 1; i < lines.length; i++) {
  const r = parse(lines[i]);
  if (r[cTip] !== 'Abitazioni civili' || r[cStato] !== 'NORMALE') { continue; }
  const key = norm(r[cCom]);
  if (!target.has(key)) { continue; }
  if (!acc.has(key)) { acc.set(key, { nome: target.get(key), prov: r[cProv], compr: [], loc: [], zone: new Set() }); }
  const a = acc.get(key);
  a.zone.add(r[cZona]);
  const cmin = num(r[cCmin]), cmax = num(r[cCmax]);
  const lmin = num(r[cLmin]), lmax = num(r[cLmax]);
  if (cmin && cmax) { a.compr.push((cmin + cmax) / 2); }
  if (lmin && lmax) { a.loc.push((lmin + lmax) / 2); }
}

const median = xs => {
  if (!xs.length) { return null; }
  const s = [...xs].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const citta = [...acc.values()]
  .filter(a => a.compr.length && a.loc.length)
  .map(a => ({
    n: a.nome, p: a.prov,
    v: Math.round(median(a.compr)),                      // €/m² compravendita
    a: Math.round(median(a.loc) * 10) / 10,              // €/m²/mese locazione
    z: a.zone.size                                       // zone su cui è calcolata la mediana
  }))
  .sort((x, y) => x.n.localeCompare(y.n, 'it'));

const mancanti = CAPOLUOGHI.filter(c => !acc.has(norm(ALIAS[c] || c)));
const out = { fonte: 'Agenzia Entrate - OMI', periodo, tipologia: 'Abitazioni civili, stato normale', citta };
writeFileSync('tools/data/omi-capoluoghi.json', JSON.stringify(out));
// Versione caricabile da <script>: evita la fetch, cosi la pagina funziona anche da file://
writeFileSync('tools/data/omi-capoluoghi.js',
  '/* Generato da build-omi-capoluoghi.mjs · Fonte: Agenzia Entrate - OMI · periodo ' + periodo + ' */\n' +
  'window.OMI = ' + JSON.stringify(out) + ';\n');

console.log(`periodo ${periodo} · separatore "${sep}" · ${lines.length - headIdx - 1} righe lette`);
console.log(`citta con dati completi: ${citta.length} su ${CAPOLUOGHI.length} cercate`);
if (mancanti.length) { console.log('non trovate nel file: ' + mancanti.join(', ')); }
const senzaAffitto = [...acc.values()].filter(a => a.compr.length && !a.loc.length).map(a => a.nome);
if (senzaAffitto.length) { console.log('senza valori di locazione: ' + senzaAffitto.join(', ')); }
console.log('scritti tools/data/omi-capoluoghi.json e .js');
