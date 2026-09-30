// Mode Carrière — « Ce que fait ce bâtiment » : chaque bâtiment, abri, atelier, machine, animal, aménagement de la
// ferme et de terrain a un rôle, des lignes par niveau et des conseils, lus par les requêtes des fiches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, FARM_ITEMS } from '../src/data/career/buildings.js';
import { MACHINES } from '../src/data/career/machines.js';
import { CAREER_ANIMALS } from '../src/data/career/animals.js';
import { LOT_TYPES } from '../src/data/career/lots.js';
import { DESCRIBED, describe, effectLines } from '../src/data/career/descriptions.js';
import { newCareer, setRank } from './career-helpers.js';

const text = (s) => typeof s === 'string' && s.trim().length > 3 && !/undefined|NaN|null/.test(s);

test('une description pour chaque identifiant (bâtiments, machines, animaux, ruche et panneau, aménagements)', () => {
  const all = {
    building: BUILDINGS.map((b) => b.id),
    machine: MACHINES.map((m) => m.id),
    animal: CAREER_ANIMALS.map((a) => a.id),
    item: FARM_ITEMS.map((i) => i.id),
    lotType: LOT_TYPES.map((t) => t.id),
  };
  for (const [kind, ids] of Object.entries(all)) {
    assert.deepEqual([...DESCRIBED[kind]].sort(), [...ids].sort(), kind);
    for (const id of ids) {
      const d = describe(kind, id, 1);
      assert.ok(d, `${kind} ${id}`);
      assert.ok(text(d.role) && d.role.endsWith('.'), `${kind} ${id} : rôle`);
      assert.ok(Array.isArray(d.tips) && d.tips.every(text), `${kind} ${id} : conseils`);
      assert.ok(d.effectLines.length > 0 && d.effectLines.every(text), `${kind} ${id} : lignes ${d.effectLines}`);
    }
  }
});

test('lignes par niveau : une par niveau des données, chiffres des données (capacité, places, revenus)', () => {
  for (const b of BUILDINGS) {
    const d = describe('building', b.id, 1);
    assert.equal(d.levels.length, b.levels.length, b.id);
    d.levels.forEach((l, k) => {
      assert.equal(l.level, k + 1);
      assert.equal(l.cost, b.levels[k].cost);
      assert.ok(l.lines.length > 0 && l.lines.every(text), `${b.id} niv. ${k + 1}`);
    });
  }
  for (const m of MACHINES) assert.equal(describe('machine', m.id, 1).levels.length, m.levels.length);
  assert.match(effectLines('building', 'storage', 2).join(' '), /100 récoltes/);
  assert.match(effectLines('building', 'house', 5).join(' '), /8 employés/);
  assert.match(effectLines('building', 'coop', 3).join(' '), /12 poules/);
  assert.match(effectLines('building', 'mill', 3).join(' '), /pain/);
  assert.doesNotMatch(effectLines('building', 'mill', 3).join(' '), /farine/);
  assert.match(effectLines('building', 'roadsideStand', 1).join(' '), /\+20 %/);
  assert.match(effectLines('machine', 'seeder', 2).join(' '), /tracteur/);
  assert.match(effectLines('animal', 'cow').join(' '), /16 pièces par jour/);
  assert.equal(describe('building', 'house', 5).nextEffectLines, null, 'dernier niveau');
  assert.equal(describe('building', 'dragon', 1), null);
});

test('requêtes : buildings(), building(), shelters(), machines(), machineCatalog(), investments(), lotTypes(), about()', () => {
  const g = newCareer();
  setRank(g, 6);
  g.state.money = 1e6;
  for (const b of g.query.career.buildings()) {
    assert.ok(text(b.role), b.id);
    assert.ok(b.effectLines.length > 0);
    assert.ok(Array.isArray(b.levelLines) && b.levelLines.length === b.maxLevel);
    assert.ok(Array.isArray(b.tips));
  }
  const storage = g.query.career.building('storage');
  assert.equal(storage.level, 0);
  assert.match(storage.effectLines[0], /30 récoltes/, 'pas construit : ce que donne le niveau 1');
  const house = g.query.career.building('house');
  assert.match(house.nextEffectLines[0], /2 employés/);
  assert.ok(text(g.query.career.shelters()[0].role));
  assert.ok(text(g.query.career.shelters()[0].animalAbout.role));
  for (const m of g.query.career.machineCatalog()) assert.ok(text(m.role) && m.effectLines.length > 0, m.id);
  assert.ok(g.actions.career.buyMachine('sprinklers', 'start').ok);
  const sp = g.query.career.machines()[0];
  assert.ok(text(sp.role));
  assert.match(sp.nextEffectLines[0], /tout le terrain/);
  for (const inv of g.query.investments()) assert.ok(text(inv.role) && inv.effectLines.length > 0, inv.id);
  for (const t of g.query.career.lotTypes('start')) assert.ok(text(t.role) && t.effectLines.length > 0, t.type);
  const about = g.query.career.about('building', 'house');
  assert.equal(about.level, 1);
  assert.ok(text(about.role));
  assert.equal(g.query.career.about('machine', 'sprinklers').level, 1);
  assert.equal(g.query.career.about('building', 'nope'), null);
});
