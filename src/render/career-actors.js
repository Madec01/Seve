// Personnages et engins du mode Carrière (docs/CARRIERE.md § 12) : employés qui marchent vers leur
// tâche puis la font (pose de travail + outil), machines qui traversent les champs rang par rang (le
// tracteur ou le cheval tire le semoir et la moissonneuse), animaux des abris (6 au plus par abri),
// corbeaux posés sur les parcelles (et leur envol), Joseph qui vient proposer une quête, visiteurs,
// touristes et villageois des jours de fête, chat et chien de la ferme.
//
// createCareerActors() → actors
//   actors.reset()                         oublie tout (nouvelle partie)
//   actors.shift(dy)                       le monde a grandi vers le haut : tout descend de dy px
//   actors.sync(game, layout, time)        relit l'état (employés, abris, corbeaux, quête, offres, animaux)
//   actors.update(dt, env)                 avance (dt : secondes réelles ; env : { elapsed, speed, season, weather, dayProgress })
//   actors.collect(push, view)             ajoute les sprites à la liste de dessin de la scène
//                                          push(name, x, y, sortY, set, opts) ; view : { x0, y0, x1, y1 } (px monde)
//   actors.hitTest(wx, wy, slop)           { type: 'employee', staffId } | { type: 'joseph' } |
//                                          { type: 'visitor', offerId, kind } | { type: 'crow', plotIndex } | null
//   actors.rectOf(hit)                     rectangle (px monde) d'une cible (surbrillance)
//   actors.onEvent(type, payload, layout)  réactions (envol des corbeaux, retour de Joseph…)
//   actors.stats()                         nombres d'acteurs dessinés (mesures)
//   actors.markers()                       positions des employés, de Joseph, des visiteurs (mini-carte)
//
// Lecture seule : l'état du jeu n'est jamais modifié. Les heures des tâches et des passages sont celles
// du cœur (secondes écoulées dans la journée, state.time.elapsed) : à ×4, le travail va 4 fois plus vite, mais les
// employés ne courent pas — ils marchent au pas (temps réel, accélération modérée) et coupent par un fondu quand la
// tâche suivante est trop loin (walkToward). Les animaux, les visiteurs, Joseph et les promeneurs sont du décor en
// temps réel. Mouvements réduits : aucun trajet dessiné (l'employé est à sa tâche).

import { TILE, SPRITES, staffSprite } from './atlas.js';
import { tileHash } from './layout-common.js';
import { MAX_ANIMALS_DRAWN } from './layout-career.js';
import { GAME_SECONDS_PER_REAL_SECOND } from '../data/balance.js';

const T = TILE;
// Rythme des personnages (2026-10-03, retour joueur : « en ×1 les personnages semblent accélérés, comme en ×4 ») :
// les employés marchent au pas tranquille en temps RÉEL (≈ 42 px CSS/s sur le Pixel 7, 59 au plus pressé), un peu plus vite aux vitesses
// rapides (paceFactor : ×1,25 à ×2, ×1,5 à ×4) ; quand la tâche suivante est trop loin pour y arriver sans courir, ils
// « coupent » (fondu, puis réapparition près du but) au lieu de traverser la ferme en courant. La cadence des pas suit
// la distance parcourue (une bascule de pose tous les STEP_PX px : ≈ 4 à 5 pas/s), jamais l'image.
const STAFF_WALK = 22; // px du monde par seconde réelle, à ×1
const STAFF_HURRY = 1.4; // un peu plus vif quand l'heure presse (au-delà : raccourci doux)
const STEP_PX = 6;
const JUMP_DIST = 64; // retard (px) au-delà duquel l'employé coupe
const JUMP_MIN = 28; // jamais de raccourci pour moins que ça (il marche, un peu plus vif)
const JUMP_LAND = 18; // il réapparaît à cette distance du but
const FADE_S = 0.22; // durée de chaque fondu (s réelles)
/** Accélération modérée des mouvements aux vitesses rapides (jamais ×4 à ×4). */
export function paceFactor(speed) {
  return speed >= 4 ? 1.5 : speed >= 2 ? 1.25 : 1;
}
const POP_TIME = 0.55;
const TOOL_OF = { water: 'can', harvest: 'basket', pick: 'basket', sow: 'seedbag', collect: 'pail', craft: 'hoe', sell: 'basket' };
const JOB_TOOL = { keeper: 'pail', artisan: 'hoe', seller: 'basket' };
const ANIMAL_SPEED = { hen: 15, sheep: 9, cow: 7, goat: 11, pig: 8, rabbit: 16, horse: 10, duck: 6 };
const HOP_RATE = { hen: 9, sheep: 6, cow: 4.5, goat: 7, pig: 5, rabbit: 5, horse: 3.5, duck: 2 };
const BASE_SPRITE = { hen: 'animal.chicken', sheep: 'animal.sheep', cow: 'animal.cow', goat: 'animal.goat', pig: 'animal.pig', horse: 'animal.horse', duck: 'animal.duck.swim' };
const VISITOR_SPRITES = ['npc.visitor.1', 'npc.visitor.2', 'npc.visitor.3'];

const rnd = (a, b) => a + Math.random() * (b - a);
const exists = (name) => !!SPRITES[name];

function popScale(t) {
  if (t >= 1) return 1;
  const c1 = 1.9;
  const c3 = c1 + 1;
  const u = t - 1;
  return Math.max(0.05, 1 + c3 * u * u * u + c1 * u * u);
}

/** Longueurs cumulées d'une ligne brisée (réutilise `out`). */
function polyLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** Point à la distance d le long d'une ligne brisée ; out.dx = sens horizontal. */
function pointAlong(pts, d, out) {
  let rest = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (rest <= seg || i === pts.length - 1) {
      const k = seg > 0 ? Math.min(1, rest / seg) : 1;
      out.x = a.x + (b.x - a.x) * k;
      out.y = a.y + (b.y - a.y) * k;
      out.dx = b.x - a.x;
      return out;
    }
    rest -= seg;
  }
  const last = pts[pts.length - 1];
  out.x = last.x;
  out.y = last.y;
  out.dx = 0;
  return out;
}

export function createCareerActors() {
  let reducedMotion = false; // mouvements réduits (lot 1) : pas d'apparition « ressort » ni de rebond
  let layout = null;
  let game = null;
  let time = 0;
  let elapsed = 0;
  let prevElapsed = null;
  let speed = 1; // vitesse du jeu (env.speed) : raccourcis et accélération modérée
  let initialized = false;

  const staff = new Map(); // staffId → acteur
  const herds = new Map(); // buildingId → [animaux]
  const crows = new Map(); // plotIndex → { since, x, y, flip }
  const flying = []; // corbeaux qui s'envolent / arrivent
  const machines = new Map(); // key → { x, y, facing, moving, t, lastX, lastY, home: {x,y}, returnT }
  const walkers = []; // touristes et villageois sur la route
  const visitors = new Map(); // offerId → { x, y, kind, sprite, arrive }
  const pets = new Map(); // 'cat' | 'dog' → acteur
  let joseph = null; // { x, y, state: 'in'|'wait'|'out', reason, t, facing }
  let questKey = null;
  let festive = false;
  const tmp = { x: 0, y: 0, dx: 0 };

  function reset() {
    staff.clear();
    herds.clear();
    crows.clear();
    flying.length = 0;
    machines.clear();
    walkers.length = 0;
    visitors.clear();
    pets.clear();
    joseph = null;
    questKey = null;
    initialized = false;
    prevElapsed = null;
  }

  function shift(dy) {
    if (!dy) return;
    for (const a of staff.values()) {
      a.y += dy;
      a.homeY += dy;
      a.wy += dy;
      if (a.path) for (const p of a.path) p.y += dy;
      a.goalKey = '';
    }
    for (const list of herds.values()) for (const a of list) { a.y += dy; a.ty += dy; a.minY += dy; a.maxY += dy; }
    for (const c of crows.values()) c.y += dy;
    for (const f of flying) { f.x0 += 0; f.y0 += dy; f.y1 += dy; }
    for (const m of machines.values()) { m.y += dy; m.lastY += dy; }
    for (const w of walkers) w.y += dy;
    for (const v of visitors.values()) v.y += dy;
    for (const p of pets.values()) { p.y += dy; p.ty += dy; }
    if (joseph) joseph.y += dy;
  }

  // Bords du monde (px) : carte 2D (x0 < 0 avec des terrains à gauche), sinon 0 … largeur.
  const worldX0 = () => Math.min(0, layout?.x0 ?? 0);
  const worldX1 = () => layout?.x1 ?? layout?.width ?? 0;

  /**
   * Repères de la mini-carte : [{ kind: 'staff' | 'joseph' | 'visitor', x, y, working?, id? }] (px monde).
   */
  function markers() {
    const out = [];
    for (const a of staff.values()) if (a.visible && a.s) out.push({ kind: 'staff', id: a.id, x: a.x, y: a.y, working: !!a.working });
    if (joseph && joseph.state !== 'out') out.push({ kind: 'joseph', x: joseph.x, y: joseph.y });
    for (const v of visitors.values()) if (!v.leaving) out.push({ kind: 'visitor', id: v.id, x: v.x, y: v.y });
    return out;
  }

  // ── Points des cibles ────────────────────────────────────────────────────────────────
  function homePoint(k = 0) {
    // Devant la maison, en deux rangs (le perron puis le pied des murs), sans cacher la porte.
    const h = layout.farmerHome;
    const col = [1, 2, -1, 3, 4, -2, 5, 6][k % 8];
    return { x: h.x + col * 13, y: h.y + (k % 2 ? -7 : 1) };
  }

  /** Point (px monde, pieds) où se tient un employé pour une cible du cœur. */
  function targetPoint(target, k) {
    if (!target || !layout) return homePoint(k);
    switch (target.type) {
      case 'plot': {
        const r = layout.plotRect(target.plotIndex);
        if (!r) break;
        return { x: r.x + r.w / 2 + (k % 2 ? 3 : -3), y: r.y + r.h - 1 };
      }
      case 'building': {
        const id = target.buildingId;
        const h = layout.home;
        if (id === 'storage' && h) return { x: (h.storage.x + h.storage.w / 2) * T, y: (h.storage.y + h.storage.h) * T + 6 };
        if (id === 'roadsideStand' && h) return { x: (h.stand.x + 1) * T, y: h.stand.y * T - 2 };
        if (id === 'house') return homePoint(k);
        const s = layout.slots[id];
        if (s) {
          if (s.water) return { x: (s.dock.x + 1.5) * T, y: (s.dock.y + 1) * T };
          const b = s.building;
          const below = s.pen ? { x: (b.x + b.w / 2) * T + (k % 3 - 1) * 6, y: (b.y + b.h) * T + 8 } : { x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T + 6 };
          return below;
        }
        break;
      }
      case 'lot': {
        const l = layout.lots.find((e) => e.id === target.lotId);
        if (l) return { x: ((l.ox || 0) + 7) * T + (k % 3) * 10, y: l.lane * T + 12 };
        break;
      }
      case 'home':
      default:
        return homePoint(k);
    }
    return homePoint(k);
  }

  // ── Synchronisation ──────────────────────────────────────────────────────────────────
  function sync(g, L, t) {
    game = g;
    layout = L;
    time = t;
    const st = g.state;
    const c = st.career || {};
    elapsed = st.time?.elapsed || 0;
    syncStaff(c.staff || []);
    syncHerds(st);
    syncCrows(st.plots || []);
    syncVisitors(c.events || {});
    syncJoseph(c.quest || null);
    syncPets(c.pets || {});
    syncMachines(c.machines || {});
    festive = !!(c.events && c.events.today);
    initialized = true;
  }

  function syncStaff(list) {
    const seen = new Set();
    list.forEach((s, k) => {
      if (!s || s.id === undefined) return;
      seen.add(s.id);
      let a = staff.get(s.id);
      if (!a) {
        const hp = homePoint(k);
        a = { id: s.id, k, x: hp.x, y: hp.y, homeX: hp.x, homeY: hp.y, facing: 1, walkD: 0, pose: 'idle', tool: null, visible: true, path: [], goalKey: '', alpha: 1, jump: null, working: false, wander: rnd(0.5, 3), wx: hp.x, wy: hp.y, born: initialized ? time : -10 };
        staff.set(s.id, a);
      }
      a.k = k;
      a.s = s;
    });
    for (const id of [...staff.keys()]) if (!seen.has(id)) staff.delete(id);
  }

  function spawnAnimal(kind, area, pop, k) {
    const big = kind === 'horse';
    const w = big ? 32 : 16;
    const a = {
      kind, k,
      minX: area.x + 2, maxX: area.x + area.w - w - 2, minY: area.y + (big ? -8 : -2), maxY: area.y + area.h - (big ? 30 : 16),
      x: 0, y: 0, tx: 0, ty: 0, moving: false, wait: rnd(0.2, 2.5), phase: rnd(0, 6), facing: Math.random() < 0.5 ? 1 : -1,
      peck: 0, idleFrame: 0, idleT: 0, born: pop ? time : -10, variant: k % 2,
    };
    if (a.maxX < a.minX) a.maxX = a.minX;
    if (a.maxY < a.minY) a.maxY = a.minY;
    a.x = rnd(a.minX, a.maxX);
    a.y = rnd(a.minY, a.maxY);
    a.tx = a.x;
    a.ty = a.y;
    return a;
  }

  function syncHerds(st) {
    const seen = new Set();
    for (const [id, s] of Object.entries(layout.slots || {})) {
      if (!s.animal || (s.kind !== 'shelter' && s.kind !== 'pond')) continue;
      seen.add(id);
      const n = Math.min(MAX_ANIMALS_DRAWN, Math.max(0, st.investments?.[s.animal] || 0));
      let list = herds.get(id);
      const area = s.kind === 'pond' ? { x: s.water.x * T + 4, y: s.water.y * T + 6, w: s.water.w * T - 8, h: s.water.h * T - 8 } : { x: (s.pen.x + 1) * T, y: (s.pen.y + 1) * T, w: (s.pen.w - 2) * T, h: (s.pen.h - 2) * T };
      if (!list || list.area.x !== area.x || list.area.y !== area.y || list.area.w !== area.w) {
        list = [];
        list.area = area;
        herds.set(id, list);
      }
      while (list.length < n) list.push(spawnAnimal(s.animal, area, initialized, list.length));
      if (list.length > n) list.length = n;
    }
    for (const id of [...herds.keys()]) if (!seen.has(id)) herds.delete(id);
  }

  function syncCrows(plots) {
    for (let i = 0; i < plots.length; i++) {
      const on = !!plots[i]?.crow;
      const had = crows.get(i);
      if (on && !had) {
        const r = layout.plotRect(i);
        if (!r) continue;
        const flip = tileHash(i, 3, 17) < 0.5;
        const cr = { since: time, x: r.x + 8 + Math.floor(tileHash(i, 1, 9) * 8), y: r.y + 4 + Math.floor(tileHash(i, 2, 9) * 6), flip };
        crows.set(i, cr);
        if (initialized) flying.push({ x0: cr.x + (flip ? -70 : 70), y0: cr.y - 90, x1: cr.x, y1: cr.y, t: 0, life: 0.9, landing: true, plot: i, flip });
      } else if (!on && had) {
        crows.delete(i);
        if (initialized) flying.push({ x0: had.x, y0: had.y, x1: had.x + (had.flip ? -90 : 90), y1: had.y - 110, t: 0, life: 1.3, landing: false, flip: !had.flip });
      }
    }
    for (const i of [...crows.keys()]) if (i >= plots.length) crows.delete(i);
  }

  function syncVisitors(ev) {
    const seen = new Set();
    const h = layout.home;
    if (!h) return;
    const road = (h.roadY + 1) * T + 6;
    let k = 0;
    for (const o of ev.offers || []) {
      if (!o || o.accepted || o.delivered === true) continue;
      seen.add(o.id);
      if (!visitors.has(o.id)) {
        const kind = o.kind;
        // Sous la route, en file devant l'étal (la bulle tient sur la route, sans cacher le panneau).
        const spot = kind === 'pet'
          ? { x: (h.house.door.x + 3) * T + 4, y: (h.y0 + 6) * T + 14 }
          : { x: h.stand.x * T - 8 - k * 18, y: (h.roadY + 2) * T + 13 };
        const sprite = kind === 'pet' ? (o.data?.petId === 'dog' ? 'pet.dog' : 'pet.cat') : kind === 'merchant' ? 'npc.visitor.3' : VISITOR_SPRITES[Math.floor(tileHash(String(o.id).length, k, 5) * 2)];
        // Déjà là au chargement de la partie ; sinon il arrive par la route.
        visitors.set(o.id, { id: o.id, kind, sprite, x: kind === 'pet' || !initialized ? spot.x : worldX0() - 24, y: spot.y, tx: spot.x, ty: spot.y, facing: 1, walkD: 0, cropId: o.data?.cropId || null });
      }
      k++;
    }
    for (const [id, v] of [...visitors]) {
      if (seen.has(id)) continue;
      if (!v.leaving) { v.leaving = true; v.tx = worldX1() + 24; v.facing = 1; }
    }
    // Touristes (événement au hasard) et villageois des jours de fête : promeneurs sur la route.
    const want = (ev.active?.kind === 'tourists' || ev.active?.id === 'tourists' ? 3 : 0) + (ev.today ? 3 : 0);
    while (walkers.filter((w) => !w.leaving).length < want) {
      const n = walkers.length;
      const dir = n % 2 ? -1 : 1;
      walkers.push({ x: !initialized ? (2 + n * 3.5) * T : dir > 0 ? worldX0() - 20 - n * 30 : worldX1() + 20 + n * 30, y: road - 2 + (n % 3) * 5, dir, sprite: VISITOR_SPRITES[n % 3], walkD: 0, pause: 0, leaving: false, stopX: rnd(3, 11) * T });
    }
    let alive = walkers.filter((w) => !w.leaving).length;
    for (const w of walkers) {
      if (alive <= want) break;
      if (!w.leaving) { w.leaving = true; alive--; }
    }
  }

  function syncJoseph(q) {
    const key = q ? `${q.id}:${q.accepted ? 1 : 0}` : null;
    if (key === questKey) return;
    questKey = key;
    if (q && !q.accepted) callJoseph('quest');
    else if (joseph && joseph.reason === 'quest') leaveJoseph(0.6);
  }

  function josephSpot() {
    const h = layout.home;
    const d = h.house.door;
    return { x: (d.x + 2) * T + 4, y: (h.lane) * T + 13 };
  }

  function callJoseph(reason, stay = Infinity) {
    const spot = josephSpot();
    const road = (layout.home.roadY + 1) * T + 6;
    if (!joseph && !initialized) joseph = { x: spot.x, y: spot.y, route: [spot], d: 0, state: 'wait', reason, t: 0, stay, facing: -1, walkD: 0 };
    else if (!joseph) joseph = { x: worldX0() - 20, y: road, route: [{ x: worldX0() - 20, y: road }, { x: layout.farmerHome.x - 20, y: road }, { x: spot.x, y: road }, spot], d: 0, state: 'in', reason, t: 0, stay, facing: 1, walkD: 0 };
    else {
      joseph.reason = reason;
      joseph.stay = stay;
      if (joseph.state === 'out') {
        joseph.route = [{ x: joseph.x, y: joseph.y }, { x: spot.x, y: road }, spot];
        joseph.d = 0;
        joseph.state = 'in';
      }
    }
  }

  function leaveJoseph(delay = 0) {
    if (!joseph) return;
    joseph.leaveIn = delay;
  }

  function syncPets(p) {
    for (const id of ['cat', 'dog']) {
      if (p[id] && !pets.has(id)) {
        const hp = layout.farmerHome;
        pets.set(id, { id, x: hp.x + (id === 'cat' ? 26 : -26), y: hp.y + 4, tx: hp.x, ty: hp.y, wait: rnd(1, 3), moving: false, facing: 1, walkD: 0, born: initialized ? time : -10, sit: 0 });
      } else if (!p[id] && pets.has(id)) pets.delete(id);
    }
  }

  function syncMachines(ms) {
    for (const key of [...machines.keys()]) if (!ms[key]) machines.delete(key);
    for (const [key, m] of Object.entries(ms)) {
      if (!m) continue;
      const park = layout.machineParking?.[key];
      if (!park) continue;
      let a = machines.get(key);
      if (!a) {
        a = { key, id: m.id, x: park.x, y: park.y, lastX: park.x, lastY: park.y, facing: -1, moving: false, frameD: 0, bounce: 0, returnFrom: null, returnT: 0 };
        machines.set(key, a);
      }
      a.park = park;
      a.on = m.on !== false;
    }
  }

  // ── Mise à jour ─────────────────────────────────────────────────────────────────────
  function update(dt, env) {
    time += dt;
    const e = env?.elapsed ?? elapsed;
    let gdt = prevElapsed === null ? 0 : e - prevElapsed;
    if (gdt < 0) gdt = e; // nouvelle journée
    gdt = Math.min(2, Math.max(0, gdt));
    prevElapsed = e;
    elapsed = e;
    speed = Number.isFinite(env?.speed) ? env.speed : speed;
    for (const a of staff.values()) updateStaff(a, dt);
    for (const list of herds.values()) for (const a of list) updateAnimal(a, dt);
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt;
      if (f.t >= f.life) flying.splice(i, 1);
    }
    updateVisitors(dt);
    updateJoseph(dt);
    for (const p of pets.values()) updatePet(p, dt);
    updateMachines(dt, gdt);
  }

  /**
   * Avance l'employé vers (tx, ty) au pas tranquille, le long d'un chemin (a.path) recalculé quand le but change.
   * Trop loin pour y arriver à temps sans courir (retard > JUMP_DIST, ou temps réel disponible trop court) :
   * « raccourci doux » — il s'efface, puis réapparaît un peu avant le but et finit à pied. Renvoie true s'il marche.
   * @param avail secondes RÉELLES avant la fin de la tâche (Infinity : pas d'échéance)
   */
  function walkToward(a, tx, ty, dt, avail) {
    const key = `${Math.round(tx)},${Math.round(ty)}`;
    if (key !== a.goalKey) {
      a.goalKey = key;
      a.path = Math.hypot(tx - a.x, ty - a.y) > 1 ? layout.route({ x: a.x, y: a.y }, { x: tx, y: ty }) : [];
      if (!a.path.length || Math.hypot(a.path[a.path.length - 1].x - tx, a.path[a.path.length - 1].y - ty) > 0.5) a.path.push({ x: tx, y: ty });
    }
    // Mouvements réduits : pas de trajet dessiné, l'employé est à sa tâche.
    if (reducedMotion) {
      a.x = tx;
      a.y = ty;
      a.path.length = 0;
      a.alpha = 1;
      a.jump = null;
      return false;
    }
    const left = remaining(a, tx, ty);
    if (left <= 0.5 && !a.jump) {
      a.path.length = 0;
      return false;
    }
    const base = STAFF_WALK * paceFactor(speed);
    // Vitesse : le pas tranquille, un peu plus vif (×STAFF_HURRY au plus) si l'heure presse ; au-delà, raccourci doux.
    const need = Number.isFinite(avail) && avail > 0 ? left / (avail * 0.8) : 0;
    const v = Math.min(base * STAFF_HURRY, Math.max(base, need));
    if (!a.jump && (left > JUMP_DIST || need > base * STAFF_HURRY) && left > JUMP_MIN) {
      a.jump = { t: 0, done: false };
      a.jumps = (a.jumps || 0) + 1;
    }
    let step = v * dt;
    if (a.jump) {
      a.jump.t += dt;
      if (!a.jump.done) {
        a.alpha = Math.max(0, 1 - a.jump.t / FADE_S);
        if (a.jump.t >= FADE_S) {
          // Réapparaît à JUMP_LAND px du but (le long du chemin), puis finit à pied.
          placeAlong(a, Math.min(JUMP_LAND, remaining(a, tx, ty)));
          a.jump.done = true;
          a.jump.t = 0;
          step = 0;
        }
      } else {
        a.alpha = Math.min(1, a.jump.t / FADE_S);
        if (a.alpha >= 1) a.jump = null;
      }
    } else a.alpha = 1;
    if (step <= 0) return true;
    const prevX = a.x;
    let rest = step;
    while (rest > 0 && a.path.length) {
      const n = a.path[0];
      const d = Math.hypot(n.x - a.x, n.y - a.y);
      if (d <= rest) {
        a.x = n.x;
        a.y = n.y;
        rest -= d;
        a.path.shift();
      } else {
        a.x += ((n.x - a.x) / d) * rest;
        a.y += ((n.y - a.y) / d) * rest;
        rest = 0;
      }
    }
    if (Math.abs(a.x - prevX) > 0.05) a.facing = a.x > prevX ? 1 : -1;
    // Cadence des pas liée à la distance parcourue (une bascule tous les STEP_PX px) : jamais à l'image près.
    a.walkD += step - rest;
    return step - rest > 0;
  }

  /** Distance restante le long du chemin. */
  function remaining(a, tx, ty) {
    let d = 0;
    let px = a.x;
    let py = a.y;
    for (const n of a.path) {
      d += Math.hypot(n.x - px, n.y - py);
      px = n.x;
      py = n.y;
    }
    return a.path.length ? d : Math.hypot(tx - a.x, ty - a.y);
  }

  /** Place l'acteur sur son chemin à `left` px de la fin (retire les points dépassés). */
  function placeAlong(a, left) {
    const pts = [{ x: a.x, y: a.y }, ...a.path];
    const total = polyLength(pts);
    pointAlong(pts, Math.max(0, total - left), tmp);
    let acc = 0;
    let keep = pts.length - 1;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc >= total - left - 0.01) {
        keep = i;
        break;
      }
    }
    a.path = pts.slice(keep);
    a.x = tmp.x;
    a.y = tmp.y;
    if (Math.abs(tmp.dx) > 0.5) a.facing = tmp.dx > 0 ? 1 : -1;
  }

  const walkPose = (a) => (Math.floor(a.walkD / STEP_PX) % 2 ? 'walk' : 'walk2');

  function updateStaff(a, dt) {
    const s = a.s;
    a.visible = !!s && !s.onLeave;
    if (!a.visible) return;
    const task = s.task;
    const hp = homePoint(a.k);
    a.homeX = hp.x;
    a.homeY = hp.y;
    const rate = Math.max(1e-6, speed * GAME_SECONDS_PER_REAL_SECOND); // secondes de jeu par seconde réelle
    if (!task || task.kind === 'home' && elapsed >= task.doneAt) {
      // Flânerie près de la maison (temps réel : décor).
      a.tool = s.job ? JOB_TOOL[s.job] || null : null;
      if (task && task.kind === 'home') a.tool = null;
      a.working = false;
      const moving = walkToward(a, a.wx, a.wy, dt, Infinity);
      if (moving) a.pose = walkPose(a);
      else {
        a.pose = 'idle';
        a.wander -= dt;
        if (a.wander <= 0) {
          a.wander = rnd(2.5, 7);
          a.wx = a.homeX + rnd(-22, 22);
          a.wy = a.homeY + rnd(-3, 5);
        }
      }
      return;
    }
    a.wx = a.homeX;
    a.wy = a.homeY;
    const to = targetPoint(task.target, a.k);
    const before = elapsed < task.startAt;
    const avail = (task.doneAt - elapsed) / rate;
    const moving = before ? false : walkToward(a, to.x, to.y, dt, task.kind === 'idle' ? Infinity : avail);
    const arrived = !moving && !a.jump && Math.hypot(a.x - to.x, a.y - to.y) <= 1;
    if (moving) {
      a.pose = walkPose(a);
      a.tool = TOOL_OF[task.kind] || (s.job ? JOB_TOOL[s.job] : null) || null;
      a.working = false;
    } else if (arrived && !before && elapsed < task.doneAt && task.kind !== 'idle' && task.kind !== 'home') {
      a.pose = 'work';
      a.working = true;
      a.tool = task.kind === 'chase' ? null : TOOL_OF[task.kind] || (s.job ? JOB_TOOL[s.job] : null) || 'hoe';
      if (task.kind === 'chase') a.facing = Math.sin(time * 6) > 0 ? 1 : -1;
    } else {
      a.pose = 'idle';
      a.working = false;
      a.tool = task.kind === 'idle' || task.kind === 'home' ? (s.job ? JOB_TOOL[s.job] || null : null) : TOOL_OF[task.kind] || null;
    }
  }

  function updateAnimal(a, dt) {
    a.phase += dt;
    if (a.moving) {
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const d = Math.hypot(dx, dy);
      let speed = ANIMAL_SPEED[a.kind] || 10;
      if (a.kind === 'rabbit') speed *= Math.sin(a.phase * HOP_RATE.rabbit * Math.PI) > 0 ? 2 : 0.1; // bonds
      const step = speed * dt;
      if (d <= step) {
        a.x = a.tx;
        a.y = a.ty;
        a.moving = false;
        a.wait = a.kind === 'hen' || a.kind === 'rabbit' ? rnd(0.4, 2.2) : rnd(1.5, 5);
        a.idleFrame = 0;
        a.idleT = rnd(0.5, 2);
      } else {
        a.x += (dx / d) * step;
        a.y += (dy / d) * step;
        if (Math.abs(dx) > 0.3) a.facing = dx > 0 ? 1 : -1;
      }
    } else {
      a.wait -= dt;
      a.idleT -= dt;
      if (a.idleT <= 0) {
        a.idleT = rnd(0.8, 2.5);
        a.idleFrame = (a.kind === 'pig' || a.kind === 'horse') && Math.random() < 0.55 ? 1 : 0;
      }
      if (a.kind === 'hen') {
        if (a.peck > 0) a.peck -= dt;
        else if (Math.random() < dt * 0.9) a.peck = 0.35;
      }
      if (a.wait <= 0) {
        const range = a.kind === 'hen' || a.kind === 'rabbit' ? 22 : 30;
        a.tx = Math.max(a.minX, Math.min(a.maxX, a.x + rnd(-range, range)));
        a.ty = Math.max(a.minY, Math.min(a.maxY, a.y + rnd(-range * 0.6, range * 0.6)));
        a.moving = true;
        a.peck = 0;
        a.idleFrame = 0;
      }
    }
  }

  function stepTo(o, tx, ty, speed, dt) {
    const dx = tx - o.x;
    const dy = ty - o.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step) {
      o.x = tx;
      o.y = ty;
      return true;
    }
    o.x += (dx / d) * step;
    o.y += (dy / d) * step;
    if (Math.abs(dx) > 0.3) o.facing = dx > 0 ? 1 : -1;
    o.walkD = (o.walkD || 0) + step;
    return false;
  }

  function updateVisitors(dt) {
    for (const [id, v] of [...visitors]) {
      const arrived = stepTo(v, v.tx, v.ty, v.kind === 'pet' ? 20 : 26, dt);
      v.moving = !arrived;
      if (arrived && v.leaving) visitors.delete(id);
      else if (arrived) v.facing = v.kind === 'pet' ? v.facing : 1;
    }
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i];
      if (w.pause > 0) {
        w.pause -= dt;
        continue;
      }
      w.x += w.dir * 22 * dt;
      w.walkD += 22 * dt;
      if (!w.leaving && Math.abs(w.x - w.stopX) < 1 && !w.stopped) {
        w.stopped = true;
        w.pause = rnd(1.2, 3);
      }
      const out = w.dir > 0 ? w.x > worldX1() + 30 : w.x < worldX0() - 30;
      if (out) {
        if (w.leaving) walkers.splice(i, 1);
        else {
          w.dir = -w.dir;
          w.stopped = false;
          w.stopX = rnd(3, 11) * T;
        }
      }
    }
  }

  function updateJoseph(dt) {
    const j = joseph;
    if (!j) return;
    j.t += dt;
    if (j.leaveIn !== undefined) {
      j.leaveIn -= dt;
      if (j.leaveIn <= 0 && j.state !== 'out') {
        const road = (layout.home.roadY + 1) * T + 6;
        j.route = [{ x: j.x, y: j.y }, { x: j.x, y: road }, { x: worldX0() - 30, y: road }];
        j.d = 0;
        j.state = 'out';
        delete j.leaveIn;
      }
    }
    if (j.state === 'wait') {
      if (Number.isFinite(j.stay)) {
        j.stay -= dt;
        if (j.stay <= 0) leaveJoseph(0);
      }
      j.moving = false;
      return;
    }
    const len = polyLength(j.route);
    const prevX = j.x;
    j.d = Math.min(len, j.d + 24 * dt);
    pointAlong(j.route, j.d, tmp);
    j.x = tmp.x;
    j.y = tmp.y;
    if (Math.abs(j.x - prevX) > 0.01) j.facing = j.x > prevX ? 1 : -1;
    j.walkD += 24 * dt;
    j.moving = j.d < len;
    if (!j.moving) {
      if (j.state === 'in') {
        j.state = 'wait';
        j.facing = -1;
      } else if (j.state === 'out') joseph = null;
    }
  }

  function updatePet(p, dt) {
    if (p.moving) {
      const arrived = stepTo(p, p.tx, p.ty, p.id === 'dog' ? 26 : 18, dt);
      if (arrived) {
        p.moving = false;
        p.wait = rnd(1.5, 5);
      }
      return;
    }
    p.wait -= dt;
    if (p.wait <= 0) {
      const hp = layout.farmerHome;
      p.tx = hp.x + rnd(-60, 60);
      p.ty = hp.y + rnd(-8, 8);
      if (p.id === 'dog' && Math.random() < 0.4) p.ty = (layout.home.roadY) * T - 2;
      p.moving = true;
    }
  }

  /** Passage en cours d'une machine (state.career.work.runs) à l'heure du jour. */
  function runOf(key) {
    const runs = game?.state?.career?.work?.runs;
    if (!Array.isArray(runs)) return null;
    for (const r of runs) if (r && r.key === key && Array.isArray(r.plots) && r.plots.length) return r;
    return null;
  }

  function updateMachines(dt, gdt) {
    for (const a of machines.values()) {
      const run = a.id === 'seeder' || a.id === 'harvester' || a.id === 'fruitPicker' ? runOf(a.key) : null;
      a.bounce = Math.max(0, a.bounce - dt);
      const px0 = a.x;
      const py0 = a.y;
      if (run) {
        a.run = run;
        positionOnRun(a, run);
        a.returnFrom = null;
      } else {
        a.run = null;
        if (!a.returnFrom && (Math.abs(a.x - a.park.x) > 1 || Math.abs(a.y - a.park.y) > 1)) {
          a.returnFrom = [{ x: a.x, y: a.y }, ...layout.route({ x: a.x, y: a.y }, { x: a.park.x, y: a.park.y })];
          a.returnD = 0;
        }
        if (a.returnFrom) {
          const len = polyLength(a.returnFrom);
          a.returnD = Math.min(len, a.returnD + Math.max(60, len / 1.6) * dt);
          pointAlong(a.returnFrom, a.returnD, tmp);
          a.x = tmp.x;
          a.y = tmp.y;
          if (a.returnD >= len) {
            a.returnFrom = null;
            a.x = a.park.x;
            a.y = a.park.y;
            a.facing = -1;
          }
        } else {
          a.x = a.park.x;
          a.y = a.park.y;
        }
      }
      const moved = Math.hypot(a.x - px0, a.y - py0);
      a.moving = moved > 0.05;
      if (a.moving && Math.abs(a.x - px0) > 0.05) a.facing = a.x > px0 ? 1 : -1;
      // Roues / sabots : cadence plafonnée en temps réel (≤ 8 images/s), même quand la machine file à ×4.
      a.frameD += Math.min(moved, 36 * dt) + (a.run && gdt > 0 ? 12 * dt : 0);
    }
  }

  /** Position (coin haut-gauche du sprite) d'une machine sur son passage. */
  function positionOnRun(a, run) {
    const pts = run.plots;
    const size = { w: a.park.w, h: a.park.h };
    const at = (p) => {
      const r = layout.plotRect(p.index);
      if (!r) return null;
      return { x: r.x + r.w / 2 - size.w / 2, y: r.y + r.h - size.h + 2, t: p.at };
    };
    let prev = { x: a.park.x, y: a.park.y, t: (run.startAt ?? pts[0].at) - 1.2 };
    const first = at(pts[0]);
    if (first && prev.t >= first.t) prev.t = first.t - 1.2;
    if (elapsed <= prev.t) {
      a.x = a.park.x;
      a.y = a.park.y;
      return;
    }
    for (let i = 0; i < pts.length; i++) {
      const cur = at(pts[i]);
      if (!cur) continue;
      if (elapsed <= cur.t) {
        const k = cur.t > prev.t ? (elapsed - prev.t) / (cur.t - prev.t) : 1;
        a.x = prev.x + (cur.x - prev.x) * Math.max(0, Math.min(1, k));
        a.y = prev.y + (cur.y - prev.y) * Math.max(0, Math.min(1, k));
        return;
      }
      prev = cur;
    }
    // Après la dernière parcelle : il reste sur place (le retour au garage se fait à la fin du passage).
    a.x = prev.x;
    a.y = prev.y;
  }

  // ── Dessin ──────────────────────────────────────────────────────────────────────────
  const inView = (v, x, y, w, h) => !v || (x + w >= v.x0 && x <= v.x1 && y + h >= v.y0 && y <= v.y1);

  function collect(push, view, sets) {
    const base = sets.base;
    const obj = sets.obj;
    let n = 0;
    // Animaux des abris
    for (const list of herds.values()) {
      for (const a of list) {
        const big = a.kind === 'horse';
        const w = big ? 32 : 16;
        if (!inView(view, a.x, a.y, w, w)) continue;
        let name = BASE_SPRITE[a.kind] || 'animal.chicken';
        let hop = 0;
        if (a.kind === 'rabbit') name = a.variant ? 'animal.rabbit.brown' : 'animal.rabbit.white';
        if (a.moving) {
          const up = Math.sin(a.phase * (HOP_RATE[a.kind] || 5) * Math.PI) > 0;
          if (a.kind === 'pig' || a.kind === 'horse') name = up ? `animal.${a.kind}.walk.1` : name;
          else if (a.kind === 'rabbit') name = up ? `${name}.hop` : name;
          else if (a.kind !== 'duck') hop = up ? -1 : 0;
        } else if (a.idleFrame) {
          if (a.kind === 'pig') name = 'animal.pig.sniff';
          else if (a.kind === 'horse') name = 'animal.horse.graze';
        }
        if (a.kind === 'duck') hop = Math.sin(a.phase * 2.2) > 0.4 ? -1 : 0;
        if (a.peck > 0) hop = 1;
        if (!exists(name)) name = BASE_SPRITE[a.kind] && exists(BASE_SPRITE[a.kind]) ? BASE_SPRITE[a.kind] : 'animal.chicken';
        const x = Math.round(a.x);
        const y = Math.round(a.y) + hop;
        const age = time - a.born;
        const scale = age < POP_TIME && !reducedMotion ? popScale(age / POP_TIME) : 1;
        if (scale !== 1) {
          const ww = w * scale;
          push(name, Math.round(x + (w - ww) / 2), Math.round(y + w - ww), a.y + w, base, { flipX: a.facing < 0, scale });
        } else push(name, x, y, a.y + w, base, { flipX: a.facing < 0 });
        n++;
      }
    }
    // Machines (garées ou au travail)
    for (const a of machines.values()) {
      const park = a.park;
      if (!park) continue;
      if (!inView(view, a.x - 40, a.y - 16, park.w + 80, park.h + 32)) continue;
      pushMachine(push, a, obj);
      n++;
    }
    // Employés
    for (const a of staff.values()) {
      if (!a.visible || !a.s) continue;
      if (!inView(view, a.x - 8, a.y - 16, 16, 16)) continue;
      const pose = a.pose || 'idle';
      let name = staffSprite(a.s.look || {}, pose);
      if (!exists(name)) name = staffSprite(a.s.look || {}, 'idle');
      if (!exists(name)) name = 'farmer.outfit.0';
      const bob = pose === 'work' && Math.sin(time * 16) > 0 ? 1 : 0;
      const x = Math.round(a.x) - 8;
      const y = Math.round(a.y) - 15 + bob;
      let overlay = null;
      if (a.tool) {
        const tool = pose === 'work' ? `tool.${a.tool}.work` : a.tool === 'hoe' ? 'tool.hoe.carry' : `tool.${a.tool}`;
        if (exists(tool)) overlay = tool;
      }
      const age = time - a.born;
      const scale = age < POP_TIME && !reducedMotion ? popScale(age / POP_TIME) : 1;
      if (scale !== 1) push(name, Math.round(x + (16 - 16 * scale) / 2), Math.round(y + 16 - 16 * scale), a.y + 1, base, { scale });
      else if ((a.alpha ?? 1) < 1) {
        if (a.alpha <= 0.02) continue; // raccourci doux : effacé
        push(name, x, y, a.y + 1, base, { flipX: a.facing < 0, overlay, alpha: a.alpha });
      } else push(name, x, y, a.y + 1, base, { flipX: a.facing < 0, overlay });
      n++;
    }
    // Corbeaux posés
    for (const [i, c] of crows) {
      if (!inView(view, c.x, c.y, 16, 16)) continue;
      const landing = flying.some((f) => f.landing && f.plot === i);
      if (landing) continue;
      const peck = Math.sin(time * 5 + i * 1.7) > 0.7 ? 1 : 0;
      const hopX = Math.sin(time * 0.7 + i) > 0.9 ? 1 : 0;
      push('bird.crow', c.x + hopX, c.y + peck, c.y + 14, base, { flipX: c.flip });
      n++;
    }
    // Corbeaux en vol
    for (const f of flying) {
      const u = Math.min(1, f.t / f.life);
      const e = f.landing ? 1 - (1 - u) * (1 - u) : u * u;
      const x = f.x0 + (f.x1 - f.x0) * e;
      const y = f.y0 + (f.y1 - f.y0) * e - (f.landing ? 0 : Math.sin(u * Math.PI) * 10);
      const frame = Math.floor(time * 12) % 2 ? 'bird.crow.fly.1' : 'bird.crow.fly.2';
      const name = f.landing && u > 0.92 ? 'bird.crow' : frame;
      push(name, Math.round(x), Math.round(y), 1e7 + y, base, { flipX: f.flip, alpha: f.landing ? 1 : Math.max(0, 1 - Math.max(0, u - 0.6) / 0.4) });
      n++;
    }
    // Visiteurs, promeneurs, Joseph, animaux de compagnie
    for (const v of visitors.values()) {
      if (!inView(view, v.x - 8, v.y - 16, 16, 16)) continue;
      let name = v.sprite;
      if (v.moving && v.kind !== 'pet' && exists(`${name}.walk`) && Math.floor((v.walkD || 0) / 5) % 2) name = `${name}.walk`;
      if (v.moving && v.kind === 'pet' && exists(`${name}.walk.1`)) name = Math.floor((v.walkD || 0) / 4) % 2 ? `${name}.walk.1` : `${name}.walk.2`;
      push(name, Math.round(v.x) - 8, Math.round(v.y) - 15, v.y + 1, base, { flipX: v.facing < 0 });
      if (!v.moving && !v.leaving) {
        // Petite bulle : ce qu'il veut (culture), la marchandise, ou « ? » pour l'animal perdu.
        const icon = v.kind === 'visitor' && v.cropId && exists(`crop.${v.cropId}.icon`) ? `crop.${v.cropId}.icon` : v.kind === 'merchant' ? 'icon.career.coins' : v.kind === 'pet' ? 'icon.career.heart' : null;
        if (icon && exists(icon)) {
          const bob = Math.sin(time * 3 + v.x) > 0.3 ? -1 : 0;
          push('@bubble', Math.round(v.x) - 9, Math.round(v.y) - 36 + bob, 1e7 + v.y, base, { icon });
        }
      }
      n++;
    }
    for (const w of walkers) {
      if (!inView(view, w.x - 8, w.y - 16, 16, 16)) continue;
      let name = w.sprite;
      if (w.pause <= 0 && Math.floor(w.walkD / 5) % 2 && exists(`${name}.walk`)) name = `${name}.walk`;
      push(name, Math.round(w.x) - 8, Math.round(w.y) - 15, w.y + 1, base, { flipX: w.dir < 0 });
      n++;
    }
    if (joseph && inView(view, joseph.x - 8, joseph.y - 16, 16, 16)) {
      let name = 'npc.joseph';
      if (joseph.moving) name = Math.floor(joseph.walkD / 5) % 2 ? 'npc.joseph.walk' : 'npc.joseph.walk2';
      push(name, Math.round(joseph.x) - 8, Math.round(joseph.y) - 15, joseph.y + 1, base, { flipX: joseph.facing < 0 });
      if (joseph.state === 'wait' && joseph.reason === 'quest') {
        const bob = Math.sin(time * 3) > 0.2 ? -1 : 0;
        push('@bubble', Math.round(joseph.x) - 9, Math.round(joseph.y) - 36 + bob, 1e7 + joseph.y, base, { icon: 'icon.career.quest' });
      }
      n++;
    }
    for (const p of pets.values()) {
      if (!inView(view, p.x - 8, p.y - 16, 16, 16)) continue;
      let name = p.id === 'dog' ? 'pet.dog' : 'pet.cat';
      if (p.moving) name = Math.floor((p.walkD || 0) / 4) % 2 ? `${name}.walk.1` : `${name}.walk.2`;
      if (!exists(name)) name = p.id === 'dog' ? 'pet.dog' : 'pet.cat';
      const age = time - p.born;
      const scale = age < POP_TIME && !reducedMotion ? popScale(age / POP_TIME) : 1;
      push(name, Math.round(p.x) - 8, Math.round(p.y) - 14, p.y + 1, base, scale !== 1 ? { flipX: p.facing < 0, scale } : { flipX: p.facing < 0 });
      n++;
    }
    lastDrawn = n;
    void festive;
  }
  let lastDrawn = 0;

  function pushMachine(push, a, obj) {
    const park = a.park;
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    const bottom = a.y + park.h;
    const facing = a.facing || -1;
    const frame = Math.floor(a.frameD / 6) % 2;
    if (a.id === 'tractor') {
      // Garé au repos ; il sort quand il tire une machine (dessiné avec elle).
      if (tractorBusy()) return;
      const name = `machine.tractor.${facing > 0 ? 'r' : 'l'}${a.moving && frame ? '.1' : ''}`;
      push(exists(name) ? name : 'machine.tractor.l', x, y, bottom, obj);
      return;
    }
    if (a.id === 'collector') {
      const b = a.bounce > 0 && !reducedMotion ? -1 : 0;
      push('machine.collector', x, y + b, bottom, obj);
      return;
    }
    if (a.id === 'waterTower') {
      push('machine.waterTower', x, y, bottom, obj);
      return;
    }
    let name = park.sprite;
    if ((a.id === 'harvester' || a.id === 'seeder') && a.run && frame && exists(`${name}.1`)) name = `${name}.1`;
    // La moissonneuse regarde à gauche (rabatteur devant) : retournée quand elle va à droite.
    push(name, x, y, bottom, obj, { flipX: a.id === 'harvester' && facing > 0 });
    // Attelage : tracteur (ou cheval) devant, dans le sens de la marche.
    const puller = a.run ? a.run.puller : null;
    if (puller && (a.moving || a.run)) {
      if (puller === 'tractor') {
        const tn = `machine.tractor.${facing > 0 ? 'r' : 'l'}${frame ? '.1' : ''}`;
        const tx = facing > 0 ? x + park.w - 6 : x - 26;
        push(exists(tn) ? tn : 'machine.tractor.l', tx, Math.round(a.y + park.h - 32), bottom + 0.2, obj);
      } else if (puller === 'horse') {
        const hn = frame ? 'animal.horse.walk.1' : 'animal.horse';
        const hx = facing > 0 ? x + park.w - 6 : x - 26;
        push(exists(hn) ? hn : 'animal.horse', hx, Math.round(a.y + park.h - 30), bottom + 0.2, obj, { flipX: facing < 0 });
      }
    }
  }

  function tractorBusy() {
    for (const m of machines.values()) if (m.run && m.run.puller === 'tractor') return true;
    return false;
  }

  // ── Toucher ──────────────────────────────────────────────────────────────────────────
  function personRect(x, y) {
    return { x: Math.round(x) - 8, y: Math.round(y) - 16, w: 16, h: 17 };
  }
  const near = (r, x, y, slop) => x >= r.x - slop && y >= r.y - slop && x < r.x + r.w + slop && y < r.y + r.h + slop;

  function hitTest(wx, wy, slop = 0) {
    // Corbeaux d'abord : toucher la parcelle chasse le corbeau.
    for (const [i] of crows) {
      const r = layout?.plotRect(i);
      if (r && near(r, wx, wy, 0)) return { type: 'crow', plotIndex: i };
    }
    let best = null;
    let bestD = Infinity;
    const consider = (r, hit) => {
      if (!near(r, wx, wy, slop)) return;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const d = Math.hypot(wx - cx, wy - cy);
      if (d < bestD) { bestD = d; best = hit; }
    };
    if (joseph && joseph.state !== 'out') consider(personRect(joseph.x, joseph.y), { type: 'joseph' });
    for (const v of visitors.values()) if (!v.leaving) consider(personRect(v.x, v.y), { type: 'visitor', offerId: v.id, kind: v.kind });
    for (const a of staff.values()) if (a.visible && a.s) consider(personRect(a.x, a.y), { type: 'employee', staffId: a.id });
    return best;
  }

  function rectOf(hit) {
    if (!hit) return null;
    if (hit.type === 'employee') {
      const a = staff.get(hit.staffId);
      return a ? personRect(a.x, a.y) : null;
    }
    if (hit.type === 'joseph') return joseph ? personRect(joseph.x, joseph.y) : null;
    if (hit.type === 'visitor') {
      const v = visitors.get(hit.offerId);
      return v ? personRect(v.x, v.y) : null;
    }
    if (hit.type === 'crow') return layout?.plotRect(hit.plotIndex) || null;
    return null;
  }

  function onEvent(type, payload = {}) {
    if (!layout) return;
    switch (type) {
      case 'questDone':
      case 'josephHeart':
        callJoseph('visit', 5);
        break;
      case 'machineWorked': {
        if (payload.kind === 'collect') {
          const a = machines.get(payload.key);
          if (a) a.bounce = 0.6;
        }
        break;
      }
      default:
        break;
    }
  }

  function stats() {
    let animals = 0;
    for (const l of herds.values()) animals += l.length;
    return { staff: staff.size, animals, crows: crows.size, flying: flying.length, machines: machines.size, walkers: walkers.length, visitors: visitors.size, joseph: !!joseph, drawn: lastDrawn };
  }

  function setReducedMotion(on) {
    reducedMotion = !!on;
  }
  /** Mesures (QA du rythme) : position, pose et opacité des employés, des visiteurs, de Joseph et d'un animal par troupeau. */
  function probe() {
    const out = { staff: [], animals: [], visitors: [], joseph: joseph ? { x: joseph.x, y: joseph.y, moving: !!joseph.moving } : null };
    for (const [id, a] of staff) if (a.visible) out.staff.push({ id, x: a.x, y: a.y, pose: a.pose, alpha: a.alpha ?? 1, working: !!a.working, walkD: a.walkD || 0, jumps: a.jumps || 0 });
    for (const list of herds.values()) if (list[0]) out.animals.push({ kind: list[0].kind, x: list[0].x, y: list[0].y, moving: !!list[0].moving });
    for (const [id, v] of visitors) out.visitors.push({ id, x: v.x, y: v.y, moving: !!v.moving });
    for (const w of walkers) out.visitors.push({ id: 'walker', x: w.x, y: w.y, moving: !(w.pause > 0) });
    return out;
  }

  return { reset, shift, sync, update, collect, hitTest, rectOf, onEvent, stats, markers, probe, setReducedMotion, get joseph() { return joseph; } };
}
