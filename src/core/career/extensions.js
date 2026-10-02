// Mode Carrière — modules d'extension chargés avec le cœur (CORE-B, CORE-C).
// Chaque module s'enregistre lui-même (registerCareerExtension, src/core/career/registry.js) quand il est
// importé. Ajouter UNE ligne d'import par module ici (fichier partagé : rien d'autre ne s'y écrit).
//
// Exemple :
//   import './staff.js';
//   import './machines.js';

import './events.js';
import './quests.js';
import './animals.js';
import './machines.js';
import './staff.js';
import './work.js';
import './surprises.js';
import { varietyExtension } from './variety.js';
import { registerCareerExtension } from './registry.js';

// (lot 3) La variété après tous les autres (récoltes comptées : quête de Joseph, puis tableau et charrette).
registerCareerExtension(varietyExtension);

export {};
