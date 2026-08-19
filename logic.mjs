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

/* Verificato ad agosto 2026 con riferimenti normativi (sub-agente fiscale, 19/08/2026). */
export const FISCO = Object.freeze({
  anno: 2026,            // riverificare a ogni legge di bilancio (ultima: L. 199/2025)
  cedBreveUnico: 0.21,   // brevi, 1 immobile a scelta in dichiarazione — art. 4 c. 2 D.L. 50/2017 mod. L. 213/2023 art. 1 c. 63; Circ. AdE 10/E/2024
  cedBrevePlu: 0.26,     // brevi, aliquota ordinaria (2° immobile) — L. 213/2023 art. 1 c. 63; tetto 2 appartamenti e presunzione d'impresa dal 3°: L. 199/2025 art. 1 c. 17
  ced44: 0.21,           // canone libero (4+4 e transitorio) — D.Lgs. 23/2011 art. 3 c. 2
  cedConc: 0.10,         // concordato in comuni ATA (Del. CIPE 87/03) o calamitati (D.L. 47/2014 art. 9 c. 1 e 2-bis) — strutturale dal 2020: L. 160/2019 art. 1 c. 6; altrove 21%
  imuConc: 0.75,         // IMU al 75% per concordato, ovunque (no vincolo ATA) — L. 160/2019 art. 1 c. 760
  imuMolt: 1.05 * 160    // rendita +5% (L. 662/1996 art. 3 c. 48) × 160 cat. A non A/10 (L. 160/2019 c. 745); aliquote comunali: base 0,86% max 1,06% (c. 754), 1,14% solo ex maggiorazione TASI (c. 755)
});
// Cedolare = imposta sul 100% del canone/corrispettivo lordo: nessun costo deducibile, niente forfait 5% (quello vale solo in IRPEF ordinaria).
// Brevi: la ritenuta 21% degli intermediari è sempre a titolo d'acconto dal 2024 (L. 213/2023 art. 1 c. 63 lett. b).
// Pulizie forfettarie addebitate all'ospite: imponibili in cedolare (Circ. AdE 24/E/2017 §3.1); qui restano fuori dai ricavi (ADR pulizie escluse).

/**
 * Consumi (luce, gas, acqua, wifi): stimati dagli occupanti tipici e scalati
 * con la presenza effettiva. Una quota resta fissa anche a casa vuota
 * (canoni, wifi, minimi di riscaldamento); il resto segue le persone.
 */
export const CONSUMI = Object.freeze({
  baseAnnua: 600,        // €/anno di quota fissa dell'appartamento (wifi, canoni, minimi)
  perOccupante: 450,     // €/anno per occupante a piena presenza
  quotaFissa: 0.3        // parte dei consumi pieni che corre anche a casa vuota
});

/** Consumi annui a piena occupazione, dagli occupanti tipici. */
export function consumiPieni(occupanti) {
  return CONSUMI.baseAnnua + CONSUMI.perOccupante * nonNegativo(occupanti);
}

/** Consumi effettivi dell'anno data la presenza media (0..1). */
export function consumiEffettivi(pieni, presenza) {
  return nonNegativo(pieni) * (CONSUMI.quotaFissa + (1 - CONSUMI.quotaFissa) * quota(presenza));
}

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
    consumi: nonNegativo(p.consumi),   // consumi annui a piena occupazione
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

  // Affitto breve turistico: consumi scalati sull'occupazione
  const ricB = p.adr * 365 * p.occ;
  const aliqB = p.unico ? FISCO.cedBreveUnico : FISCO.cedBrevePlu;
  const consumiB = consumiEffettivi(p.consumi, p.occ);
  const breve = {
    k: 'breve', aliq: aliqB,
    ricavi: ricB,
    costi: ricB * (p.ota + p.gest) + consumiB + p.condominio + p.manut * 1.5,
    ced: ricB * aliqB,
    imu: imuPiena,
    notti: 365 * p.occ,
    consumi: consumiB
  };

  // Medio termine (transitorio a canone libero): consumi scalati sui mesi abitati
  const canM = p.canone * (1 + p.premio);
  const ricM = canM * p.mesiMedio;
  const consumiM = consumiEffettivi(p.consumi, p.mesiMedio / 12);
  const medio = {
    k: 'medio', aliq: FISCO.ced44,
    ricavi: ricM,
    costi: ricM * 0.05 + consumiM + p.condominio + p.manut,
    ced: ricM * FISCO.ced44,
    imu: imuPiena,
    canone: canM,
    consumi: consumiM
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
 * Forma chiusa, con i consumi che crescono con l'occupazione:
 *   netto(occ) = occ·[adr·365·(1 − ota − gest − ced) − (1−quotaFissa)·consumi]
 *                − quotaFissa·consumi − condominio − manut·1,5 − IMU
 * Ritorna null se il margine per punto di occupazione è nullo o serve
 * un'occupazione irrealistica (> 150%).
 */
export function breakEvenOcc(grezzi, obiettivo) {
  const p = normalizza(grezzi);
  const aliqB = p.unico ? FISCO.cedBreveUnico : FISCO.cedBrevePlu;
  const fissi = CONSUMI.quotaFissa * p.consumi + p.condominio + p.manut * 1.5;
  const margine = p.adr * 365 * (1 - p.ota - p.gest - aliqB)
    - (1 - CONSUMI.quotaFissa) * p.consumi;
  if (margine <= 0) return null;
  const occ = (numero(obiettivo) + fissi + calcolaImu(p.rendcat, p.aliq)) / margine;
  return occ > 0 && occ <= 1.5 ? occ : null;
}
