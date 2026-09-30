// Mode Carrière — prénoms et apparences des employés (données pures). Conception : docs/CARRIERE.md § 7.1.
//
// Apparence : look = { gender: 'm' | 'f', outfit: 0..3, hat: bool, tint: 0..3 } → 2 × 4 × 2 × 4 = 64
// apparences (sprites `staff.<clé>` et `portrait.staff.<clé>`, clé = lookKey(look) de src/render/atlas.js :
// « <genre><tenue><chapeau><teinte> », ex. 'f013'). Le genre suit le prénom.

/** Prénoms français (les 24 du § 7.1, puis d'autres pour varier) ; gender : 'm' | 'f'. */
export const FIRST_NAMES = [
  { name: 'Lucie', gender: 'f' },
  { name: 'Marcel', gender: 'm' },
  { name: 'Rose', gender: 'f' },
  { name: 'Paulin', gender: 'm' },
  { name: 'Jeanne', gender: 'f' },
  { name: 'Léon', gender: 'm' },
  { name: 'Margot', gender: 'f' },
  { name: 'Émile', gender: 'm' },
  { name: 'Suzanne', gender: 'f' },
  { name: 'Gaston', gender: 'm' },
  { name: 'Louise', gender: 'f' },
  { name: 'Aimé', gender: 'm' },
  { name: 'Colette', gender: 'f' },
  { name: 'Firmin', gender: 'm' },
  { name: 'Odette', gender: 'f' },
  { name: 'Victor', gender: 'm' },
  { name: 'Berthe', gender: 'f' },
  { name: 'Armand', gender: 'm' },
  { name: 'Irène', gender: 'f' },
  { name: 'Lucien', gender: 'm' },
  { name: 'Yvette', gender: 'f' },
  { name: 'Hector', gender: 'm' },
  { name: 'Mireille', gender: 'f' },
  { name: 'Jules', gender: 'm' },
  { name: 'Adèle', gender: 'f' },
  { name: 'Alphonse', gender: 'm' },
  { name: 'Blanche', gender: 'f' },
  { name: 'Basile', gender: 'm' },
  { name: 'Josette', gender: 'f' },
  { name: 'Eugène', gender: 'm' },
  { name: 'Marthe', gender: 'f' },
  { name: 'Fernand', gender: 'm' },
  { name: 'Simone', gender: 'f' },
  { name: 'Honoré', gender: 'm' },
  { name: 'Germaine', gender: 'f' },
  { name: 'Marius', gender: 'm' },
  { name: 'Hortense', gender: 'f' },
  { name: 'Norbert', gender: 'm' },
  { name: 'Agathe', gender: 'f' },
  { name: 'Raymond', gender: 'm' },
];

export const FIRST_NAMES_BY_NAME = Object.fromEntries(FIRST_NAMES.map((n) => [n.name, n]));

/** Genre d'un prénom de la liste ('m' par défaut). */
export function genderOf(name) {
  return FIRST_NAMES_BY_NAME[name]?.gender || 'm';
}

/** Dimensions des apparences (mêmes nombres que STAFF_OUTFITS / STAFF_TINTS de l'atlas). */
export const LOOK = { outfits: 4, tints: 4, genders: ['m', 'f'] };
export const LOOK_COUNT = LOOK.genders.length * LOOK.outfits * 2 * LOOK.tints; // 64

/** Clé d'apparence (même règle que lookKey de src/render/atlas.js, sans dépendre du rendu). */
export function lookId(look) {
  return `${look.gender === 'f' ? 'f' : 'm'}${look.outfit}${look.hat ? 1 : 0}${look.tint}`;
}

/** true si l'apparence est valide. */
export function validLook(look) {
  return (
    !!look && typeof look === 'object'
    && LOOK.genders.includes(look.gender)
    && Number.isInteger(look.outfit) && look.outfit >= 0 && look.outfit < LOOK.outfits
    && typeof look.hat === 'boolean'
    && Number.isInteger(look.tint) && look.tint >= 0 && look.tint < LOOK.tints
  );
}
