// Chronologie de l'intro « MG studios » (variante « Le panneau de la ferme ») — logique PURE, sans DOM :
// temps forts de l'image et du son, fin douce (tenue, dernier geste, fondu enchaîné), passage au toucher,
// mouvement réduit. Testée sous Node (tests/intro.test.js) ; utilisée par src/intro/mg-studios.js (image)
// et src/intro/player.js (son, fondus).
//
// Fin douce (demande de l'utilisateur, 2026-10-04 : « il faut que ça finisse bien, sans que ça coupe d'un coup ») :
//   - tenue de l'image finale : tout le monde est en place (la poule s'est arrêtée, la vache et le mouton
//     broutent), le coq gonfle le poitrail (petit battement d'ailes), un oiseau traverse le ciel ;
//   - le dernier accord résonne et s'éteint de lui-même ; les cris se terminent avant le fondu ;
//   - fondu enchaîné de l'image vers l'écran suivant (FADE_OUT s) et, pendant ce temps, rampe du volume
//     de l'intro jusqu'à 0 (jamais de coupure sèche) ;
//   - toucher pendant l'animation : même chose en SKIP_FADE s (image et son).

/** Vrais cris d'animaux (assets/audio/intro/*.mp3, Freesound CC0, voir CREDITS.md) : durée (s) et enveloppe,
 * une valeur de 0 à 9 par tranche de 20 ms, extraite de la forme d'onde. Elle anime le bec, les têtes levées
 * et les traits « voix » au rythme exact de l'enregistrement. */
export const SND_INFO = Object.freeze({
  coq: { dur: 1.745, env: '0022233333200001479832113333233332535534433332333333455547998888889888988765432100000000' },
  vache: { dur: 1.18, env: '01111124344444445555656666667778889899999999998877765420000' },
  mouton: { dur: 0.81, env: '00014567788889988788887888888876666666420' },
  poule: { dur: 1.08, env: '001100000000121000000000001211257888777888944443221100' },
  ailes: { dur: 0.46, env: '00112293225641100000000' },
});
export const INTRO_SOUNDS = Object.freeze(Object.keys(SND_INFO));
export const introSoundPath = (name) => `assets/audio/intro/${name}.mp3`;

/** Volume relatif de chaque cri (fichiers normalisés à −3 dBFS) ; vache et mouton adoucis, « au loin ». */
export const SND_MIX = Object.freeze({
  coq: { vol: 0.5 },
  poule: { vol: 0.3, lp: 6000 },
  vache: { vol: 0.3, lp: 2600 },
  mouton: { vol: 0.24, lp: 3800 },
  ailes: { vol: 0.32 },
});

/** Niveau (0..9) de l'enveloppe d'un cri, dt secondes après son début. */
export function sndLevel(name, dt) {
  const e = SND_INFO[name].env;
  const i = Math.floor(dt / 0.02);
  return dt < 0 || i >= e.length ? 0 : +e[i];
}
/** Le cocorico enregistré : [début, durée] de chaque syllabe (co · co · riii · cooô). */
export const CROW_SYL = [[0.04, 0.18], [0.3, 0.12], [0.44, 0.59], [1.04, 0.6]];
export const CROW_DUR = SND_INFO.coq.dur;
export const crowSyllableOn = (dt) => sndLevel('coq', dt) >= 3;

/** Fondu enchaîné final (s) : entre 0,8 et 1,2 s. */
export const FADE_OUT = 1.0;
/** Fondu quand le joueur touche pour passer (s), image et son. */
export const SKIP_FADE = 0.35;
/** Entrée en fondu de l'animation (s). */
export const FADE_IN = 0.18;

/** Temps forts (secondes), calés sur les vrais enregistrements (le cocorico dure 1,75 s). */
export const T = Object.freeze({
  fall: 0.42, impact: 0.86, pop: 0.9, land: 1.08, crow: 1.16, sheen: 2.72, cow: 3.05, hen: 3.85, sheep: 4.35,
  // fin : la poule s'arrête (henStop), un oiseau traverse, accord final, le coq gonfle le poitrail
  henStop: 4.75, bird: 4.85, chord: 5.15, puff: 5.2, puffEnd: 5.75,
  fadeStart: 5.8,
});
export const INTRO_DUR = T.fadeStart + FADE_OUT;

/** Mouvement réduit : image fixe en fondu, le cocorico puis l'accord, fondu de sortie. */
export const RM = Object.freeze({ inEnd: 0.5, crow: 0.25, fadeStart: 2.8, dur: 2.8 + 0.9 });

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
export const eInOutSine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;

/** Plan de lecture : { dur, fadeStart, fadeEnd, reduced }. */
export function introPlan(reduced = false) {
  if (reduced) return { reduced: true, dur: RM.dur, fadeStart: RM.fadeStart, fadeEnd: RM.dur };
  return { reduced: false, dur: INTRO_DUR, fadeStart: T.fadeStart, fadeEnd: INTRO_DUR };
}

/**
 * Opacité de la couche de l'intro (image + fond) à l'instant t : 1 pendant l'animation, puis fondu enchaîné
 * vers l'écran suivant. skipFrom ≥ 0 : le joueur a touché à cet instant (fondu de SKIP_FADE s, sans jamais
 * remonter).
 */
export function overlayAlpha(t, plan, skipFrom = -1) {
  let a = 1 - eInOutSine(prog(t, plan.fadeStart, plan.fadeEnd));
  if (skipFrom >= 0) a = Math.min(a, 1 - prog(t, skipFrom, skipFrom + SKIP_FADE));
  return a;
}
/** Opacité de l'image elle-même (entrée en fondu ; en mouvement réduit, entrée plus lente). */
export function artAlpha(t, plan) {
  return plan.reduced ? prog(t, 0, RM.inEnd) : prog(t, 0, FADE_IN);
}
/** Instant où l'intro est finie (couche invisible). */
export function endTime(plan, skipFrom = -1) {
  return skipFrom >= 0 ? Math.min(plan.dur, skipFrom + SKIP_FADE) : plan.dur;
}

/**
 * Position de la poule (0 = hors champ à gauche, 1 = hors champ à droite) et ce qu'elle fait, ct secondes
 * après son entrée (T.hen − 0,95). Elle entre, s'arrête au milieu pour caqueter et picorer, repart un peu et
 * s'installe à droite du panneau (la fin : tout le monde en place).
 */
export const HEN_REST = 0.74;
export function henAt(ct) {
  if (ct <= 0) return { p: 0, walking: false, visible: false };
  if (ct < 0.95) return { p: (ct / 0.95) * 0.5, walking: true, visible: true };
  if (ct < 1.35) return { p: 0.5, walking: false, visible: true };
  const stop = T.henStop - (T.hen - 0.95); // 1,85 s
  if (ct < stop) return { p: 0.5 + ((ct - 1.35) / (stop - 1.35)) * (HEN_REST - 0.5), walking: true, visible: true };
  return { p: HEN_REST, walking: false, visible: true };
}

/**
 * Programme sonore de l'intro : liste d'événements { at, kind, name?, dur } (secondes depuis le début).
 * kind : 'sample' (vrai enregistrement), 'synth' (marimba, clochette, choc, souffle, nappe). `dur` = instant
 * où le son est éteint de lui-même (enveloppe à −80 dB), pour vérifier qu'aucun son ne dépasse la fin.
 */
export function soundProgram(reduced = false) {
  if (reduced) {
    const c = RM.crow;
    return [
      { at: c, kind: 'sample', name: 'coq', dur: CROW_DUR },
      ...[72, 76, 79].map((m, i) => ({ at: c + CROW_DUR - 0.1 + i * 0.06, kind: 'mallet', midi: m, vol: 0.07, decay: 0.9, dur: 1.0 })),
      { at: c + CROW_DUR, kind: 'bell', midi: 84, vol: 0.05, decay: 1.2, dur: 1.3 },
    ];
  }
  return [
    { at: 0.4, kind: 'whoosh', vol: 0.08, dur: 0.48 },
    { at: T.impact, kind: 'thud', vol: 0.9, dur: 0.3 },
    { at: T.impact + 0.005, kind: 'knock', vol: 0.5, dur: 0.15 },
    ...[72, 76, 79].map((m, i) => ({ at: 0.96 + i * 0.08, kind: 'mallet', midi: m, vol: 0.1, decay: 0.5, dur: 0.6 })),
    { at: T.pop - 0.02, kind: 'sample', name: 'ailes', pan: -0.35, dur: SND_INFO.ailes.dur },
    { at: T.crow, kind: 'sample', name: 'coq', pan: -0.35, dur: CROW_DUR },
    { at: T.sheen, kind: 'mallet', midi: 84, vol: 0.1, decay: 0.7, bright: 1.3, dur: 0.8 },
    { at: T.sheen + 0.08, kind: 'bell', midi: 96, vol: 0.05, decay: 1.3, dur: 1.4 },
    { at: T.sheen, kind: 'pad', midis: [60, 64, 67, 72], vol: 0.03, dur: 1.8 },
    { at: T.cow, kind: 'sample', name: 'vache', pan: -0.3, dur: SND_INFO.vache.dur },
    { at: T.hen, kind: 'sample', name: 'poule', pan: 0.05, dur: SND_INFO.poule.dur },
    { at: T.sheep, kind: 'sample', name: 'mouton', pan: 0.3, dur: SND_INFO.mouton.dur },
    // fin : accord qui se pose (arpège doux + clochette + nappe), qui s'éteint dans le fondu
    ...[67, 72, 76, 79].map((m, i) => ({ at: T.chord + i * 0.07, kind: 'mallet', midi: m, vol: 0.075, decay: 1.1, dur: 1.2 })),
    { at: T.chord + 0.3, kind: 'bell', midi: 91, vol: 0.035, decay: 1.25, dur: 1.35 },
    { at: T.chord, kind: 'pad', midis: [55, 60, 64, 67], vol: 0.022, dur: 1.6 },
    // le coq gonfle le poitrail : un petit battement d'ailes, plus discret
    { at: T.puff + 0.02, kind: 'sample', name: 'ailes', pan: -0.35, vol: 0.55, dur: SND_INFO.ailes.dur },
  ];
}

/**
 * Courbe du volume général de l'intro (automation du gain du bus) : [[t, gain], …] avec des rampes linéaires.
 * Fin normale : tenu à 1 jusqu'au fondu, puis rampe jusqu'à 0 pendant tout le fondu (≥ 0,6 s).
 * Passage au toucher à skipFrom : rampe de la valeur courante à 0 en SKIP_FADE s.
 */
export function gainCurve(plan, skipFrom = -1) {
  const pts = [[0, 1], [plan.fadeStart, 1], [plan.fadeEnd, 0]];
  if (skipFrom < 0 || skipFrom >= plan.fadeEnd) return pts;
  const at = (t) => (t <= plan.fadeStart ? 1 : 1 - prog(t, plan.fadeStart, plan.fadeEnd));
  const end = Math.min(plan.fadeEnd, skipFrom + SKIP_FADE);
  return [[0, 1], ...(skipFrom > plan.fadeStart ? [[plan.fadeStart, 1]] : []), [skipFrom, at(skipFrom)], [end, 0]];
}
