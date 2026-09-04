// 24 succès. Ils racontent une courbe d'apprentissage, pas une liste de corvées.

import { emit } from '../core/events.js';

export const ACHIEVEMENTS = [
  { id: 'premiere_graine', name: 'Première graine', desc: 'Semer une plante.', test: (s) => s.stats.seedsSown >= 1 },
  { id: 'premiere_recolte', name: 'Première récolte', desc: 'Récolter une plante mûre.', test: (s) => s.stats.harvests >= 1 },
  { id: 'premier_accord', name: 'Premier accord', desc: 'Former un accord quelconque.', test: (s) => s.stats.chords >= 1 },
  { id: 'juste', name: 'Juste', desc: '10 actions parfaitement sur le temps.', test: (s) => s.stats.perfectBeats >= 10 },
  { id: 'juste_100', name: 'Métronome vivant', desc: '500 actions parfaitement sur le temps.', test: (s) => s.stats.perfectBeats >= 500 },
  { id: 'chaine_4', name: 'Élan', desc: 'Atteindre une chaîne ×4.', test: (s) => s.stats.bestChain >= 4 },
  { id: 'majeur', name: 'Retour de la lumière', desc: 'Former un accord majeur.', test: (s) => hasChord(s, 'majeur') },
  { id: 'mineur', name: 'Belle mélancolie', desc: 'Former un accord mineur.', test: (s) => hasChord(s, 'mineur') },
  { id: 'suspendu', name: 'Le temps hésite', desc: 'Former un accord suspendu.', test: (s) => hasChord(s, 'suspendu') },
  { id: 'penta', name: 'Pentatonique', desc: 'Former les cinq degrés d’un seul groupe.', test: (s) => hasChord(s, 'pentatonique') },
  { id: 'penta_3', name: 'Compositrice', desc: 'Former trois Pentatoniques.', test: (s) => (s.stats.chordCounts?.pentatonique || 0) >= 3 },
  { id: 'purificatrice', name: 'Purificatrice', desc: 'Purifier 500 cases.', test: (s) => s.stats.purified >= 500 },
  { id: 'cycle_1', name: 'Un cycle entier', desc: 'Terminer un Cycle complet.', test: (s) => s.stats.runs >= 1 },
  { id: 'cycle_10', name: 'Saison après saison', desc: 'Terminer dix Cycles.', test: (s) => s.stats.runs >= 10 },
  { id: 'marais', name: 'Pieds mouillés', desc: 'Débloquer les Marais de Verre.', test: (s) => s.unlockedBiomes.includes('marais') },
  { id: 'vallee', name: 'Malgré la chaleur', desc: 'Débloquer la Vallée Calcinée.', test: (s) => s.unlockedBiomes.includes('vallee') },
  { id: 'canopee', name: 'Là-haut', desc: 'Débloquer la Canopée Suspendue.', test: (s) => s.unlockedBiomes.includes('canopee') },
  { id: 'coeur', name: 'Le Cœur Sourd', desc: 'Atteindre la source du silence.', test: (s) => s.unlockedBiomes.includes('coeur') },
  { id: 'echo_1', name: 'Un souvenir', desc: 'Découvrir un Écho.', test: (s) => s.echoes.length >= 1 },
  { id: 'echo_all', name: 'Tout se souvient', desc: 'Découvrir les douze Échos.', test: (s) => s.echoes.length >= 12 },
  { id: 'cendre_ami', name: 'Pardon', desc: 'Écouter Vieux-Cendre jusqu’au bout.', test: (s) => !!s.npcMet.cendre_done },
  { id: 'luthier', name: 'La sixième corde', desc: 'Rencontrer le Luthier.', test: (s) => !!s.npcMet.luthier },
  { id: 'score_5000', name: 'Belle floraison', desc: 'Terminer un Cycle avec 5 000 points.', test: (s) => s.stats.bestScore >= 5000 },
  { id: 'sans_flétrir', name: 'Rien n’est perdu', desc: 'Terminer un Cycle sans laisser faner une seule plante.', test: (s) => !!s.stats.flawlessRun },
];

function hasChord(save, id) {
  return (save.stats.chordCounts && save.stats.chordCounts[id] > 0) || false;
}

export function checkAchievements(save) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.test(save); } catch (err) { ok = false; }
    if (ok) {
      save.achievements[a.id] = Date.now();
      unlocked.push(a);
      emit('achievement', a);
    }
  }
  return unlocked;
}

export function achievementProgress(save) {
  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
  return { got, total, ratio: got / total };
}
