// Vérifie les fonctions pures de dither-charts.js : node dither-charts.check.js (sortie 0 = tout passe).
// Les trois premiers cas sont les tests de Monocode (dither.rs), au même commit que le port.
'use strict';
const assert = require('assert');
const D = require('./dither-charts.js');

// un ton de k/16 encre exactement k cellules d'une tuile 4x4
for (let steps = 0; steps <= 16; steps++) {
  let count = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (D.inked(x, y, steps / 16)) count++;
  assert.strictEqual(count, steps, `ton ${steps}/16`);
}

// échelles rondes qui incluent zéro, série plate, nombres compacts
const s = D.Scale.nice([42, 74], true);
assert.deepStrictEqual([s.min, s.max, s.step], [0, 80, 20]);
assert.deepStrictEqual(s.ticks(), [0, 20, 40, 60, 80]);
const flat = D.Scale.nice([5, 5], false);
assert.ok(flat.max > flat.min, 'une série plate garde une étendue');
assert.strictEqual(D.compact(48210, 1), '48.2K');
assert.strictEqual(D.compact(0.25, 0.25), '0.25');
assert.strictEqual(D.compact(2500000, 1), '2.5M');

// la courbe monotone passe par ses points sans les dépasser
const c = new D.Curve([[0, 10], [10, 0], [20, 0], [30, 10]]);
assert.strictEqual(c.at(10), 0);
for (let x = 10; x <= 20; x++) assert.ok(Math.abs(c.at(x)) < 1e-4, 'plat entre deux points égaux');
for (let x = 0; x <= 30; x++) { const y = c.at(x); assert.ok(y >= 0 && y <= 10, `pas de dépassement en x=${x}`); }

// runs : chaque cellule encrée l'est une fois, dans sa clé, et rien d'autre
const ink = (col, row) => (D.inked(col, row, ((col * 7 + row * 3) % 17) / 16) ? (col + row) % 3 : null);
const seen = new Map();
for (const [x, y, w, h, k] of D.runs(23, 11, ink)) {
  for (let r = y; r < y + h; r++) for (let q = x; q < x + w; q++) {
    const id = q + ',' + r;
    assert.ok(!seen.has(id), `cellule ${id} peinte deux fois`);
    seen.set(id, k);
  }
}
for (let r = 0; r < 11; r++) for (let q = 0; q < 23; q++) assert.strictEqual(seen.has(q + ',' + r) ? seen.get(q + ',' + r) : null, ink(q, r), `cellule ${q},${r}`);

// écart signé en tête d'un détail
assert.deepStrictEqual(D.splitDelta('+12.4% vs octobre'), ['+12.4%', 'vs octobre']);
assert.deepStrictEqual(D.splitDelta('-3'), ['-3', '']);
assert.strictEqual(D.splitDelta('requêtes par jour'), null);
assert.strictEqual(D.splitDelta('+ plus'), null);

console.log('dither-charts : ok');
