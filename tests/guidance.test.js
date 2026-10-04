// Guide de la ferme (lot 1 « confort ») : textes en français facile, mots expliqués, conseils repris.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_SECTIONS, GLOSSARY } from '../src/ui/guide.js';
import { LESSONS } from '../src/ui/coach/lessons/index.js';

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

test('leçons de Joseph : « Tout ramasser » existe, l\'embauche et la forêt ne se montrent que si elles servent encore', () => {
  // Les anciens conseils (table HINTS de src/ui/hints.js, retirée) sont des leçons du catalogue, du même identifiant.
  const lesson = (id) => LESSONS.find((l) => l.id === id);
  assert.ok(lesson('career.collectAll'));
  const ctx = (career) => ({ state: { career }, career, mode: 'career', safe: (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch { return fb; } } });
  assert.equal(lesson('career.hire').stillRelevant(ctx({ staff: [] })), true);
  assert.equal(lesson('career.hire').stillRelevant(ctx({ staff: [{ id: 1 }] })), false);
  assert.equal(lesson('career.lotForSale').stillRelevant(ctx({ lotsBought: 0 })), true);
  assert.equal(lesson('career.lotForSale').stillRelevant(ctx({ lotsBought: 1 })), false);
});
