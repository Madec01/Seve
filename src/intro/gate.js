/* Portillon de l'intro « MG studios » de « Une année à la ferme ».
 *
 * Script CLASSIQUE (pas un module), recopié tel quel dans index.html et dev.html par tools/build.js, juste
 * avant le chargeur (src/loader.js). Même prudence que le chargeur (var, pas de fonctions fléchées) : il
 * s'exécute dans <head>, avant que la page soit lue, et ne doit JAMAIS empêcher le jeu de démarrer.
 *
 * Rôle :
 *  1. Décide si l'intro se joue : oui à chaque ouverture du jeu, sauf « ?nointro », réglage « Intro au
 *     démarrage » désactivé (Options), « ?debug=1 » ou navigateur piloté par un robot de test
 *     (navigator.webdriver) — « ?intro=1 » la force malgré ces deux derniers cas.
 *     Oui → classe « intro-on » sur <html> AVANT le premier affichage : l'écran-titre « Touchez pour
 *     commencer » (#intro, css/intro.css) recouvre l'écran de chargement, qui continue dessous.
 *  2. Télécharge le lecteur de l'intro EN PARALLÈLE du jeu (index.html : dist/intro.<empreinte>.js ;
 *     dev.html : import() de src/intro/player.js) : il ne retarde jamais le chargement du jeu.
 *  3. Au toucher (tout l'écran ; Entrée ou Espace au clavier) : crée et débloque l'AudioContext DU JEU
 *     (window.__fermeIntro.ctx, repris par src/audio/audio.js), puis lance l'animation avec le son
 *     (volume des effets du joueur ; sans son si le son est coupé ; image fixe si mouvement réduit).
 *     Toucher pendant l'animation la passe (fondu rapide). Lecteur absent au bout de 4 s : pas d'intro.
 *  4. Relais avec le jeu (src/main.js) : window.__fermeIntro.onGameReady(go) — le jeu, une fois prêt,
 *     confie son passage au menu. Il est appelé au début du fondu final (le menu apparaît sous l'intro :
 *     fondu enchaîné), ou tout de suite si l'intro est déjà finie (l'écran de chargement avait pris le
 *     relais, sans saut : même fond).
 *  5. window.__fermeIntro.abort() : le chargeur l'appelle s'il affiche son aide (« Réparer le jeu ») :
 *     l'intro s'efface pour ne rien cacher.
 *
 * État (window.__fermeIntro.state) : 'off' | 'title' | 'starting' | 'playing' | 'fading' | 'done'.
 */
(function () {
  'use strict';
  var BUILD = window.__FERME_BUILD__ || {};
  var SETTINGS_KEY = 'une-annee-a-la-ferme.settings';
  var PLAYER_WAIT = 4000;
  var root = document.documentElement;

  var api = {
    active: false,
    state: 'off',
    reason: '',
    ctx: null,
    reduced: false,
    volume: 0,
    onGameReady: function (go) { run(go); },
    abort: function () {},
    skip: function () {},
    times: {}, // (vérifications) instants (performance.now) du toucher, du début du fondu, de la fin
  };
  window.__fermeIntro = api;

  function stamp(k) { try { if (!api.times[k]) api.times[k] = performance.now(); } catch (e) { /* */ } }
  function run(fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); } }

  // ── Décision ────────────────────────────────────────────────────────────────────────
  var settings = {};
  try { settings = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { settings = {}; }
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
  var has = function (k) { return !!(params && params.has(k)); };
  var get = function (k) { return params ? params.get(k) : null; };
  var forced = get('intro') === '1';
  var reason = '';
  if (!BUILD.intro) reason = 'pas de lecteur';
  else if (has('nointro') || get('intro') === '0') reason = '?nointro';
  else if (settings.intro === false && !forced) reason = 'réglage';
  else if (!forced && get('debug') === '1') reason = '?debug=1';
  else if (!forced && navigator.webdriver) reason = 'robot de test';
  api.reason = reason;
  if (reason) return;

  api.active = true;
  api.state = 'title';
  var mq = false;
  try { mq = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { mq = false; }
  api.reduced = settings.reducedMotion === true || mq;
  var num = function (v, d) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, v)) : d; };
  var sfx = num(settings.sfxVolume, 0.8);
  api.volume = settings.muted === true ? 0 : sfx * sfx; // même courbe que le jeu (src/audio/audio.js)
  root.className += (root.className ? ' ' : '') + 'intro-on' + (api.reduced ? ' intro-reduced' : '');

  // ── Lecteur (en parallèle du jeu) ─────────────────────────────────────────────────────
  var playerWaiters = [];
  function playerReady() {
    if (!window.__fermeIntroPlayer) return;
    var list = playerWaiters;
    playerWaiters = [];
    for (var i = 0; i < list.length; i++) list[i]();
  }
  window.addEventListener('ferme-intro-player', playerReady);
  function loadPlayer() {
    try {
      if (BUILD.intro.module) {
        var dynImport = new Function('u', 'return import(u)');
        dynImport(new URL(BUILD.intro.module, location.href).href).then(playerReady, function (err) {
          try { console.warn('[intro] lecteur introuvable : ' + (err && err.message ? err.message : err)); } catch (e) { /* */ }
        });
      } else {
        var s = document.createElement('script');
        s.src = BUILD.intro.src;
        s.async = true;
        s.setAttribute('data-intro', '1'); // (src/loader.js ne compte pas son échec comme un échec du jeu)
        s.onerror = function () { try { console.warn('[intro] lecteur introuvable : ' + BUILD.intro.src); } catch (e) { /* */ } };
        (document.head || root).appendChild(s);
      }
    } catch (e) { /* sans lecteur : pas d'intro, le jeu démarre normalement */ }
  }
  loadPlayer();

  // ── Relais avec le jeu ────────────────────────────────────────────────────────────────
  var gameGo = null;
  function callGo() {
    if (!gameGo) return;
    var go = gameGo;
    gameGo = null;
    run(go);
  }
  api.onGameReady = function (go) {
    gameGo = go;
    if (api.state === 'fading' || api.state === 'done') callGo();
  };

  // ── Écran-titre, toucher, animation ──────────────────────────────────────────────────
  var el = null;
  var controller = null;
  function fadeStarted() {
    if (api.state === 'done') return;
    api.state = 'fading';
    stamp('fading');
    callGo();
  }
  function finish() {
    if (api.state === 'done') return;
    fadeStarted();
    api.state = 'done';
    stamp('done');
    root.className = root.className.replace(/\s*\bintro-(on|reduced)\b/g, '');
    if (el) {
      el.setAttribute('hidden', '');
      el.style.opacity = '';
      if (document.activeElement === el) { try { el.blur(); } catch (e) { /* */ } }
    }
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = api.ctx;
    try {
      if (!ctx) { ctx = new AC(); api.ctx = ctx; }
      if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(function () {});
      // petit tampon silencieux : débloque aussi les anciens Safari
      var b = ctx.createBuffer(1, 1, 22050);
      var src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) { /* sans son */ }
    return ctx;
  }

  function startPlayer() {
    var P = window.__fermeIntroPlayer;
    if (!P || api.state !== 'starting') { if (!P) finish(); return; }
    var canvas = el.querySelector('.intro-canvas');
    try {
      controller = P.play({
        root: el,
        canvas: canvas,
        ctx: api.volume > 0 ? api.ctx : null,
        volume: api.volume,
        reduced: api.reduced,
        onFadeStart: fadeStarted,
        onDone: finish,
      });
      api.state = 'playing';
    } catch (e) {
      try { console.warn('[intro] ' + (e && e.message ? e.message : e)); } catch (e2) { /* */ }
      finish();
    }
  }

  var startedAt = 0;
  function start() {
    if (api.state !== 'title') return;
    api.state = 'starting';
    startedAt = Date.now();
    stamp('tap');
    unlockAudio();
    if (el) el.className += ' is-tapped';
    if (window.__fermeIntroPlayer) { startPlayer(); return; }
    var timer = setTimeout(function () { if (api.state === 'starting') finish(); }, PLAYER_WAIT);
    playerWaiters.push(function () { clearTimeout(timer); startPlayer(); });
  }

  api.skip = function () {
    if (api.state === 'playing' && controller) controller.skip();
    else if (api.state === 'starting') finish();
  };
  api.abort = function () {
    if (api.state === 'title' || api.state === 'starting') finish();
    else if (api.state === 'playing') api.skip();
  };

  function onTap(e) {
    if (api.state === 'title') {
      if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button !== 0) return;
      start();
    } else if (api.state === 'playing' && Date.now() - startedAt > 500) api.skip(); // (pas le toucher qui l'a lancée)
    if (e.cancelable && e.type !== 'pointerup') e.preventDefault();
  }
  function onKey(e) {
    if (api.state === 'title' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) { e.preventDefault(); start(); }
    else if (api.state === 'playing' && e.key !== 'Tab') { e.preventDefault(); api.skip(); }
  }
  function onVisibility() { if (document.hidden && api.state === 'playing') api.skip(); }

  function bind() {
    el = document.getElementById('intro');
    if (!el) { finish(); return; }
    el.removeAttribute('hidden');
    // Chrome Android : seuls touchend / pointerup / click débloquent l'audio au doigt (pas pointerdown)
    el.addEventListener('pointerup', onTap);
    el.addEventListener('touchend', onTap, { passive: false });
    el.addEventListener('click', onTap);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
