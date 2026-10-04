// Accompagnement (docs/ACCOMPAGNEMENT.md § 5.1, § 15 point 1 « A ») : option de création `starter` de la carrière.
// 6 carottes mûres et arrosées au départ ; désactivée par défaut (simulations, parité inchangées) ; aucun tirage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { getCrop } from '../src/data/crops.js';
import { checkCareerState } from '../src/core/career/save.js';

const opts = { seed: 1234, farmName: 'Ferme test' };

test('starter : désactivé par défaut (aucune culture au départ)', () => {
  const g = createCareer(opts);
  assert.ok(g.state.plots.every((p) => !p.cropId));
});

test('starter : 6 carottes mûres, arrosées, sur le champ de départ ; récoltables tout de suite', () => {
  const g = createCareer({ ...opts, starter: true });
  const sown = g.state.plots.map((p, i) => [p, i]).filter(([p]) => p.cropId);
  assert.equal(sown.length, 6);
  assert.deepEqual(sown.map(([, i]) => i), [0, 1, 2, 3, 4, 5]);
  for (const [p] of sown) {
    assert.equal(p.cropId, 'carrot');
    assert.equal(p.growth, getCrop('carrot').growDays);
    assert.equal(p.watered, true);
    assert.equal(p.lot, 'start');
    assert.ok(p.unlocked);
  }
  assert.equal(checkCareerState(g.state), null);
  const plots = g.query.plots();
  assert.equal(plots.filter((p) => p.action === 'harvest').length, 6);
  const money = g.state.money;
  const res = g.actions.harvest(0);
  assert.ok(res.ok, res.reason);
  assert.ok(g.state.money > money);
});

test('starter : déterministe, sans tirage (mêmes flux du hasard, même météo qu\'une ferme sans carottes)', () => {
  const a = createCareer({ ...opts, starter: true });
  const b = createCareer({ ...opts, starter: true });
  const c = createCareer(opts);
  assert.deepEqual(a.serialize(), b.serialize());
  assert.deepEqual(a.state.rng, c.state.rng);
  assert.deepEqual(a.state.weather, c.state.weather);
  assert.equal(a.state.money, c.state.money);
});

test('starter : la sauvegarde se relit', () => {
  const g = createCareer({ ...opts, starter: true });
  const back = loadCareer(JSON.parse(JSON.stringify(g.serialize())));
  assert.equal(back.state.plots.filter((p) => p.cropId === 'carrot').length, 6);
});
