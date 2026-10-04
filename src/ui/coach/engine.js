// Accompagnement « Joseph vous montre » — le moteur de leçons (docs/ACCOMPAGNEMENT.md § 4 ; contrats :
// docs/ARCHITECTURE.md, « Accompagnement — contrats »).
//
// createCoach(app) → app.coach : file de leçons, contexte, étapes, pause (raison « coach »), réglage Complet / Discret /
// Aucun, cours (tutoriel du niveau 1, début de carrière), rejeu depuis le carnet, rappels.
// Purement de l'interface : lit game.state / game.query / les événements, n'appelle AUCUNE action de jeu (seulement
// app.pushPause / app.popPause), n'écrit rien dans l'état de partie.
//
// Deux places : `course` (au plus un cours) et `lesson` (au plus une leçon simple). Une étape « passive » d'un cours
// (pastille d'attente : « Demain : les œufs », « Arrosez chaque matin ») laisse passer une leçon simple ; une étape
// active la bloque. Une seule bulle à l'écran à la fois.

import { el } from '../dom.js';
import { DAY_SECONDS } from '../../data/balance.js';
import { absDay as coreAbsDay } from '../../core/surprises.js';
import * as storage from '../../storage.js';
import { createBubble } from './bubble.js';
import { createCoachStore } from './store.js';
import { resolveTarget, focusTarget, needsTouchZoom } from './targets.js';
import { acquiredAtLoad, experienced } from './acquired.js';
import { createReminders } from './reminders.js';
import { openCarnet as openCarnetSheet } from './carnet.js';
import { SIGNALS } from './signals.js';
import { setSectionOpen } from '../career/util.js';
import { allowedDuringCourse, asList, canShow, displayMode, pickNext, priorityOf, sayOf, COURSE_RELEASE_DAYS, PATIENCE_MIN_MS, PATIENCE_REPLAY_MS } from './scheduler.js';

const STATE_EVAL_MS = 500; // déclencheurs d'état et réussites d'état : au plus 2 fois par seconde
const PILL_QUIET_MS = 15000; // Discret : la pastille d'une leçon essentielle reste 15 s (30 s en grand texte)
const SCROLL_SETTLE_MS = 700;
const STALE_DAYS = 2; // une leçon utile (U) restée 2 jours de jeu dans la file va au carnet (« à lire »)
const DEV = typeof location !== 'undefined' && /[?&](debug|dev)\b/.test(location.search || '');

/** Question unique aux anciens joueurs (§ 10.2) : leçon interne, jamais dans le carnet. */
const ASK_LESSON = {
  id: 'coach.ask',
  chapter: 'basics',
  title: 'Joseph vous accompagne',
  always: true,
  hidden: true,
  where: 'game',
  priority: 95,
  steps: [{ id: 'ask', say: 'Je peux vous montrer les nouveautés en chemin.', target: null, pause: false, choice: true }],
};

export function createCoach(app) {
  const layer = el('div', { id: 'coach', 'aria-live': 'off' });
  document.body.append(layer);
  const bubble = createBubble(layer, app);
  const store = createCoachStore(app);

  const lessons = new Map();
  const byEvent = new Map(); // type → [lesson] (déclencheurs `on`)
  const stateLessons = []; // déclencheurs d'état seuls
  let reminderList = [];

  let game = null;
  let mode = null;
  let bound = false;
  let boundAt = 0;
  let bindInfo = {};
  let expert = false;
  let speedTouched = false;
  const queue = []; // { id, lesson, at, chained, forced, target, from }
  let course = null;
  let lessonRun = null;
  let lastEndAt = -Infinity;
  let perDay = 0;
  let shownDay = null;
  let sheetShownCount = -1;
  let lastStateEval = 0;
  let pauseHeld = false;
  let zoomForced = false;
  let sayHook = null;
  let menuScreen = null;
  let lastSheet = null;
  let deducedOnce = false;
  let providerSet = false;
  let targetsTodo = false; // l'étape affichée montre la ligne « À faire » (elle reste visible sous la bulle)

  // ── Catalogue ─────────────────────────────────────────────────────────────────
  function register(list = [], rems = []) {
    for (const l of list) {
      if (!l || !l.id || !Array.isArray(l.steps)) continue;
      if (lessons.has(l.id)) {
        if (lessons.get(l.id) !== l && DEV) console.warn(`Accompagnement : leçon en double « ${l.id} »`);
        continue;
      }
      lessons.set(l.id, l);
      const on = asList(l.trigger?.on);
      if (on.length) for (const t of on) (byEvent.get(t) || byEvent.set(t, []).get(t)).push(l);
      else if (typeof l.trigger?.when === 'function') stateLessons.push(l);
    }
    const ids = new Set(reminderList.map((r) => r.id));
    for (const r of rems) if (r && r.id && !ids.has(r.id)) {
      reminderList.push(r);
      ids.add(r.id);
    }
    reminders.setList(reminderList);
  }

  // ── Contexte ──────────────────────────────────────────────────────────────────
  const safe = (fn, fallback) => {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  };

  /** Jour absolu continu (même calcul que le cœur : années comprises en carrière). */
  function absDayOf(state) {
    if (!state?.time) return 0;
    return safe(() => coreAbsDay(state), state.time.day || 1);
  }

  function uiCtx(now = performance.now()) {
    const inMenu = !!app.inMenu || !app.game;
    const dlgOpen = !!app.dialogs?.isOpen?.();
    const top = dlgOpen ? app.dialogs.top() : null;
    return {
      playing: !!game && !inMenu && game.state.status === 'playing',
      menu: inMenu,
      menuScreen: inMenu ? top || menuScreen : null,
      dialog: inMenu ? (top && top !== 'main-menu' ? top : null) : top,
      sheet: app.sheets?.current || null,
      sheetCount: app.sheets?.openCount ?? 0,
      fete: !!app.cozy?.feteMode,
      view: !!app.valleyView?.active,
      decor: !!app.decor?.active,
      placing: !!(app.valley?.placing || app.heritage?.pairing || app.places?.wilding),
      // Genre de visée : l'aménagement choisi (haie, nichoir…), 'pair' (semer la paire) ou 'wild' (terres sauvages).
      placingKind: app.places?.wilding ? 'wild' : app.heritage?.pairing ? 'pair' : typeof app.valley?.placing === 'string' ? app.valley.placing : app.valley?.placing ? 'nature' : null,
      rotated: document.body.classList.contains('is-rotated'),
      resume: top === 'resume',
      sinceStartMs: now - boundAt,
      wide: !!app.isWide?.(),
      touch: !!app.isTouch,
      reducedMotion: !!app.reducedMotion?.(),
      textScale: app.settings?.textScale || 1,
      speedTouched,
      todoShown: !!app.todo?.visible,
      todoItem: !!app.todo?.visible && !!app.todo?.currentId,
      unread: app.messages?.unread || 0,
    };
  }

  let frameCtx = null; // contexte de base de l'image (réutilisé)
  function baseCtx(now) {
    const g = game && !app.inMenu ? game : null;
    const st = g?.state || null;
    const cal = g ? safe(() => g.query.calendar(), null) : null;
    return {
      app: undefined, // (jamais : les catalogues sont purs)
      game: g,
      q: g?.query,
      state: st,
      mode: g ? mode : null,
      difficulty: g?.difficulty || st?.difficulty || null,
      level: g?.level || null,
      career: st?.career || null,
      ev: null,
      signal: null,
      day: st ? { abs: absDayOf(st), day: st.time.day, seasonId: cal?.seasonId || null, dayProgress: Math.max(0, Math.min(1, (st.time.elapsed || 0) / DAY_SECONDS)), year: st.time.year || 1, seasonKey: `${st.time.year || 1}-${st.time.seasonIndex || 0}` } : null,
      ui: uiCtx(now),
      progress: safe(() => app.progression.get(), {}),
      seen: (id) => store.seen(id),
      settings: app.settings,
      safe,
      mem: {},
      courseActive: !!course,
      expert,
      firstSteps: !!bindInfo.firstSteps,
      resumed: !!bindInfo.resumed,
      created: !!bindInfo.created,
      bill: g ? safe(() => app.hud.projection(), null) : null,
    };
  }
  function ctxWith(extra = {}, run = null) {
    const c = Object.assign({}, frameCtx || baseCtx(performance.now()), extra);
    c.mem = run ? run.mem : {};
    c.courseActive = !!course;
    return c;
  }

  // ── Déduction de ce qui est su (§ 10.3) ───────────────────────────────────────
  function deductionCtx() {
    const save = safe(() => storage.loadCareer(), null);
    const st = save?.state;
    const progress = safe(() => app.progression.get(), {});
    return {
      progress,
      tutorialDone: safe(() => storage.loadTutorial().done, false),
      careerSave: st?.time ? { year: st.time.year || 1, day: st.time.day || 1, rank: st.career?.rank || 1 } : null,
      archives: (progress?.career?.archive || []).length,
      state: game?.state || null,
      game,
      mode,
      seen: (id) => store.seen(id),
    };
  }
  function deduce() {
    const actx = deductionCtx();
    // Avant la partie (au chargement), la carrière sauvegardée compte comme « état » pour les leçons de mécanique.
    const ids = acquiredAtLoad([...lessons.values()], actx);
    for (const id of ids) {
      store.mark(id);
      if (!lessons.get(id)?.hidden) store.addUnread(id);
    }
    expert = experienced(actx);
    deducedOnce = true;
    return actx;
  }

  // ── Partie ────────────────────────────────────────────────────────────────────
  function bind(g, info = {}) {
    unbindRuns(false);
    game = g;
    mode = info.mode || (g?.mode === 'career' ? 'career' : 'levels');
    bound = true;
    boundAt = performance.now();
    bindInfo = { ...info };
    speedTouched = false;
    queue.length = 0;
    perDay = 0;
    shownDay = null;
    lastEndAt = -Infinity;
    reminders.bind(g, mode, info);
    // Rappels sans entrée « À faire » aujourd'hui (`todo: (ctx) => item`) : le moteur les fournit à la ligne.
    if (!providerSet && app.todo?.addProvider) {
      providerSet = true;
      app.todo.addProvider(() => {
        if (!bound || !game || store.level() === 'off') return [];
        const ctx = ctxWith();
        return reminderList
          .filter((r) => typeof r.todo === 'function' && modeOk(r) && !store.reminderOff(r.id))
          .map((r) => safe(() => r.todo(ctx), null))
          .filter((it) => it && it.id);
      });
    }
    const actx = deduce();
    frameCtx = baseCtx(performance.now());
    // Question unique aux anciens joueurs (Discret présélectionné).
    if (!store.asked()) {
      if (experienced(actx)) enqueue(ASK_LESSON, { forced: true });
      else store.setAsked();
    }
    // Cours : reprise d'un cours commencé, ou nouvelle carrière avec « Premiers pas ».
    if (mode === 'career') {
      const key = g.state.seed ?? null;
      const saved = store.course('career.firstSteps', key);
      if (info.created && info.firstSteps) startCourse('career.firstSteps', { force: true });
      else if (info.resumed && saved && !saved.done && saved.step) startCourse('career.firstSteps', { from: saved.step, force: true });
    } else if (g.level?.tutorial) {
      const saved = store.course('levels.firstYear');
      if (saved && !saved.done) {
        if (info.resumed && saved.step) startCourse('levels.firstYear', { from: saved.step, force: true });
        else if (!info.resumed) startCourse('levels.firstYear', { force: true });
      }
    }
    signal(SIGNALS.start, { created: !!info.created, resumed: !!info.resumed });
  }

  function unbindRuns(keepCourse = true) {
    if (course && !keepCourse) {
      /* l'étape est déjà enregistrée à chaque pas : rien à faire */
    }
    course = null;
    lessonRun = null;
    releasePause();
    restoreZoom();
    bubble.hide();
    bubble.hidePill();
    bubble.clearPoint();
  }

  function unbind() {
    unbindRuns(true);
    queue.length = 0;
    game = null;
    mode = null;
    bound = false;
    bindInfo = {};
    reminders.unbind();
  }

  // ── File ──────────────────────────────────────────────────────────────────────
  function enqueue(lesson, opts = {}) {
    if (!lesson) return false;
    if (course?.lesson === lesson || lessonRun?.lesson === lesson) return true;
    const q = queue.find((e) => e.lesson === lesson);
    if (q) {
      if (opts.target) q.target = opts.target;
      if (opts.forced) q.forced = true;
      return true;
    }
    queue.push({ id: lesson.id, lesson, at: performance.now(), day: frameCtx?.day?.abs ?? null, chained: !!opts.chained, forced: !!opts.forced, target: opts.target || null, replay: !!opts.replay, from: opts.from || null });
    return true;
  }

  function modeOk(l) {
    if (!Array.isArray(l.modes) || !l.modes.length) return true;
    // Au menu principal, aucune partie n'est liée : une leçon du menu (grange, décor, carrière) vaut pour tous les modes.
    if (!mode && l.where === 'menu') return true;
    return !!mode && l.modes.includes(mode);
  }

  /** Une leçon déclenchée entre dans la file (ou est rangée dans le carnet selon le réglage). */
  /** Leçon montrée par le cours en cours (ses `lessons` ou une étape `lesson`) : le cours s'en charge. */
  function ownedByCourse(id) {
    const c = course?.lesson;
    return !!c && ((c.lessons || []).includes(id) || c.steps.some((s) => s.lesson === id));
  }

  function triggered(l, ctx) {
    if (store.seen(l.id) || !modeOk(l) || l.course || ownedByCourse(l.id)) return;
    if (queue.some((e) => e.lesson === l) || course?.lesson === l || lessonRun?.lesson === l) return;
    let ok = true;
    if (typeof l.trigger?.when === 'function') ok = safe(() => !!l.trigger.when(ctx), false);
    if (!ok) return;
    const how = displayMode(l, store.level());
    if (how === 'carnet') {
      store.mark(l.id);
      store.addUnread(l.id);
      note(`Nouvelle page dans le carnet de Joseph : ${l.title}.`);
      return;
    }
    enqueue(l);
  }

  /** « Nouvelle page dans le carnet » : Discret → message info dans l'historique ; Aucun → rien (pastille du bouton). */
  function note(text) {
    if (store.level() === 'quiet') app.messages?.add?.({ kind: 'info', title: 'Le carnet de Joseph', text });
  }

  function evalTriggers(type, extra) {
    const list = byEvent.get(type);
    if (!list?.length) return;
    const ctx = ctxWith(extra);
    for (const l of list) triggered(l, ctx);
  }

  function evalStateTriggers() {
    if (!game || app.inMenu) return;
    const ctx = ctxWith();
    for (const l of stateLessons) triggered(l, ctx);
    // Sujet réglé avant d'être montré : vue sans être montrée.
    const today = ctx.day?.abs ?? null;
    for (let i = queue.length - 1; i >= 0; i--) {
      const e = queue[i];
      // Leçon utile (U) qui attend depuis STALE_DAYS jours de jeu (un cours, des journées chargées) : hors de propos,
      // elle va au carnet (« à lire ») au lieu d'arriver à contretemps — Joseph ne rattrape pas son retard d'un coup.
      if (!e.forced && !e.replay && !e.chained && e.lesson.tier === 'U' && !course && today !== null && e.day !== null && e.day !== undefined && today - e.day >= STALE_DAYS) {
        store.mark(e.lesson.id);
        if (!e.lesson.hidden) store.addUnread(e.lesson.id);
        queue.splice(i, 1);
        continue;
      }
      if (e.forced || e.replay || typeof e.lesson.stillRelevant !== 'function') continue;
      if (!safe(() => !!e.lesson.stillRelevant(ctx), true)) {
        store.mark(e.lesson.id);
        queue.splice(i, 1);
      }
    }
  }

  // ── Déroulé d'une leçon ───────────────────────────────────────────────────────
  function newRun(lesson, opts = {}) {
    const how = opts.replay ? 'full' : displayMode(lesson, store.level());
    return {
      lesson,
      steps: lesson.steps,
      index: -1,
      mem: {},
      how, // 'full' | 'pill' | 'offer'
      replay: !!opts.replay,
      target: opts.target || null,
      startedAt: performance.now(),
      stepAt: 0,
      nudgedAt: 0,
      skips: 0,
      minimized: false,
      released: false,
      focused: -1,
      crowdTried: -1,
      crowdAt: 0,
      settleTimer: null,
      asking: false, // « On arrête là ? »
      pillUntil: 0,
      key: lesson.id === 'career.firstSteps' ? game?.state?.seed ?? null : null,
      laterUsed: !!opts.later,
    };
  }

  const stepOf = (run) => (run && run.index >= 0 ? run.steps[run.index] : null);
  const sheetOfStep = (step, ctx) => (typeof step?.sheet === 'function' ? safe(() => step.sheet(ctx), null) : step?.sheet || null);

  function begin(entry) {
    const i = queue.indexOf(entry);
    if (i >= 0) queue.splice(i, 1);
    const l = entry.lesson;
    if (!entry.replay && !l.always && !l.course) {
      const ctx = ctxWith();
      if (typeof l.stillRelevant === 'function' && !safe(() => !!l.stillRelevant(ctx), true)) {
        store.mark(l.id);
        return;
      }
    }
    const run = newRun(l, entry);
    if (l.course) course = run;
    else lessonRun = run;
    if (!l.course && !entry.replay && !l.always) {
      const abs = frameCtx?.day?.abs ?? null;
      if (shownDay !== abs) {
        shownDay = abs;
        perDay = 0;
      }
      if (!entry.chained && !entry.forced) perDay += 1;
    }
    if (app.sheets?.isOpen?.()) sheetShownCount = app.sheets.openCount;
    goTo(run, entry.from ? Math.max(0, l.steps.findIndex((s) => s.id === entry.from)) : 0);
    if (run.how === 'pill' && (lessonRun === run || course === run)) run.pillUntil = performance.now() + PILL_QUIET_MS * ((app.settings?.textScale || 1) >= 1.3 ? 2 : 1);
  }

  /** Va à l'étape i (les étapes dont le but est déjà atteint sont sautées). */
  function goTo(run, i) {
    clearTimeout(run.settleTimer);
    run.settleTimer = null;
    let k = i;
    while (k < run.steps.length) {
      const s = run.steps[k];
      const ctx = ctxWith({}, run);
      if (!run.replay && typeof s.skipIf === 'function' && safe(() => !!s.skipIf(ctx), false)) {
        const noteText = typeof s.skipNote === 'function' ? safe(() => s.skipNote(ctx), null) : null;
        if (noteText) app.toasts?.show?.({ prio: 'important', kind: 'info', icon: 'rain', text: noteText, log: false });
        if (s.lesson) store.mark(s.lesson);
        k += 1;
        continue;
      }
      break;
    }
    if (k >= run.steps.length) return finish(run, 'done');
    run.index = k;
    run.stepAt = performance.now();
    run.stepDay = frameCtx?.day?.abs ?? null; // jour de jeu du début de l'étape (attente d'un cours : § 4.3)
    run.nudgedAt = 0;
    run.released = false;
    run.minimized = false;
    run.asking = false;
    const s = run.steps[k];
    if (run.lesson.course && !run.replay) store.saveCourse(run.lesson.id, { step: s.id, key: run.key });
    const ctx = ctxWith({}, run);
    if (typeof s.enter === 'function') safe(() => s.enter(ctx, kit), null);
    render(run, true);
    return undefined;
  }

  function advance(run) {
    const s = stepOf(run);
    if (!s) return;
    if (s.lesson && !run.replay) store.mark(s.lesson);
    run.skips = 0;
    app.audio?.play?.('confirm', { volume: 0.6 });
    // Rejeu (« Suivant ») : une étape qui vise une feuille fermée est sautée (on regarde sans faire).
    goTo(run, run.replay ? nextReachable(run, run.index + 1) : run.index + 1);
  }

  /** Réussite d'une étape ; `settle` : un glissé envoie plusieurs récoltes, on attend la fin du geste. */
  function succeed(run) {
    const s = stepOf(run);
    if (!s) return;
    if (s.settle) {
      // Fin du geste : plus de récolte depuis `settle` ms ET plus aucun doigt sur la scène (glissé lent).
      clearTimeout(run.settleTimer);
      const idx = run.index;
      const at = performance.now();
      const wait = () => {
        if (!((run === course || run === lessonRun) && run.index === idx)) return;
        if (app.input?.active || performance.now() - at < s.settle) {
          run.settleTimer = setTimeout(wait, 120);
          return;
        }
        advance(run);
      };
      run.settleTimer = setTimeout(wait, s.settle);
      return;
    }
    advance(run);
  }

  function finish(run, how = 'done') {
    clearTimeout(run.settleTimer);
    const l = run.lesson;
    if (!run.replay && !l.hidden) {
      store.mark(l.id);
      if (how === 'skip' || how === 'later-done') store.addPassed(l.id);
      if (how === 'quiet') store.addUnread(l.id);
      if (l.course) {
        reminders.quietAfterCourse?.();
        for (const id of l.lessons || []) store.mark(id);
        for (const s of l.steps) if (s.lesson) store.mark(s.lesson);
        store.saveCourse(l.id, { done: true, key: run.key });
      }
    }
    if (run === course) course = null;
    if (run === lessonRun) lessonRun = null;
    lastEndAt = performance.now();
    bubble.hide();
    bubble.hidePill();
    bubble.clearPoint();
    releasePause();
    if (!course && !lessonRun) restoreZoom();
    if (!run.replay && !l.hidden && how === 'done') {
      if (l.next && lessons.get(l.next)) enqueue(lessons.get(l.next), { chained: true });
      signal(SIGNALS.lessonEnd, { id: l.id, course: !!l.course });
    }
    // Le cours en attente (étape passive) reprend sa pastille à l'image suivante.
  }

  // ── Boutons ───────────────────────────────────────────────────────────────────
  function skip(scope = 'step') {
    const run = displayed();
    if (!run) return;
    app.audio?.play?.('close', { volume: 0.6 });
    if (scope === 'lesson' || scope === 'course' || !run.lesson.course) {
      if (!run.lesson.course && scope === 'step' && run.index < run.steps.length - 1) {
        run.skips += 1;
        goTo(run, nextReachable(run, run.index + 1));
        return;
      }
      finish(run, 'skip');
      return;
    }
    // Cours : deux « Passer » d'affilée → « On arrête là ? »
    if (run.skips >= 1 && !run.asking) {
      run.asking = true;
      render(run, true);
      return;
    }
    run.skips += 1;
    goTo(run, nextReachable(run, run.index + 1));
  }

  /** Après « Passer » : une étape qui vise le contenu d'une feuille fermée est sautée aussi (on ne peut pas la faire). */
  function nextReachable(run, i) {
    let k = i;
    const ctx = ctxWith({}, run);
    while (k < run.steps.length) {
      const sh = sheetOfStep(run.steps[k], ctx);
      if (sh && app.sheets?.current !== sh) {
        k += 1;
        continue;
      }
      break;
    }
    return k;
  }

  function later() {
    const run = displayed();
    if (!run) return;
    const s = stepOf(run);
    if (run.lesson.course) {
      const to = s?.laterTo ? run.steps.findIndex((x) => x.id === s.laterTo) : run.index + 1;
      goTo(run, to >= 0 ? to : run.index + 1);
      return;
    }
    // Leçon simple : elle revient une fois, au prochain bon moment.
    if (!run.laterUsed) {
      const l = run.lesson;
      finishSilently(run);
      const e = { id: l.id, lesson: l, at: performance.now() + 60000, chained: false, forced: false, later: true };
      queue.push(e);
      return;
    }
    finish(run, 'later-done');
  }

  /** Retire la leçon de l'écran sans la marquer vue (« Plus tard »). */
  function finishSilently(run) {
    clearTimeout(run.settleTimer);
    if (run === lessonRun) lessonRun = null;
    if (run === course) course = null;
    lastEndAt = performance.now();
    bubble.hide();
    bubble.hidePill();
    bubble.clearPoint();
    releasePause();
  }

  function expand() {
    const run = displayed();
    if (!run) return;
    app.audio?.play?.('open', { volume: 0.6 });
    if (run.how === 'pill') run.how = 'full';
    run.minimized = false;
    run.stepAt = performance.now();
    render(run, true);
  }

  // ── Affichage ─────────────────────────────────────────────────────────────────
  /** La leçon affichée : la leçon simple d'abord (elle n'existe que si le cours est passif), sinon le cours. */
  function displayed() {
    return lessonRun || course || null;
  }

  function isPassive(run, ctx = ctxWith({}, run)) {
    const s = stepOf(run);
    if (!s) return false;
    if (s.pill) return true;
    if (s.wait && typeof s.wait.until === 'function' && !safe(() => !!s.wait.until(ctx), false)) return true;
    return false;
  }

  function stepTarget(run, ctx) {
    const s = stepOf(run);
    if (!s) return null;
    const t = typeof s.target === 'function' ? safe(() => s.target(ctx), null) : s.target || null;
    return t || null;
  }

  function buttonsFor(run, s, ctx) {
    const out = [];
    if (run.asking) {
      out.push({ id: 'coach-stop-no', label: 'Non', onClick: () => { run.asking = false; run.skips = 0; goTo(run, nextReachable(run, run.index + 1)); } });
      out.push({ id: 'coach-stop-yes', label: 'Oui', primary: true, onClick: () => finish(run, 'skip') });
      return out;
    }
    if (run.how === 'offer' && run.index === 0) {
      out.push({ id: 'coach-know', label: 'Je connais', onClick: () => finish(run, 'skip') });
      out.push({ id: 'coach-yes', label: 'Oui', primary: true, onClick: () => {
        run.how = 'full';
        // « Oui » répond déjà à la bulle d'accueil (« Je vous montre ? ») : on ne repose pas la question.
        if (!s.target && !s.gesture && s.done?.button) advance(run);
        else render(run, true);
      } });
      return out;
    }
    if (s.choice) {
      const cur = store.asked() ? store.level() : 'quiet';
      for (const [v, label] of [['full', 'Complet'], ['quiet', 'Discret'], ['off', 'Aucun']]) {
        out.push({ id: `coach-level-${v}`, label: cur === v ? `● ${label}` : label, primary: cur === v, onClick: () => { setLevel(v); finish(run, 'done'); } });
      }
      return out;
    }
    const list = s.buttons || [];
    if (list.includes('later')) out.push({ id: 'coach-later', label: 'Plus tard', onClick: () => later() });
    if (s.done?.button) out.push({ id: 'coach-ok', label: s.done.button, primary: true, onClick: () => advance(run) });
    else if (run.replay) out.push({ id: 'coach-next', label: 'Suivant', primary: true, onClick: () => advance(run) });
    return out;
  }

  function modelFor(run, ctx) {
    const s = stepOf(run);
    const l = run.lesson;
    let text = sayOf(s, ctx);
    if (run.asking) text = 'On arrête là ? Tout reste dans mon carnet.';
    else if (run.how === 'offer' && run.index === 0) text = 'Je vous montre les premiers pas ?';
    const t = stepTarget(run, ctx);
    const resolved = t ? resolveTarget(t, app) : null;
    if (run.replay && t && !resolved && s.idle) text = s.idle;
    const gestureStep = !!s.gesture && s.gesture !== 'look' && !s.done?.button;
    const showSkip = !run.asking && !(run.how === 'offer' && run.index === 0) && !s.choice && (gestureStep || (l.course && !s.done?.button)) && !run.replay;
    const know = l.course && run.index === 0 && !run.replay && !run.asking && run.how !== 'offer' && (s.buttons || []).includes('know');
    const visibleSteps = l.course ? l.steps.length : 0;
    return {
      title: l.title,
      text,
      face: s.face || (s.gesture && s.gesture !== 'look' ? 'point' : 'content'),
      label: t?.label || '',
      buttons: buttonsFor(run, s, ctx),
      skip: know ? { label: 'Je connais', onClick: () => finish(run, 'skip') } : showSkip ? { label: 'Passer', onClick: () => skip('step') } : null,
      dots: visibleSteps > 1 && !run.asking ? { index: run.index, total: visibleSteps } : null,
      onPortrait: () => openCarnet({ lessonId: l.id }),
    };
  }

  /** (Re)dessine la bulle de l'étape courante. */
  function render(run, fresh = false) {
    if (run !== displayed()) return;
    const ctx = ctxWith({}, run);
    const s = stepOf(run);
    if (!s) return;
    if (fresh) {
      bubble.hide();
      bubble.hidePill();
      bubble.clearPoint();
    }
    run.dirty = true;
    if (fresh) {
      run.focused = -1;
      run.viewFocused = -1;
    }
    paint(run, ctx, true);
  }

  /** Une image : contexte, visibilité, placement, doigt, pause. */
  function paint(run, ctx, force = false) {
    const s = stepOf(run);
    const ui = ctx.ui;
    const sheet = sheetOfStep(s, ctx);
    const passive = isPassive(run, ctx);
    const stepForCtx = { ...s, sheet };
    const okCtx = canShow(run.lesson, ui, stepForCtx) || (run.lesson.course && !sheet && run.how !== 'offer' && passive && canShowPassive(ui));
    if (!okCtx) {
      // Fenêtre, fête, vue, feuille sans la cible : la bulle se cache, l'étape attend.
      if (bubble.visible) bubble.hide();
      const showStatic = run.lesson.course && !ui.dialog && !ui.menu && ui.sheet && !ui.wide && !passive && run.how === 'full' && !(app.sheets?.box?.classList.contains('is-tall'));
      if (showStatic) bubble.showPill({ title: run.lesson.title, text: sayOf(s, ctx), onTap: null, kind: 'lesson' });
      else bubble.hidePill();
      bubble.frame(performance.now(), { hidden: true });
      releasePause();
      run.wasHidden = true;
      return;
    }
    const t = stepTarget(run, ctx);
    const resolved = t ? resolveTarget(t, app) : null;
    // Pastille : Discret (1ʳᵉ étape), étape passive, bulle réduite.
    if (passive || run.how === 'pill' || run.minimized) {
      if (bubble.visible) bubble.hide();
      if (passive && run === course && !lessonRun && reminders.pillShown) {
        // Un rappel de sécurité parle (fermage en danger) : la pastille d'attente du cours lui laisse la place.
        bubble.clearPoint();
        releasePause();
        return;
      }
      const waitSay = passive && s.wait && !s.pill ? safe(() => (typeof s.wait.say === 'function' ? s.wait.say(ctx) : s.wait.say), '') : sayOf(s, ctx);
      bubble.showPill({
        title: run.lesson.title,
        text: waitSay || sayOf(s, ctx),
        kind: 'lesson',
        onTap: passive && !run.minimized ? null : () => expand(),
        avoid: resolved?.rects || null,
      });
      if (resolved) bubble.pointAt(resolved, passive ? 'look' : s.gesture);
      else bubble.clearPoint();
      bubble.frame(performance.now(), { covered: coveredFn(resolved) });
      releasePause();
      return;
    }
    bubble.hidePill();
    if (!bubble.visible || run.dirty || run.wasHidden) {
      bubble.show(modelFor(run, ctx));
      run.dirty = false;
      run.wasHidden = false;
      sayHook?.(sayOf(s, ctx));
      if (app.keyboardMode) requestAnimationFrame(() => bubble.el.querySelector('.btn--red, .btn, .coach-skip')?.focus({ preventScroll: true }));
      if (!run.replay && run.index > 0) app.audio?.play?.('warning', { volume: 0.4 });
    }
    // Montrer la cible : la scène défile (au-dessus de la bulle), zoom tactile si elle est trop petite.
    if (t && !t.view && run.focused !== run.index && (resolved || t.scene || Number.isInteger(t.plot) || t.plots)) {
      run.focused = run.index;
      focusTarget(t, app, { bottom: bubble.height + 16 });
    }
    // Vue de la vallée : la bulle est placée ; la vue défile pour que la cible ne soit ni sous la barre ni sous la bulle.
    if (t?.view && resolved && run.viewFocused !== run.index && bubble.visible) {
      run.viewFocused = run.index;
      const br = bubble.el.getBoundingClientRect();
      focusTarget(t, app, { avoid: { top: br.top, bottom: br.bottom } });
    }
    if (resolved && needsTouchZoom(resolved) && !zoomForced && app.scene?.ensureTouchZoom && !app.scene.zoomInfo?.().forced) {
      zoomForced = true;
      safe(() => app.scene.ensureTouchZoom(), null);
    }
    const state = bubble.place(resolved, { inSheet: !!sheet, overDialog: ui.menu || !!ui.dialog, force });
    if (state === 'crowded' && resolved?.kind === 'scene') {
      const now = performance.now();
      if (run.crowdTried !== run.index) {
        run.crowdTried = run.index;
        run.crowdAt = now;
        focusTarget(t, app, { bottom: bubble.height + 16 });
      } else if (now - run.crowdAt > SCROLL_SETTLE_MS) {
        // Grand texte sur petit écran : la bulle se réduit en pastille (l'anneau montre la cible, un toucher la rouvre).
        run.minimized = true;
      }
    }
    targetsTodo = typeof t?.ui === 'string' && t.ui.startsWith('#todo');
    if (resolved) bubble.pointAt(resolved, s.gesture || 'look');
    else bubble.clearPoint();
    bubble.frame(performance.now(), { covered: coveredFn(resolved) });
    holdPause(s.pause !== false && !run.released && !ui.menu);
  }

  /**
   * Le cours en cours, pour l'ordonnanceur : null (pas de cours) | { passive, waitedDays } (étape d'attente depuis
   * combien de jours de jeu). Voir allowedDuringCourse (scheduler.js).
   */
  function courseGate() {
    if (!course) return null;
    const passive = isPassive(course);
    const abs = frameCtx?.day?.abs ?? null;
    const waitedDays = passive && abs !== null && course.stepDay !== null && course.stepDay !== undefined ? abs - course.stepDay : 0;
    return { passive, waitedDays };
  }

  /** Étape passive d'un cours : visible partout en partie, sauf fenêtre, fête, vue, visée, décor, menu. */
  function canShowPassive(ui) {
    return ui.playing && !ui.dialog && !ui.fete && !ui.view && !ui.placing && !ui.decor && !ui.rotated && !ui.resume && !ui.menu && !ui.sheet;
  }

  /** Les cibles de la scène cachées par la feuille ou la barre du haut ne reçoivent ni anneau ni doigt. */
  function coveredFn(resolved) {
    if (!resolved || resolved.kind !== 'scene') return null;
    if (resolved.view) {
      // Vue de la vallée : couverte par son ruban (haut) ou sa barre (bas), pas par la barre d'onglets de la ferme.
      const vis = app.valleyView?.visibleRect?.();
      if (!vis) return null;
      return (r) => r.top + r.height / 2 > vis.bottom + 1 || r.top + r.height / 2 < vis.top - 1;
    }
    const top = app.safeTop?.() ?? 0;
    const bottom = app.safeBottom?.() ?? innerHeight;
    return (r) => r.top + r.height / 2 > bottom + 1 || r.top + r.height / 2 < top - 1;
  }

  // ── Pause « coach » ───────────────────────────────────────────────────────────
  function holdPause(want) {
    if (want && !pauseHeld) {
      pauseHeld = true;
      app.pushPause?.('coach');
    } else if (!want && pauseHeld) releasePause();
  }
  function releasePause() {
    if (!pauseHeld) return;
    pauseHeld = false;
    app.popPause?.('coach');
  }
  function restoreZoom() {
    if (!zoomForced) return;
    zoomForced = false;
    safe(() => app.scene?.restoreZoom?.(), null);
  }

  // ── Événements et signaux ─────────────────────────────────────────────────────
  function checkDone(run, extra) {
    const s = stepOf(run);
    if (!s || !s.done || run.asking || (run.how === 'offer' && run.index === 0) || s.choice) return;
    const type = extra.ev?.type || extra.signal?.name;
    const on = asList(s.done.on);
    if (!on.includes(type)) return;
    const ctx = ctxWith(extra, run);
    if (typeof s.done.when === 'function' && !safe(() => !!s.done.when(ctx), false)) return;
    succeed(run);
  }

  function notify(ev) {
    if (!ev || !ev.type) return;
    if (!bound || !game) return;
    if (ev.type === 'bankrupt' || ev.type === 'victory') {
      // Le cours garde son étape ; plus rien ne s'affiche sur l'écran de fin.
      lessonRun = null;
      course = null;
      bubble.hide();
      bubble.hidePill();
      bubble.clearPoint();
      releasePause();
      return;
    }
    const extra = { ev };
    for (const run of [course, lessonRun]) if (run) checkDone(run, extra);
    // Une étape dont le texte dépend du jeu (argent, aube) se rafraîchit.
    const run = displayed();
    if (run && ['dawn', 'watered', 'harvested', 'planted', 'purchased'].includes(ev.type)) run.dirty = true;
    evalTriggers(ev.type, extra);
    reminders.notify(ev);
  }

  function signal(name, data = null) {
    if (!name) return;
    if (name === SIGNALS.speed) {
      if ((data?.speed || 0) > 0) speedTouched = true;
    }
    if (name === SIGNALS.menu) menuScreen = data?.screen || null;
    const extra = { signal: { name, data } };
    if (bound && game) {
      for (const run of [course, lessonRun]) {
        if (!run) continue;
        checkDone(run, extra);
        // Feuille fermée alors que l'étape visait son contenu : retour à l'étape d'ancrage.
        if (name === SIGNALS.sheetClose) {
          const s = stepOf(run);
          const ctx = ctxWith(extra, run);
          const sh = sheetOfStep(s, ctx);
          if (s && sh && data?.id === sh && s.back) {
            const b = run.steps.findIndex((x) => x.id === s.back);
            if (b >= 0) goTo(run, b);
          }
        }
      }
    }
    evalTriggers(name, extra);
    if (name === SIGNALS.resumeClose) reminders.quietAfterResume();
  }

  /** Demande explicite d'une leçon du catalogue (ex. les lanternes, cozy.js). Renvoie vrai si elle sera montrée. */
  function request(id, opts = {}) {
    const l = lessons.get(id);
    if (!l) {
      if (DEV) console.warn(`Accompagnement : « ${id} » n'est pas au catalogue.`);
      return false;
    }
    if (store.seen(id) && !opts.force) return false;
    if (!modeOk(l)) return false;
    const how = opts.force ? 'full' : displayMode(l, store.level());
    if (how === 'carnet') {
      store.mark(id);
      store.addUnread(id);
      return false;
    }
    return enqueue(l, { target: opts.target || null, forced: !!opts.force });
  }

  function startCourse(id, opts = {}) {
    const l = lessons.get(id);
    if (!l || !l.course) return false;
    if (course?.lesson === l) return true;
    if (!opts.force && store.seen(id)) return false;
    const how = displayMode(l, store.level());
    if (how === 'carnet' && !opts.replay) {
      store.mark(id);
      store.addUnread(id);
      for (const x of l.lessons || []) {
        if (!store.seen(x)) store.addUnread(x);
        store.mark(x);
      }
      store.saveCourse(id, { done: true, key: game?.state?.seed ?? null });
      return false;
    }
    // Un cours passe avant tout : la leçon simple affichée s'efface (elle reviendra).
    if (lessonRun && !lessonRun.replay) {
      const l2 = lessonRun.lesson;
      finishSilently(lessonRun);
      enqueue(l2);
    }
    const e = { id, lesson: l, at: performance.now(), chained: true, forced: true, from: opts.from || null, replay: !!opts.replay };
    // Démarré tout de suite (sa 1ʳᵉ bulle attend le bon moment : fenêtre, 3 s de grâce…).
    begin(e);
    return true;
  }

  function replay(id) {
    const l = lessons.get(id);
    if (!l) return { ok: false, reason: 'missing', text: 'Cette page n\'a pas encore de démonstration.' };
    if (!game || app.inMenu) return { ok: false, reason: 'context', text: 'En partie seulement.' };
    if (!modeOk(l)) return { ok: false, reason: 'context', text: l.modes?.includes('career') ? 'Possible dans votre ferme (carrière).' : 'Possible dans les niveaux.' };
    if (l.where === 'menu') return { ok: false, reason: 'context', text: 'Au menu principal seulement.' };
    if (lessonRun) finishSilently(lessonRun);
    if (l.course) {
      if (course) finishSilently(course);
      begin({ id, lesson: l, at: performance.now(), chained: true, forced: true, replay: true });
      return { ok: true };
    }
    begin({ id, lesson: l, at: performance.now(), chained: true, forced: true, replay: true });
    return { ok: true };
  }

  // ── Chaque image ──────────────────────────────────────────────────────────────
  function frame(now = performance.now()) {
    frameCtx = baseCtx(now);
    const ui = frameCtx.ui;
    if (ui.sheet !== lastSheet) lastSheet = ui.sheet;
    // Au menu : seules les leçons « menu » (grange, décor, carrière) s'affichent.
    if (!bound || !game || app.inMenu) {
      if (lessonRun && whereIsMenu(lessonRun.lesson) && ui.menu) {
        paint(lessonRun, ctxWith({}, lessonRun));
      } else if (lessonRun && !whereIsMenu(lessonRun.lesson)) {
        finishSilently(lessonRun);
      } else if (!lessonRun) {
        const e = pickNext(queue.filter((x) => whereIsMenu(x.lesson)), ui, now, { lastEndAt: -Infinity });
        if (e) begin(e);
        else {
          bubble.hide();
          bubble.hidePill();
          bubble.clearPoint();
        }
      }
      return;
    }
    if (now - lastStateEval >= STATE_EVAL_MS) {
      lastStateEval = now;
      evalStateTriggers();
      for (const run of [course, lessonRun]) {
        const s = stepOf(run);
        if (s?.done?.state && !run.asking && !(run.how === 'offer' && run.index === 0)) {
          const ctx = ctxWith({}, run);
          if (safe(() => !!s.done.state(ctx), false)) succeed(run);
        }
      }
    }
    // Discret : la pastille d'une leçon essentielle part d'elle-même (la leçon reste « à lire » dans le carnet).
    if (lessonRun && lessonRun.how === 'pill' && lessonRun.pillUntil && now > lessonRun.pillUntil) finish(lessonRun, 'quiet');
    // Choisir la prochaine leçon : pendant un cours (même une étape d'attente), aucune autre leçon ne s'intercale, sauf
    // un danger réel (`urgent`) quand le cours attend (allowedDuringCourse) ; les autres attendent la fin du cours.
    if (!lessonRun) {
      const gate = courseGate();
      const candidates = queue.filter((x) => !whereIsMenu(x.lesson) && (x.at <= now || !x.later) && (x.forced || !ownedByCourse(x.id)) && allowedDuringCourse(x.lesson, gate));
      if (candidates.length) {
        const c0 = ctxWith();
        for (const e of candidates) {
          const first = e.lesson.steps[e.from ? Math.max(0, e.lesson.steps.findIndex((x) => x.id === e.from)) : 0];
          e.step = first ? { ...first, sheet: sheetOfStep(first, c0) } : null;
        }
        const e = pickNext(candidates, ui, now, {
          lastEndAt,
          perDay,
          dayAbs: frameCtx.day?.abs,
          shownDay,
          sheetShownCount,
        });
        if (e) begin(e);
      }
    }
    const run = displayed();
    if (run) {
      // Patience : 15 s sans geste → le doigt rejoue ; 45 s → la bulle se réduit en pastille.
      const s = stepOf(run);
      if (s && s.gesture && s.gesture !== 'look' && !s.done?.button && bubble.visible && run.how === 'full') {
        const idle = now - run.stepAt;
        if (idle > PATIENCE_REPLAY_MS && now - run.nudgedAt > PATIENCE_REPLAY_MS) {
          run.nudgedAt = now;
          bubble.nudge();
        }
        if (idle > PATIENCE_MIN_MS && !run.minimized && !run.replay) run.minimized = true;
      }
      paint(run, ctxWith({}, run));
    } else {
      bubble.hide();
      bubble.clearPoint();
      if (!reminders.pillShown) bubble.hidePill();
      releasePause();
    }
    // Rappels : jamais sur une bulle ; pendant un cours, seul le rappel de sécurité (fermage / charges en danger) parle,
    // et seulement quand le cours attend (sa pastille d'attente s'efface le temps du rappel).
    const cg = courseGate();
    const courseQuiet = !!cg && !(cg.passive && cg.waitedDays >= COURSE_RELEASE_DAYS);
    reminders.frame(now, frameCtx, { busy: !!lessonRun || (!!cg && !cg.passive), courseQuiet });
  }

  const whereIsMenu = (l) => l?.where === 'menu';

  // ── Réglage ───────────────────────────────────────────────────────────────────
  function setLevel(v) {
    store.setLevel(v);
    // Passer de « Aucun » à « Complet » ne rejoue rien : les leçons « à lire » restent dans le carnet.
    if (v === 'off') {
      for (let i = queue.length - 1; i >= 0; i--) if (!queue[i].lesson.always) queue.splice(i, 1);
      if (lessonRun && !lessonRun.replay && !lessonRun.lesson.always) finish(lessonRun, 'quiet');
    }
  }

  // Outils pour les étapes (`enter(ctx, kit)`) : préparer l'écran sans toucher au jeu.
  const kit = {
    openSection: (key) => safe(() => {
      setSectionOpen(key, true);
      // Feuille déjà dessinée, section repliée : on la déplie (comme un toucher sur son en-tête).
      const sec = document.getElementById(`fold-${key}`);
      if (sec && !sec.classList.contains('is-open')) sec.querySelector('.fold-head')?.click();
    }, null),
    focusInvestment: (id) => safe(() => app.panel?.focusInvestment?.(id), null),
    closeSheet: () => safe(() => app.sheets?.isOpen?.() && app.sheets.close('silent'), null),
  };

  function openCarnet(opts = {}) {
    return openCarnetSheet(app, opts);
  }

  const reminders = createReminders(app, { bubble, store, safe, isBusy: () => !!displayed() });

  return {
    register,
    bind,
    unbind,
    notify,
    signal,
    request,
    frame,
    startCourse,
    replay,
    skip,
    later,
    expand,
    get level() {
      return store.level();
    },
    setLevel,
    get active() {
      return !!displayed() && bubble.visible;
    },
    /** La bulle d'une leçon couvre l'écran (pas une pastille) : (zoom, mini-carte, ligne « À faire », fenêtres de la Vallée attendent). */
    get blocking() {
      return !!displayed() && bubble.visible;
    },
    get targetsTodo() {
      return !!displayed() && bubble.visible && targetsTodo;
    },
    get current() {
      const run = displayed();
      const s = stepOf(run);
      return run && s ? { lessonId: run.lesson.id, stepId: s.id, index: run.index, total: run.steps.length, course: !!run.lesson.course, how: run.how, replay: run.replay, minimized: run.minimized } : null;
    },
    get courseId() {
      return course?.lesson.id || null;
    },
    seen: (id) => store.seen(id),
    unread: () => store.unread(),
    markRead: (id) => store.markRead(id),
    passed: (id) => store.passed(id),
    lessons: () => [...lessons.values()],
    lesson: (id) => lessons.get(id) || null,
    reminderList: () => reminderList.slice(),
    reminderOff: (id) => store.reminderOff(id),
    setReminderOff: (id, on) => store.setReminderOff(id, on),
    openCarnet,
    onSay(fn) {
      sayHook = typeof fn === 'function' ? fn : null;
    },
    onSpeed(speed) {
      speedTouched = true;
      const run = displayed();
      if (run && speed > 0) {
        run.released = true;
        releasePause();
      }
      signal(SIGNALS.speed, { speed });
    },
    relayout() {
      const run = displayed();
      if (run) {
        run.dirty = true;
        run.crowdTried = -1;
      }
    },
    deduce,
    /** Contexte de déduction (tests, débogage). */
    experienced: () => expert,
    stats() {
      return {
        shown: [course?.lesson.id, lessonRun?.lesson.id].filter(Boolean),
        queue: queue.map((e) => e.id),
        perDay,
        lastAt: lastEndAt,
        level: store.level(),
        reminders: reminders.stats(),
        pause: pauseHeld,
        deduced: deducedOnce,
      };
    },
    /** Pastille de rappel affichée (tests). */
    get reminderShown() {
      return reminders.pillShown;
    },
    _priorityOf: priorityOf,
  };
}
