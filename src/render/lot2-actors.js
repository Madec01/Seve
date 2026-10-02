// Surprises de l'aube et trouvailles du défrichage dans la scène (lot 2 « Toucher & surprises », B4 et B6).
//
// createLot2Actors(effects) → actors
//   actors.setImages(images)            planches (sprites du lot 2 : peuvent manquer, tout est gardé)
//   actors.setReducedMotion(on)         pas de vol de la fée (elle apparaît et s'efface sur place), le renard
//                                       arrive déjà assis, le hérisson reste tranquille, pas de « ressort »
//   actors.sync(game, layout, info)     état durable (state.surprises) : renard installé (carrière), hérisson
//                                       (niveaux à maladie) ; info = { day, dayProgress, career }
//   actors.onEvent(type, payload, layout)   'surprise' | 'forage' | 'foragePicked' | 'finds'
//   actors.update(dt)
//   actors.draw(ctx)                    contexte translaté en coordonnées du monde (après les objets)
//   actors.clear(), actors.shift(dx, dy), actors.stats()
//
// Animations (toutes douces, aucune ne bloque le jeu) :
//   fée       vole en boucle au-dessus du carré 3 × 3 mûri, traînée d'étincelles, puis s'élève et s'efface ;
//   renard    entre par le côté du champ, trotte jusqu'à la maison et s'assoit (dort le soir) tant qu'il reste ;
//   coffre    tombe près de la maison avec un éclat, s'ouvre (pièces ou écus qui jaillissent), puis s'efface ;
//   hérisson  se promène tranquillement dans le champ (pauses, petits pas) tant qu'il garde le potager ;
//   chouette  sculptée : apparaît près de la maison dans un nuage d'étincelles, reste toute la journée ;
//   cercle    de champignons : la parcelle scintille (le cercle lui-même est dessiné par scene.js) ;
//   trouvailles (carrière) : sur le terrain défriché, chaque trouvaille sort d'une souche et saute en l'air.

import { TILE, SPRITES, drawSprite } from './atlas.js';
import { canDraw } from './effects.js';

const OUTLINE = '#3f2631';
const FOX_NAMES = { idle: ['animal.fox', 'fox'], walk: ['animal.fox.walk.1', 'animal.fox'], sit: ['animal.fox.sit', 'animal.fox', 'fox'], sleep: ['animal.fox.sleep', 'animal.fox.sit', 'animal.fox', 'fox'] };
const HOG_NAMES = { idle: ['animal.hedgehog', 'hedgehog'], walk: ['animal.hedgehog.walk.1', 'animal.hedgehog', 'hedgehog'] };
const FIND_SPRITES = { chest: 'find.chest', well: 'find.well', statue: 'find.statue', coins: 'find.coins', seedjar: 'find.seedjar', lamb: 'find.lostlamb' };

const rand = (a, b) => a + Math.random() * (b - a);

export function createLot2Actors(effects) {
  let images = null;
  let reduced = false;
  const items = []; // animations passagères : { kind, t, life, … }
  const fox = { on: false, x: 0, y: 0, tx: 0, ty: 0, mode: 'sit', facing: 1, t: 0, fade: 1, seen: false };
  const hog = { on: false, x: 0, y: 0, tx: 0, ty: 0, wait: 0, facing: 1, t: 0, fade: 1, step: 0 };
  let owl = null; // { x, y, day, t }
  let dayNow = 0;
  let night = false;
  let lastLayout = null;

  const pick = (names) => {
    for (const n of names) if (canDraw(images, n)) return n;
    return null;
  };

  // ── Repères ────────────────────────────────────────────────────────────────────
  function houseSpots(layout) {
    const h = layout.house || (layout.home && layout.home.house);
    const e = layout.essential || { x: 0, w: layout.width || 9999 };
    const clampX = (x) => Math.max(e.x + 4, Math.min(e.x + e.w - 20, x));
    const f = layout.lots ? null : layout.fieldRect;
    if (h) {
      const x1 = (h.x + h.w) * TILE;
      const yb = (h.y + h.h) * TILE;
      // Renard : assis au pied de la clôture du champ (côté maison), sinon à droite de la maison.
      const fox = f ? { x: clampX(f.x - 20), y: f.y + f.h - 22 } : { x: clampX(x1 + 34), y: yb - 14 };
      return { fox, chest: { x: clampX(x1 + 2), y: yb - 14 }, owl: { x: clampX(x1 + 18), y: yb - 30 } };
    }
    const g = layout.fieldRect || { x: 0, y: 0, w: 160, h: 100 };
    return { fox: { x: clampX(g.x - 18), y: g.y + g.h - 16 }, chest: { x: clampX(g.x + g.w + 4), y: g.y + g.h - 16 }, owl: { x: clampX(g.x + g.w + 4), y: g.y } };
  }

  function rectOfPlots(layout, plots) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const i of plots || []) {
      const r = layout.plotRect?.(i);
      if (!r) continue;
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.h);
    }
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function fieldBox(layout) {
    if (layout.fieldRect && !layout.lots) return layout.fieldRect;
    // Carrière : le premier terrain cultivé visible (parcelles), sinon la cour.
    const p = layout.plots?.find?.((q) => !q.retired);
    if (p && layout.lots) {
      const lot = layout.lots.find((l) => l.rect && p.x >= l.rect.x && p.x < l.rect.x + l.rect.w && p.y >= l.rect.y && p.y < l.rect.y + l.rect.h);
      if (lot) return lot.rect;
    }
    return layout.fieldRect || layout.homeRect || { x: 0, y: 0, w: 200, h: 120 };
  }

  // ── État durable ──────────────────────────────────────────────────────────────
  function sync(game, layout, info = {}) {
    lastLayout = layout;
    const s = game?.state?.surprises;
    dayNow = info.day ?? 0;
    night = (info.dayProgress ?? 0.5) > 0.84;
    const spots = houseSpots(layout);
    const foxOn = !!(s && s.fox);
    if (foxOn && !fox.on) {
      fox.on = true;
      fox.tx = spots.fox.x;
      fox.ty = spots.fox.y;
      if (!fox.seen) {
        // Rechargement d'une partie : le renard est déjà là, assis.
        fox.x = fox.tx;
        fox.y = fox.ty;
        fox.mode = 'sit';
        fox.fade = 1;
      }
    } else if (!foxOn && fox.on) {
      fox.on = false;
    }
    if (fox.on && fox.mode === 'sit') {
      // La disposition a pu changer (carrière : la ferme grandit).
      fox.tx = spots.fox.x;
      fox.ty = spots.fox.y;
      fox.x = fox.tx;
      fox.y = fox.ty;
    }
    const hogOn = !!(s && s.hedgehog);
    if (hogOn && !hog.on) {
      hog.on = true;
      const f = fieldBox(layout);
      hog.x = f.x + f.w * 0.5;
      hog.y = f.y + f.h * 0.6;
      hog.tx = hog.x;
      hog.ty = hog.y;
      hog.wait = 0.5;
      hog.fade = reduced ? 1 : 0;
    } else if (!hogOn && hog.on) hog.on = false;
    if (owl && owl.day !== dayNow) owl = null;
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function onEvent(type, p = {}, layout) {
    if (!layout) return;
    lastLayout = layout;
    const k = layout.plotScale || 1;
    switch (type) {
      case 'surprise': {
        const spots = houseSpots(layout);
        switch (p.kind) {
          case 'fairy': {
            const r = rectOfPlots(layout, p.plots) || (p.center !== undefined ? layout.plotRect?.(p.center) : null);
            if (!r) break;
            items.push({ kind: 'fairy', t: 0, life: reduced ? 2.4 : 4.2, r, x: r.x - 20, y: r.y - 10, trail: 0, frame: 0 });
            break;
          }
          case 'fox': {
            fox.on = true;
            fox.seen = true;
            fox.tx = spots.fox.x;
            fox.ty = spots.fox.y;
            if (reduced) {
              fox.x = fox.tx;
              fox.y = fox.ty;
              fox.mode = 'sit';
              fox.fade = 0;
            } else {
              const f = fieldBox(layout);
              fox.x = f.x - 30;
              fox.y = Math.min(fox.ty, f.y + f.h - 12);
              fox.mode = 'walk';
              fox.fade = 1;
              // Il arrive en 4 s au plus, même de loin (carrière : la maison peut être loin du champ).
              fox.speed = Math.max(26, Math.hypot(fox.tx - fox.x, fox.ty - fox.y) / 4);
            }
            break;
          }
          case 'chest': {
            const s = spots.chest;
            items.push({ kind: 'chest', t: 0, life: 5, x: s.x, y: s.y, amount: p.amount || 0, ecus: p.ecus || 0, opened: false });
            effects.sparkle({ x: s.x - 4, y: s.y - 4, w: 24, h: 20 }, 10, 'gold', 0);
            break;
          }
          case 'hedgehog': {
            const f = fieldBox(layout);
            hog.on = true;
            hog.x = f.x + f.w * 0.3;
            hog.y = f.y + f.h * 0.7;
            hog.tx = hog.x;
            hog.ty = hog.y;
            hog.wait = 0.8;
            hog.fade = reduced ? 1 : 0;
            effects.sparkle({ x: hog.x - 6, y: hog.y - 6, w: 20, h: 16 }, 8, 'gold', 0.1);
            break;
          }
          case 'owl': {
            const s = spots.owl;
            owl = { x: s.x, y: s.y, day: dayNow, t: 0 };
            effects.sparkle({ x: s.x - 6, y: s.y - 4, w: 28, h: 40 }, 18, 'gold', 0);
            effects.ring?.(s.x + 8, s.y + 30, 2, 14, '#ffe27a', 0.6, 0, 0.45, 1);
            break;
          }
          case 'ring': {
            const r = layout.plotRect?.(p.plotIndex);
            if (!r) break;
            effects.sparkle(r, 14, 'gold', 0.1);
            effects.ring?.(r.x + r.w / 2, r.y + r.h * 0.6, 2 * k, 12 * k, '#ffd6f0', 0.7, 0.1, 0.5, k);
            break;
          }
          default:
            break;
        }
        break;
      }
      case 'forage':
        (p.plots || []).forEach((i, j) => {
          const r = layout.plotRect?.(i);
          if (r) effects.sparkle(r, 5 * k, 'gold', 0.1 + j * 0.12);
        });
        break;
      case 'foragePicked': {
        const r = layout.plotRect?.(p.plotIndex);
        if (!r) break;
        const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        const name = p.kind === 'ring' ? 'mushroom.ring' : pick(['mushrooms', 'mushroom', 'mushroom.ring']);
        if (name && canDraw(images, name)) effects.harvestPop?.(r, name, k, 'normal');
        effects.burst?.(c.x, c.y - 4 * k, p.kind === 'ring' ? 14 : 8, 'gold', 30, 0.04, k);
        effects.coins(c.x, c.y - 4 * k, 2);
        if (p.amount) effects.floatText(c.x, c.y - 10 * k, `+${p.amount}`, '#ffe27a');
        break;
      }
      case 'finds': {
        const r = layout.lotRect?.(p.lotId);
        if (!r) break;
        (p.finds || []).forEach((f, j) => {
          // Une souche au hasard dans le terrain (loin des bords), la trouvaille en sort.
          const x = r.x + TILE * 2 + Math.random() * Math.max(TILE, r.w - TILE * 5);
          const y = r.y + TILE * 2 + Math.random() * Math.max(TILE, r.h - TILE * 5);
          items.push({ kind: 'find', t: 0, delay: 0.7 + j * 0.55, life: 3.2, x, y, sprite: FIND_SPRITES[f.kind] || 'find.chest', find: f });
        });
        break;
      }
      default:
        break;
    }
  }

  // ── Mise à jour ───────────────────────────────────────────────────────────────
  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.delay > 0) {
        it.delay -= dt;
        continue;
      }
      it.t += dt;
      if (it.kind === 'fairy') updateFairy(it, dt);
      else if (it.kind === 'chest' && !it.opened && it.t > 1.1) {
        it.opened = true;
        const cx = it.x + 8;
        const cy = it.y + 4;
        effects.burst?.(cx, cy, 14, 'gold', 36, 0, 1);
        if (it.amount) {
          effects.coins(cx, cy, 8);
          effects.floatText(cx, cy - 6, `+${it.amount}`, '#ffe27a', { icon: true, life: 2.2, size: 1.1 });
        } else if (it.ecus) {
          effects.floatText(cx, cy - 6, `+${it.ecus} écus`, '#fff3b0', { icon: false, life: 2.4, size: 1.1 });
        }
      } else if (it.kind === 'find' && !it.popped && it.t > 0.35) {
        it.popped = true;
        effects.dirt(it.x + 8, it.y + 12, 10, 1);
        effects.burst?.(it.x + 8, it.y + 4, 12, 'gold', 34, 0, 1);
        effects.sparkle({ x: it.x - 2, y: it.y - 16, w: 20, h: 22 }, 8, 'gold', 0.2);
      }
      if (it.t >= it.life) items.splice(i, 1);
    }
    if (fox.on) updateFox(dt);
    if (hog.on) updateHog(dt);
    if (owl) owl.t += dt;
  }

  function updateFairy(it, dt) {
    const r = it.r;
    const u = it.t / it.life;
    if (reduced) {
      it.x = r.x + r.w / 2 - 8;
      it.y = r.y + r.h / 2 - 12;
    } else if (u < 0.75) {
      // Boucles en huit au-dessus du carré.
      const a = (it.t / (it.life * 0.75)) * Math.PI * 4;
      it.x = r.x + r.w / 2 - 8 + Math.sin(a) * r.w * 0.42;
      it.y = r.y + r.h / 2 - 14 + Math.sin(a * 2) * r.h * 0.28 - Math.cos(a * 0.5) * 4;
    } else {
      it.y -= dt * 40;
      it.x += dt * 18;
    }
    it.frame = Math.floor(it.t * 12) % 3;
    it.trail -= dt;
    if (it.trail <= 0) {
      it.trail = reduced ? 0.25 : 0.05;
      effects.sparkle({ x: it.x + 4, y: it.y + 6, w: 8, h: 6 }, reduced ? 2 : 1, 'gold', 0);
    }
    if (!it.burstDone && u > 0.72) {
      it.burstDone = true;
      effects.sparkle(r, 18, 'gold', 0);
      effects.ring?.(r.x + r.w / 2, r.y + r.h / 2, 4, Math.max(r.w, r.h) * 0.6, '#ffe27a', 0.8, 0, 0.5, 1);
    }
  }

  function updateFox(dt) {
    fox.t += dt;
    if (fox.fade < 1 && fox.mode === 'sit') fox.fade = Math.min(1, fox.fade + dt * 1.5);
    if (fox.mode !== 'walk') return;
    const dx = fox.tx - fox.x;
    const dy = fox.ty - fox.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) {
      fox.x = fox.tx;
      fox.y = fox.ty;
      fox.mode = 'sit';
      effects.sparkle({ x: fox.x, y: fox.y - 2, w: 16, h: 10 }, 4, 'gold', 0);
      return;
    }
    const v = (fox.speed || 26) * dt;
    fox.x += (dx / d) * Math.min(v, d);
    fox.y += (dy / d) * Math.min(v, d);
    fox.facing = dx >= 0 ? 1 : -1;
  }

  function updateHog(dt) {
    hog.t += dt;
    if (hog.fade < 1) hog.fade = Math.min(1, hog.fade + dt * 1.2);
    if (reduced) return;
    if (hog.wait > 0) {
      hog.wait -= dt;
      if (hog.wait <= 0 && lastLayout) {
        const f = fieldBox(lastLayout);
        hog.tx = Math.max(f.x + 6, Math.min(f.x + f.w - 22, hog.x + rand(-50, 50)));
        hog.ty = Math.max(f.y + 10, Math.min(f.y + f.h - 20, hog.y + rand(-30, 30)));
      }
      return;
    }
    const dx = hog.tx - hog.x;
    const dy = hog.ty - hog.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      hog.wait = rand(1.2, 3.2);
      return;
    }
    const v = 9 * dt;
    hog.x += (dx / d) * Math.min(v, d);
    hog.y += (dy / d) * Math.min(v, d);
    hog.facing = dx >= 0 ? 1 : -1;
    hog.step += dt;
  }

  // ── Dessin ────────────────────────────────────────────────────────────────────
  function sprite(ctx, name, x, y, opts) {
    if (!name || !canDraw(images, name)) return false;
    drawSprite(ctx, images, name, Math.round(x), Math.round(y), opts);
    return true;
  }

  /** Petite fée de secours (si le dessin manque) : corps lumineux, ailes qui battent. */
  function fairyFallback(ctx, x, y, frame) {
    const cx = Math.round(x + 8);
    const cy = Math.round(y + 8);
    ctx.fillStyle = 'rgba(255,243,176,0.45)';
    ctx.fillRect(cx - 3, cy - 3, 7, 7);
    ctx.fillStyle = frame === 1 ? '#d8f0ff' : '#ffffff';
    const w = frame === 2 ? 1 : 2;
    ctx.fillRect(cx - 1 - w * 2, cy - 2, w * 2, 2);
    ctx.fillRect(cx + 2, cy - 2, w * 2, 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - 1, cy - 2, 3, 5);
    ctx.fillStyle = '#ffd6e8';
    ctx.fillRect(cx, cy - 1, 1, 3);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(cx, cy - 4, 1, 1);
  }

  function shadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(40,24,32,0.22)';
    ctx.fillRect(Math.round(x + 3), Math.round(y + 14), w - 6, 2);
  }

  function draw(ctx) {
    // Renard
    if (fox.on) {
      const walking = fox.mode === 'walk';
      const names = walking ? (Math.floor(fox.t * 8) % 2 ? FOX_NAMES.walk : FOX_NAMES.idle) : night ? FOX_NAMES.sleep : FOX_NAMES.sit;
      const n = pick(names);
      ctx.globalAlpha = fox.fade;
      shadow(ctx, fox.x, fox.y, 16);
      const hop = walking && !reduced && Math.floor(fox.t * 8) % 2 ? -1 : 0;
      if (!sprite(ctx, n, fox.x, fox.y + hop, fox.facing < 0 ? { flipX: true } : undefined)) {
        ctx.fillStyle = '#d9692c';
        ctx.fillRect(Math.round(fox.x + 3), Math.round(fox.y + 8), 9, 5);
        ctx.fillStyle = '#fff3e0';
        ctx.fillRect(Math.round(fox.x + 11), Math.round(fox.y + 11), 3, 2);
      }
      ctx.globalAlpha = 1;
    }
    // Hérisson
    if (hog.on) {
      const moving = hog.wait <= 0 && !reduced;
      const n = pick(moving && Math.floor(hog.step * 6) % 2 ? HOG_NAMES.walk : HOG_NAMES.idle);
      ctx.globalAlpha = hog.fade;
      shadow(ctx, hog.x, hog.y, 14);
      if (!sprite(ctx, n, hog.x, hog.y, hog.facing < 0 ? { flipX: true } : undefined)) {
        ctx.fillStyle = '#6b4a3a';
        ctx.fillRect(Math.round(hog.x + 4), Math.round(hog.y + 9), 8, 5);
      }
      ctx.globalAlpha = 1;
    }
    // Chouette sculptée (journée de sa découverte)
    if (owl) {
      const u = Math.min(1, owl.t / 0.5);
      ctx.globalAlpha = u;
      const dy = reduced ? 0 : Math.round((1 - u) * 6);
      if (!sprite(ctx, 'owl.carved', owl.x, owl.y + dy)) {
        ctx.fillStyle = '#9a6a3c';
        ctx.fillRect(Math.round(owl.x + 4), Math.round(owl.y + 10 + dy), 8, 18);
      }
      ctx.globalAlpha = 1;
      if (Math.floor(owl.t * 0.7) % 4 === 0 && (owl.t % 1.43) < 0.12) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(owl.x + 11), Math.round(owl.y + 6), 1, 1);
      }
    }
    for (const it of items) {
      if (it.delay > 0) continue;
      const u = it.t / it.life;
      if (it.kind === 'fairy') {
        const alpha = u < 0.08 ? u / 0.08 : u > 0.8 ? Math.max(0, (1 - u) / 0.2) : 1;
        ctx.globalAlpha = alpha;
        // Halo doux
        ctx.fillStyle = 'rgba(255,243,176,0.25)';
        ctx.fillRect(Math.round(it.x + 3), Math.round(it.y + 3), 10, 10);
        const n = pick([`fairy.${it.frame}`, 'fairy.0', 'fairy']);
        if (!sprite(ctx, n, it.x, it.y)) fairyFallback(ctx, it.x, it.y, it.frame);
        ctx.globalAlpha = 1;
      } else if (it.kind === 'chest') {
        const appear = Math.min(1, it.t / 0.35);
        const s = reduced ? 1 : appear < 1 ? 0.4 + 0.8 * appear - 0.2 * appear * appear : 1;
        const fall = reduced ? 0 : Math.round((1 - appear) * -14);
        ctx.globalAlpha = u > 0.82 ? Math.max(0, (1 - u) / 0.18) : Math.min(1, it.t / 0.15);
        const name = it.opened ? pick(['chest.old.open', 'chest.old']) : pick(['chest.old']);
        shadow(ctx, it.x, it.y, 16);
        ctx.save();
        ctx.translate(Math.round(it.x + 8), Math.round(it.y + 16 + fall));
        ctx.scale(s, s);
        if (!sprite(ctx, name, -8, -16)) {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(-7, -11, 14, 11);
          ctx.fillStyle = '#a0603a';
          ctx.fillRect(-6, -10, 12, 9);
          ctx.fillStyle = '#ffe27a';
          ctx.fillRect(-1, -7, 2, 3);
        }
        ctx.restore();
        // Éclat qui passe sur le coffre fermé
        if (!it.opened && it.t > 0.4) {
          const g = Math.floor((it.t - 0.4) * 30);
          if (g < 12) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(it.x + 2 + g), Math.round(it.y + 6), 1, 1);
            ctx.fillRect(Math.round(it.x + 3 + g), Math.round(it.y + 5), 1, 3);
          }
        }
        ctx.globalAlpha = 1;
      } else if (it.kind === 'find') {
        // La souche puis la trouvaille qui saute en l'air.
        const fade = u > 0.8 ? Math.max(0, (1 - u) / 0.2) : 1;
        ctx.globalAlpha = Math.min(1, it.t / 0.2) * fade;
        if (!sprite(ctx, 'land.stump.find', it.x, it.y)) sprite(ctx, 'stump', it.x, it.y);
        if (it.t > 0.35) {
          const v = Math.min(1, (it.t - 0.35) / 0.7);
          const jump = reduced ? 14 : Math.sin(Math.min(1, v) * Math.PI * 0.5) * 22;
          const n = pick([it.sprite, 'find.chest']);
          const w = n && SPRITES[n] ? (SPRITES[n].w || 1) * TILE : 16;
          const h = n && SPRITES[n] ? (SPRITES[n].h || 1) * TILE : 16;
          if (!sprite(ctx, n, it.x + 8 - w / 2, it.y - jump - (h - 16))) {
            ctx.fillStyle = '#ffe27a';
            ctx.fillRect(Math.round(it.x + 5), Math.round(it.y + 4 - jump), 6, 6);
          }
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  return {
    setImages(imgs) {
      images = imgs;
    },
    setReducedMotion(on) {
      reduced = !!on;
    },
    sync,
    onEvent,
    update,
    draw,
    clear() {
      items.length = 0;
      fox.on = false;
      fox.seen = false;
      hog.on = false;
      owl = null;
    },
    shift(dx, dy) {
      for (const it of items) {
        it.x += dx;
        it.y += dy;
        if (it.r) {
          it.r = { ...it.r, x: it.r.x + dx, y: it.r.y + dy };
        }
      }
      fox.x += dx; fox.y += dy; fox.tx += dx; fox.ty += dy;
      hog.x += dx; hog.y += dy; hog.tx += dx; hog.ty += dy;
      if (owl) { owl.x += dx; owl.y += dy; }
    },
    stats() {
      return { items: items.length, fox: fox.on ? fox.mode : null, hedgehog: hog.on, owl: !!owl };
    },
  };
}
