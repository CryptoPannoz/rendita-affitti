/**
 * Motore di calcolo — puro, senza DOM e senza stringhe di interfaccia.
 *
 * Nato dalla fusione di due versioni: la UI bilingue (index.html) e il
 * motore modulare con test (branch motore-modulare). Le regole del modello
 * sono quelle decise da Alberto e documentate in CLAUDE.md:
 *
 * - Affitto breve: consumi inclusi (a carico host), condominio pieno,
 *   manutenzione specifica più alta, cedolare 26% (21% per un solo immobile a scelta).
 * - Medio termine (transitorio): di norma canone = 4+4 (il "premio" parte
 *   da zero), consumi inclusi, condominio pieno, gestione 5%, cedolare 21%.
 *   Canone e manutenzione sono regolabili nello scenario. Il 10% del
 *   transitorio concordato richiede il canone da tabelle e non è modellato.
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

/** Dettaglio trasparente dei consumi annuali inseriti nel calcolatore. */
export function calcolaConsumiVoci(v = {}) {
  const luce = nonNegativo(v.luceKwh) * nonNegativo(v.luceTariffa);
  const gas = nonNegativo(v.gasSmc) * nonNegativo(v.gasTariffa);
  const acqua = nonNegativo(v.acqua);
  const internet = nonNegativo(v.internetMensile) * 12;
  const altro = nonNegativo(v.altro);
  return { luce, gas, acqua, internet, altro, totale: luce + gas + acqua + internet + altro };
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
  const canone = nonNegativo(p.canone);
  const sconto = quota(p.sconto);
  const premio = Math.max(-1, numero(p.premio));
  const manut = nonNegativo(p.manut);
  return {
    valore: nonNegativo(p.valore),
    rendcat: nonNegativo(p.rendcat),
    canone,
    canoneConc: p.canoneConc == null ? canone * (1 - sconto) : nonNegativo(p.canoneConc),
    canoneLib44: p.canoneLib44 == null ? canone : nonNegativo(p.canoneLib44),
    canoneMedio: p.canoneMedio == null ? canone * (1 + premio) : nonNegativo(p.canoneMedio),
    sconto,
    adr: nonNegativo(p.adr),
    occ: quota(p.occ),
    premio,                                           // fallback storico per il canone medio
    mesiMedio: Math.min(12, nonNegativo(p.mesiMedio)),
    aliq: nonNegativo(p.aliq),
    ota: quota(p.ota),
    gest: quota(p.gest),
    consumi: nonNegativo(p.consumi),   // consumi annui a piena occupazione
    condominio: nonNegativo(p.condominio),
    manut,
    manutConc: p.manutConc == null ? manut : nonNegativo(p.manutConc),
    manutLib44: p.manutLib44 == null ? manut : nonNegativo(p.manutLib44),
    manutMedio: p.manutMedio == null ? manut : nonNegativo(p.manutMedio),
    manutBreve: p.manutBreve == null ? manut * 1.5 : nonNegativo(p.manutBreve),
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
    costi: ricB * (p.ota + p.gest) + consumiB + p.condominio + p.manutBreve,
    ced: ricB * aliqB,
    imu: imuPiena,
    notti: 365 * p.occ,
    consumi: consumiB
  };

  // Medio termine (transitorio a canone libero): consumi scalati sui mesi abitati
  const canM = p.canoneMedio;
  const ricM = canM * p.mesiMedio;
  const consumiM = consumiEffettivi(p.consumi, p.mesiMedio / 12);
  const medio = {
    k: 'medio', aliq: FISCO.ced44,
    ricavi: ricM,
    costi: ricM * 0.05 + consumiM + p.condominio + p.manutMedio,
    ced: ricM * FISCO.ced44,
    imu: imuPiena,
    canone: canM,
    consumi: consumiM
  };

  // 4+4 canone libero
  const ric4 = p.canoneLib44 * 12 * (1 - p.sfitto);
  const lib44 = {
    k: 'lib44', aliq: FISCO.ced44,
    ricavi: ric4,
    costi: p.condominio * 0.2 + p.manutLib44,
    ced: ric4 * FISCO.ced44,
    imu: imuPiena,
    canone: p.canoneLib44
  };

  // 3+2 concordato
  const canC = p.canoneConc;
  const ricC = canC * 12 * (1 - p.sfitto / 2);
  const aliqC = p.alta ? FISCO.cedConc : FISCO.ced44;
  const conc = {
    k: 'conc', aliq: aliqC,
    ricavi: ricC,
    costi: p.condominio * 0.2 + p.manutConc,
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
  const fissi = CONSUMI.quotaFissa * p.consumi + p.condominio + p.manutBreve;
  const margine = p.adr * 365 * (1 - p.ota - p.gest - aliqB)
    - (1 - CONSUMI.quotaFissa) * p.consumi;
  if (margine <= 0) return null;
  const occ = (numero(obiettivo) + fissi + calcolaImu(p.rendcat, p.aliq)) / margine;
  // Oltre il 100% l'obiettivo è fisicamente irraggiungibile: è un "mai".
  return occ > 0 && occ <= 1 ? occ : null;
}

/**
 * Lordo mensile minimo che porta uno scenario al netto obiettivo, lasciando
 * invariati tutti gli altri parametri. Nel breve il lordo mensile viene
 * tradotto nell'ADR necessario all'occupazione selezionata.
 */
export function trovaSogliaLordoMensile(grezzi, chiave, obiettivo) {
  if (!['conc', 'lib44', 'medio', 'breve'].includes(chiave)) return null;
  const base = normalizza(grezzi);
  if (chiave === 'breve' && base.occ <= 0) return null;

  const netto = lordo => {
    const p = { ...grezzi };
    if (chiave === 'breve') p.adr = nonNegativo(lordo) * 12 / (365 * base.occ);
    else if (chiave === 'conc') p.canoneConc = nonNegativo(lordo);
    else if (chiave === 'lib44') p.canoneLib44 = nonNegativo(lordo);
    else p.canoneMedio = nonNegativo(lordo);
    return calcolaScenari(p)[chiave].netto;
  };

  const target = numero(obiettivo);
  if (netto(0) >= target) return 0;
  let alto = 1000;
  while (alto < 100000 && netto(alto) < target) alto *= 2;
  if (netto(alto) < target) return null;
  let basso = 0;
  for (let i = 0; i < 60; i += 1) {
    const medio = (basso + alto) / 2;
    if (netto(medio) >= target) alto = medio; else basso = medio;
  }
  return alto;
}

/**
 * Curva mensile di occupazione per la visualizzazione della stagionalità:
 * moltiplicatori regionali (media 1) × occupazione media, con i mesi che
 * sforerebbero il tetto saturati e l'eccedenza ridistribuita sugli altri,
 * così la media annua della curva resta quella dichiarata dall'utente
 * (possibile finché occupazione ≤ tetto).
 */
export function curvaStagionale(occ, mult, cap = 0.98) {
  const o = quota(occ);
  let occs = (mult || []).map(m => o * nonNegativo(m));
  for (let giro = 0; giro < 24; giro++) {
    let ecc = 0;
    occs = occs.map(x => { if (x > cap) { ecc += x - cap; return cap; } return x; });
    if (ecc < 1e-9) break;
    const liberi = occs.map((x, i) => i).filter(i => occs[i] < cap);
    if (!liberi.length) break;
    const somma = liberi.reduce((a, i) => a + occs[i], 0);
    for (const i of liberi) occs[i] += somma > 0 ? ecc * occs[i] / somma : ecc / liberi.length;
  }
  return occs;
}
