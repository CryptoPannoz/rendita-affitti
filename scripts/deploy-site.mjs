#!/usr/bin/env node
/**
 * Copia l'applicazione dentro il sito personale, dove sta la versione pubblica.
 *
 * Questa repo resta la fonte del codice (ed è quella open source che la gente
 * clona); bebroggi.it/tools/rendita-affitti/ è dove il tool vive davvero.
 * Tenere due copie va bene solo se allinearle è un comando, non un lavoro
 * manuale: questo è quel comando.
 *
 * Uso:  npm run deploy:site
 */

import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_CANDIDATES = [
  process.env.RENDITA_SITE_DIR && resolve(process.env.RENDITA_SITE_DIR),
  resolve(ROOT, '..', 'alberto-broggi-site'),
  resolve(ROOT, '..', 'site-source')
].filter(Boolean);
const SITE = SITE_CANDIDATES.find(path => existsSync(path));
if (!SITE) {
  console.error(`Non trovo il sito. Percorsi provati:\n- ${SITE_CANDIDATES.join('\n- ')}`);
  console.error('Clona CryptoPannoz/alberto-broggi-site accanto a questa cartella o imposta RENDITA_SITE_DIR.');
  process.exit(1);
}
const TARGET = join(SITE, 'tools', 'rendita-affitti');

/** Quello che serve al browser, più gli script per rigenerare i dati. */
const PAYLOAD = ['index.html', 'logic.mjs', 'data', 'scripts', 'tests', 'package.json', 'README.md', 'LICENSE'];

// Si azzera la destinazione: se un file sparisce qui, deve sparire anche là.
await rm(TARGET, { recursive: true, force: true });
await mkdir(TARGET, { recursive: true });

for (const entry of PAYLOAD) {
  const from = join(ROOT, entry);
  if (!existsSync(from)) {
    console.warn(`  ⚠︎  salto ${entry} (non esiste)`);
    continue;
  }
  await cp(from, join(TARGET, entry), { recursive: true });
  console.log(`  ✓ ${entry}`);
}

console.log(`\nPubblicato in ${TARGET}`);
console.log('Ora committa e pusha il sito.');
