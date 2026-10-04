// Paysage sonore de la Vallée vivante (lot V4, paquet AUDIO) : natureScape pur (src/audio/soundscape.js) et budget de
// voix du moteur (src/audio/nature.js, sur un faux contexte audio). Contrat : docs/ARCHITECTURE.md, « Plan audio technique
// (paquet AUDIO) » ; plan sonore : docs/VALLEE.md § 18.8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BIRDS_BY_STAGE, LAYER_IDS, MAX_VOICES, NATURE_SOURCES, RATE_CAP, SONG_IDS, demoFacts, farmBirdsFactor, natureScape, phaseOf, spatial,
} from '../src/audio/soundscape.js';
import { createNature } from '../src/audio/nature.js';
import { createSynth } from '../src/audio/synth.js';

/** Faits factices (forme figée de soundFacts, CORE) : vallée commencée, rien d'installé. */
function facts(over = {}) {
  return {
    on: true, stage: 0, installed: [], seen: [],
    places: { brook: 0, combe: 0, poppies: 0, millpond: 0, bocage: 0, oldOrchard: 0 },
    farm: { pond: false, frogs: false, wildGrass: 0, fallows: 0, strips: 0, hives: 0, nest: null },
    flyover: null, complete: false,
    ...over,
  };
}
const day = { where: 'farm', season: 'spring', weather: 'sunny', dayProgress: 0.5, detail: 'full' };
const ids = (scape) => scape.birds.map((b) => b.id).sort();

test('BIRDS_BY_STAGE : × 0,25 à l\'étape 0, × 1 dès l\'étape 5 ; hors Vallée : × 1', () => {
  assert.deepEqual([...BIRDS_BY_STAGE], [0.25, 0.4, 0.55, 0.7, 0.85, 1, 1, 1, 1]);
  assert.equal(farmBirdsFactor(facts({ stage: 0 })), 0.25);
  assert.equal(farmBirdsFactor(facts({ stage: 3 })), 0.7);
  assert.equal(farmBirdsFactor(facts({ stage: 8 })), 1);
  assert.equal(farmBirdsFactor(null), 1);
  assert.equal(farmBirdsFactor({ on: false, stage: 0 }), 1);
});

test('phaseOf : aube (premier quart), journée, soir (dernier quart)', () => {
  assert.equal(phaseOf(0), 'dawn');
  assert.equal(phaseOf(0.249), 'dawn');
  assert.equal(phaseOf(0.25), 'day');
  assert.equal(phaseOf(0.74), 'day');
  assert.equal(phaseOf(0.75), 'dusk');
  assert.equal(phaseOf(1), 'dusk');
  assert.equal(phaseOf(undefined), 'day', 'inconnu : la journée');
});

test('étape 0 : la vallée s\'est tue — birdsFactor 0,25, aucun chant, aucune couche', () => {
  const s = natureScape(facts(), day);
  assert.equal(s.birdsFactor, 0.25);
  assert.deepEqual(s.birds, []);
  assert.ok(Object.values(s.layers).every((v) => v === 0));
});

test('hors Vallée (null, on: false) et « Coupés » : rien de nouveau, couche birds intacte (× 1)', () => {
  for (const f of [null, { on: false }]) {
    const s = natureScape(f, day);
    assert.equal(s.birdsFactor, 1);
    assert.deepEqual(s.birds, []);
    assert.equal(s.maxVoices, 0);
  }
  const off = natureScape(demoFacts(), { ...day, detail: 'off' });
  assert.equal(off.birdsFactor, 1, '« Coupés » : sans le facteur d\'étape');
  assert.deepEqual(off.birds, []);
  assert.ok(Object.values(off.layers).every((v) => v === 0));
});

test('rouge-gorge installé : il chante même l\'hiver ; le merle pas en automne', () => {
  const f = facts({ stage: 2, installed: ['robin', 'blackbird'] });
  assert.ok(ids(natureScape(f, { ...day, season: 'winter' })).includes('robin'));
  assert.ok(!ids(natureScape(f, { ...day, season: 'autumn' })).includes('blackbird'));
  assert.ok(ids(natureScape(f, { ...day, season: 'spring' })).includes('blackbird'));
  // L'aube double le rouge-gorge.
  const dawn = natureScape(f, { ...day, dayProgress: 0.1 }).birds.find((b) => b.id === 'robin');
  const noon = natureScape(f, day).birds.find((b) => b.id === 'robin');
  assert.equal(dawn.rate, noon.rate * 2);
});

test('un chant n\'existe que si l\'espèce est installée (ou le visiteur vu)', () => {
  const s = natureScape(facts({ stage: 4, installed: ['robin'] }), day);
  assert.deepEqual(ids(s), ['robin']);
  const v = natureScape(facts({ stage: 8, seen: ['oriole'], places: { oldOrchard: 3 } }), { ...day, where: 'view', season: 'summer', dayProgress: 0.1 });
  assert.deepEqual(ids(v), ['oriole']);
});

test('pluie et orage : aucun chant (grenouilles gardées) ; neige : rouge-gorge, chouettes, ruisseau', () => {
  const f = demoFacts();
  for (const weather of ['rain', 'storm']) {
    const s = natureScape(f, { ...day, weather, dayProgress: 0.9 });
    assert.deepEqual(s.birds, [], weather);
    assert.ok(s.layers.frogs > 0, `${weather} : les grenouilles chantent encore`);
    assert.equal(s.layers.crickets, 0);
  }
  const snow = natureScape(f, { ...day, season: 'winter', weather: 'snow', dayProgress: 0.9 });
  for (const b of snow.birds) assert.ok(['robin', 'tawnyOwl', 'littleOwl'].includes(b.id), b.id);
  assert.ok(snow.layers.brook > 0);
  assert.equal(snow.layers.frogs, 0);
  const snowView = natureScape(f, { ...day, where: 'view', season: 'winter', weather: 'snow', dayProgress: 0.9 });
  assert.equal(snowView.brook, 'frozen');
  assert.deepEqual(ids(snowView), ['littleOwl', 'robin', 'tawnyOwl']);
});

test('grenouilles : × 1,5 le jour qui suit une pluie ; l\'été, seulement le soir', () => {
  const f = facts({ stage: 3, farm: { frogs: true } });
  const base = natureScape(f, day).layers.frogs;
  assert.equal(base, 0.3);
  assert.equal(natureScape(f, { ...day, afterRain: true }).layers.frogs, 0.45);
  assert.equal(natureScape(f, { ...day, season: 'summer' }).layers.frogs, 0);
  assert.ok(natureScape(f, { ...day, season: 'summer', dayProgress: 0.8 }).layers.frogs > 0);
});

test('ruisseau : Ru 1 / 2 / 3 dans la vue → 0,3 / 0,6 / 0,8 ; ferme à l\'étape 6 → 0,15 lointain', () => {
  const view = { ...day, where: 'view' };
  assert.equal(natureScape(facts({ stage: 4, places: { brook: 1 } }), view).layers.brook, 0.3);
  assert.equal(natureScape(facts({ stage: 4, places: { brook: 2 } }), view).layers.brook, 0.6);
  assert.equal(natureScape(facts({ stage: 4, places: { brook: 3 } }), view).layers.brook, 0.8);
  assert.equal(natureScape(facts({ stage: 4, places: { brook: 0 } }), view).layers.brook, 0);
  const farm6 = natureScape(facts({ stage: 6 }), day);
  assert.equal(farm6.layers.brook, 0.15);
  assert.equal(farm6.brook, 'far');
  assert.equal(natureScape(facts({ stage: 5 }), day).layers.brook, 0);
  // Gelé l'hiver : plus doux.
  assert.ok(natureScape(facts({ stage: 4, places: { brook: 2 } }), { ...view, season: 'winter' }).layers.brook < 0.6);
});

test('moulin à Ru 4 hors hiver ; feuilles (bois ≥ 2, ferme étape ≥ 5) ; grillons l\'été', () => {
  const view = { ...day, where: 'view' };
  const f = facts({ stage: 7, places: { brook: 4, combe: 2, poppies: 1 } });
  assert.equal(natureScape(f, view).layers.mill, 0.4);
  assert.equal(natureScape(f, { ...view, season: 'winter' }).layers.mill, 0);
  assert.equal(natureScape(f, view).layers.leaves, 0.25);
  assert.equal(natureScape(facts({ stage: 5 }), day).layers.leaves, 0.25);
  assert.equal(natureScape(facts({ stage: 4 }), day).layers.leaves, 0);
  assert.equal(natureScape(f, { ...view, season: 'summer' }).layers.crickets, 0.2);
  assert.equal(natureScape(f, { ...view, season: 'autumn' }).layers.crickets, 0);
  const wild = facts({ stage: 3, farm: { strips: 3, fallows: 1 } });
  const c = natureScape(wild, { ...day, season: 'summer' }).layers.crickets;
  assert.ok(c >= 0.2 && c <= 0.35, String(c));
});

test('plafond : ≤ 12 phrases par minute à la ferme, ≤ 16 dans la vue, au prorata', () => {
  const f = demoFacts();
  for (const where of ['farm', 'view']) {
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      for (const dayProgress of [0.1, 0.5, 0.9]) {
        const s = natureScape(f, { ...day, where, season, dayProgress });
        const total = s.birds.reduce((a, b) => a + b.rate, 0);
        assert.ok(total <= RATE_CAP[where] + 1e-3, `${where} ${season} ${dayProgress} : ${total}`);
      }
    }
  }
  // Un plafond qui mord garde les proportions.
  const dawn = natureScape(f, { ...day, dayProgress: 0.1 });
  const robin = dawn.birds.find((b) => b.id === 'robin').rate;
  const swallow = dawn.birds.find((b) => b.id === 'swallow').rate;
  assert.ok(Math.abs(robin / swallow - (1.5 * 2) / (2 * 0.6)) < 0.01);
});

test('« Légers » → 4 voix et pas d\'écho ; « Complets » → 12 voix, écho dans la vue seulement', () => {
  const f = demoFacts();
  const light = natureScape(f, { ...day, where: 'view', detail: 'light' });
  assert.equal(light.maxVoices, 4);
  assert.equal(light.echo, false);
  const full = natureScape(f, { ...day, where: 'view', detail: 'full' });
  assert.equal(full.maxVoices, 12);
  assert.equal(full.echo, true);
  assert.equal(natureScape(f, day).echo, false);
  assert.deepEqual({ ...MAX_VOICES }, { full: 12, light: 4 });
});

test('spatial : gain borné à [0,15 ; 1], panoramique à [−0,6 ; 0,6], ruban du ruisseau', () => {
  for (let x = -50; x <= 250; x += 25) {
    for (let y = -100; y <= 600; y += 50) {
      const s = spatial({ x, y }, { y: 200, h: 160 });
      assert.ok(s.gain >= 0.15 && s.gain <= 1);
      assert.ok(s.pan >= -0.6 && s.pan <= 0.6);
    }
  }
  assert.deepEqual(spatial({ x: 96, y: 200 }, { y: 200 }), { gain: 1, pan: 0 });
  assert.equal(spatial({ x: 96, y: 0 }, { y: 1000 }).gain, 0.15);
  assert.ok(spatial({ x: 40, y: 200 }, { y: 200 }).pan < 0, 'le ruisseau à gauche');
  assert.ok(spatial({ x: 152, y: 200 }, { y: 200 }).pan > 0, 'la prairie à droite');
  assert.equal(spatial({ x: 40, y0: 120, y1: 420 }, { y: 300 }).gain, 1, 'ruban : au point le plus proche');
});

test('vue : chaque chant placé ; places des visiteurs remplaçables (spots) ; ferme : cigognes au nid seulement', () => {
  const f = demoFacts();
  const view = natureScape(f, { ...day, where: 'view', season: 'spring', spots: { steeple: { x: 170, y: 30 } } });
  for (const b of view.birds) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), b.id);
  const stork = view.birds.find((b) => b.id === 'whiteStork');
  assert.deepEqual([stork.x, stork.y], [170, 30]);
  const robin = view.birds.find((b) => b.id === 'robin');
  assert.ok(robin && robin.y > 250, 'le rouge-gorge s\'entend depuis la ferme, en bas de la vue');
  assert.ok(!ids(natureScape(f, day)).includes('kingfisher'), 'le martin-pêcheur ne s\'entend que dans la vue');
  const noNest = natureScape(demoFacts({ farm: { nest: null } }), day);
  assert.ok(!ids(noNest).includes('whiteStork'));
  assert.ok(ids(natureScape(demoFacts({ farm: { nest: null }, flyover: 'storks' }), day)).includes('whiteStork'));
  const autumn = { ...day, season: 'autumn' };
  assert.ok(!ids(natureScape(f, autumn)).includes('crane'), 'les grues : les jours de passage à la ferme');
  assert.ok(ids(natureScape(demoFacts({ flyover: 'cranes' }), autumn)).includes('crane'));
});

test('coucou : printemps, étape ≥ 5, ferme et vue', () => {
  assert.ok(!ids(natureScape(facts({ stage: 4 }), day)).includes('cuckoo'));
  assert.ok(ids(natureScape(facts({ stage: 5 }), day)).includes('cuckoo'));
  assert.ok(ids(natureScape(facts({ stage: 5 }), { ...day, where: 'view' })).includes('cuckoo'));
  assert.ok(!ids(natureScape(facts({ stage: 5 }), { ...day, season: 'summer' })).includes('cuckoo'));
});

test('NATURE_SOURCES : 5 couches, 17 chants, chacun avec saisons, recette et lieu ; le moteur sait tous les jouer', () => {
  assert.deepEqual([...LAYER_IDS], ['brook', 'mill', 'leaves', 'crickets', 'frogs']);
  assert.equal(SONG_IDS.length, 17);
  for (const id of SONG_IDS) {
    const s = NATURE_SOURCES[id];
    assert.ok(s.rate > 0 && s.seasons && s.phases && s.recipe && s.name, id);
    assert.ok(s.farm || s.view, `${id} : un lieu`);
  }
  const engine = createNature(fakeCtx(), fakeCtx().destination, { clock: 'manual' });
  assert.deepEqual([...engine.songs].sort(), [...SONG_IDS].sort());
});

test('soundscape.js est pur : ni DOM, ni horloge, ni hasard', () => {
  const src = readFileSync(new URL('../src/audio/soundscape.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['Math.random', 'Date.', 'performance.', 'document', 'window', 'AudioContext', 'import ']) {
    assert.ok(!src.includes(bad), bad);
  }
});

test('natureScape est déterministe et ne modifie pas les faits', () => {
  const f = demoFacts();
  const copy = JSON.stringify(f);
  const a = natureScape(f, { ...day, where: 'view' });
  const b = natureScape(f, { ...day, where: 'view' });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(f), copy);
});

// ── Moteur sur un faux contexte audio (budget de voix, arrêt) ────────────────────────
function fakeParam(v = 0) {
  const p = { value: v };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[m] = () => p;
  return p;
}
function fakeCtx() {
  const live = new Set();
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  const source = (extra) => {
    const n = node({ start() { live.add(n); }, stop() {}, onended: null, ...extra });
    return n;
  };
  const ctx = {
    sampleRate: 8000, currentTime: 0, state: 'running', live,
    destination: node(),
    createGain: () => node({ gain: fakeParam(1) }),
    createOscillator: () => source({ type: 'sine', frequency: fakeParam(440) }),
    createBufferSource: () => source({ buffer: null, loop: false }),
    createBiquadFilter: () => node({ type: 'lowpass', frequency: fakeParam(350), Q: fakeParam(1), gain: fakeParam(0) }),
    createWaveShaper: () => node({ curve: null, oversample: 'none' }),
    createDynamicsCompressor: () => node({ threshold: fakeParam(), knee: fakeParam(), ratio: fakeParam(), attack: fakeParam(), release: fakeParam() }),
    createDelay: () => node({ delayTime: fakeParam() }),
    createStereoPanner: () => node({ pan: fakeParam() }),
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    /** Termine toutes les sources (comme si le temps passait). */
    endAll() {
      for (const n of [...live]) {
        live.delete(n);
        if (n.onended) n.onended();
      }
    },
  };
  return ctx;
}

test('moteur : jamais plus de 12 voix (« Complets »), 4 (« Légers ») ; deux phrases d\'un même chant ≥ 4 s', () => {
  for (const detail of ['full', 'light']) {
    const ctx = fakeCtx();
    let r = 0;
    const engine = createNature(ctx, ctx.destination, { detail, clock: 'manual', random: () => ((r = (r * 9301 + 49297) % 233280) / 233280) });
    // Tous les chants, fréquence énorme : le budget doit tenir.
    const birds = SONG_IDS.map((id) => ({ id, rate: 240 }));
    engine.set({ on: true, where: 'farm', layers: { brook: 0, mill: 0, leaves: 0, crickets: 0, frogs: 0 }, birds, maxVoices: MAX_VOICES[detail], echo: false });
    let peak = 0;
    for (let t = 0; t < 30; t += 0.25) {
      ctx.currentTime = t;
      engine.advance(t);
      peak = Math.max(peak, engine.voices);
    }
    assert.equal(peak, MAX_VOICES[detail], detail);
    ctx.endAll();
    assert.equal(engine.voices, 0, 'toutes les voix libérées à leur fin');
    engine.stop();
    assert.ok(engine.stopped);
  }
});

test('moteur : couches démarrées quand le niveau monte, arrêtées après le fondu quand il tombe à 0', () => {
  const ctx = fakeCtx();
  const engine = createNature(ctx, ctx.destination, { clock: 'manual' });
  engine.set(natureScape(demoFacts(), { ...day, where: 'view', season: 'summer' }));
  assert.ok(engine.layers >= 4, String(engine.layers));
  engine.set(null);
  for (let t = 0; t < 6; t += 0.25) {
    ctx.currentTime = t;
    engine.advance(t);
  }
  assert.equal(engine.layers, 0);
  assert.equal(engine.play('robin'), true, 'débogage : une phrase hors paysage');
  assert.equal(engine.play('nothing'), false);
});

test('synth : tons « clatter » (cigognes) et « legend » (réveil d\'une légende) ; limiteur de nature borné sous 0,5', () => {
  const ctx = fakeCtx();
  const synth = createSynth(ctx, ctx.destination);
  assert.ok(synth.names.includes('clatter') && synth.names.includes('legend'));
  assert.equal(synth.play('clatter', { when: 0 }), true);
  assert.equal(synth.play('legend', { when: 0 }), true);
  let shaper = null;
  const ctx2 = fakeCtx();
  const make = ctx2.createWaveShaper;
  ctx2.createWaveShaper = () => (shaper = make());
  createNature(ctx2, ctx2.destination, { clock: 'manual' });
  const curve = shaper.curve;
  assert.ok(curve && curve.length > 1000);
  assert.ok(Math.max(...curve.map(Math.abs)) < 0.5, 'pic de sortie toujours < 0,5');
  const mid = (curve.length - 1) / 2;
  const at = (x) => curve[Math.round(mid + x * mid)];
  assert.ok(Math.abs(at(0.2) - 0.2) < 0.002, 'linéaire en dessous de 0,3');
});
