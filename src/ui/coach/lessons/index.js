// Catalogue de l'accompagnement : concaténation des fichiers de leçons (PUR, testable sous Node).
// Chaque fichier exporte `LESSONS` (tableau), et facultativement `REMINDERS` (tableau) et `CHAPTERS` (tableau).
// Les paquets LEÇONS ajoutent ici leurs fichiers (un import + une ligne dans PARTS).

import * as basics from './basics.js';
import * as levels from './levels.js';
import * as career from './career.js';
import * as lots from './lots.js';
import * as valley from './valley.js';

const PARTS = [basics, levels, career, lots, valley];

/** Chapitres du carnet, dans l'ordre du jeu (docs/ACCOMPAGNEMENT.md § 9.2). */
export const CHAPTERS = [
  { id: 'basics', title: 'Les premiers pas' },
  { id: 'money', title: 'Le temps et l\'argent' },
  { id: 'levels', title: 'Les niveaux' },
  { id: 'career', title: 'Ma ferme' },
  { id: 'surprises', title: 'Les surprises' },
  { id: 'village', title: 'Le village' },
  { id: 'cozy', title: 'Fêtes, hiver et album' },
  { id: 'valley', title: 'La Vallée' },
];
for (const p of PARTS) for (const c of p.CHAPTERS || []) if (!CHAPTERS.some((x) => x.id === c.id)) CHAPTERS.push(c);

export const LESSONS = PARTS.flatMap((p) => p.LESSONS || []);
export const REMINDERS = PARTS.flatMap((p) => p.REMINDERS || []);
