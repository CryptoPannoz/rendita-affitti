/**
 * Motore di calcolo — puro, senza DOM e senza stringhe di interfaccia.
 *
 * Nato dalla fusione di due versioni: la UI bilingue (index.html) e il
 * motore modulare con test (branch motore-modulare). Le regole del modello
 * sono quelle decise da Alberto e documentate in CLAUDE.md:
 *
 * - Affitto breve: consumi inclusi (a carico host), condominio pieno,
 *   manutenzione +50%, cedolare 26% (21% per un solo immobile a scelta).
 * - Medio termine (transitorio): di norma canone = 4+4 (il "premio" parte
 *   da zero), consumi inclusi, condominio pieno, gestione 5%, cedolare 21%.
 *   Il 10% del transitorio concordato richiede il canone da tabelle e non
 *   è modellato.
 * - 4+4: utenze all'inquilino, condominio al 20% (straordinaria), sfitto
 *   pieno, cedolare 21%.
 * - 3+2 concordato: canone scontato, sfitto dimezzato, cedolare 10% solo
 *   nei comuni ad alta tensione abitativa (21% altrove), IMU al 75% ovunque.
 *
 * Ogni numero fiscale ha il suo anno: a ogni legge di bilancio va
 * riverificato. Prima di committare: `npm test`.
 */

export const FISCO = Object.freeze({
  anno: 2026,
  cedBreveUnico: 0.21,   // affitti brevi: ridotta, per un solo immobile a scelta (L. 213/2023)
  cedBrevePlu: 0.26,     // aliquota standard; dal 2026 max 2 immobili, dal 3° impresa (L. 199/2025)
  ced44: 0.21,           // 4+4 canone libero e transitorio a canone libero
  cedConc: 0.10,         // 3+2 concordato, SOLO comuni alta tensione abitativa
  imuConc: 0.75,         // IMU ridotta al 75% per il concordato (ovunque)
  imuMolt: 1.05 * 160    // rendita catastale → base imponibile abitazioni
});

const numero = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const nonNegativo = v => Math.max(0, numero(v));
const quota = v => Math.min(1, Math.max(0, numero(v)));

/** IMU annua piena: rendita rivalutata × moltiplicatore × aliquota in ‰. */
export function calcolaImu(renditaCatastale, aliquotaPerMille) {
  return nonNegativo(renditaCatastale) * FISCO.imuMolt * nonNegativo(aliquotaPerMille) / 1000;
}

/** Normalizza i parametri grezzi (input utente) in valori sicuri. */
export function normalizza(p = {}) {
  return {
    valore: nonNegativo(p.valore),
    rendcat: nonNegativo(p.rendcat),
    canone: nonNegativo(p.canone),
    sconto: quota(p.sconto),
    adr: nonNegativo(p.adr),
    occ: quota(p.occ),
    premio: Math.max(-1, numero(p.premio)),          // può essere negativo (canone sotto il 4+4)
    mesiMedio: Math.min(12, nonNegativo(p.mesiMedio)),
    aliq: nonNegativo(p.aliq),
    ota: quota(p.ota),
    gest: quota(p.gest),
    utenze: nonNegativo(p.utenze),
    condominio: nonNegativo(p.condominio),
    manut: nonNegativo(p.manut),
    sfitto: quota(p.sfitto),
    unico: Boolean(p.unico),
    alta: Boolean(p.alta)
  };
}

/**
 * I quattro scenari, solo numeri. La cedolare si applica sempre sul lordo:
 * con la cedolare secca nessun costo è deducibile.
 */
export function calcolaScenari(grezzi) {
  const p = normalizza(grezzi);
  const imuPiena = calcolaImu(p.rendcat, p.aliq);
  const imuConc = imuPiena * FISCO.imuConc;

  // Affitto breve turistico
  const ricB = p.adr * 365 * p.occ;
  const aliqB = p.unico ? FISCO.cedBreveUnico : FISCO.cedBrevePlu;
  const breve = {
    k: 'breve', aliq: aliqB,
    ricavi: ricB,
    costi: ricB * (p.ota + p.gest) + p.utenze + p.condominio + p.manut * 1.5,
    ced: ricB * aliqB,
    imu: imuPiena,
    notti: 365 * p.occ
  };

  // Medio termine (transitorio a canone libero)
  const canM = p.canone * (1 + p.premio);
  const ricM = canM * p.mesiMedio;
  const medio = {
    k: 'medio', aliq: FISCO.ced44,
    ricavi: ricM,
    costi: ricM * 0.05 + p.utenze + p.condominio + p.manut,
    ced: ricM * FISCO.ced44,
    imu: imuPiena,
    canone: canM
  };

  // 4+4 canone libero
  const ric4 = p.canone * 12 * (1 - p.sfitto);
  const lib44 = {
    k: 'lib44', aliq: FISCO.ced44,
    ricavi: ric4,
    costi: p.condominio * 0.2 + p.manut,
    ced: ric4 * FISCO.ced44,
    imu: imuPiena,
    canone: p.canone
  };

  // 3+2 concordato
  const canC = p.canone * (1 - p.sconto);
  const ricC = canC * 12 * (1 - p.sfitto / 2);
  const aliqC = p.alta ? FISCO.cedConc : FISCO.ced44;
  const conc = {
    k: 'conc', aliq: aliqC,
    ricavi: ricC,
    costi: p.condominio * 0.2 + p.manut,
    ced: ricC * aliqC,
    imu: imuConc,                                    // la riduzione IMU vale ovunque
    canone: canC
  };

  for (const s of [breve, medio, lib44, conc]) {
    s.netto = s.ricavi - s.costi - s.ced - s.imu;
    s.rendimento = p.valore > 0 ? s.netto / p.valore : 0;
  }
  return { breve, medio, lib44, conc, imuPiena, imuConc };
}

/** Scenari ordinati per netto decrescente. */
export function classifica(scenari) {
  return [scenari.breve, scenari.medio, scenari.lib44, scenari.conc]
    .sort((a, b) => b.netto - a.netto);
}

/**
 * Occupazione alla quale l'affitto breve raggiunge un netto obiettivo.
 * Forma chiusa: netto(occ) = adr·365·occ·(1 − ota − gest − ced) − fissi − IMU.
 * Ritorna null se il margine per notte è nullo o l'occupazione necessaria
 * è irrealistica (> 150%).
 */
export function breakEvenOcc(grezzi, obiettivo) {
  const p = normalizza(grezzi);
  const aliqB = p.unico ? FISCO.cedBreveUnico : FISCO.cedBrevePlu;
  const fissi = p.utenze + p.condominio + p.manut * 1.5;
  const margine = p.adr * 365 * (1 - p.ota - p.gest - aliqB);
  if (margine <= 0) return null;
  const occ = (numero(obiettivo) + fissi + calcolaImu(p.rendcat, p.aliq)) / margine;
  return occ > 0 && occ <= 1.5 ? occ : null;
}
