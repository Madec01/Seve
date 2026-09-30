// Mode Carrière — menu principal « Ma ferme » (§ 1.1, § 10.1) et création d'une ferme (§ 16) :
// nom de la ferme (18 caractères), fermier ou fermière (aperçu), tenue (parmi celles débloquées),
// difficulté (Détente / Classique), durée des saisons (7, 10 ou 14 jours).
//
// careerMenuButtons(app, btn) → nœuds du menu ; openNewFarm(app, { replacing }) → fenêtre de création.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { v3 } from '../v3.js';
import { validateFarmName } from '../decor.js';
import { farmerPreview, rankIcon } from './util.js';

/** Boutons « Ma ferme » du menu principal. */
export function careerMenuButtons(app, btn) {
  const info = app.savedCareerInfo?.() || null;
  const nodes = [];
  if (info?.meta) {
    const m = info.meta;
    nodes.push(
      btn(
        [el('span.btn-main', rankIcon(m.rank || 1, 'sprite--sm'), 'Ma ferme'), el('span.btn-sub', info.label)],
        () => app.continueCareer(),
        'btn--red.btn--big.btn--career',
        { id: 'menu-career', 'data-autofocus': '' },
      ),
      btn([icon('seed', 'sm'), 'Nouvelle ferme'], async () => {
        const ok = await app.dialogs.confirm({
          title: 'Nouvelle ferme ?',
          text: `« ${m.farmName} » (année ${m.year}, ${m.rankName || `rang ${m.rank}`}) sera archivée dans la grange, puis effacée. Une seule ferme à la fois.`,
          ok: 'Continuer',
        });
        if (ok) openNewFarm(app, { replacing: info });
      }, 'btn--small.btn--career-new', { id: 'menu-career-new' }),
    );
  } else {
    nodes.push(
      btn(
        [el('span.btn-main', 'Ma ferme'), el('span.btn-sub', info?.broken ? 'Sauvegarde illisible : commencer une ferme' : 'Commencer ma ferme')],
        () => openNewFarm(app, {}),
        'btn--red.btn--big.btn--career',
        { id: 'menu-career', 'data-autofocus': '' },
      ),
    );
  }
  return nodes;
}

const GENDERS = [
  { id: 'fermier', label: 'Fermier', female: false },
  { id: 'fermiere', label: 'Fermière', female: true },
];
const LENGTHS = [
  { n: 7, label: '7 jours', sub: 'une année ≈ 10 min', note: 'Le rythme des niveaux : une saison file vite.' },
  { n: 10, label: '10 jours', sub: '≈ 13 min', note: 'Plus de temps pour chaque saison.' },
  { n: 14, label: '14 jours', sub: '≈ 19 min', note: 'Tout son temps : idéal pour planifier tranquillement.' },
];
const DIFFS = [
  { id: 'detente', label: 'Détente', tag: 'recommandé', sub: 'Jamais de fin de partie', text: 'Charges douces, récoltes mieux payées. Un soir difficile ? Joseph vous avance l\'argent ; au pire, une passe difficile, mais la ferme continue.' },
  { id: 'classique', label: 'Classique', tag: null, sub: 'La faillite existe', text: 'Charges plus lourdes, pas de prêt de Joseph : si la caisse ne suffit pas un soir de charges, la ferme est vendue (archivée).' },
];

/** Fenêtre « Nouvelle ferme ». `replacing` : ferme en cours à archiver avant de commencer. */
export function openNewFarm(app, { replacing = null } = {}) {
  const P = app.progression;
  const max = v3.cosmetics?.FARM_NAME_MAX || 18;
  const outfits = (P.available() ? P.cosmeticsList('outfit') : []).filter((o) => o.isDefault || !o.price || P.owns(o.id));
  const state = {
    name: P.available() ? P.farmName() : 'Ferme des Tilleuls',
    gender: 'fermier',
    outfit: P.available() ? P.cosmetics().outfit || 'outfit.classic' : 'outfit.classic',
    difficulty: 'detente',
    seasonLength: 7,
  };
  if (!outfits.some((o) => o.id === state.outfit)) state.outfit = outfits[0]?.id || 'outfit.classic';

  // ── Nom ──
  const input = el('input.name-input', {
    type: 'text',
    id: 'nf-name',
    value: state.name,
    maxLength: max + 6,
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    enterKeyHint: 'done',
    'aria-label': 'Nom de la ferme',
  });
  const count = el('span.name-count');
  const error = el('p.name-error', { role: 'alert' });
  const checkName = () => {
    const r = validateFarmName(input.value, max);
    const len = [...input.value.trim()].length;
    count.textContent = `${len}/${max}`;
    count.classList.toggle('is-over', len > max);
    error.textContent = input.value.trim() && !r.ok ? r.error : !input.value.trim() ? 'Donnez un nom à votre ferme.' : '';
    return r;
  };
  input.addEventListener('input', () => {
    checkName();
    syncStart();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    e.stopPropagation();
  });
  input.addEventListener('focus', () => setTimeout(() => input.scrollIntoView({ block: 'nearest' }), 300));

  // ── Fermier / fermière ──
  const genderBox = el('div.nf-genders', { role: 'radiogroup', 'aria-label': 'Je suis' });
  const outfitBox = el('div.nf-outfits', { role: 'radiogroup', 'aria-label': 'Tenue' });
  const paintGenders = () => {
    genderBox.replaceChildren(
      ...GENDERS.map((g) =>
        el(
          `button.nf-gender${state.gender === g.id ? '.is-on' : ''}`,
          { type: 'button', role: 'radio', id: `nf-${g.id}`, 'aria-checked': state.gender === g.id ? 'true' : 'false', onclick: () => {
            if (state.gender === g.id) return;
            app.audio.play('toggle');
            state.gender = g.id;
            paintGenders();
            paintOutfits();
          } },
          el('span.nf-preview', farmerPreview(state.outfit, g.female, 'sprite--hero')),
          el('b', g.label),
        ),
      ),
    );
  };
  const paintOutfits = () => {
    if (outfits.length <= 1) {
      outfitBox.replaceChildren(el('p.stats-note', 'D\'autres tenues se débloquent dans la grange (Ma ferme), avec vos écus.'));
      return;
    }
    outfitBox.replaceChildren(
      ...outfits.map((o) =>
        el(
          `button.nf-outfit${state.outfit === o.id ? '.is-on' : ''}`,
          { type: 'button', role: 'radio', id: `nf-${o.id.replace(/\./g, '-')}`, 'aria-checked': state.outfit === o.id ? 'true' : 'false', 'aria-label': o.name, onclick: () => {
            if (state.outfit === o.id) return;
            app.audio.play('toggle');
            state.outfit = o.id;
            paintGenders();
            paintOutfits();
          } },
          farmerPreview(o.id, state.gender === 'fermiere', 'sprite--card'),
          el('small', o.name),
        ),
      ),
    );
  };

  // ── Difficulté ──
  const diffBox = el('div.diff-switch', { role: 'radiogroup', 'aria-label': 'Difficulté de la ferme', id: 'nf-diff' });
  const diffDesc = el('p.diff-desc');
  const paintDiff = () => {
    diffBox.replaceChildren(
      ...DIFFS.map((d) =>
        el(
          `button.diff-opt.is-${d.id}${state.difficulty === d.id ? '.is-on' : ''}`,
          { type: 'button', role: 'radio', id: `nf-diff-${d.id}`, 'aria-checked': state.difficulty === d.id ? 'true' : 'false', onclick: () => {
            if (state.difficulty === d.id) return;
            app.audio.play('toggle');
            state.difficulty = d.id;
            paintDiff();
          } },
          el('span.diff-radio', { 'aria-hidden': 'true' }),
          el('span.diff-text', el('b.diff-title', d.label, d.tag ? el('span.diff-tag', d.tag) : null), el('small.diff-sub', d.sub)),
        ),
      ),
    );
    diffDesc.textContent = DIFFS.find((d) => d.id === state.difficulty).text;
  };

  // ── Durée des saisons ──
  const lenBox = el('div.c-seg3', { role: 'radiogroup', 'aria-label': 'Durée des saisons', id: 'nf-length' });
  const lenNote = el('p.diff-desc');
  const paintLen = () => {
    lenBox.replaceChildren(
      ...LENGTHS.map((l) =>
        el(
          `button.c-seg3-btn${state.seasonLength === l.n ? '.is-on' : ''}`,
          { type: 'button', role: 'radio', id: `nf-len-${l.n}`, 'aria-checked': state.seasonLength === l.n ? 'true' : 'false', onclick: () => {
            if (state.seasonLength === l.n) return;
            app.audio.play('toggle');
            state.seasonLength = l.n;
            paintLen();
          } },
          el('b', l.label),
          el('small', l.sub),
        ),
      ),
    );
    const l = LENGTHS.find((x) => x.n === state.seasonLength);
    lenNote.textContent = `${l.note} Gains et coûts de chaque jour ne changent pas ; charges de saison et objectifs de patrimoine sont ajustés.`;
  };

  paintGenders();
  paintOutfits();
  paintDiff();
  paintLen();
  checkName();

  const startBtn = app.dialogs.btn(['Commencer', icon('play', 'sm')], () => submit(), 'btn--red', { id: 'nf-start' });
  const syncStart = () => {
    const ok = validateFarmName(input.value, max).ok;
    startBtn.classList.toggle('is-disabled', !ok);
    startBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
  };
  syncStart();

  async function submit() {
    const r = checkName();
    if (!r.ok) {
      app.audio.play('error');
      input.focus();
      return;
    }
    if (replacing?.meta) {
      const ok = await app.dialogs.confirm({
        title: 'Dernière vérification',
        text: `« ${replacing.meta.farmName} » va être archivée puis effacée, et « ${r.value} » va commencer. Vous êtes sûr ?`,
        ok: 'Nouvelle ferme',
        danger: true,
      });
      if (!ok) return;
    }
    app.dialogs.closeTop();
    app.startCareer({ farmName: r.value, farmerGender: state.gender, outfit: state.outfit, difficulty: state.difficulty, seasonLength: state.seasonLength }, { archiveExisting: !!replacing?.meta });
  }

  const section = (title, ...kids) => el('section.nf-sec', el('h3.opt-section', title), kids);
  const body = el(
    'div.nf-form',
    el('p.nf-intro', 'Votre ferme à vous : elle dure d\'année en année et s\'agrandit terrain par terrain.'),
    section('Nom de la ferme', el('div.name-form', el('div.name-row', input), el('div.name-meta', error, count))),
    section('Je suis', genderBox),
    section('Tenue', outfitBox),
    section('Difficulté', el('div.diff-box.nf-diff', diffBox, diffDesc)),
    section('Durée des saisons', lenBox, lenNote),
    el('p.stats-note', 'Le temps ne passe que quand vous jouez : rien ne pousse ni ne se perd pendant votre absence.'),
  );
  const node = app.dialogs.frame({
    title: 'Nouvelle ferme',
    ribbon: 'ribbon',
    cls: 'dialog--newfarm',
    body,
    actions: [app.dialogs.btn('Annuler', () => app.dialogs.closeTop(), '', { id: 'nf-cancel' }), startBtn],
    onClose: () => app.dialogs.closeTop(),
  });
  return app.dialogs.open(node, { id: 'new-farm' });
}
