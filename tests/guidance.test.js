// Guide de la ferme (lot 1 « confort ») : textes en français facile, mots expliqués, conseils repris.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_SECTIONS, GLOSSARY } from '../src/ui/guide.js';
import { HINTS } from '../src/ui/hints.js';

const words = (s) => s.split(/\s+/).filter(Boolean).length;

test('guide : sections complètes, phrases courtes (FALC : 25 mots au plus par phrase)', () => {
  const ids = new Set();
  for (const s of GUIDE_SECTIONS) {
    assert.ok(!ids.has(s.id), `section en double : ${s.id}`);
    ids.add(s.id);
    assert.ok(['both', 'levels', 'career'].includes(s.mode), s.id);
    assert.ok(s.lines.length >= 3, s.id);
    for (const l of s.lines) {
      for (const sentence of l.split(/(?<=[.!?])\s+/)) assert.ok(words(sentence) <= 25, `${s.id} : phrase trop longue « ${sentence} »`);
    }
  }
  for (const id of ['gestures', 'time', 'todo', 'crops', 'money', 'career', 'animals', 'visitors']) assert.ok(ids.has(id), `section manquante : ${id}`);
});

test('glossaire : les mots difficiles de l\'analyse sont expliqués', () => {
  const have = new Set(GLOSSARY.map((g) => g.word));
  for (const w of ['Fermage', 'Charges de saison', 'Entretien', 'Patrimoine', 'Cours', 'Hors saison', 'Grenier', 'Vendre en l\'état', 'Plan de culture', 'Chômage technique', 'Carburant']) {
    assert.ok(have.has(w), `mot manquant : ${w}`);
  }
  assert.match(GLOSSARY.find((g) => g.word === 'Fermage').text, /loyer de la ferme/);
  for (const g of GLOSSARY) for (const sentence of g.text.split(/(?<=[.!?])\s+/)) assert.ok(words(sentence) <= 25, `${g.word} : « ${sentence} »`);
});

test('conseils : « Tout ramasser » existe, l\'embauche et la forêt ne se montrent que s\'ils servent encore', () => {
  assert.ok(HINTS['career.collectAll']);
  const app = (career) => ({ game: { state: { career } } });
  assert.equal(HINTS['career.hire'].relevant(app({ staff: [] })), true);
  assert.equal(HINTS['career.hire'].relevant(app({ staff: [{ id: 1 }] })), false);
  assert.equal(HINTS['career.lotForSale'].relevant(app({ lotsBought: 0 })), true);
  assert.equal(HINTS['career.lotForSale'].relevant(app({ lotsBought: 1 })), false);
});
