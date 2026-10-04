// Accompagnement — le catalogue des leçons (docs/ACCOMPAGNEMENT.md § 14) : unicité, FALC (≤ 90 caractères par étape,
// ≤ 12 mots par phrase), anciens conseils couverts, événements connus, chapitres, mots interdits. PUR (sans DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS, REMINDERS, CHAPTERS } from '../src/ui/coach/lessons/index.js';
import * as levels from '../src/ui/coach/lessons/levels.js';
import * as career from '../src/ui/coach/lessons/career.js';
import * as lots from '../src/ui/coach/lessons/lots.js';
import * as valley from '../src/ui/coach/lessons/valley.js';
import { SIGNAL_NAMES } from '../src/ui/coach/signals.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Types d'événements du cœur : tous les push('type') / api.push('type') de src/core. */
function coreEvents() {
  const out = new Set();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.js')) {
        for (const line of readFileSync(p, 'utf8').split('\n')) {
          if (!/push\(/.test(line)) continue;
          for (const m of line.matchAll(/'([a-z][A-Za-z]+)'/g)) out.add(m[1]);
        }
      }
    }
  };
  walk(join(ROOT, 'src/core'));
  return out;
}
const KNOWN = new Set([...coreEvents(), ...SIGNAL_NAMES]);

// Contexte d'essai : de quoi appeler les textes calculés (aucune exception attendue).
function mockCtx(mode) {
  const q = {
    plots: () => [],
    plantableCrops: () => [{ id: 'carrot', canAfford: true, seedCost: 4 }],
    investments: () => [{ id: 'hen', nextCost: 30, canBuy: true }, { id: 'chickenCoop', nextCost: 70, canBuy: true }],
    finance: () => ({ nextBill: { amount: 40 } }),
    calendar: () => ({ seasonId: 'spring', day: 1 }),
    career: { summary: () => ({}) },
  };
  return {
    game: { query: q, state: {} },
    q,
    state: { money: 100, investments: {}, weather: {}, time: { year: 1, day: 1 }, career: mode === 'career' ? { buildings: { coop: { pending: 2 } } } : null, stats: { year: {} } },
    mode,
    level: { gridCols: 4, tutorial: true },
    ui: { touch: true },
    day: { abs: 1001, dayProgress: 0.5 },
    mem: {},
    seen: () => false,
    safe: (fn, fb) => {
      try {
        const v = fn();
        return v === undefined ? fb : v;
      } catch {
        return fb;
      }
    },
    bill: { amount: 40, state: 'ok', daysLeft: 5 },
  };
}

function texts(step) {
  if (typeof step.say === 'string') return [step.say];
  if (typeof step.say !== 'function') return [];
  return ['levels', 'career'].map((m) => step.say(mockCtx(m))).filter((t) => typeof t === 'string');
}

const sentences = (t) => t.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝÉ«✓✗+\d])/u).filter(Boolean);
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const FORBIDDEN = /oubli|dépêchez|dernière chance|vous perdez/i;

test('catalogue : identifiants uniques, chapitre connu, au moins une étape, titre court', () => {
  const ids = new Set();
  const chapters = new Set(CHAPTERS.map((c) => c.id));
  for (const l of LESSONS) {
    assert.ok(l.id && typeof l.id === 'string', 'leçon sans identifiant');
    assert.ok(!ids.has(l.id), `leçon en double : ${l.id}`);
    ids.add(l.id);
    assert.ok(chapters.has(l.chapter), `${l.id} : chapitre inconnu « ${l.chapter} »`);
    assert.ok(Array.isArray(l.steps) && l.steps.length, `${l.id} : aucune étape`);
    assert.ok(typeof l.title === 'string' && l.title.length > 0 && l.title.length <= 30, `${l.id} : titre de 1 à 30 caractères`);
    if (!l.course) assert.ok(['E', 'U'].includes(l.tier), `${l.id} : niveau E ou U`);
    const stepIds = new Set();
    for (const s of l.steps) {
      assert.ok(s.id && !stepIds.has(s.id), `${l.id} : étape sans identifiant ou en double`);
      stepIds.add(s.id);
      if (s.back) assert.ok(l.steps.some((x) => x.id === s.back), `${l.id}.${s.id} : étape d'ancrage inconnue`);
    }
  }
});

test('catalogue : textes FALC (≤ 90 caractères, ≤ 12 mots par phrase, ≤ 3 phrases courtes), aucun mot qui culpabilise', () => {
  for (const l of LESSONS) {
    for (const s of l.steps) {
      for (const t of texts(s)) {
        assert.ok(t.length <= 90, `${l.id}.${s.id} : ${t.length} caractères « ${t} »`);
        const ss = sentences(t);
        assert.ok(ss.length <= 3, `${l.id}.${s.id} : trop de phrases « ${t} »`);
        for (const x of ss) assert.ok(words(x) <= 12, `${l.id}.${s.id} : phrase trop longue « ${x} »`);
        assert.ok(!FORBIDDEN.test(t), `${l.id}.${s.id} : mot interdit « ${t} »`);
      }
    }
  }
  for (const r of REMINDERS) assert.ok(!FORBIDDEN.test(r.example || ''), `rappel ${r.id}`);
});

test('catalogue : déclencheurs et réussites sur des événements connus du cœur ou des signaux déclarés', () => {
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  for (const l of LESSONS) {
    for (const t of list(l.trigger?.on)) assert.ok(KNOWN.has(t), `${l.id} : déclencheur inconnu « ${t} »`);
    for (const s of l.steps) for (const t of list(s.done?.on)) assert.ok(KNOWN.has(t), `${l.id}.${s.id} : réussite inconnue « ${t} »`);
  }
});

test('catalogue : chaque étape a une cible, sauf bienvenue / fin / lecture marquée', () => {
  for (const l of LESSONS) {
    for (const s of l.steps) {
      const reading = !!s.done?.button || s.choice;
      if (!reading) assert.ok(s.target !== undefined && s.target !== null, `${l.id}.${s.id} : étape à geste sans cible`);
    }
  }
});

test('rappels : identifiants uniques, attente et texte d\'exemple', () => {
  const ids = new Set();
  for (const r of REMINDERS) {
    assert.ok(!ids.has(r.id), `rappel en double : ${r.id}`);
    ids.add(r.id);
    assert.equal(typeof r.when, 'function', r.id);
    assert.ok(typeof r.example === 'string' && r.example.length <= 90, `${r.id} : exemple`);
  }
  for (const id of ['harvest', 'water', 'sow', 'money.low', 'order']) assert.ok(ids.has(id), `rappel de base manquant : ${id}`);
});

test('cours : ≈ 90 mots (niveau 1) et ≈ 75 mots (carrière), 13 et 11 étapes', () => {
  const count = (id) => LESSONS.find((l) => l.id === id).steps.reduce((n, s) => n + Math.max(0, ...texts(s).map(words)), 0);
  const fy = LESSONS.find((l) => l.id === 'levels.firstYear');
  const fs = LESSONS.find((l) => l.id === 'career.firstSteps');
  assert.equal(fy.steps.length, 13);
  assert.equal(fs.steps.length, 11);
  assert.ok(count('levels.firstYear') <= 110, `niveau 1 : ${count('levels.firstYear')} mots`);
  assert.ok(count('career.firstSteps') <= 95, `carrière : ${count('career.firstSteps')} mots`);
});

// Anciens conseils (docs/ACCOMPAGNEMENT.md § 1) : chacun a sa leçon, du même identifiant. Attend les paquets LEÇONS.
const OLD_HINTS = [
  'processing', 'processingBought', 'tree', 'goat', 'pollination', 'contest', 'grange', 'decor',
  'career.start', 'career.collect', 'career.lotForSale', 'career.plan', 'career.hire', 'career.leave', 'career.collectAll',
  'career.machine', 'career.storage', 'career.quest', 'career.crows', 'career.yearEnd', 'career.theme',
  'variety.board', 'variety.cart', 'variety.cards', 'variety.challenges', 'variety.merchant', 'variety.rare',
  'cozy.album', 'cozy.fete', 'cozy.winter', 'cozy.lanterns', 'cozy.helpers', 'cozy.seedFair',
  'valley.box', 'valley.jar', 'valley.trial', 'valley.nature', 'valley.species', 'valley.fixed', 'valley.fallow',
  'valley.stage', 'valley.library', 'valley.troc', 'valley.pair', 'valley.cross', 'valley.scented', 'valley.view',
  'valley.works', 'valley.valleyAnimal', 'valley.river', 'valley.wild',
];
const pending = [levels, career, lots, valley].some((m) => !(m.LESSONS || []).length);
test('catalogue : tout ancien conseil a sa leçon (même identifiant)', { skip: pending ? 'en attente des paquets LEÇONS (catalogues levels / career / lots / valley encore vides)' : false }, () => {
  const ids = new Set(LESSONS.map((l) => l.id));
  const missing = OLD_HINTS.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `anciens conseils sans leçon : ${missing.join(', ')}`);
});
