// Progression permanente vue par l'interface : lecture / enregistrement (storage.js), bonus,
// succès (vérification en partie et annonce), écus, cosmétiques, conseils déjà vus.
//
// createProgress(app, storage) → {
//   available(), get(), reload(), commit(p),
//   starsEarned(), starsSpent(), starsAvailable(), perkList(), buyPerk(id), refundPerks(),
//   perksEnabled(), setPerksEnabled(on), runPerks(), activePerkCount(),
//   achievementList(ctx), achievementDef(id), checkGame(game), checkBoot(), announce(ids, rewards),
//   recordRunEnd(info), ecus(), cosmetics(), cosmeticsList(category?), buyCosmetic(id),
//   placeDecor(slotId, itemId|null), setPath(id), setFence(id), setOutfit(id), setFarmName(text),
//   farmName(), hintSeen(id), markHint(id), isLevelUnlocked(id), levelInfo(id), canSpendStars(),
//   difficulty(), setDifficulty(id) }
//
// Toute la logique est dans src/core/progression.js (pur) ; ici, seulement l'état courant,
// l'enregistrement et les messages. Sans ce module (lot CORE pas encore livré), available()
// est faux et les fonctions renvoient des valeurs neutres : l'interface masque la grange.

import { v3, has } from './v3.js';
import { el, fmt, plural } from './dom.js';
import { achievementIcon } from './icons.js';

const DEFAULT_NAME = 'Ferme des Tilleuls';

export function createProgress(app, storage) {
  let current = null;
  const P = () => v3.progression;

  function available() {
    return !!v3.ready;
  }

  function load() {
    const raw = storage.loadProgress();
    if (!available()) return raw || { levels: {} };
    try {
      return P().normalizeProgress(raw);
    } catch (err) {
      console.warn('Progression illisible, valeurs par défaut :', err);
      return P().normalizeProgress(null);
    }
  }

  function get() {
    if (!current) current = load();
    return current;
  }

  function reload() {
    current = null;
    return get();
  }

  function commit(next) {
    if (!next) return current;
    current = next;
    storage.saveProgress(next);
    app.onProgressChange?.(next);
    return next;
  }

  /** Applique le résultat { ok, progress } d'une fonction de progression. */
  function applyResult(res) {
    if (res && res.ok !== false && res.progress) commit(res.progress);
    return res || { ok: false, reason: 'Indisponible pour l\'instant.' };
  }

  const call = (name, ...args) => (has(name) ? P()[name](get(), ...args) : null);

  // ── Étoiles et bonus ──────────────────────────────────────────────────────────
  const starsEarned = () => call('starsEarned') ?? Object.values(get().levels || {}).reduce((s, l) => s + (l?.stars || 0), 0);
  const starsSpent = () => call('starsSpent') ?? 0;
  const starsAvailable = () => call('starsAvailable') ?? 0;
  const perkList = () => call('perkList') || [];
  const perksEnabled = () => get().perksEnabled !== false;
  function buyPerk(id) {
    if (!has('buyPerk')) return { ok: false, reason: 'Indisponible pour l\'instant.' };
    return applyResult(P().buyPerk(get(), id));
  }
  function refundPerks() {
    if (!has('refundPerks')) return;
    const r = P().refundPerks(get());
    commit(r?.progress || r);
  }
  function setPerksEnabled(on) {
    if (!has('setPerksEnabled')) return;
    const r = P().setPerksEnabled(get(), !!on);
    commit(r?.progress || r);
  }
  const runPerks = () => call('runPerks') || {};
  const activePerkCount = () => Object.keys(runPerks()).length;
  /** Un bonus peut être acheté maintenant (pastille dorée du menu). */
  const canSpendStars = () => available() && perkList().some((p) => p.canBuy);

  // ── Succès ────────────────────────────────────────────────────────────────────
  const achievementList = (ctx = null) => call('achievementList', ctx) || [];
  function achievementDef(id) {
    const a = v3.achievements;
    return a?.getAchievement?.(id) || a?.ACHIEVEMENTS?.find((x) => x.id === id) || null;
  }

  /** Contexte d'une partie pour les succès (requête du cœur), ou null. */
  function contextOf(game) {
    if (!game || typeof game.query.achievementContext !== 'function') return null;
    try {
      return game.query.achievementContext();
    } catch (err) {
      console.warn('achievementContext :', err);
      return null;
    }
  }

  /**
   * Succès nouvellement remplis : avec le contexte d'une partie **en cours** (aube, achat, récolte),
   * sinon sans contexte (progression seule). Une partie terminée a déjà été comptée par
   * recordRunEnd : repasser son contexte compterait ses chiffres deux fois dans les cumuls.
   */
  function newAchievements(game) {
    if (!available() || !has('checkAchievements') || !has('unlockAchievements')) return null;
    const ctx = game && game.state?.status === 'playing' ? contextOf(game) : null;
    if (game && game.state?.status === 'playing' && !ctx) return null;
    try {
      return P().checkAchievements(get(), ctx) || [];
    } catch (err) {
      console.warn('checkAchievements :', err);
      return null;
    }
  }

  /** Vérifie les succès (partie en cours, ou progression seule si game est nul ou terminé) ; annonce les nouveaux. */
  function checkGame(game) {
    const ids = newAchievements(game);
    if (!ids || !ids.length) return [];
    const res = P().unlockAchievements(get(), ids);
    commit(res.progress);
    announce(ids, res.rewards);
    return ids;
  }

  /**
   * Au démarrage : succès mérités par les anciennes parties. Ceux que storage.js a débloqués en
   * migrant une progression v1 (progressMigration, une seule fois) + ceux de la progression seule.
   */
  function checkBoot() {
    let ids = [];
    try {
      ids = storage.progressMigration?.()?.retroactive || [];
    } catch {
      ids = [];
    }
    const more = newAchievements(null) || [];
    if (more.length) {
      const res = P().unlockAchievements(get(), more);
      commit(res.progress);
    }
    return [...new Set([...ids, ...more])];
  }

  function rewardText(r) {
    if (!r) return '';
    const parts = [];
    if (r.stars) parts.push(`+${r.stars} ★`);
    if (r.ecus) parts.push(`+${plural(r.ecus, 'écu')}`);
    return parts.join(' · ');
  }

  /** Message « Succès : Premier panier · +5 écus » (son doux, petite fête, jamais de pause). */
  function announce(ids, rewards) {
    ids.forEach((id, i) => {
      const def = achievementDef(id);
      const r = def?.reward;
      setTimeout(() => {
        app.audio.play('unlock', { volume: 0.7 });
        app.vibrate?.([10, 40, 10]);
        const node = app.toasts.show({
          kind: 'achievement',
          sprite: achievementIcon(id, true, 'sprite--md', r?.stars || 0),
          title: `Succès : ${def?.name || id}`,
          text: rewardText(r) || 'Débloqué !',
          duration: 4200,
        });
        celebrate(node);
      }, i * 900);
    });
    if (rewards?.stars) app.onStarsEarned?.(rewards.stars);
  }

  /** Petite fête : quelques confettis autour d'un élément (sans bloquer le toucher). */
  function celebrate(node) {
    if (!node || app.reducedMotion?.()) return;
    const burst = el('span.confetti', { 'aria-hidden': 'true' });
    for (let k = 0; k < 10; k++) {
      const c = el('i');
      c.style.setProperty('--a', `${Math.round((360 / 10) * k + Math.random() * 20)}deg`);
      c.style.setProperty('--d', `${28 + Math.round(Math.random() * 26)}px`);
      c.style.setProperty('--c', ['#fddc00', '#e2665b', '#7cc955', '#63aff3', '#fff1d2'][k % 5]);
      burst.append(c);
    }
    node.append(burst);
    setTimeout(() => burst.remove(), 1200);
  }

  // ── Fin de partie ─────────────────────────────────────────────────────────────
  /**
   * info : { levelId, outcome: 'victory'|'bankrupt'|'abandon', stars, money, summary, perksActive }
   * → { rewards: { ecus, newStars, newBest, firstTime }, achievements: [id], starsAvailable }
   */
  function recordRunEnd(info) {
    if (!available() || !has('recordRunEnd')) return { rewards: { ecus: 0 }, achievements: [], starsAvailable: 0 };
    let res;
    try {
      res = P().recordRunEnd(get(), info);
    } catch (err) {
      console.warn('recordRunEnd :', err);
      return { rewards: { ecus: 0 }, achievements: [], starsAvailable: starsAvailable() };
    }
    commit(res.progress);
    return { rewards: res.rewards || { ecus: 0 }, achievements: res.achievements || [], starsAvailable: starsAvailable() };
  }

  // ── Écus et cosmétiques ───────────────────────────────────────────────────────
  const ecus = () => Math.max(0, Math.floor(get().ecus || 0));
  function cosmetics() {
    const def = v3.cosmetics?.DEFAULT_COSMETICS || { farmName: DEFAULT_NAME, outfit: 'outfit.classic', path: 'path.dirt', fence: 'fence.wood', decor: {}, owned: [] };
    const c = get().cosmetics || {};
    return { ...def, ...c, decor: { ...(c.decor || def.decor || {}) }, owned: [...new Set([...(def.owned || []), ...(c.owned || [])])] };
  }
  function cosmeticsList(category = null) {
    const all = v3.cosmetics?.COSMETICS || [];
    return category ? all.filter((c) => c.category === category) : all;
  }
  const owns = (id) => cosmetics().owned.includes(id) || !!cosmeticsList().find((c) => c.id === id)?.isDefault;
  function buyCosmetic(id) {
    if (!has('buyCosmetic')) return { ok: false, reason: 'Indisponible pour l\'instant.' };
    return applyResult(P().buyCosmetic(get(), id));
  }
  function place(fn, ...args) {
    if (!has(fn)) return { ok: false, reason: 'Indisponible pour l\'instant.' };
    const r = P()[fn](get(), ...args);
    // setFarmName renvoie la progression ; les autres { ok, progress }.
    if (r && r.ok === undefined && r.levels) {
      commit(r);
      return { ok: true, progress: r };
    }
    return applyResult(r);
  }
  const placeDecor = (slotId, itemId) => place('placeDecor', slotId, itemId);
  const setPath = (id) => place('setPath', id);
  const setFence = (id) => place('setFence', id);
  const setOutfit = (id) => place('setOutfit', id);
  const setFarmName = (text) => place('setFarmName', text);
  const farmName = () => cosmetics().farmName || v3.cosmetics?.DEFAULT_FARM_NAME || DEFAULT_NAME;

  // ── Difficulté (mode des nouvelles parties) ───────────────────────────────────
  /** 'detente' | 'classique' : à passer à createGame({ difficulty }). Détente sans module de progression. */
  const difficulty = () => call('runDifficulty') || 'detente';
  function setDifficulty(id) {
    if (!has('setDifficulty')) return { ok: false, reason: 'Indisponible pour l\'instant.' };
    return applyResult(P().setDifficulty(get(), id));
  }

  // ── Conseils et niveaux ───────────────────────────────────────────────────────
  const hintSeen = (id) => (get().hintsSeen || []).includes(id);
  function markHint(id) {
    if (!has('markHint')) return;
    const r = P().markHint(get(), id);
    commit(r?.progress || r);
  }
  function isLevelUnlocked(id) {
    if (has('isLevelUnlocked')) return P().isLevelUnlocked(get(), id);
    return storage.isLevelUnlocked(id);
  }
  const levelInfo = (id) => get().levels?.[id] || {};

  return {
    available,
    get,
    reload,
    commit,
    starsEarned,
    starsSpent,
    starsAvailable,
    perkList,
    buyPerk,
    refundPerks,
    perksEnabled,
    setPerksEnabled,
    runPerks,
    activePerkCount,
    canSpendStars,
    achievementList,
    achievementDef,
    checkGame,
    checkBoot,
    announce,
    rewardText,
    recordRunEnd,
    ecus,
    cosmetics,
    cosmeticsList,
    owns,
    buyCosmetic,
    placeDecor,
    setPath,
    setFence,
    setOutfit,
    setFarmName,
    farmName,
    hintSeen,
    markHint,
    isLevelUnlocked,
    levelInfo,
    difficulty,
    setDifficulty,
    fmtEcus: (n) => `${fmt(n)} écu${Math.abs(n) > 1 ? 's' : ''}`,
  };
}
