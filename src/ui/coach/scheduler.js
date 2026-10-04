// Accompagnement « Joseph vous montre » — ordonnanceur PUR (aucun accès au DOM ni à window, testable sous Node).
// Conception : docs/ACCOMPAGNEMENT.md §§ 4.3, 4.7, 8.2 ; contrats : docs/ARCHITECTURE.md, « Accompagnement — contrats ».
//
// canShow(lesson, ui)                 la leçon (sa 1ʳᵉ étape affichable) peut-elle s'afficher dans ce contexte d'interface ?
// displayMode(lesson, level)          'full' | 'pill' | 'carnet' (leçon) ; 'full' | 'offer' | 'carnet' (cours)
// pickNext(queue, ui, now, opts)      la prochaine entrée de la file à montrer (priorité, respiration, quotas), ou null
// reminderDue(rem, ctx, memo)         { text, target?, id } si le rappel doit parler maintenant, sinon null
// createReminderMemo()                mémoire des rappels (session seulement, jamais dans la partie)
// noteReminderShown / noteReminderIgnored / noteReminderSeason : comptes des pastilles

export const BREATH_MS = 20000; // respiration entre deux leçons (hors cours et `next`)
export const PER_DAY = 3; // leçons hors cours par jour de jeu
export const START_GRACE_MS = 3000; // rien dans les 3 s après le début ou la reprise d'une partie
export const COURSE_GRACE_MS = 1200; // un cours commence plus vite (premier glissé de récolte en moins de 5 s)
export const PATIENCE_REPLAY_MS = 15000; // le doigt rejoue son geste
export const PATIENCE_MIN_MS = 45000; // la bulle se réduit en pastille
export const REMINDERS_PER_DAY = 1;
export const REMINDERS_PER_SEASON = 4;
export const REMINDER_IGNORE_LIMIT = 3;

export const LEVELS = Object.freeze(['full', 'quiet', 'off']);
export const PRIORITY = Object.freeze({ course: 100, safety: 90, essential: 70, useful: 40, meta: 20 });

/** Priorité d'une leçon (défaut selon son niveau). */
export function priorityOf(lesson) {
  if (!lesson) return 0;
  if (Number.isFinite(lesson.priority)) return lesson.priority;
  if (lesson.course) return PRIORITY.course;
  return lesson.tier === 'E' ? PRIORITY.essential : PRIORITY.useful;
}

/**
 * Où la leçon s'affiche : 'farm' (défaut) | 'sheet:<id>' | 'view' | 'fete' | 'placing' | 'menu' | 'dialog' | 'dialog:<id>'
 * | 'game' (partout en partie, même feuille ouverte : question unique aux anciens joueurs).
 */
export function whereOf(lesson) {
  return typeof lesson?.where === 'string' && lesson.where ? lesson.where : 'farm';
}

/**
 * Contexte d'interface (ui) : { playing, menu, menuScreen, dialog, sheet, sheetCount, sheetShown, fete, view, decor,
 * placing, rotated, resume, sinceStartMs, wide }.
 * @param {object} lesson
 * @param {object} ui
 * @param {object} [step] étape à afficher (défaut : la première) — `step.sheet` : seulement cette feuille ouverte
 */
export function canShow(lesson, ui, step = null) {
  if (!lesson || !ui) return false;
  const where = whereOf(lesson);
  const s = step || lesson.steps?.[0] || null;
  if (ui.rotated) return false;
  if (where === 'menu') return !!ui.menu && (!ui.menuScreen || ui.menuScreen === 'main-menu') && (!ui.dialog || ui.dialog === 'main-menu');
  if (ui.menu || !ui.playing) return false;
  if ((ui.sinceStartMs ?? Infinity) < (lesson.course ? COURSE_GRACE_MS : START_GRACE_MS)) return false;
  if (ui.resume) return false;
  if (where.startsWith('dialog')) {
    const want = where.slice(7);
    return !!ui.dialog && (!want || ui.dialog === want);
  }
  if (ui.dialog) return false;
  if (ui.fete) return where === 'fete';
  if (ui.view) return where === 'view';
  if (ui.placing) return where === 'placing';
  if (ui.decor) return false;
  if (where === 'fete' || where === 'view' || where === 'placing') return false;
  const sheetOf = where.startsWith('sheet:') ? where.slice(6) : s?.sheet || null;
  if (sheetOf) return ui.sheet === sheetOf;
  if (where === 'game') return true;
  // Feuille ouverte (téléphone) : seules les étapes visant le contenu de cette feuille s'affichent.
  if (ui.sheet && !ui.wide) return false;
  return true;
}

/**
 * Ce que montre le réglage (docs/ACCOMPAGNEMENT.md § 4.7).
 * Leçon : Complet → 'full' ; Discret → 'pill' (E) ou 'carnet' (U) ; Aucun → 'carnet'.
 * Cours : Complet → 'full' ; Discret → 'offer' (« Je vous montre les premiers pas ? ») ; Aucun → 'carnet'.
 * Sécurité (priorité ≥ 90) : Discret → 'pill', Aucun → 'carnet' (le message important d'aujourd'hui reste, rappel).
 * `always: true` (question unique, réglage) : toujours 'full'.
 */
export function displayMode(lesson, level = 'full') {
  if (!lesson) return 'carnet';
  if (lesson.always) return 'full';
  const lv = LEVELS.includes(level) ? level : 'full';
  if (lesson.course) return lv === 'full' ? 'full' : lv === 'quiet' ? 'offer' : 'carnet';
  if (lv === 'full') return 'full';
  if (lv === 'off') return 'carnet';
  return lesson.tier === 'E' || priorityOf(lesson) >= PRIORITY.safety ? 'pill' : 'carnet';
}

/**
 * Prochaine entrée à montrer. queue : [{ id, lesson, at, chained?, forced? }] ; opts : { lastEndAt, perDay, dayAbs,
 * shownDay, sheetShownCount }. Une entrée `chained` (cours, `next`, rejeu, demande forcée) ignore respiration et quota.
 * Renvoie l'entrée choisie (non retirée de la file) ou null.
 */
export function pickNext(queue, ui, now, opts = {}) {
  if (!Array.isArray(queue) || !queue.length) return null;
  const lastEndAt = opts.lastEndAt ?? -Infinity;
  const perDay = opts.dayAbs !== undefined && opts.shownDay === opts.dayAbs ? opts.perDay || 0 : 0;
  // Une seule bulle par ouverture de feuille.
  const sheetBusy = !!ui?.sheet && opts.sheetShownCount !== undefined && opts.sheetShownCount === ui.sheetCount;
  const sorted = queue
    .map((e, i) => ({ e, i }))
    .sort((a, b) => priorityOf(b.e.lesson) - priorityOf(a.e.lesson) || (a.e.at ?? 0) - (b.e.at ?? 0) || a.i - b.i);
  for (const { e } of sorted) {
    const free = !!(e.chained || e.forced || e.lesson?.course || e.lesson?.always);
    if (!free && now - lastEndAt < BREATH_MS) continue;
    if (!free && perDay >= PER_DAY) continue;
    if (sheetBusy && !e.lesson?.always) continue;
    if (!canShow(e.lesson, ui, e.step || null)) continue;
    return e;
  }
  return null;
}

// ── Rappels ───────────────────────────────────────────────────────────────────────────────────

export function createReminderMemo() {
  return { sorts: {}, day: null, dayCount: 0, season: null, seasonCount: 0, lastSort: null, lastSortDay: null, quietUntil: -Infinity };
}

function sortMemo(memo, id) {
  if (!memo.sorts[id]) memo.sorts[id] = { since: null, shown: 0, ignored: 0, silentSeason: null, lastDay: null, onceSeason: null };
  return memo.sorts[id];
}

/** Nouvelle saison : les sortes réduites au silence reparlent, le quota de saison repart. */
export function noteReminderSeason(memo, seasonKey) {
  if (memo.season === seasonKey) return;
  memo.season = seasonKey;
  memo.seasonCount = 0;
  for (const s of Object.values(memo.sorts)) {
    if (s.silentSeason !== null && s.silentSeason !== seasonKey) {
      s.silentSeason = null;
      s.ignored = 0;
    }
  }
}

/**
 * Le rappel doit-il parler maintenant ? ctx : { day: { abs, seasonKey }, mode, off: { [id]: true }, level, ui }.
 * rem : { id, modes, when(ctx) → null | { since?, text, target? }, wait (jours), oncePerSeason, safety }.
 * Met à jour memo.sorts[id].since (début de l'attente). Renvoie { id, text, target, safety } ou null.
 * `opts.ignoreQuota` : évaluation seule (ligne du matin) sans les quotas de pastilles.
 */
export function reminderDue(rem, ctx, memo, opts = {}) {
  if (!rem || !ctx || !memo) return null;
  if (Array.isArray(rem.modes) && rem.modes.length && !rem.modes.includes(ctx.mode)) return null;
  const s = sortMemo(memo, rem.id);
  let cond = null;
  try {
    cond = rem.when(ctx) || null;
  } catch {
    cond = null;
  }
  const abs = ctx.day?.abs ?? 0;
  if (!cond || !cond.text) {
    s.since = null;
    return null;
  }
  if (s.since === null || s.since === undefined) s.since = Number.isFinite(cond.since) ? cond.since : abs;
  const wait = Number.isFinite(rem.wait) ? rem.wait : 1;
  if (abs - s.since < wait) return null;
  if (ctx.off?.[rem.id]) return null;
  const seasonKey = ctx.day?.seasonKey ?? null;
  if (rem.oncePerSeason && s.onceSeason === seasonKey) return null;
  const out = { id: rem.id, text: cond.text, target: cond.target || null, safety: !!rem.safety };
  if (opts.ignoreQuota) return out;
  if (s.silentSeason !== null && s.silentSeason === seasonKey) return null;
  if (abs < memo.quietUntil) return null;
  if (!rem.safety) {
    if (memo.day === abs && memo.dayCount >= REMINDERS_PER_DAY) return null;
    if (memo.season === seasonKey && memo.seasonCount >= REMINDERS_PER_SEASON) return null;
    if (memo.lastSort === rem.id && memo.lastSortDay !== null && abs - memo.lastSortDay <= 1) return null;
  }
  return out;
}

/** Une pastille de rappel s'est affichée. */
export function noteReminderShown(memo, id, ctx, { safety = false } = {}) {
  const abs = ctx.day?.abs ?? 0;
  const s = sortMemo(memo, id);
  s.shown += 1;
  s.lastDay = abs;
  if (ctx.day?.seasonKey !== undefined) s.onceSeason = ctx.day.seasonKey;
  if (safety) return;
  if (memo.day !== abs) {
    memo.day = abs;
    memo.dayCount = 0;
  }
  memo.dayCount += 1;
  memo.seasonCount += 1;
  memo.lastSort = id;
  memo.lastSortDay = abs;
}

/** Pastille partie sans être touchée : au 3ᵉ silence, la sorte se tait jusqu'à la saison suivante. */
export function noteReminderIgnored(memo, id, ctx) {
  const s = sortMemo(memo, id);
  s.ignored += 1;
  if (s.ignored >= REMINDER_IGNORE_LIMIT) s.silentSeason = ctx.day?.seasonKey ?? null;
}

/** Pastille touchée : le compteur des silences repart. */
export function noteReminderUsed(memo, id) {
  sortMemo(memo, id).ignored = 0;
}

/** Après « Où en étais-je ? » : aucun rappel pendant un jour de jeu. */
export function quietReminders(memo, untilAbs) {
  memo.quietUntil = Math.max(memo.quietUntil, untilAbs);
}

/** Texte d'une étape : chaîne, ou fonction du contexte (garde-fou : jamais d'exception). */
export function sayOf(step, ctx) {
  if (!step) return '';
  try {
    const v = typeof step.say === 'function' ? step.say(ctx) : step.say;
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

/** Liste de déclencheurs (`on`) : chaîne ou tableau → tableau. */
export function asList(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
