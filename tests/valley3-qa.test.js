// Vallée V3 — corrections de l'intégration au doigt (QA V3) : carte « Trouvailles » unique, terres sauvages sur la grande
// carte, texte de la canicule juste en Détente comme en Classique, terres sauvages toujours ouvertes après le 16ᵉ terrain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findsGroups } from '../src/ui/lot2.js';
import { cellLabel, wildAria } from '../src/ui/career/lots.js';
import { PLACES_BY_ID, WILD_RULES } from '../src/data/career/places.js';

test('trouvailles : toutes les cartes en attente en une seule, sans les événements vides', () => {
  const a = { type: 'finds', lotName: 'Le Haut-Champ', finds: [{ kind: 'well' }] };
  const b = { type: 'finds', lotName: 'La Combe', finds: [] };
  const c = { type: 'finds', lotName: 'Les Saules', finds: [{ kind: 'chest' }, { kind: 'lamb' }] };
  assert.deepEqual(findsGroups([a, b, c]), [a, c]);
  assert.deepEqual(findsGroups(a), [a]);
  assert.deepEqual(findsGroups([null, undefined]), []);
});

test('grande carte : une terre sauvage porte le nom de sa sorte, une forêt à confier son prix ; lecteurs d\'écran', () => {
  assert.equal(cellLabel({ state: 'wildland', wildKind: 'wood', wildStage: 1 }), 'Bois');
  assert.equal(cellLabel({ state: 'wildland', wildKind: 'marsh', wildStage: 2 }), 'Marais');
  assert.equal(cellLabel({ state: 'wildland', wildKind: 'grassland', wildStage: 0 }), 'Prairie');
  assert.match(cellLabel({ state: 'wildable', price: 2800 }), /2.800/);
  assert.equal(cellLabel({ state: 'forest' }), '');
  assert.match(wildAria({ state: 'wildland', wildKind: 'wood', wildStage: 1 }), /terre sauvage, bois, en reprise/);
  assert.match(wildAria({ state: 'wildland', wildKind: 'marsh', wildStage: 2 }), /terre sauvage, marais, reprise/);
  assert.match(wildAria({ state: 'wildable', price: 2500 }), /forêt à confier à la nature, 2.500 pièces/);
  assert.equal(wildAria({ state: 'owned' }), '');
});

test('canicule (Ru des Saules 1) : le texte dit un quart de jour de plus (juste en Détente comme en Classique)', () => {
  const b = PLACES_BY_ID.brook.steps[1].boon;
  assert.equal(b.kind, 'heatGrowth');
  assert.equal(b.value, 0.25);
  assert.match(b.text, /¼ de jour de plus/);
  assert.doesNotMatch(b.text, /^Canicule : une parcelle non arrosée pousse ½ jour \(au lieu de ¼\)\.$/);
});

test('terres sauvages : ouvertes au 16ᵉ terrain, sans autre attente (évaluation de l\'intégration, § 17.12.8)', () => {
  assert.equal(WILD_RULES.needLots, 16);
  assert.equal(WILD_RULES.needStage, undefined, 'aucune étape de la vallée demandée en plus');
});
