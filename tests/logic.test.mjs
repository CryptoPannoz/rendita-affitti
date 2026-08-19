import test from 'node:test';
import assert from 'node:assert/strict';
import { FISCO, calcolaImu, calcolaScenari, classifica, breakEvenOcc, normalizza } from '../logic.mjs';

const vicino = (a, b, tolleranza = 0.01) =>
  assert.ok(Math.abs(a - b) <= tolleranza, `atteso ${b}, ottenuto ${a}`);

/* Il caso di riferimento: Trieste, 70 mq, i default della pagina.
   I valori attesi sono stati calcolati a mano, cifra per cifra. */
const trieste = {
  valore: 138000, rendcat: 410, canone: 525, sconto: 0.20,
  adr: 120, occ: 0.49, premio: 0, mesiMedio: 11, aliq: 10.6,
  ota: 0.16, gest: 0.10, utenze: 1800, condominio: 1200, manut: 900,
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
  // Breve: 120×365×0,49 = 21.462 di lordo; 26% variabili; 4.350 fissi (manut ×1,5)
  vicino(s.breve.ricavi, 21462);
  vicino(s.breve.costi, 21462 * 0.26 + 4350);
  vicino(s.breve.ced, 21462 * 0.21);
  vicino(s.breve.netto, 6294.73);
  // Medio: canone = 4+4 (premio 0) × 11 mesi, consumi inclusi → può andare in negativo
  vicino(s.medio.ricavi, 5775);
  vicino(s.medio.costi, 5775 * 0.05 + 3900);
  vicino(s.medio.netto, -356.63);
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

test('concordato fuori dai comuni ad alta tensione: cedolare 21%, IMU comunque al 75%', () => {
  const fuori = calcolaScenari({ ...trieste, alta: false });
  assert.equal(fuori.conc.aliq, FISCO.ced44);
  vicino(fuori.conc.imu, 730.128 * 0.75);
  // Il medio termine resta al 21% in ogni caso: il 10% richiederebbe il canone da tabelle.
  assert.equal(fuori.medio.aliq, FISCO.ced44);
  assert.equal(calcolaScenari(trieste).medio.aliq, FISCO.ced44);
});

test('consumi e condominio: inclusi nel breve e nel medio, all\'inquilino nei contratti lunghi', () => {
  const senza = calcolaScenari({ ...trieste, utenze: 0 });
  const s = calcolaScenari(trieste);
  vicino(s.breve.costi - senza.breve.costi, 1800);
  vicino(s.medio.costi - senza.medio.costi, 1800);
  vicino(s.lib44.costi, senza.lib44.costi);        // utenze mai nel 4+4
  vicino(s.lib44.costi, 1200 * 0.2 + 900);          // condominio solo al 20%
  vicino(s.breve.costi, s.breve.ricavi * 0.26 + 1800 + 1200 + 900 * 1.5); // pieno + usura
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
  assert.ok(be > 0.30 && be < 0.40, `pareggio fuori range: ${be}`);
  const verifica = calcolaScenari({ ...trieste, occ: be });
  vicino(verifica.breve.netto, s.lib44.netto, 0.5);
});

test('break-even: null quando il margine per notte è nullo o serve occupazione irrealistica', () => {
  assert.equal(breakEvenOcc({ ...trieste, ota: 0.5, gest: 0.4 }, 1000), null); // margine ≤ 0
  assert.equal(breakEvenOcc({ ...trieste, adr: 20 }, 50000), null);            // > 150%
});

test('input sporchi: NaN, negativi e quote oltre 1 non producono mai NaN', () => {
  const sporchi = calcolaScenari({
    valore: 'boh', rendcat: -5, canone: null, sconto: 7, adr: NaN,
    occ: 2, premio: 'x', mesiMedio: 99, aliq: -1, ota: -3, gest: 9,
    utenze: undefined, condominio: -10, manut: 'y', sfitto: 5
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
