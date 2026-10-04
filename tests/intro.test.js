// Intro « MG studios » (src/intro/) : chronologie et fin douce (logique pure), décision du portillon
// (src/intro/gate.js, exécuté dans un faux navigateur), réglage par défaut, et présence dans la version publiée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ROOT, hash16 } from '../tools/build.js';
import {
  T, RM, FADE_OUT, SKIP_FADE, INTRO_DUR, SND_INFO, INTRO_SOUNDS, introSoundPath, introPlan, overlayAlpha, endTime,
  soundProgram, gainCurve, henAt, HEN_REST, sndLevel,
} from '../src/intro/timeline.js';
import { INTRO_SHEET, INTRO_SPRITES } from '../src/intro/sheet.js';
import { DEFAULT_SETTINGS } from '../src/storage.js';

const readText = (p) => readFileSync(join(ROOT, p), 'utf8');

test('chronologie : durée raisonnable, fondu final de 0,8 à 1,2 s, au plus ~6 s avant le fondu', () => {
  const plan = introPlan(false);
  assert.ok(plan.fadeStart <= 6, `fondu final à ${plan.fadeStart} s`);
  assert.ok(FADE_OUT >= 0.8 && FADE_OUT <= 1.2);
  assert.equal(plan.fadeEnd - plan.fadeStart, FADE_OUT);
  assert.equal(plan.dur, INTRO_DUR);
  // tenue de l'image finale : tout le monde est en place AVANT le dernier geste, le geste finit avant le fondu
  assert.ok(T.henStop < T.puff && T.puff < T.puffEnd && T.puffEnd <= T.fadeStart);
  assert.ok(T.sheep + SND_INFO.mouton.dur <= T.puff, 'le mouton a fini de bêler avant le dernier geste');
  assert.ok(T.bird < T.fadeStart, 'l\'oiseau passe pendant la tenue');
  // la poule s'arrête et reste en place (elle ne quitte plus l'écran)
  const ct = (t) => t - (T.hen - 0.95);
  assert.equal(henAt(ct(T.henStop)).p, HEN_REST);
  assert.deepEqual(henAt(ct(T.fadeStart)), { p: HEN_REST, walking: false, visible: true });
  assert.deepEqual(henAt(99), { p: HEN_REST, walking: false, visible: true });
  assert.ok(henAt(ct(T.henStop - 0.2)).walking);
});

test('opacité : pleine pendant l\'animation, fondu enchaîné continu jusqu\'à 0, passage au toucher en ~0,35 s', () => {
  const plan = introPlan(false);
  assert.equal(overlayAlpha(0, plan), 1);
  assert.equal(overlayAlpha(T.fadeStart - 0.01, plan), 1);
  assert.equal(overlayAlpha(plan.fadeEnd, plan), 0);
  let prev = 1;
  for (let t = plan.fadeStart; t <= plan.fadeEnd + 1e-9; t += 0.02) {
    const a = overlayAlpha(t, plan);
    assert.ok(a <= prev + 1e-9 && prev - a < 0.06, `saut d'opacité à ${t.toFixed(2)} s`);
    prev = a;
  }
  // toucher à 2 s : 1 → 0 en SKIP_FADE, sans saut
  assert.ok(SKIP_FADE >= 0.3 && SKIP_FADE <= 0.4);
  assert.equal(overlayAlpha(2, plan, 2), 1);
  assert.ok(Math.abs(overlayAlpha(2 + SKIP_FADE / 2, plan, 2) - 0.5) < 1e-9);
  assert.equal(overlayAlpha(2 + SKIP_FADE, plan, 2), 0);
  assert.equal(endTime(plan, 2), 2 + SKIP_FADE);
  // toucher pendant le fondu final : jamais de remontée
  const tt = plan.fadeStart + 0.5;
  assert.ok(overlayAlpha(tt + 0.1, plan, tt) <= overlayAlpha(tt, plan, tt));
  assert.equal(endTime(plan, plan.fadeEnd - 0.1), plan.fadeEnd);
});

test('son : rien ne coupe sec — chaque son s\'éteint de lui-même avant la fin, le volume général descend en rampe ≥ 0,6 s', () => {
  for (const reduced of [false, true]) {
    const plan = introPlan(reduced);
    for (const e of soundProgram(reduced)) {
      assert.ok(e.at >= 0, `${e.kind} avant le début`);
      assert.ok(e.at + e.dur <= plan.dur + 0.15, `${e.kind}${e.name ? ` ${e.name}` : ''} (${reduced ? 'mouvement réduit' : 'normal'}) finit à ${(e.at + e.dur).toFixed(2)} s, après la fin (${plan.dur} s)`);
      if (e.kind === 'sample') assert.ok(SND_INFO[e.name], e.name);
    }
    const curve = gainCurve(plan);
    assert.deepEqual(curve[curve.length - 1], [plan.fadeEnd, 0]);
    const fall = curve.at(-1)[0] - curve.at(-2)[0];
    assert.ok(curve.at(-2)[1] === 1 && fall >= 0.6, `rampe finale de ${fall} s`);
    // les cris sont terminés quand le fondu commence (seuls l'accord et la clochette résonnent dans le fondu)
    for (const e of soundProgram(reduced).filter((x) => x.kind === 'sample')) {
      assert.ok(e.at + e.dur <= plan.fadeStart + 0.05, `${e.name} encore en cours au début du fondu`);
    }
  }
  // l'accord final est posé avant le fondu et s'éteint naturellement (au plus à la fin)
  const chord = soundProgram(false).filter((e) => e.at >= T.chord - 1e-9 && e.kind !== 'sample');
  assert.ok(chord.length >= 4);
  assert.ok(chord.every((e) => e.at < T.fadeStart && e.at + e.dur <= INTRO_DUR + 0.15));
});

test('son : passage au toucher = rampe de la valeur courante vers 0 en SKIP_FADE (aucune coupure)', () => {
  const plan = introPlan(false);
  const c = gainCurve(plan, 2);
  assert.deepEqual(c.at(-2), [2, 1]);
  assert.deepEqual(c.at(-1), [2 + SKIP_FADE, 0]);
  const mid = plan.fadeStart + 0.4; // pendant le fondu final : on part de la valeur atteinte
  const c2 = gainCurve(plan, mid);
  assert.ok(Math.abs(c2.at(-2)[1] - 0.6) < 1e-9);
  assert.equal(c2.at(-1)[1], 0);
  assert.ok(c2.at(-1)[0] - c2.at(-2)[0] > 0.3);
  // les temps sont croissants
  for (const curve of [c, c2, gainCurve(plan)]) for (let i = 1; i < curve.length; i++) assert.ok(curve[i][0] >= curve[i - 1][0]);
});

test('mouvement réduit : image fixe en fondu, cocorico puis accord, fondu de sortie', () => {
  const plan = introPlan(true);
  assert.ok(plan.reduced);
  assert.ok(plan.fadeEnd - plan.fadeStart >= 0.8);
  const prog = soundProgram(true);
  assert.equal(prog[0].name, 'coq');
  assert.equal(prog[0].at, RM.crow);
  assert.ok(prog.slice(1).every((e) => e.at >= RM.crow + SND_INFO.coq.dur - 0.15));
});

test('enveloppes des cris : niveaux 0 à 9, silence avant et après', () => {
  for (const n of INTRO_SOUNDS) {
    assert.equal(sndLevel(n, -0.1), 0);
    assert.equal(sndLevel(n, SND_INFO[n].dur + 1), 0);
    assert.ok(/^[0-9]+$/.test(SND_INFO[n].env));
    assert.ok(Math.abs(SND_INFO[n].env.length * 0.02 - SND_INFO[n].dur) < 0.08, n);
  }
});

test('ressources de l\'intro : planche et cris présents', () => {
  assert.ok(existsSync(join(ROOT, INTRO_SHEET)));
  for (const k of ['rooster.idle', 'rooster.crow', 'rooster.flap', 'rooster.puff', 'hen', 'cow', 'sheep', 'bird.0', 'grass.0', 'fence', 'soil', 'crop.0', 'tree.a']) assert.ok(INTRO_SPRITES[k], k);
  for (const n of INTRO_SOUNDS) assert.ok(existsSync(join(ROOT, introSoundPath(n))), introSoundPath(n));
  assert.equal(DEFAULT_SETTINGS.intro, true, 'intro activée par défaut');
});

// ── Portillon (src/intro/gate.js) dans un faux navigateur ──
function runGate({ search = '', settings = null, webdriver = false, build = { intro: { src: 'dist/intro.x.js' } }, reduced = false } = {}) {
  const store = new Map();
  if (settings) store.set('une-annee-a-la-ferme.settings', JSON.stringify(settings));
  const appended = [];
  const html = { className: '' };
  const window = {
    __FERME_BUILD__: build,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null) },
    matchMedia: () => ({ matches: reduced }),
    addEventListener() {},
  };
  const document = {
    documentElement: html,
    readyState: 'loading',
    head: { appendChild: (n) => appended.push(n) },
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ setAttribute() {}, getAttribute() {} }),
    getElementById: () => null,
  };
  const ctx = { window, document, location: { search, href: `http://x/${search}` }, navigator: { webdriver }, URLSearchParams, URL, console, setTimeout, clearTimeout, Event: class {} };
  vm.runInNewContext(readText('src/intro/gate.js'), ctx);
  return { api: window.__fermeIntro, html, appended };
}

test('portillon : intro à chaque ouverture, sauf ?nointro, réglage coupé, ?debug=1 ou robot de test (?intro=1 la force)', () => {
  const on = runGate();
  assert.equal(on.api.active, true);
  assert.equal(on.api.state, 'title');
  assert.match(on.html.className, /\bintro-on\b/);
  assert.equal(on.appended.length, 1, 'lecteur téléchargé en parallèle');
  assert.equal(on.appended[0].src, 'dist/intro.x.js');
  for (const [opts, reason] of [
    [{ search: '?nointro' }, '?nointro'],
    [{ search: '?nointro=1&intro=1' }, '?nointro'],
    [{ settings: { intro: false } }, 'réglage'],
    [{ search: '?debug=1' }, '?debug=1'],
    [{ webdriver: true }, 'robot de test'],
    [{ build: {} }, 'pas de lecteur'],
  ]) {
    const r = runGate(opts);
    assert.equal(r.api.active, false, JSON.stringify(opts));
    assert.equal(r.api.reason, reason);
    assert.equal(r.html.className, '');
    assert.equal(r.appended.length, 0);
  }
  assert.equal(runGate({ search: '?debug=1&intro=1' }).api.active, true);
  assert.equal(runGate({ webdriver: true, search: '?intro=1' }).api.active, true);
  // intro désactivée : le jeu passe tout de suite (onGameReady appelle go)
  let called = 0;
  runGate({ search: '?nointro' }).api.onGameReady(() => { called += 1; });
  assert.equal(called, 1);
  // intro active, écran-titre : le jeu attend le toucher
  let waited = 0;
  on.api.onGameReady(() => { waited += 1; });
  assert.equal(waited, 0);
});

test('portillon : volume des effets du joueur (au carré), son coupé, mouvement réduit (réglage ou système)', () => {
  assert.ok(Math.abs(runGate().api.volume - 0.64) < 1e-9);
  assert.ok(Math.abs(runGate({ settings: { sfxVolume: 0.5 } }).api.volume - 0.25) < 1e-9);
  assert.equal(runGate({ settings: { muted: true, sfxVolume: 1 } }).api.volume, 0);
  assert.equal(runGate().api.reduced, false);
  assert.equal(runGate({ settings: { reducedMotion: true } }).api.reduced, true);
  const r = runGate({ reduced: true });
  assert.equal(r.api.reduced, true);
  assert.match(r.html.className, /\bintro-reduced\b/);
  assert.equal(runGate({ settings: 'pas du json' }).api.active, true);
});

test('version publiée : paquet de l\'intro, portillon dans les pages, précache « core » (planche, cris)', () => {
  const info = JSON.parse(readText('dist/build.json'));
  assert.match(info.intro, /^dist\/intro\.[0-9a-f]{10}\.js$/);
  assert.ok(existsSync(join(ROOT, info.intro)));
  const html = readText('index.html');
  const cfg = JSON.parse(/window\.__FERME_BUILD__ = (\{.*?\});<\/script>/.exec(html)[1]);
  assert.equal(cfg.intro.src, info.intro);
  assert.ok(html.includes('window.__fermeIntro = api'), 'portillon absent de index.html');
  assert.ok(html.indexOf('window.__fermeIntro = api') < html.indexOf('window.__repairGame'), 'portillon avant le chargeur');
  assert.ok(html.includes('id="intro"'));
  const dev = readText('dev.html');
  const devCfg = JSON.parse(/window\.__FERME_BUILD__ = (\{.*?\});<\/script>/.exec(dev)[1]);
  assert.equal(devCfg.intro.module, 'src/intro/player.js');
  assert.ok(dev.includes('window.__fermeIntro = api') && dev.includes('css/intro.css'));
  const sw = readText('sw.js');
  assert.ok(sw.includes(`["${info.intro}", '${hash16(readFileSync(join(ROOT, info.intro)))}'`), 'paquet de l\'intro absent du précache');
  for (const p of [INTRO_SHEET, ...INTRO_SOUNDS.map(introSoundPath)]) {
    const m = new RegExp(`\\["${p.replace(/[.]/g, '\\.')}", '([0-9a-f]{16})', \\d+, '(core|lazy)'\\]`).exec(sw);
    assert.ok(m, `${p} absent du précache`);
    assert.equal(m[1], hash16(readFileSync(join(ROOT, p))));
    assert.equal(m[2], 'core', `${p} doit être installé d'emblée (l'intro se joue à l'ouverture)`);
  }
  // le paquet de l'intro reste petit (il passe avant le jeu sur un réseau lent)
  assert.ok(readFileSync(join(ROOT, info.intro)).length < 80 * 1024);
});
