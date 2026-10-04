// Signaux d'interface de l'accompagnement (docs/ARCHITECTURE.md, « Accompagnement — contrats », SIGNALS).
// Un seul appel par endroit : `app.coach?.signal(SIGNALS.x, data)`. Module PUR (aucun accès au DOM).

export const SIGNALS = Object.freeze({
  sheetOpen: 'sheetOpen', // { id }
  sheetClose: 'sheetClose', // { id }
  tab: 'tab', // { id }
  dialogOpen: 'dialogOpen', // { id }
  dialogClose: 'dialogClose', // { id }
  todoGo: 'todoGo', // { id }
  longPress: 'longPress', // { hit }
  sowAll: 'sowAll',
  zoom: 'zoom', // { ratio }
  viewOpen: 'viewOpen',
  viewClose: 'viewClose',
  feteMode: 'feteMode', // { on }
  placing: 'placing', // { kind | null }
  wildPlacing: 'wildPlacing', // { on }
  decor: 'decor', // { on }
  menu: 'menu', // { screen }
  resumeClose: 'resumeClose',
  rankClosed: 'rankClosed', // { rank }
  messagesOpen: 'messagesOpen',
  carnetOpen: 'carnetOpen',
  speed: 'speed', // { speed }
  valleySheet: 'valleySheet', // { tab }
  // Précisions MOTEUR (voir « Écarts et précisions (livraison MOTEUR) ») :
  plotTap: 'plotTap', // { index, empty } : toucher bref d'une parcelle (avant l'action)
  sheetShown: 'sheetShown', // { id, by } : fiche ouverte, by = 'tap' | 'press'
  start: 'start', // { created, resumed } : début ou reprise d'une partie (émis par le moteur, coach.bind)
  lessonEnd: 'lessonEnd', // { id, course } : une leçon vient d'être finie (émis par le moteur)
});

export const SIGNAL_NAMES = Object.freeze(Object.values(SIGNALS));
