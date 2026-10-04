// Gestionnaire audio (Web Audio) : musique avec fondus enchaînés, ambiances en couches, effets
// sonores avec légère variation de hauteur et limitation des répétitions, volumes séparés.
//
//   const audio = createAudio(AUDIO, settings);
//   audio.prefetch(list, onProgress)   télécharge des fichiers avant le déverrouillage (écran de chargement)
//   audio.unlock()                     à appeler dans un geste du joueur (clic, touche) : crée le contexte
//   audio.playMusic('spring')          fondu enchaîné de 2 s ; 'victory' = intro puis boucle ; null = silence
//   audio.play('coin')                 effet sonore
//   audio.setAmbience({ birds, rain, wind, bees })  niveaux cibles 0..1 (fondu)
//   audio.setWorld({ active, owned, season, weather })  cris d'animaux ponctuels
//   audio.setVolumes(settings)         { musicVolume, sfxVolume, ambienceVolume, muted, uiSound }
//   audio.uiStats()                    (mesures) sons d'interface joués / écartés, dernier joué
//
// Sons de l'interface (boutons, bascules, fiches, onglets, erreurs : UI_SOUND_NAMES, src/audio/ui-sounds.js),
// réglage settings.uiSound : 'normal' (fichiers Kenney d'origine) · 'soft' (par défaut : sons doux calculés, plus bas
// que les sons du jeu, ±3 % de hauteur, passe-bas 3 kHz, survol muet, répétitions rapprochées adoucies, pas de son
// d'ouverture/fermeture juste après le toucher qui l'a provoquée) · 'off' (aucun). Les sons du jeu ne changent pas.
//   audio.note(step, opts)             (lot 2) note synthétisée n° step d'une série de récolte (gamme
//                                      pentatonique qui monte, src/audio/synth.js), sur le bus des effets
//   audio.tone(name, opts)             (lot 2) son synthétisé : 'belle' | 'gold' | 'fanfare' | 'thud' |
//                                      'splash' | 'pop' | 'chime' | 'magic' | 'wish' | 'reveal' | 'chirp' (lot 4 : oiseau)
//                                      | 'clatter' (V4 : cigognes) | 'legend' (V4 : réveil d'une légende)
//   audio.setNature(scape | null)      (V4) paysage sonore de la vallée (natureScape, src/audio/soundscape.js), joué
//                                      en synthèse sur le bus « Ambiance » (src/audio/nature.js) ; null = silence
//   audio.setNatureListener({ y, h })  (V4) vue de la vallée : centre de l'écran (px du monde), au défilement
//   audio.setNatureDetail(mode)        (V4) réglage « Sons de la vallée » : 'full' | 'light' | 'off'
//   audio.setMusicScale(k)             (V4) facteur à part sur la musique (vue de la vallée : 0,6), sans toucher au duck
//   audio.playNature(id, opts)         (V4, débogage) joue un son de la vallée tout de suite (__debug.valley4.sound)
//   audio.natureVoices / natureStats() (V4, mesures) voix de nature en cours, état du moteur
//
// La couche « birds » n'est PAS multipliée ici par scape.birdsFactor : c'est main.js qui passe
// `birds: levels.birds × scape.birdsFactor` à setAmbience (une seule multiplication).
//
// Avant le déverrouillage, les demandes de musique et d'ambiance sont mémorisées et appliquées
// dès que le contexte existe ; les effets sonores sont ignorés.

import { assetUrl } from '../version.js';
import { createSynth } from './synth.js';
import { createNature } from './nature.js';
import { UI_SOUND_MODES, UI_SOUND_NAMES, renderUiSound } from './ui-sounds.js';

const FADE = 2; // secondes
const DEFAULT_THROTTLE = 45; // ms entre deux lectures du même son
const THROTTLE = { coin: 90, hover: 70, harvest: 60, water: 60, plant: 60, buy: 120, rooster: 25000, error: 150, warning: 400 };
const MAX_VOICES = { coin: 3, harvest: 3, water: 3, plant: 3, hover: 2 };
// Sons d'interface : jamais deux fois le même à moins de 80 ms (quel que soit le mode).
const UI_SET = new Set(UI_SOUND_NAMES);
const UI_MIN_REPEAT = 80; // ms
// Mode « Doux » : un son d'interface se tait si un autre vient de jouer (le toucher a déjà fait son « toc ») ;
// l'ouverture/fermeture d'une fiche suit presque toujours un toucher : fenêtre plus large. Erreur, validation et
// avertissement informent : toujours joués.
const UI_GAP = { open: 160, close: 160 };
const UI_GAP_DEFAULT = 90; // ms
const UI_PRIORITY = new Set(['error', 'confirm', 'warning']);
// Mode « Doux » : le même son répété (petits touchers à la chaîne) baisse de 15 % à chaque fois, jusqu'à 40 %.
const UI_STREAK_WINDOW = 1200; // ms
const UI_PITCH = 0.03; // ±3 %
const UI_LOWPASS = 3000; // Hz

function pickFormat() {
  try {
    const a = document.createElement('audio');
    const ogg = a.canPlayType('audio/ogg; codecs="vorbis"');
    return ogg === 'probably' || ogg === 'maybe' ? 0 : 1;
  } catch {
    return 1;
  }
}

export function createAudio(manifest, initialSettings = {}) {
  const preferred = pickFormat(); // 0 = ogg, 1 = mp3
  let ctx = null;
  let master = null;
  const bus = { music: null, sfx: null, ambience: null };
  let uiBus = null; // (mode « Doux ») gain → passe-bas 3 kHz → bus des effets
  let settings = { musicVolume: 0.6, sfxVolume: 0.8, ambienceVolume: 0.6, muted: false, natureSound: 'full', uiSound: 'soft', ...initialSettings };
  let duck = 1; // atténuation de la musique (menus de pause)
  let musicScale = 1; // (V4) facteur à part : la musique baisse dans la vue de la vallée

  const raw = new Map(); // url → Promise<ArrayBuffer>
  const buffers = new Map(); // clé (1er chemin) → AudioBuffer
  const loading = new Map(); // clé → Promise<AudioBuffer|null>

  const keyOf = (entry) => entry.src[0];
  const urlOf = (entry, i = preferred) => entry.src[Math.min(i, entry.src.length - 1)];

  function fetchRaw(url) {
    if (!raw.has(url)) {
      raw.set(
        url,
        fetch(assetUrl(url)).then((r) => {
          if (!r.ok) throw new Error(`Son introuvable : ${url}`);
          return r.arrayBuffer();
        }),
      );
      raw.get(url).catch(() => raw.delete(url));
    }
    return raw.get(url);
  }

  function decode(data) {
    return new Promise((resolve, reject) => {
      // Ancienne signature à rappels (Safari) et promesse : on gère les deux.
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  /** Charge et décode un son (avec repli sur l'autre format). Nécessite le contexte. */
  function load(entry) {
    const key = keyOf(entry);
    if (buffers.has(key)) return Promise.resolve(buffers.get(key));
    if (loading.has(key)) return loading.get(key);
    const order = preferred === 0 ? [0, 1] : [1, 0];
    const p = (async () => {
      for (const i of order) {
        const url = urlOf(entry, i);
        try {
          const data = await fetchRaw(url);
          raw.delete(url); // decodeAudioData détache le tampon : ne pas le réutiliser
          const buf = await decode(data.slice(0));
          buffers.set(key, buf);
          return buf;
        } catch {
          /* essaie l'autre format */
        }
      }
      return null;
    })();
    loading.set(key, p);
    p.then((b) => {
      if (!b) loading.delete(key);
    });
    return p;
  }

  /** Télécharge (sans décoder) une liste d'entrées ; onProgress(fait, total). */
  function prefetch(entries, onProgress) {
    let done = 0;
    const total = entries.length;
    return Promise.all(
      entries.map((e) =>
        fetchRaw(urlOf(e))
          .catch(() => fetchRaw(urlOf(e, 1 - preferred)).catch(() => null))
          .finally(() => {
            done += 1;
            if (onProgress) onProgress(done, total);
          }),
      ),
    );
  }

  // ── Volumes ──────────────────────────────────────────────────────────────────────
  function applyVolumes(immediate = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const set = (node, v) => {
      node.gain.cancelScheduledValues(t);
      if (immediate) node.gain.setValueAtTime(v, t);
      else node.gain.setTargetAtTime(v, t, 0.08);
    };
    set(master, settings.muted ? 0 : 1);
    set(bus.music, settings.musicVolume * settings.musicVolume * duck * musicScale); // courbe douce (perception)
    set(bus.sfx, settings.sfxVolume * settings.sfxVolume);
    set(bus.ambience, settings.ambienceVolume * settings.ambienceVolume);
  }

  function setVolumes(next) {
    settings = { ...settings, ...next };
    applyVolumes();
    applyNature(); // volume « Ambiance » à 0, son coupé, ou retour : le moteur s'arrête ou repart
  }

  function setMusicScale(k) {
    const v = Number.isFinite(k) ? Math.max(0, Math.min(1, k)) : 1;
    if (v === musicScale) return;
    musicScale = v;
    applyVolumes();
  }

  function setDuck(on) {
    duck = on ? 0.45 : 1;
    applyVolumes();
  }

  // ── Déverrouillage ───────────────────────────────────────────────────────────────
  function unlock() {
    if (ctx) {
      // 'suspended' (onglet revenu, politique d'autoplay) ou 'interrupted' (Safari iOS : appel, verrouillage).
      if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      // L'intro « MG studios » (src/intro/gate.js) a créé et débloqué le contexte au toucher de l'écran-titre :
      // le jeu le reprend (un seul contexte, déjà autorisé par le navigateur).
      const shared = typeof window !== 'undefined' ? window.__fermeIntro?.ctx : null;
      ctx = shared && shared.state !== 'closed' ? shared : new AC();
    } catch {
      ctx = null;
      return;
    }
    master = ctx.createGain();
    master.connect(ctx.destination);
    for (const k of Object.keys(bus)) {
      bus[k] = ctx.createGain();
      bus[k].connect(master);
    }
    // Sons doux de l'interface : calculés une fois (quelques ms), filet de sécurité passe-bas à 3 kHz.
    uiBus = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = UI_LOWPASS;
    lp.Q.value = 0.5;
    uiBus.connect(lp);
    lp.connect(bus.sfx);
    for (const name of UI_SOUND_NAMES) {
      try {
        const data = renderUiSound(name, ctx.sampleRate);
        if (!data) continue;
        const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
        b.getChannelData(0).set(data);
        softBuffers.set(name, b);
      } catch {
        /* son doux indisponible : l'interface reste muette pour ce son */
      }
    }
    applyVolumes(true);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // Décode tous les effets sonores (petits) tout de suite.
    for (const e of Object.values(manifest.sfx)) load(e);
    // Applique ce qui a été demandé avant le déverrouillage.
    if (music.wanted) {
      const k = music.wanted;
      music.wanted = null;
      music.key = null;
      playMusic(k, { fade: 1 });
    }
    updateAmbience();
    applyNature();
  }

  const isUnlocked = () => !!ctx;

  // ── Effets sonores ───────────────────────────────────────────────────────────────
  const lastPlayed = new Map();
  const voices = new Map();
  const softBuffers = new Map(); // nom → AudioBuffer (sons doux de l'interface)
  const uiMode = () => (UI_SOUND_MODES.includes(settings.uiSound) ? settings.uiSound : 'soft');
  let lastUiAt = -Infinity;
  const uiStreak = new Map(); // nom → { n, at }
  const uiCount = { played: 0, skipped: 0, last: null, lastVolume: 0, mode: 'soft' };

  /** Son d'interface (boutons, fiches, onglets…) selon le réglage « Sons de l'interface ». */
  function playUi(name, entry, opts) {
    const mode = uiMode();
    uiCount.mode = mode;
    if (mode === 'off') return;
    if (mode === 'normal') {
      playBuffer(name, entry, { ...opts, throttle: Math.max(UI_MIN_REPEAT, opts.throttle ?? THROTTLE[name] ?? DEFAULT_THROTTLE) });
      return;
    }
    const buf = softBuffers.get(name);
    if (!buf) return; // survol : muet en mode « Doux »
    const now = performance.now();
    const throttle = Math.max(UI_MIN_REPEAT, opts.throttle ?? THROTTLE[name] ?? 0);
    const gap = UI_PRIORITY.has(name) ? 0 : UI_GAP[name] ?? UI_GAP_DEFAULT;
    if (now - (lastPlayed.get(name) || -Infinity) < throttle || now - lastUiAt < gap || (voices.get(name) || 0) >= 2) {
      uiCount.skipped++;
      return;
    }
    const prev = uiStreak.get(name);
    const n = prev && now - prev.at < UI_STREAK_WINDOW ? prev.n + 1 : 1;
    uiStreak.set(name, { n, at: now });
    const streak = Math.max(0.4, 1 - 0.15 * (n - 1));
    lastPlayed.set(name, now);
    lastUiAt = now;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * UI_PITCH;
    const g = ctx.createGain();
    const volume = Math.min(1, opts.volume ?? 1) * streak;
    g.gain.value = volume;
    src.connect(g);
    g.connect(uiBus);
    voices.set(name, (voices.get(name) || 0) + 1);
    src.onended = () => {
      voices.set(name, Math.max(0, (voices.get(name) || 1) - 1));
      g.disconnect();
    };
    src.start(ctx.currentTime + (opts.delay || 0));
    uiCount.played++;
    uiCount.last = name;
    uiCount.lastVolume = volume;
  }

  /**
   * @param name  clé de manifest.sfx
   * @param opts  { volume = 1, pitch = 0.05 (variation ±), rate, throttle (ms), delay (s) }
   */
  function play(name, opts = {}) {
    const entry = manifest.sfx[name];
    if (!entry || !ctx || settings.muted || ctx.state !== 'running') return;
    if (UI_SET.has(name)) {
      playUi(name, entry, opts);
      return;
    }
    playBuffer(name, entry, opts);
  }

  /** Lecture d'un fichier du catalogue (sons du jeu, et sons d'interface en mode « Normaux »). */
  function playBuffer(name, entry, opts) {
    const now = performance.now();
    const throttle = opts.throttle ?? THROTTLE[name] ?? DEFAULT_THROTTLE;
    if (now - (lastPlayed.get(name) || -Infinity) < throttle) return;
    const max = MAX_VOICES[name] ?? 4;
    if ((voices.get(name) || 0) >= max) return;
    const buf = buffers.get(keyOf(entry));
    if (!buf) {
      load(entry);
      return;
    }
    lastPlayed.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const variation = opts.pitch ?? 0.05;
    src.playbackRate.value = (opts.rate || 1) * (1 + (Math.random() * 2 - 1) * variation);
    const g = ctx.createGain();
    g.gain.value = (entry.volume ?? 1) * (opts.volume ?? 1);
    src.connect(g);
    g.connect(bus.sfx);
    voices.set(name, (voices.get(name) || 0) + 1);
    src.onended = () => {
      voices.set(name, Math.max(0, (voices.get(name) || 1) - 1));
      g.disconnect();
    };
    src.start(ctx.currentTime + (opts.delay || 0));
  }

  // ── Sons synthétisés (lot 2) ─────────────────────────────────────────────────────
  let synth = null;
  const lastTone = new Map();
  function synthReady() {
    if (!ctx || settings.muted || ctx.state !== 'running' || settings.sfxVolume <= 0) return null;
    if (!synth) synth = createSynth(ctx, bus.sfx);
    return synth;
  }
  /** Note n° step d'une série de récolte (marimba, pentatonique montante). */
  function note(step, opts = {}) {
    const s = synthReady();
    if (!s) return false;
    return s.note(step, { volume: opts.volume ?? 1, when: ctx.currentTime + (opts.delay || 0) });
  }
  /** Son synthétisé ; opts { volume, delay, throttle (ms, 60 par défaut) }. */
  function tone(name, opts = {}) {
    const s = synthReady();
    if (!s) return false;
    const now = performance.now();
    if (now - (lastTone.get(name) || -Infinity) < (opts.throttle ?? 60)) return false;
    lastTone.set(name, now);
    return s.play(name, { volume: opts.volume ?? 1, when: ctx.currentTime + (opts.delay || 0) });
  }

  // ── Musique ──────────────────────────────────────────────────────────────────────
  const music = { key: null, wanted: null, token: 0, track: null };

  function stopTrack(track, fade) {
    if (!track || !ctx) return;
    const t = ctx.currentTime;
    const g = track.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + Math.max(0.02, fade));
    for (const s of track.sources) {
      try {
        s.stop(t + Math.max(0.02, fade) + 0.05);
      } catch {
        /* déjà arrêtée */
      }
    }
    setTimeout(() => track.gain.disconnect(), (fade + 0.3) * 1000);
  }

  /**
   * Change de musique avec un fondu enchaîné.
   * @param key  'menu' | 'spring' | 'summer' | 'autumn' | 'winter' | 'night' | 'victory' | null
   */
  function playMusic(key, opts = {}) {
    const fade = opts.fade ?? FADE;
    if (!ctx) {
      music.wanted = key;
      return;
    }
    if (key === music.key && !opts.restart) return;
    music.key = key;
    const token = ++music.token;
    stopTrack(music.track, fade);
    music.track = null;
    if (!key) return;

    const entries = key === 'victory' ? [manifest.music.victory.intro, manifest.music.victory.loop] : [manifest.music[key]];
    if (!entries[0]) return;
    Promise.all(entries.map(load)).then((bufs) => {
      if (token !== music.token || bufs.some((b) => !b)) return;
      const t = ctx.currentTime + 0.05;
      const gain = ctx.createGain();
      const volume = entries[entries.length - 1].volume ?? 0.7;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + (key === 'victory' ? 0.3 : fade));
      gain.connect(bus.music);
      const sources = [];
      if (key === 'victory') {
        const intro = ctx.createBufferSource();
        intro.buffer = bufs[0];
        intro.connect(gain);
        intro.start(t);
        const loop = ctx.createBufferSource();
        loop.buffer = bufs[1];
        loop.loop = true;
        loop.connect(gain);
        loop.start(t + bufs[0].duration);
        sources.push(intro, loop);
      } else {
        const src = ctx.createBufferSource();
        src.buffer = bufs[0];
        src.loop = entries[0].loop !== false;
        src.connect(gain);
        src.start(t);
        sources.push(src);
      }
      music.track = { key, gain, sources };
    });
  }

  // ── Ambiances ────────────────────────────────────────────────────────────────────
  const amb = {}; // nom → { gain, source, level }
  const ambTargets = { birds: 0, rain: 0, wind: 0, bees: 0 };

  function updateAmbience() {
    if (!ctx) return;
    for (const [name, target] of Object.entries(ambTargets)) {
      const entry = manifest.ambience[name];
      if (!entry) continue;
      let layer = amb[name];
      if (!layer) {
        if (target <= 0) continue;
        layer = amb[name] = { gain: ctx.createGain(), source: null, starting: false };
        layer.gain.gain.value = 0;
        layer.gain.connect(bus.ambience);
      }
      if (!layer.source && !layer.starting && target > 0) {
        layer.starting = true;
        load(entry).then((buf) => {
          layer.starting = false;
          if (!buf || layer.source) return;
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(layer.gain);
          // Départ à un endroit aléatoire de la boucle : moins répétitif.
          src.start(ctx.currentTime, Math.random() * buf.duration);
          layer.source = src;
          rampLayer(name);
        });
      }
      rampLayer(name);
    }
  }

  function rampLayer(name) {
    const layer = amb[name];
    if (!layer || !ctx) return;
    const entry = manifest.ambience[name];
    const v = ambTargets[name] * (entry.volume ?? 1);
    const t = ctx.currentTime;
    const g = layer.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v, t + FADE);
  }

  /** Niveaux cibles des couches d'ambiance (0..1) ; les couches absentes passent à 0. */
  function setAmbience(levels = {}) {
    for (const k of Object.keys(ambTargets)) ambTargets[k] = Math.max(0, Math.min(1, levels[k] || 0));
    updateAmbience();
  }

  // ── Paysage sonore de la vallée (V4) ─────────────────────────────────────────────
  // Moteur créé paresseusement, seulement s'il peut s'entendre : contexte prêt, son non coupé, « Ambiance » > 0 et
  // « Sons de la vallée » différent de « Coupés » ; sinon arrêté (fondu court) et libéré. La demande faite avant le
  // déverrouillage est mémorisée (comme la musique). Arrière-plan : le contexte suspendu suffit, et la minuterie du
  // moteur s'arrête d'elle-même (document.hidden).
  let nature = null;
  let natureScapeWanted = null;
  let natureListener = null;
  const natureMode = () => (settings.natureSound === 'light' || settings.natureSound === 'off' ? settings.natureSound : 'full');
  const natureAudible = () => !!ctx && !settings.muted && settings.ambienceVolume > 0 && natureMode() !== 'off';

  function ensureNature() {
    if (!natureAudible()) return null;
    if (!nature) {
      nature = createNature(ctx, bus.ambience, { detail: natureMode() });
      if (natureListener) nature.setListener(natureListener);
    }
    return nature;
  }
  function stopNature() {
    if (nature) nature.stop();
    nature = null;
  }
  function applyNature() {
    const scape = natureScapeWanted;
    if (!natureAudible() || !scape || !scape.on) {
      // Sans paysage, un moteur créé pour le débogage se tait doucement (ses couches tombent), puis il est libéré.
      if (nature && natureAudible() && !scape) nature.set(null);
      else stopNature();
      return;
    }
    const n = ensureNature();
    n.setDetail(natureMode());
    n.set(scape);
  }

  /** Paysage sonore à jouer (natureScape) ; null = la vallée se tait. */
  function setNature(scape) {
    natureScapeWanted = scape && scape.on ? scape : null;
    applyNature();
  }
  function setNatureListener(l) {
    natureListener = l ? { y: l.y, h: l.h } : null;
    if (nature && natureListener) nature.setListener(natureListener);
  }
  function setNatureDetail(mode) {
    settings = { ...settings, natureSound: mode === 'light' || mode === 'off' ? mode : 'full' };
    applyNature();
  }
  /** (Débogage) Joue un son de la vallée (chant ou couche) tout de suite, hors paysage. */
  function playNature(id, opts = {}) {
    if (!ctx || ctx.state !== 'running') return false;
    const n = ensureNature();
    if (!n) return false;
    return n.play(id, opts);
  }

  // ── Animaux (cris ponctuels) ─────────────────────────────────────────────────────
  let world = { active: false, owned: {}, season: 'spring', weather: 'sunny' };
  let animalTimer = null;

  function scheduleAnimal() {
    clearTimeout(animalTimer);
    animalTimer = setTimeout(animalCall, 15000 + Math.random() * 25000);
  }

  function animalCall() {
    const o = world.owned || {};
    const pool = [];
    if (o.chickenCoop > 0) pool.push('chicken');
    if (o.cow > 0) pool.push('cow');
    if (o.sheep > 0) pool.push('sheep');
    if (world.active && pool.length && !document.hidden) {
      const name = pool[Math.floor(Math.random() * pool.length)];
      play(name, { volume: 0.55, pitch: 0.08, throttle: 4000 });
    }
    scheduleAnimal();
  }

  function setWorld(next) {
    world = { ...world, ...next };
    if (world.active && !animalTimer) scheduleAnimal();
    if (!world.active) {
      clearTimeout(animalTimer);
      animalTimer = null;
    }
  }

  // ── Visibilité de l'onglet ───────────────────────────────────────────────────────
  // Téléphone : appli en arrière-plan (accueil, écran verrouillé) → silence ; au retour, reprise
  // (si le navigateur la refuse sans geste, le prochain toucher la relance via unlock()).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
  window.addEventListener('pagehide', () => {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  });
  window.addEventListener('pageshow', () => {
    if (ctx && !document.hidden && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  });

  return {
    prefetch,
    unlock,
    isUnlocked,
    play,
    /** (Mesures) sons d'interface joués / écartés (anti-répétition), dernier joué et son volume, mode. */
    uiStats() {
      return { ...uiCount, mode: uiMode() };
    },
    note,
    tone,
    playMusic,
    setAmbience,
    setWorld,
    setVolumes,
    setDuck,
    setNature,
    setNatureListener,
    setNatureDetail,
    setMusicScale,
    playNature,
    /** (V4, mesures) voix de nature en cours (chants) ; 0 si le moteur ne tourne pas. */
    get natureVoices() {
      return nature ? nature.voices : 0;
    },
    /** (V4, débogage) état du moteur de nature, ou null. */
    natureStats() {
      return nature ? { ...nature.stats(), layerCount: nature.layers } : null;
    },
    get musicKey() {
      return music.key ?? music.wanted;
    },
    get context() {
      return ctx;
    },
    /** (Mesures) voix synthétisées en cours. */
    get synthVoices() {
      return synth ? synth.voices : 0;
    },
    /** Précharge (décode) une entrée du catalogue en tâche de fond. Renvoie une promesse (jamais rejetée). */
    warm(entry) {
      if (ctx) return load(entry).catch(() => null);
      return fetchRaw(urlOf(entry)).catch(() => null);
    },
  };
}

/**
 * Niveaux d'ambiance pour une saison, une météo et les investissements possédés.
 * Oiseaux au printemps et en été (pas sous la pluie), vent en hiver (et par orage), pluie,
 * abeilles l'été près des ruches.
 */
export function ambienceFor({ season, weather, owned = {} }) {
  const rainy = weather === 'rain' || weather === 'storm';
  const levels = { birds: 0, rain: 0, wind: 0, bees: 0 };
  if ((season === 'spring' || season === 'summer') && !rainy) levels.birds = weather === 'cloudy' ? 0.6 : 0.9;
  if (season === 'autumn' && !rainy) levels.birds = 0.3;
  if (rainy) levels.rain = weather === 'storm' ? 1 : 0.75;
  if (season === 'winter') levels.wind = weather === 'snow' ? 0.9 : 0.6;
  if (weather === 'storm') levels.wind = Math.max(levels.wind, 0.5);
  if (owned.beehive > 0 && (season === 'summer' || season === 'spring') && !rainy) {
    levels.bees = Math.min(1, (season === 'summer' ? 0.5 : 0.25) + 0.15 * owned.beehive);
  }
  return levels;
}
