import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('il flusso mostra i quattro scenari prima del CTA del verdetto', () => {
  const scenari = html.indexOf('<div class="scen-grid">');
  const verdetto = html.indexOf('<div class="card verdict" id="verdict"></div>');
  assert.ok(scenari >= 0, 'griglia scenari non trovata');
  assert.ok(verdetto > scenari, 'il CTA del verdetto deve venire dopo i quattro scenari');
});

test('il verdetto chiede l’email solo nella fase teaser', () => {
  const compila = html.indexOf("if (fase === 'compila')");
  const teaser = html.indexOf("else if (fase === 'teaser')");
  const formEmail = html.indexOf('<form class="gate-form"');
  assert.ok(compila >= 0 && teaser > compila && formEmail > teaser);
});
