export const FISCO = Object.freeze({
  anno: 2026,
  cedolareBreveAgevolata: 0.21,
  cedolareBreveOrdinaria: 0.26,
  cedolareLibero: 0.21,
  cedolareConcordato: 0.10,
  imuConcordato: 0.75,
  moltiplicatoreImuAbitazioni: 1.05 * 160
});

const numero = (valore, fallback = 0) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : fallback;
};

const quota = valore => Math.min(1, Math.max(0, numero(valore)));

export function calcolaImu(parametri) {
  if (!parametri.imuDovuta) return 0;
  return Math.max(0, numero(parametri.renditaCatastale))
    * FISCO.moltiplicatoreImuAbitazioni
    * Math.max(0, numero(parametri.aliquotaImu)) / 1000;
}

function chiudiScenario(scenario, valoreImmobile) {
  scenario.netto = scenario.ricavi - scenario.costi - scenario.cedolare - scenario.imu;
  scenario.rendimento = valoreImmobile > 0 ? scenario.netto / valoreImmobile : 0;
  return scenario;
}

export function calcolaScenari(parametri) {
  const valoreImmobile = Math.max(0, numero(parametri.valoreImmobile));
  const imuPiena = calcolaImu(parametri);
  const accordoPresente = parametri.accordoTerritoriale !== 'assente';
  const accordoVerificato = parametri.accordoTerritoriale === 'verificato';
  const altaTensione = parametri.altaTensione === 'si';

  const p44 = parametri.lib44;
  const ricavi44 = Math.max(0, numero(p44.canone)) * Math.min(12, Math.max(0, numero(p44.mesi)));
  const costi44 = Math.max(0, numero(p44.condominio)) + Math.max(0, numero(p44.manutenzione));
  const lib44 = chiudiScenario({
    k: 'lib44',
    nome: '4+4 libero',
    sottotitolo: 'canone libero · cedolare 21%',
    ricavi: ricavi44,
    costi: costi44,
    cedolare: ricavi44 * FISCO.cedolareLibero,
    imu: imuPiena,
    disponibile: true,
    avvisi: [],
    dettagli: {
      mesi: Math.min(12, Math.max(0, numero(p44.mesi))),
      canone: Math.max(0, numero(p44.canone)),
      costiPercentuali: 0,
      costiFissi: costi44
    }
  }, valoreImmobile);

  const pc = parametri.conc;
  const ricaviC = Math.max(0, numero(pc.canone)) * Math.min(12, Math.max(0, numero(pc.mesi)));
  const costiC = Math.max(0, numero(pc.condominio)) + Math.max(0, numero(pc.manutenzione));
  const contrattoConcordatoValido = accordoPresente && Boolean(pc.attestato);
  const aliquotaC = contrattoConcordatoValido && altaTensione
    ? FISCO.cedolareConcordato
    : FISCO.cedolareLibero;
  const avvisiC = [];
  if (!accordoPresente) avvisiC.push('Senza accordo territoriale applicabile il 3+2 non e classificato.');
  if (accordoPresente && !pc.attestato) avvisiC.push('Manca assistenza o attestazione: niente benefici fiscali nel confronto.');
  if (accordoPresente && !accordoVerificato) avvisiC.push("Accordo locale ancora da verificare: il vantaggio fiscale e provvisorio.");
  if (!altaTensione) avvisiC.push('Fuori dai comuni agevolati la cedolare resta al 21%; la riduzione IMU puo restare applicabile.');
  const conc = chiudiScenario({
    k: 'conc',
    nome: '3+2 concordato',
    sottotitolo: `cedolare ${Math.round(aliquotaC * 100)}% · IMU ${contrattoConcordatoValido ? '-25%' : 'piena'}`,
    ricavi: ricaviC,
    costi: costiC,
    cedolare: ricaviC * aliquotaC,
    imu: imuPiena * (contrattoConcordatoValido ? FISCO.imuConcordato : 1),
    disponibile: accordoPresente,
    avvisi: avvisiC,
    dettagli: {
      mesi: Math.min(12, Math.max(0, numero(pc.mesi))),
      canone: Math.max(0, numero(pc.canone)),
      costiPercentuali: 0,
      costiFissi: costiC,
      aliquota: aliquotaC
    }
  }, valoreImmobile);

  const pm = parametri.medio;
  const ricaviM = Math.max(0, numero(pm.canone)) * Math.min(12, Math.max(0, numero(pm.mesi)));
  const gestioneM = ricaviM * quota(pm.gestione);
  const costiFissiM = Math.max(0, numero(pm.utenze))
    + Math.max(0, numero(pm.condominio))
    + Math.max(0, numero(pm.manutenzione));
  const transitorioConcordatoValido = Boolean(pm.concordato) && accordoPresente && Boolean(pm.attestato);
  const aliquotaM = transitorioConcordatoValido && altaTensione
    ? FISCO.cedolareConcordato
    : FISCO.cedolareLibero;
  const avvisiM = ['Serve una reale esigenza temporanea documentabile: non e un 4+4 abbreviato.'];
  if (pm.concordato && !accordoPresente) avvisiM.push('Accordo territoriale assente: simulazione fiscale al 21% e IMU piena.');
  if (pm.concordato && accordoPresente && !pm.attestato) avvisiM.push('Senza assistenza o attestazione non sono conteggiati i benefici fiscali.');
  if (transitorioConcordatoValido && !accordoVerificato) avvisiM.push("Accordo locale ancora da verificare: il vantaggio fiscale e provvisorio.");
  const medio = chiudiScenario({
    k: 'medio',
    nome: 'Transitorio',
    sottotitolo: `${pm.concordato ? 'canone concordato' : 'ordinario'} · cedolare ${Math.round(aliquotaM * 100)}%`,
    ricavi: ricaviM,
    costi: gestioneM + costiFissiM,
    cedolare: ricaviM * aliquotaM,
    imu: imuPiena * (transitorioConcordatoValido ? FISCO.imuConcordato : 1),
    disponibile: true,
    avvisi: avvisiM,
    dettagli: {
      mesi: Math.min(12, Math.max(0, numero(pm.mesi))),
      canone: Math.max(0, numero(pm.canone)),
      costiPercentuali: gestioneM,
      costiFissi: costiFissiM,
      aliquota: aliquotaM
    }
  }, valoreImmobile);

  const pb = parametri.breve;
  const occupazioneB = quota(pb.occupazione);
  const nottiB = 365 * occupazioneB;
  const soggiornoMedio = Math.max(1, numero(pb.soggiornoMedio, 1));
  const soggiorniB = nottiB / soggiornoMedio;
  const ricaviPernottamentiB = Math.max(0, numero(pb.adr)) * nottiB;
  const ricaviPulizieB = soggiorniB * Math.max(0, numero(pb.puliziaAddebitata));
  const ricaviB = ricaviPernottamentiB + ricaviPulizieB;
  const costiPercentualiB = ricaviB * (quota(pb.ota) + quota(pb.gestione));
  const pulizieB = soggiorniB * Math.max(0, numero(pb.puliziaCosto));
  const costiFissiB = Math.max(0, numero(pb.utenze))
    + Math.max(0, numero(pb.condominio))
    + Math.max(0, numero(pb.manutenzione));
  const aliquotaB = pb.regime === '26' ? FISCO.cedolareBreveOrdinaria : FISCO.cedolareBreveAgevolata;
  const breveConsentito = parametri.regoleTuristiche !== 'vietato' && pb.regime !== 'impresa';
  const avvisiB = [];
  if (parametri.regoleTuristiche === 'da_verificare') avvisiB.push('CIN, regole regionali e limiti comunali non ancora verificati.');
  if (parametri.regoleTuristiche === 'vietato') avvisiB.push('Scenario escluso: hai indicato che la locazione turistica non e consentita.');
  if (pb.regime === 'impresa') avvisiB.push('Scenario escluso: dal terzo immobile breve il modello da privato non e applicabile nel 2026.');
  const breve = chiudiScenario({
    k: 'breve',
    nome: 'Affitto turistico',
    sottotitolo: `locazione breve · cedolare ${Math.round(aliquotaB * 100)}%`,
    ricavi: ricaviB,
    costi: costiPercentualiB + pulizieB + costiFissiB,
    cedolare: ricaviB * aliquotaB,
    imu: imuPiena,
    disponibile: breveConsentito,
    avvisi: avvisiB,
    dettagli: {
      notti: nottiB,
      soggiorni: soggiorniB,
      adr: Math.max(0, numero(pb.adr)),
      ricaviPernottamenti: ricaviPernottamentiB,
      ricaviPulizie: ricaviPulizieB,
      costiPercentuali: costiPercentualiB,
      pulizie: pulizieB,
      costiFissi: costiFissiB,
      aliquota: aliquotaB
    }
  }, valoreImmobile);

  return { lib44, conc, medio, breve, imuPiena };
}

function conVariabile(parametri, chiave, valore) {
  const copia = { ...parametri, [chiave]: { ...parametri[chiave] } };
  if (chiave === 'breve') copia.breve.occupazione = valore;
  else if (chiave === 'medio') copia.medio.mesi = valore;
  else copia[chiave].canone = valore;
  return copia;
}

export function trovaSoglia(parametri, chiave, obiettivo) {
  const limiti = chiave === 'breve' ? [0, 1] : chiave === 'medio' ? [0, 12] : [0, 100000];
  const netto = valore => calcolaScenari(conVariabile(parametri, chiave, valore))[chiave].netto;
  if (netto(limiti[0]) >= obiettivo) return limiti[0];
  if (netto(limiti[1]) < obiettivo) return null;
  let basso = limiti[0];
  let alto = limiti[1];
  for (let i = 0; i < 70; i += 1) {
    const medio = (basso + alto) / 2;
    if (netto(medio) >= obiettivo) alto = medio;
    else basso = medio;
  }
  return alto;
}

export function classificaScenari(scenari) {
  return ['lib44', 'conc', 'medio', 'breve']
    .map(chiave => scenari[chiave])
    .filter(scenario => scenario.disponibile)
    .sort((a, b) => b.netto - a.netto);
}
