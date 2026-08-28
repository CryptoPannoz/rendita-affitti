import test from 'node:test';
import assert from 'node:assert/strict';
import { FISCO, CONSUMI, calcolaImu, calcolaScenari, classifica, breakEvenOcc, normalizza, consumiPieni, consumiEffettivi, calcolaConsumiVoci, trovaSogliaLordoMensile, curvaStagionale } from '../logic.mjs';

const vicino = (a, b, tolleranza = 0.01) =>
  assert.ok(Math.abs(a - b) <= tolleranza, `atteso ${b}, ottenuto ${a}`);

/* Il caso di riferimento: Trieste, 70 mq, i default della pagina.
   I valori attesi sono stati calcolati a mano, cifra per cifra. */
const trieste = {
  valore: 138000, rendcat: 410, canone: 525, sconto: 0.20,
  adr: 120, occ: 0.49, premio: 0, mesiMedio: 11, aliq: 10.6,
  ota: 0.16, gest: 0.10, consumi: 1500, condominio: 1200, manut: 900,
  sfitto: 0.04, unico: true, alta: true
};

test('IMU: rendita rivalutata × 1,05 × 160 × aliquota per mille', () => {
  vicino(calcolaImu(410, 10.6), 730.128);
  vicino(calcolaImu(500, 10.6), 890.4);
  assert.equal(calcolaImu(0, 10.6), 0);
  assert.equal(calcolaImu(-100, 10.6), 0);
});

test('il caso Trieste torna al centesimo in tutti e quattro gli scenari', () => {
  const s = calcolaScenari(trieste);
  // Breve: 120×365×0,49 = 21.462 di lordo; 26% variabili;
  // consumi 1.500×(0,3+0,7×0,49)=964,50; condominio 1.200; manut ×1,5 = 1.350
  vicino(s.breve.ricavi, 21462);
  vicino(s.breve.consumi, 964.5);
  vicino(s.breve.costi, 21462 * 0.26 + 964.5 + 1200 + 1350);
  vicino(s.breve.ced, 21462 * 0.21);
  vicino(s.breve.netto, 7130.23);
  // Medio: canone = 4+4 (premio 0) × 11 mesi; consumi 1.500×(0,3+0,7×11/12)=1.412,50
  vicino(s.medio.ricavi, 5775);
  vicino(s.medio.consumi, 1412.5);
  vicino(s.medio.costi, 5775 * 0.05 + 1412.5 + 1200 + 900);
  vicino(s.medio.netto, 30.87);
  // 4+4: 12 mesi meno sfitto 4%, condominio al 20%
  vicino(s.lib44.ricavi, 6048);
  vicino(s.lib44.costi, 1140);
  vicino(s.lib44.netto, 2907.79);
  // 3+2: canone −20%, sfitto dimezzato, cedolare 10%, IMU 75%
  vicino(s.conc.ricavi, 4939.2);
  vicino(s.conc.ced, 493.92);
  vicino(s.conc.imu, 547.596);
  vicino(s.conc.netto, 2757.68);
});

test('la cedolare si applica sul lordo, mai sul reddito dopo i costi', () => {
  const s = calcolaScenari(trieste);
  for (const k of ['breve', 'medio', 'lib44', 'conc']) {
    vicino(s[k].ced, s[k].ricavi * s[k].aliq);
  }
});

test('breve: 21% per immobile unico, 26% dal secondo', () => {
  const unico = calcolaScenari(trieste);
  const piu = calcolaScenari({ ...trieste, unico: false });
  assert.equal(unico.breve.aliq, FISCO.cedBreveUnico);
  assert.equal(piu.breve.aliq, FISCO.cedBrevePlu);
  vicino(piu.breve.netto, unico.breve.netto - 21462 * 0.05);
});

test('consumi: base + occupanti, scalati sulla presenza con quota fissa', () => {
  assert.equal(consumiPieni(2), CONSUMI.baseAnnua + 2 * CONSUMI.perOccupante);
  vicino(consumiEffettivi(1500, 1), 1500);
  vicino(consumiEffettivi(1500, 0), 1500 * CONSUMI.quotaFissa);   // casa vuota: solo la quota fissa
  vicino(consumiEffettivi(1500, 0.49), 964.5);
  assert.equal(consumiEffettivi(-100, 0.5), 0);
});

test('calcolatore consumi: kWh, Smc, acqua, internet e altro tornano al centesimo', () => {
  const c = calcolaConsumiVoci({
    luceKwh: 1800, luceTariffa: 0.30,
    gasSmc: 400, gasTariffa: 1,
    acqua: 200, internetMensile: 30, altro: 25
  });
  vicino(c.luce, 540);
  vicino(c.gas, 400);
  vicino(c.internet, 360);
  vicino(c.totale, 1525);
});

test('canoni e manutenzioni possono essere regolati indipendentemente per scenario', () => {
  const p = {
    ...trieste,
    canoneConc: 430, canoneLib44: 560, canoneMedio: 680,
    manutConc: 700, manutLib44: 800, manutMedio: 1100, manutBreve: 1600
  };
  const s = calcolaScenari(p);
  vicino(s.conc.canone, 430);
  vicino(s.lib44.canone, 560);
  vicino(s.medio.canone, 680);
  vicino(s.conc.costi, trieste.condominio * 0.2 + 700);
  vicino(s.lib44.costi, trieste.condominio * 0.2 + 800);
  vicino(s.medio.costi, s.medio.ricavi * 0.05 + s.medio.consumi + trieste.condominio + 1100);
  vicino(s.breve.costi, s.breve.ricavi * (trieste.ota + trieste.gest) + s.breve.consumi + trieste.condominio + 1600);
});

test('soglia di lordo mensile: ogni scenario raggiunge il netto obiettivo', () => {
  const base = {
    ...trieste,
    canoneConc: 420, canoneLib44: 525, canoneMedio: 600,
    manutConc: 900, manutLib44: 900, manutMedio: 1100, manutBreve: 1350
  };
  for (const chiave of ['conc', 'lib44', 'medio', 'breve']) {
    const altri = classifica(calcolaScenari(base)).filter(s => s.k !== chiave);
    const target = altri[0].netto;
    const soglia = trovaSogliaLordoMensile(base, chiave, target);
    assert.ok(Number.isFinite(soglia) && soglia >= 0, `${chiave}: soglia non valida`);
    const p = { ...base };
    if (chiave === 'breve') p.adr = soglia * 12 / (365 * base.occ);
    else if (chiave === 'conc') p.canoneConc = soglia;
    else if (chiave === 'lib44') p.canoneLib44 = soglia;
    else p.canoneMedio = soglia;
    vicino(calcolaScenari(p)[chiave].netto, target, 0.01);
  }
});

test('concordato fuori dai comuni ad alta tensione: cedolare 21%, IMU comunque al 75%', () => {
  const fuori = calcolaScenari({ ...trieste, alta: false });
  assert.equal(fuori.conc.aliq, FISCO.ced44);
  vicino(fuori.conc.imu, 730.128 * 0.75);
  // Il medio termine resta al 21% senza il toggle del concordato, anche in comune ad alta tensione.
  assert.equal(fuori.medio.aliq, FISCO.ced44);
  assert.equal(calcolaScenari(trieste).medio.aliq, FISCO.ced44);
});

test('transitorio concordato in comune agevolato: cedolare 10% col toggle medioConc', () => {
  const s = calcolaScenari({ ...trieste, medioConc: true });
  assert.equal(s.medio.aliq, FISCO.cedConc);
  vicino(s.medio.ced, s.medio.ricavi * FISCO.cedConc);
  // Il toggle del medio non tocca gli altri scenari.
  const base = calcolaScenari(trieste);
  assert.equal(s.conc.aliq, base.conc.aliq);
  vicino(s.lib44.netto, base.lib44.netto);
});

test('consumi e condominio: inclusi nel breve e nel medio, all\'inquilino nei contratti lunghi', () => {
  const senza = calcolaScenari({ ...trieste, consumi: 0 });
  const s = calcolaScenari(trieste);
  vicino(s.breve.costi - senza.breve.costi, consumiEffettivi(1500, 0.49));
  vicino(s.medio.costi - senza.medio.costi, consumiEffettivi(1500, 11 / 12));
  vicino(s.lib44.costi, senza.lib44.costi);         // consumi mai nel 4+4
  vicino(s.conc.costi, senza.conc.costi);           // né nel 3+2
  vicino(s.lib44.costi, 1200 * 0.2 + 900);          // condominio solo al 20%
  vicino(s.breve.costi, s.breve.ricavi * 0.26 + 964.5 + 1200 + 900 * 1.5); // pieno + usura
});

test('il medio termine di norma usa il canone del 4+4; il premio lo sposta', () => {
  const s = calcolaScenari(trieste);
  assert.equal(s.medio.canone, s.lib44.canone);
  const conPremio = calcolaScenari({ ...trieste, premio: 0.15 });
  vicino(conPremio.medio.canone, 525 * 1.15);
});

test('classifica: ordinata per netto decrescente', () => {
  const ordine = classifica(calcolaScenari(trieste));
  assert.deepEqual(ordine.map(s => s.k), ['breve', 'lib44', 'conc', 'medio']);
  for (let i = 1; i < ordine.length; i += 1) assert.ok(ordine[i - 1].netto >= ordine[i].netto);
});

test('break-even: al punto di pareggio il netto del breve coincide con l\'obiettivo', () => {
  const s = calcolaScenari(trieste);
  const be = breakEvenOcc(trieste, s.lib44.netto);
  assert.ok(be > 0.25 && be < 0.40, `pareggio fuori range: ${be}`);
  const verifica = calcolaScenari({ ...trieste, occ: be });
  vicino(verifica.breve.netto, s.lib44.netto, 0.5);
});

test('break-even: null quando il margine è nullo o servirebbe più del 100% di occupazione', () => {
  assert.equal(breakEvenOcc({ ...trieste, ota: 0.5, gest: 0.4 }, 1000), null); // margine ≤ 0
  assert.equal(breakEvenOcc({ ...trieste, adr: 20 }, 50000), null);            // ben oltre il 100%
  // Caso del verificatore: ADR 55, obiettivo raggiungibile solo al ~120% → "mai", non un numero
  assert.equal(breakEvenOcc({ ...trieste, adr: 55 }, 7777), null);
  // Ma un obiettivo raggiungibile sotto il 100% resta un numero
  assert.ok(breakEvenOcc({ ...trieste, adr: 55 }, 3000) < 1);
});

test('curva stagionale: satura i picchi al 98% ma conserva la media annua', () => {
  const liguria = [0.21, 0.25, 0.34, 1.04, 1.09, 1.50, 2.29, 2.50, 1.31, 0.83, 0.23, 0.41];
  for (const occ of [0.3, 0.6, 0.8, 0.95]) {
    const c = curvaStagionale(occ, liguria);
    assert.equal(c.length, 12);
    assert.ok(Math.max(...c) <= 0.98 + 1e-9, `picco oltre il tetto a occ=${occ}`);
    const media = c.reduce((a, b) => a + b, 0) / 12;
    vicino(media, occ, 0.005);
  }
  // Sotto la soglia di saturazione la curva è la semplice proporzione
  const bassa = curvaStagionale(0.2, liguria);
  vicino(bassa[7], 0.2 * 2.50, 1e-9);
});

test('input sporchi: NaN, negativi e quote oltre 1 non producono mai NaN', () => {
  const sporchi = calcolaScenari({
    valore: 'boh', rendcat: -5, canone: null, sconto: 7, adr: NaN,
    occ: 2, premio: 'x', mesiMedio: 99, aliq: -1, ota: -3, gest: 9,
    consumi: undefined, condominio: -10, manut: 'y', sfitto: 5
  });
  for (const k of ['breve', 'medio', 'lib44', 'conc']) {
    assert.ok(Number.isFinite(sporchi[k].netto), `${k}.netto non finito`);
    assert.ok(Number.isFinite(sporchi[k].rendimento), `${k}.rendimento non finito`);
  }
  const n = normalizza({ occ: 2, sconto: 7, mesiMedio: 99, premio: -3 });
  assert.equal(n.occ, 1);
  assert.equal(n.sconto, 1);
  assert.equal(n.mesiMedio, 12);
  assert.equal(n.premio, -1);
});

test('rendimento: netto sul valore, zero se il valore manca', () => {
  const s = calcolaScenari(trieste);
  vicino(s.breve.rendimento, s.breve.netto / 138000, 1e-9);
  assert.equal(calcolaScenari({ ...trieste, valore: 0 }).breve.rendimento, 0);
});
