import test from 'node:test';
import assert from 'node:assert/strict';
import { calcolaImu, calcolaScenari, classificaScenari, trovaSoglia } from '../logic.mjs';

const base = {
  valoreImmobile: 200000,
  renditaCatastale: 500,
  aliquotaImu: 10.6,
  imuDovuta: true,
  altaTensione: 'si',
  accordoTerritoriale: 'verificato',
  regoleTuristiche: 'verificato',
  lib44: { canone: 1000, mesi: 12, condominio: 0, manutenzione: 0 },
  conc: { canone: 800, mesi: 12, condominio: 0, manutenzione: 0, attestato: true },
  medio: { canone: 1100, mesi: 11, gestione: 0.05, utenze: 0, condominio: 0, manutenzione: 0, concordato: false, attestato: false },
  breve: { adr: 100, occupazione: 0.5, soggiornoMedio: 5, puliziaAddebitata: 0, puliziaCosto: 0, ota: 0.15, gestione: 0, utenze: 0, condominio: 0, manutenzione: 0, regime: '21' }
};

test('calcola la base IMU da rendita rivalutata, moltiplicatore e aliquota per mille', () => {
  assert.equal(calcolaImu(base), 890.4);
});

test('applica la cedolare sul lordo e non sul reddito dopo i costi', () => {
  const s = calcolaScenari(base);
  assert.equal(s.lib44.ricavi, 12000);
  assert.equal(s.lib44.cedolare, 2520);
  assert.equal(s.lib44.netto, 8589.6);
  assert.equal(s.breve.ricavi, 18250);
  assert.equal(s.breve.cedolare, 3832.5);
  assert.equal(s.breve.costi, 2737.5);
  assert.equal(s.breve.netto, 10789.6);
});

test('il transitorio prende 10% e IMU al 75% solo se concordato e attestato', () => {
  const concordato = structuredClone(base);
  concordato.medio.concordato = true;
  concordato.medio.attestato = true;
  const s = calcolaScenari(concordato);
  assert.equal(s.medio.cedolare, 1210);
  assert.equal(s.medio.imu, 667.8);

  concordato.medio.attestato = false;
  const senzaAttestazione = calcolaScenari(concordato);
  assert.equal(senzaAttestazione.medio.cedolare, 2541);
  assert.equal(senzaAttestazione.medio.imu, 890.4);
});

test('le pulizie forfettarie addebitate entrano nel lordo, nelle commissioni e nella cedolare', () => {
  const conPulizie = structuredClone(base);
  conPulizie.imuDovuta = false;
  conPulizie.breve.puliziaAddebitata = 50;
  conPulizie.breve.puliziaCosto = 50;
  const s = calcolaScenari(conPulizie).breve;
  assert.equal(s.dettagli.soggiorni, 36.5);
  assert.equal(s.dettagli.ricaviPulizie, 1825);
  assert.equal(s.ricavi, 20075);
  assert.equal(s.cedolare, 4215.75);
  assert.equal(s.dettagli.costiPercentuali, 3011.25);
  assert.equal(s.dettagli.pulizie, 1825);
  assert.equal(s.netto, 11023);
});

test('il 3+2 fuori dai comuni agevolati mantiene il 21% ma conserva la riduzione IMU', () => {
  const fuoriAta = { ...base, altaTensione: 'no' };
  const s = calcolaScenari(fuoriAta);
  assert.equal(s.conc.cedolare, 2016);
  assert.equal(s.conc.imu, 667.8);
});

test('esclude dal ranking il breve non modellabile come privato', () => {
  const impresa = structuredClone(base);
  impresa.breve.regime = 'impresa';
  const s = calcolaScenari(impresa);
  assert.equal(s.breve.disponibile, false);
  assert.ok(!classificaScenari(s).some(x => x.k === 'breve'));
});

test('trova la soglia di canone 4+4 che pareggia un obiettivo', () => {
  const senzaImu = { ...base, imuDovuta: false };
  const soglia = trovaSoglia(senzaImu, 'lib44', 9480);
  assert.ok(Math.abs(soglia - 1000) < 0.001);
});
