// Intro « MG studios » — le lecteur (point d'entrée du petit paquet dist/intro.<empreinte>.js ; en mode
// développement, chargé tel quel par import()). Il est appelé par le portillon de l'intro (src/intro/gate.js,
// recopié dans la page) : rien ne se joue tant que le joueur n'a pas touché l'écran-titre.
//
//   window.__fermeIntroPlayer.load()        télécharge la planche et les cris (dès le chargement de la page)
//   window.__fermeIntroPlayer.play(opts)    joue l'intro ; renvoie { skip() }
//     opts : { root, canvas, ctx, volume, reduced, onFadeStart(), onDone() }
//       root      : la couche de l'intro (son opacité porte le fondu enchaîné vers l'écran suivant)
//       ctx       : l'AudioContext débloqué au toucher (celui que le jeu reprendra), ou null
//       volume    : volume des effets du joueur, déjà au carré (0 = sans son)
//       reduced   : mouvement réduit (image fixe en fondu, cocorico et accord)
//       onFadeStart : début du fondu final (ou du fondu rapide après un toucher) : le jeu peut s'afficher dessous
//       onDone    : couche invisible, tout est fini

import { assetUrl } from '../version.js';
import { INTRO_SHEET } from './sheet.js';
import { INTRO_SOUNDS, introSoundPath, introPlan, overlayAlpha, artAlpha, endTime, soundProgram, gainCurve } from './timeline.js';
import { createMgStudios } from './mg-studios.js';
import { createVoice, decodeSamples } from './voice.js';

let loading = null;
const raw = {};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`image introuvable : ${src}`));
    im.src = src;
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Télécharge la planche (indispensable) et les cris (facultatifs). Une seule fois. */
function load() {
  if (loading) return loading;
  const sounds = Promise.all(INTRO_SOUNDS.map((name) =>
    fetch(assetUrl(introSoundPath(name)), { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((buf) => { raw[name] = buf; })));
  const fonts = document.fonts && document.fonts.load
    ? Promise.race([Promise.all([document.fonts.load('700 23.4px Ferme'), document.fonts.load('16px Ferme')]), wait(3000)]).catch(() => null)
    : Promise.resolve();
  const sheet = loadImage(assetUrl(INTRO_SHEET)).catch(() => loadImage(`${INTRO_SHEET}?r=1`));
  loading = Promise.all([sheet, fonts]).then(([im]) => ({ sheet: im, sounds }));
  loading.catch(() => { loading = null; });
  return loading;
}

function play(opts) {
  const { root, canvas, ctx = null, volume = 0, reduced = false } = opts;
  const plan = introPlan(reduced);
  let skipFrom = -1;
  let fadeCalled = false;
  let finished = false;
  let raf = 0;
  let t0 = 0;
  let T0 = 0;
  let scene = null;
  let voice = null;
  let started = false;
  let pendingSkip = false;

  const fadeStart = () => { if (fadeCalled) return; fadeCalled = true; try { opts.onFadeStart?.(); } catch (err) { console.warn('[intro]', err); } };
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    fadeStart();
    if (voice) voice.release(0.05);
    try { scene?.destroy(); } catch { /* */ }
    try { opts.onDone?.(); } catch (err) { console.warn('[intro]', err); }
  }
  function tick(now) {
    if (finished) return;
    try {
      const t = Math.max(0, (now - t0) / 1000);
      const end = endTime(plan, skipFrom);
      const tt = Math.min(t, end);
      scene.draw(tt, { reduced, alpha: artAlpha(tt, plan) });
      root.style.opacity = String(overlayAlpha(tt, plan, skipFrom));
      if (tt >= plan.fadeStart) fadeStart();
      if (t >= end) { finish(); return; }
      raf = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[intro] arrêt :', err);
      finish();
    }
  }
  function skip() {
    if (finished) return;
    if (!started) { pendingSkip = true; return; }
    if (skipFrom >= 0) return;
    skipFrom = Math.max(0, (performance.now() - t0) / 1000);
    if (voice) { try { voice.applyGain(gainCurve(plan, skipFrom), T0); } catch { /* */ } }
    fadeStart(); // le jeu s'affiche dessous pendant le fondu rapide
  }

  (async () => {
    try {
      const { sheet, sounds } = await load();
      let samples = {};
      if (ctx && volume > 0) {
        if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => {}), wait(400)]);
        // les cris arrivent en général avant le toucher ; au pire 1,2 s d'attente, sinon l'intro se joue sans eux
        await Promise.race([sounds, wait(1200)]);
        samples = await Promise.race([decodeSamples(ctx, raw), wait(800).then(() => ({}))]);
      }
      scene = createMgStudios(canvas, sheet);
      scene.build();
      if (pendingSkip) { finish(); return; }
      const lead = 0.06;
      if (ctx && volume > 0 && ctx.state === 'running') {
        voice = createVoice(ctx, samples, volume);
        T0 = ctx.currentTime + lead;
        voice.schedule(soundProgram(reduced), T0);
        voice.applyGain(gainCurve(plan), T0);
      }
      t0 = performance.now() + lead * 1000;
      started = true;
      // (vérifications) ce qui se joue : son ou non, cris décodés, mouvement réduit, durée prévue
      window.__fermeIntroPlayer.lastPlay = { sound: !!voice, samples: Object.keys(samples).length, reduced, dur: plan.dur, fadeStart: plan.fadeStart };
      root.classList.add('is-playing');
      raf = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[intro] impossible de jouer l\'intro :', err && err.message ? err.message : err);
      finish();
    }
  })();

  return { skip, plan, get time() { return started ? (performance.now() - t0) / 1000 : 0; } };
}

window.__fermeIntroPlayer = { load, play };
// Le portillon (src/intro/gate.js) attend peut-être ce lecteur : il est prévenu.
try { window.dispatchEvent(new Event('ferme-intro-player')); } catch { /* */ }
load().catch(() => {});
