// Résonance : lecture harmonique du champ.
// Un groupe = des plantes mûres connectées orthogonalement. Le jeu y cherche
// le meilleur accord possible, et la récolte le fait sonner pour de vrai.

import { matchChord, DEGREE_INFO } from './scales.js';
import { emit } from '../core/events.js';
import { SCORE } from './constants.js';

// Composantes connexes de plantes mûres (et non flétries).
export function findGroups(field) {
  const seen = new Set();
  const groups = [];
  for (const tile of field.tiles) {
    const p = tile.plant;
    if (!p || !p.ripe || p.wilted) continue;
    if (seen.has(p.id)) continue;

    const stack = [tile];
    const tiles = [];
    seen.add(p.id);
    while (stack.length) {
      const cur = stack.pop();
      tiles.push(cur);
      for (const n of field.neighbors(cur.c, cur.r)) {
        const np = n.plant;
        if (!np || !np.ripe || np.wilted || seen.has(np.id)) continue;
        seen.add(np.id);
        stack.push(n);
      }
    }

    const degrees = new Set(tiles.map((t) => t.plant.degree));
    groups.push({ tiles, degrees, chord: matchChord(degrees, tiles.length) });
  }
  return groups;
}

// Le groupe auquel appartient une case donnée (recalcul local, peu coûteux).
export function groupAt(field, tile) {
  if (!tile || !tile.plant || !tile.plant.ripe || tile.plant.wilted) return null;
  const seen = new Set([tile.plant.id]);
  const stack = [tile];
  const tiles = [];
  while (stack.length) {
    const cur = stack.pop();
    tiles.push(cur);
    for (const n of field.neighbors(cur.c, cur.r)) {
      const np = n.plant;
      if (!np || !np.ripe || np.wilted || seen.has(np.id)) continue;
      seen.add(np.id);
      stack.push(n);
    }
  }
  const degrees = new Set(tiles.map((t) => t.plant.degree));
  return { tiles, degrees, chord: matchChord(degrees, tiles.length) };
}

// Ce qu'il manquerait au groupe pour former l'accord immédiatement supérieur.
// Sert à l'aide contextuelle et au tutoriel : le jeu souffle sans dire.
export function missingFor(group, chord) {
  return chord.need.filter((d) => !group.degrees.has(d));
}

export function suggestChord(group, chords) {
  let best = null;
  for (const chord of chords) {
    const missing = missingFor(group, chord);
    if (missing.length === 0) continue;
    if (missing.length > 2) continue;
    const score = chord.mult / (missing.length + 1);
    if (!best || score > best.score) best = { chord, missing, score };
  }
  return best;
}

// --- Récolte ----------------------------------------------------------------
// Récolter une plante d'un groupe récolte tout le groupe. C'est la décision de
// design la plus importante du jeu : elle transforme une grille en partition.

export function harvestGroup(field, tile, ctx = {}) {
  const group = groupAt(field, tile);
  if (!group) return null;

  const chordMult = group.chord ? group.chord.mult : 1;
  const chainMult = ctx.chainMult || 1;
  const justBonus = ctx.just ? 1.15 : 1;

  let base = 0;
  const harvested = [];
  const degrees = [];
  for (const t of group.tiles) {
    const res = field.harvestPlant(t);
    if (!res) continue;
    base += res.gain;
    degrees.push(res.plant.degree);
    harvested.push({ plant: res.plant, col: t.c, row: t.r, gain: res.gain });
  }
  if (!harvested.length) return null;

  const sap = Math.round(base * chordMult * chainMult * justBonus * (ctx.sapBonus || 1));

  const center = harvested.reduce(
    (a, h) => ({ col: a.col + h.col / harvested.length, row: a.row + h.row / harvested.length }),
    { col: 0, row: 0 },
  );

  let purified = 0;
  if (group.chord) {
    const chord = group.chord;
    const radius = Math.min(chord.radius, Math.max(field.cols, field.rows));
    switch (chord.effect) {
      case 'floraison':
        for (const t of field.tiles) purified += field.purify(t, 1);
        field.addWave(center.col, center.row, Math.max(field.cols, field.rows), 1.4, chord.color);
        break;
      case 'onde':
        field.addWave(center.col, center.row, radius, 1, chord.color);
        purified = radius;
        break;
      case 'ralentir':
        field.slowBlight = 12;
        field.addWave(center.col, center.row, radius, 0.7, chord.color);
        break;
      case 'maturation':
        field.ripenAround(center.col, center.row, radius);
        field.addWave(center.col, center.row, radius * 0.7, 0.8, chord.color);
        break;
      default:
        break;
    }
  }

  const result = {
    chord: group.chord,
    count: harvested.length,
    harvested,
    degrees,
    sap,
    base,
    chordMult,
    chainMult,
    center,
    purified,
    just: !!ctx.just,
  };
  emit('resonance:harvest', result);
  return result;
}

// Résumé lisible pour le HUD : ce que vaut le groupe sous le curseur.
export function previewAt(field, tile, ctx = {}) {
  const group = groupAt(field, tile);
  if (!group) return null;
  const chainMult = ctx.chainMult || 1;
  let base = 0;
  for (const t of group.tiles) base += t.plant ? Math.round(t.plant.sp.yield) : 0;
  const mult = group.chord ? group.chord.mult : 1;
  return {
    group,
    chord: group.chord,
    count: group.tiles.length,
    estimate: Math.round(base * mult * chainMult),
    hint: group.chord ? null : suggestChord(group, ctx.chords || []),
  };
}

export function degreeLabel(d) {
  const info = DEGREE_INFO[d];
  return info ? `${d} · ${info.name}` : d;
}

export const HARVEST_BASE = SCORE.sapPerHarvest;
