// Mode Carrière — équipe (§ 7 et § 10.6) : liste des employés (portrait, métier, terrain, niveau,
// humeur, salaire, congé), fiche d'un employé (métier, affectation, congé, renvoi) et candidats.

import { el, fmt, plural } from '../dom.js';
import { icon } from '../icons.js';
import { bar, buyButton, cBtn, cIcon, JOB_NAMES, JOB_TEXT, jobName, MOOD_NAMES, MOOD_NAMES_F, pips, portrait, toggle, lotIcon } from './util.js';
import { buildingCard } from './shop.js';

const JOBS = ['gardener', 'keeper', 'artisan', 'seller'];
const TRAIT_NAMES = {
  strong: 'Costaud',
  thrifty: 'Économe',
  quick: 'Vif',
  loyal: 'Fidèle',
  animalLover: 'Ami des bêtes',
  chatty: 'Bavard',
  earlyBird: 'Matinal',
};
const TRAIT_TEXT = {
  strong: '+20 % d\'actions chaque jour.',
  thrifty: 'Salaire −2 par jour.',
  quick: 'Apprend vite : expérience ×1,5.',
  loyal: 'Jamais las.',
  animalLover: 'Soigneur : revenus des animaux +5 % de plus.',
  chatty: 'Vendeur : ventes +3 % de plus.',
  earlyBird: 'Commence plus tôt : +15 % d\'actions.',
};

const isF = (s) => s?.look?.gender === 'f' || s?.look?.female === true;
const traitName = (s) => s.traitName || TRAIT_NAMES[s.trait] || s.trait || '';
const traitText = (s) => s.traitText || TRAIT_TEXT[s.trait] || '';
const moodName = (s) => s.moodName || (isF(s) ? MOOD_NAMES_F : MOOD_NAMES)[s.mood] || '';
const wageOf = (s) => s.wage ?? 8 + 3 * ((s.level || 1) - 1);

function traitIcon(trait) {
  return cIcon(`trait.${trait}`, 'sprite--sm', 'star');
}
function moodIcon(mood) {
  return cIcon(`mood.${mood || 'content'}`, 'sprite--sm', 'star');
}
function jobIcon(job, cls = 'sprite--sm') {
  return cIcon(`job.${job}`, cls, 'harvest');
}

/** Terrains compatibles avec un métier : [{ id, name, type }] (+ « tous »). */
function targetsFor(ui, job) {
  const lots = (ui.q('lots', []) || []).filter((l) => l.bought);
  if (job === 'gardener') return [{ id: 'all', name: 'Tous les champs', note: '−20 % d\'actions (trajets)' }, ...lots.filter((l) => ['field', 'orchard', 'greenhouse'].includes(l.type))];
  if (job === 'keeper') return [{ id: 'all', name: 'Tous les animaux', note: 'tous les abris' }, ...lots.filter((l) => ['meadow', 'yard', 'pond'].includes(l.type))];
  if (job === 'artisan') return lots.filter((l) => l.type === 'workshops');
  if (job === 'seller') return [{ id: 'all', name: 'La ferme', note: 'un seul vendeur compte' }];
  return [];
}

function lotLabel(ui, s) {
  if (s.onLeave) return 'en congé';
  if (s.idleReason === 'noMoney') return 'chômage technique';
  if (!s.job) return 'sans affectation · se repose';
  if (s.lotName) return s.lotName;
  if (s.lotId === 'all') return s.job === 'seller' ? 'la ferme' : s.job === 'keeper' ? 'tous les animaux' : 'tous les champs';
  return (ui.q('lot', null, s.lotId) || {}).name || 'à affecter';
}

// ── Liste ───────────────────────────────────────────────────────────────────────
export function teamContent(ui) {
  const { app, q } = ui;
  const staff = q('staff', []) || [];
  const c = q('candidates', null);
  const cap = c?.capacity ?? 0;
  const wages = staff.filter((s) => !s.onLeave).reduce((t, s) => t + wageOf(s), 0);
  if (!cap && !staff.length) return lockedContent(ui);
  const allOnLeave = staff.length > 0 && staff.every((s) => s.onLeave);
  const rows = staff.map((s) =>
    el(
      `article.c-staff-row${s.onLeave ? '.is-leave' : ''}`,
      { id: `c-staff-${s.id}` },
      el(
        'button.c-staff-open',
        { type: 'button', onclick: () => ui.open.employee(s.id), 'aria-label': `Fiche de ${s.name}` },
        el('span.c-portrait', portrait(s.look, 'sprite--card')),
        el(
          'span.c-staff-main',
          el('span.c-staff-top', el('b', s.name), moodIcon(s.mood), el('small.c-staff-mood', moodName(s))),
          el('small', s.job ? `${s.jobName || jobName(s.job, isF(s))} · ${lotLabel(ui, s)}` : lotLabel(ui, s)),
          el('span.c-staff-lvl', pips(s.level || 1, 5), s.nextLevelXp ? bar(s.xp || 0, s.nextLevelXp) : null, el('small', `${fmt(wageOf(s))} / jour`)),
        ),
      ),
      toggle(app, { id: `c-leave-${s.id}`, label: 'Congé', on: !!s.onLeave, onChange: (v) => ui.act('setLeave', s.id, v) }),
    ),
  );
  return el(
    'div.c-team',
    el(
      'div.c-team-head',
      el('span', el('b', `${staff.length} / ${cap}`), ` employé${cap > 1 ? 's' : ''}`),
      el('span', icon('coin', 'sm'), `salaires ${fmt(wages)} / jour`),
    ),
    staff.length ? toggle(app, { id: 'c-team-leave', label: 'Toute l\'équipe en congé', sub: 'Ni travail ni salaire : pratique en hiver, quand les champs sont vides.', on: allOnLeave, onChange: (v) => ui.act('setTeamLeave', v) }) : null,
    staff.length ? el('div.c-staff-list', rows) : el('p.sheet-empty', 'Personne pour l\'instant : embauchez votre premier employé !'),
    el(
      'div.sheet-actions',
      cBtn(app, [cIcon('hire', 'sprite--sm', 'harvest'), c?.list?.length ? `Embaucher (${c.list.length} candidat${c.list.length > 1 ? 's' : ''})` : 'Embaucher'], () => ui.open.hire(), { id: 'c-open-hire', cls: staff.length < cap ? 'btn--red.btn--wide' : 'btn--wide' }),
    ),
    el('p.sheet-hint', 'Un employé sans affectation se repose à la maison (salaire payé). Les salaires sont payés chaque matin avec les charges.'),
  );
}

function lockedContent(ui) {
  const { app, q } = ui;
  const house = q('building', null, 'house');
  const rank = ui.game.state.career.rank;
  return el(
    'div.info-sheet.c-team-locked',
    el('div.c-lock-illus', cIcon('staff', 'sprite--hero', 'harvest'), cIcon('lock', 'sprite--md', 'lock')),
    el('p', 'Des employés peuvent travailler pour vous : jardiniers, soigneurs, artisans et vendeurs.'),
    el(
      'ul.loan-list',
      el('li', icon(rank >= 2 ? 'star' : 'lock', 'sm'), el('span', rank >= 2 ? 'Rang 2 (Ferme familiale) : atteint ✓' : 'Atteindre le rang 2 (Ferme familiale) : voir le Carnet.')),
      el('li', icon((house?.level || 1) >= 2 ? 'star' : 'lock', 'sm'), el('span', (house?.level || 1) >= 2 ? 'Maison niveau 2 : construite ✓' : 'Améliorer la maison au niveau 2 (2 employés).')),
    ),
    house && house.level < house.maxLevel ? buildingCard(ui, house, { compact: true }) : null,
    cBtn(app, 'Voir les objectifs du rang', () => ui.open.journal('farm'), { id: 'c-team-goals', cls: 'btn--wide' }),
  );
}

// ── Fiche d'un employé ──────────────────────────────────────────────────────────
export function employeeContent(ui, staffId) {
  const { app, q } = ui;
  const s = (q('staff', []) || []).find((x) => x.id === staffId);
  if (!s) return el('p.sheet-empty', 'Cet employé ne travaille plus ici.');
  const f = isF(s);
  const targets = s.job ? targetsFor(ui, s.job) : [];
  return el(
    'div.info-sheet.c-employee',
    el(
      'div.c-emp-head',
      el('span.c-portrait.is-big', portrait(s.look, 'sprite--hero')),
      el(
        'div.c-emp-facts',
        el('b.c-emp-name', s.name),
        el('span', s.job ? `${s.jobName || jobName(s.job, f)} · niveau ${s.level || 1}` : `Niveau ${s.level || 1} · sans métier`),
        el('span.c-staff-lvl', pips(s.level || 1, 5), s.nextLevelXp ? bar(s.xp || 0, s.nextLevelXp) : null),
        el('small', s.nextLevelXp ? `${fmt(s.xp || 0)} / ${fmt(s.nextLevelXp)} expérience` : 'Niveau maximal'),
        el('span.c-emp-mood', moodIcon(s.mood), moodName(s), s.actionsPerDay ? el('small', ` · ${s.actionsPerDay} actions / jour`) : null),
        el('span', icon('coin', 'sm'), `Salaire : ${fmt(wageOf(s))} / jour`),
      ),
    ),
    s.trait ? el('p.c-trait', traitIcon(s.trait), el('b', traitName(s)), el('span.c-trait-text', traitText(s))) : null,
    el('h3.stats-title', 'Métier'),
    el(
      'div.c-jobs',
      { role: 'radiogroup', 'aria-label': 'Métier' },
      JOBS.map((j) =>
        el(
          `button.c-job${s.job === j ? '.is-on' : ''}`,
          {
            type: 'button',
            role: 'radio',
            id: `c-job-${j}`,
            'aria-checked': s.job === j ? 'true' : 'false',
            onclick: () => {
              if (s.job === j) return;
              app.audio.play('toggle');
              const first = targetsFor(ui, j).find((t) => t.id !== 'all') || targetsFor(ui, j)[0];
              ui.act('assign', s.id, j, first ? first.id : null);
            },
          },
          jobIcon(j, 'sprite--md'),
          el('span', f ? JOB_NAMES[j][1] : JOB_NAMES[j][0]),
        ),
      ),
    ),
    s.job ? el('p.stats-note', JOB_TEXT[s.job]) : el('p.stats-note', 'Choisissez un métier : le métier conseillé est une simple suggestion.'),
    s.job ? el('h3.stats-title', 'Affectation') : null,
    s.job
      ? targets.length
        ? el(
            'div.c-assign',
            targets.map((t) =>
              el(
                `button.c-row${s.lotId === t.id ? '.is-on' : ''}`,
                { type: 'button', id: `c-assign-${t.id}`, onclick: () => {
                  if (s.lotId !== t.id) ui.act('assign', s.id, s.job, t.id);
                } },
                t.type ? lotIcon(t.type, 'sprite--md') : icon('seed', 'md'),
                el('span.c-row-main', el('b', t.name), el('small', t.note || t.typeName || '')),
                s.lotId === t.id ? el('span.c-check', '✓') : null,
              ),
            ),
          )
        : el('p.stats-note', s.job === 'artisan' ? 'Il faut une cour des ateliers pour un artisan.' : 'Aucun terrain compatible pour l\'instant.')
      : null,
    toggle(app, { id: 'c-emp-leave', label: 'En congé', sub: 'Ni travail ni salaire ; un congé d\'au moins 2 jours rend joyeux.', on: !!s.onLeave, onChange: (v) => ui.act('setLeave', s.id, v) }),
    el(
      'div.sheet-actions',
      cBtn(app, 'Renvoyer', async () => {
        const ok = await app.dialogs.confirm({ title: `Renvoyer ${s.name} ?`, text: `${s.name} quittera la ferme (sans pénalité). Vous pourrez embaucher quelqu'un d'autre.`, ok: 'Renvoyer', danger: true });
        if (!ok) return;
        const res = ui.act('fire', s.id);
        if (res?.ok) {
          ui.windows.farewell(s);
          ui.open.team();
        }
      }, { id: 'c-fire', cls: 'btn--wide.btn--danger-soft' }),
    ),
  );
}

// ── Candidats ───────────────────────────────────────────────────────────────────
export function hireContent(ui) {
  const { app, q } = ui;
  const c = q('candidates', null);
  if (!c || (!c.capacity && !(q('staff', []) || []).length)) return lockedContent(ui);
  const list = c.list || [];
  return el(
    'div.c-hire',
    el('p.shop-intro', `${c.count} / ${c.capacity} employés. L'embauche est gratuite ; le salaire commence demain matin.${c.nextInDays !== null && c.nextInDays !== undefined ? ` Nouveaux candidats ${c.nextInDays <= 0 ? 'demain' : `dans ${plural(c.nextInDays, 'jour')}`}.` : ''}`),
    !c.canHire && c.reason ? el('p.card-reason', c.reason) : null,
    list.length
      ? list.map((k) =>
          el(
            'article.card.c-card.c-cand',
            { id: `c-cand-${k.id}` },
            el('div.card-icon.c-portrait', portrait(k.look, 'sprite--card')),
            el(
              'div.card-main',
              el('div.card-top', el('span.card-name', k.name), el('span.card-owned', `Niveau ${k.level || 1}`)),
              k.trait ? el('div.c-trait', traitIcon(k.trait), el('b', traitName(k)), el('span.c-trait-text', traitText(k))) : null,
              el(
                'div.card-stats',
                el('span.stat', el('span.stat-label', 'Salaire'), el('b', `${fmt(k.wage ?? wageOf(k))} / jour`)),
                k.suggestedJob ? el('span.stat', el('span.stat-label', 'Aime'), el('b', jobName(k.suggestedJob, isF(k)).toLowerCase())) : null,
              ),
            ),
            el('div.card-foot', buyButton(app, { id: `c-hire-${k.id}`, label: `Embaucher ${k.name}`, can: c.canHire, reason: c.reason, onClick: () => {
              const res = ui.act('hire', k.id);
              if (res?.ok) ui.open.team();
            } })),
          ),
        )
      : el('p.sheet-empty', 'Pas de candidat pour l\'instant.'),
    cBtn(app, 'Retour à l\'équipe', () => ui.open.team(), { id: 'c-hire-back', cls: 'btn--wide' }),
  );
}
