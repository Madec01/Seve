// Lot 2 « Toucher & surprises » (rendu, son) : parties pures testables sous Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { comboMidi, midiFreq, PENTATONIC, COMBO_TOP } from '../src/audio/synth.js';
import { qualityOf, giantRect } from '../src/render/effects.js';
import { decorSprite, SPRITES } from '../src/render/atlas.js';
import { COSMETICS } from '../src/data/cosmetics.js';

test('série de récolte : la note monte d\'un degré pentatonique à chaque parcelle, sans devenir criarde', () => {
  const notes = Array.from({ length: 30 }, (_, i) => comboMidi(i));
  assert.equal(notes[0], 64); // mi 4
  for (let i = 1; i <= COMBO_TOP; i++) assert.ok(notes[i] > notes[i - 1], `note ${i} plus haute`);
  for (const m of notes) assert.ok(PENTATONIC.includes(m % 12), `${m} dans la gamme de do pentatonique`);
  assert.ok(Math.max(...notes) <= 91, 'sol 6 au plus');
  // Au-delà du haut : alternance des deux notes du haut (jamais deux fois la même d'affilée).
  for (let i = COMBO_TOP + 1; i < notes.length; i++) assert.notEqual(notes[i], notes[i - 1]);
  assert.ok(Math.abs(midiFreq(69) - 440) < 1e-9);
});

test('qualité d\'une récolte : noms tolérants', () => {
  assert.equal(qualityOf({ quality: 'gold' }), 'gold');
  assert.equal(qualityOf({ quality: 'fine' }), 'fine');
  assert.equal(qualityOf({ quality: 'belle' }), 'fine');
  assert.equal(qualityOf({ quality: 'dorée' }), 'gold');
  assert.equal(qualityOf({ quality: 'normal' }), 'normal');
  assert.equal(qualityOf({}), 'normal');
  assert.equal(qualityOf(null), 'normal');
});

test('légume géant : union des 4 parcelles voisines, sinon la parcelle de l\'ancre', () => {
  const rect = (x, y) => ({ x, y, w: 32, h: 32 });
  const near = { 0: rect(0, 0), 1: rect(36, 0), 2: rect(0, 36), 3: rect(36, 36) };
  assert.deepEqual(giantRect({ plotRect: (i) => near[i] }, [0, 1, 2, 3], 0), { x: 0, y: 0, w: 68, h: 68 });
  const far = { 0: rect(0, 0), 1: rect(200, 0), 2: rect(0, 36), 3: rect(200, 36) };
  assert.deepEqual(giantRect({ plotRect: (i) => far[i] }, [0, 1, 2, 3], 0), rect(0, 0));
  assert.equal(giantRect({ plotRect: () => null }, [0, 1, 2, 3], 0), null);
});

test('décors trouvés à la ferme (owl.carved, statue.small) : un sprite dans la ferme et la boutique', () => {
  const found = COSMETICS.filter((c) => c.found);
  assert.deepEqual(found.map((c) => c.id).sort(), ['owl.carved', 'statue.small']);
  assert.equal(decorSprite('owl.carved'), 'owl.carved');
  assert.equal(decorSprite('statue.small'), 'find.statue');
  for (const c of found) assert.ok(SPRITES[decorSprite(c.id)], `${c.id} : sprite connu de l'atlas`);
});
