// Application installable (PWA) : service worker, mise à jour, installation, écran allumé.
// Aucune interface ici : des fonctions et des abonnements que l'interface appelle.
//
//   import * as pwa from './pwa.js';
//   pwa.initPWA();                          au démarrage (une fois) ; enregistre ./sw.js
//   pwa.onUpdateAvailable(() => …)          une nouvelle version est prête → afficher
//                                           « Nouvelle version disponible — Recharger »
//   pwa.applyUpdate()                       bouton « Recharger » : active la nouvelle version et recharge
//   pwa.onInstallChange((ok) => …)          l'installation devient possible / impossible
//   pwa.canInstall()                        vrai si le bouton « Installer le jeu » peut être montré
//   pwa.promptInstall()                     bouton « Installer le jeu » → Promise<'accepted'|'dismissed'|'unavailable'>
//   pwa.onInstalled(() => …)                le jeu vient d'être installé
//   pwa.isStandalone()                      vrai si le jeu tourne en application installée
//   pwa.setWakeLock(true|false)             garder l'écran allumé (option) ; repris au retour au premier plan
//   pwa.isWakeLockSupported()               pour masquer l'option si le navigateur ne sait pas faire
//   pwa.lockPortrait()                      tente de verrouiller l'orientation (appli installée) ; sans erreur
//   pwa.getVersion()                        Promise<string|null> : version du cache hors ligne
//   pwa.onOfflineReady(() => …)             le jeu est entièrement en cache (1re installation)
//
// Tout est protégé : sur un navigateur sans service worker, sans Wake Lock, etc., les fonctions
// ne font rien et renvoient des valeurs neutres.

const listeners = { update: new Set(), install: new Set(), installed: new Set(), offline: new Set() };
const emit = (type, ...args) => listeners[type].forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } });
const subscribe = (type, fn) => { listeners[type].add(fn); return () => listeners[type].delete(fn); };

let registration = null;
let waitingWorker = null;
let reloading = false;
let userAskedUpdate = false;
let installEvent = null;
let initialized = false;

const UPDATE_CHECK_MS = 30 * 60 * 1000; // la partie peut rester ouverte longtemps

// -----------------------------------------------------------------------------------------------
// Service worker et mises à jour

function trackWaiting(worker) {
  if (!worker) return;
  waitingWorker = worker;
  emit('update');
}

function watchInstalling(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state !== 'installed') return;
    // Un contrôleur existe déjà → c'est une mise à jour ; sinon, 1re installation : prêt hors ligne.
    if (navigator.serviceWorker.controller) trackWaiting(registration.waiting || worker);
    else emit('offline');
  });
}

/**
 * À appeler une fois au démarrage. Enregistre le service worker (./sw.js, relatif à la page :
 * fonctionne dans un sous-dossier) et capture l'invitation à installer.
 * Options : { serviceWorker: true } — `?nosw` dans l'adresse désactive le service worker (débogage).
 */
export function initPWA({ serviceWorker = true } = {}) {
  if (initialized) return;
  initialized = true;

  // Invitation à installer (Chrome/Edge Android et ordinateur)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // pas de mini-barre automatique : c'est le menu du jeu qui propose
    installEvent = e;
    emit('install', true);
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    emit('install', false);
    emit('installed');
  });

  // Écran allumé : le verrou tombe quand la page passe en arrière-plan → on le reprend au retour
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (wakeWanted) acquireWakeLock();
      if (registration) registration.update().catch(() => {});
    }
  });

  const noSW = new URLSearchParams(location.search).has('nosw');
  if (!serviceWorker || noSW || !('serviceWorker' in navigator) || !window.isSecureContext) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Ne recharger que si le joueur l'a demandé (1re installation : clients.claim() change aussi le contrôleur).
    if (!userAskedUpdate || reloading) return;
    reloading = true;
    location.reload();
  });

  const register = () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((reg) => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) trackWaiting(reg.waiting);
      watchInstalling(reg.installing);
      reg.addEventListener('updatefound', () => watchInstalling(reg.installing));
      setInterval(() => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); }, UPDATE_CHECK_MS);
    }).catch((err) => console.warn('Service worker non enregistré :', err));
  };
  // Après le chargement : ne pas concurrencer le téléchargement des ressources du jeu
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** S'abonner : une nouvelle version attend d'être activée. Renvoie une fonction de désabonnement. */
export function onUpdateAvailable(fn) {
  if (waitingWorker) queueMicrotask(() => fn());
  return subscribe('update', fn);
}

/** Vrai si une nouvelle version attend. */
export function isUpdateAvailable() {
  return Boolean(waitingWorker);
}

/**
 * Active la nouvelle version puis recharge la page (penser à sauvegarder la partie avant).
 * Sans nouvelle version en attente, recharge simplement.
 */
export function applyUpdate() {
  userAskedUpdate = true;
  const worker = waitingWorker || (registration && registration.waiting);
  if (!worker) {
    location.reload();
    return;
  }
  worker.postMessage({ type: 'SKIP_WAITING' });
  // Filet de sécurité si « controllerchange » n'arrive pas
  setTimeout(() => { if (!reloading) { reloading = true; location.reload(); } }, 4000);
}

/** Demande tout de suite au navigateur s'il existe une nouvelle version (sinon : au retour au premier plan et toutes les 30 min). */
export function checkForUpdate() {
  return registration ? registration.update().then(() => true, () => false) : Promise.resolve(false);
}

/** S'abonner : le jeu est entièrement disponible hors ligne (première installation terminée). */
export function onOfflineReady(fn) {
  return subscribe('offline', fn);
}

/** Version du cache hors ligne (celle du service worker qui contrôle la page), ou null. */
export function getVersion() {
  const ctrl = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
  if (!ctrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 2000);
    channel.port1.onmessage = (e) => { clearTimeout(timer); resolve((e.data && e.data.version) || null); };
    ctrl.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

// -----------------------------------------------------------------------------------------------
// Installation

/** Vrai si le navigateur propose l'installation (bouton « Installer le jeu » à afficher). */
export function canInstall() {
  return Boolean(installEvent) && !isStandalone();
}

/** S'abonner aux changements de canInstall() (reçoit le nouveau booléen). */
export function onInstallChange(fn) {
  return subscribe('install', fn);
}

/** S'abonner : le jeu vient d'être installé. */
export function onInstalled(fn) {
  return subscribe('installed', fn);
}

/** Ouvre la fenêtre d'installation du navigateur (à appeler dans un geste du joueur). */
export async function promptInstall() {
  const e = installEvent;
  if (!e) return 'unavailable';
  installEvent = null; // l'invitation ne sert qu'une fois
  emit('install', false);
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'dismissed';
  }
}

/** Vrai si le jeu tourne comme une application installée (plein écran ou fenêtre autonome). */
export function isStandalone() {
  try {
    return ['fullscreen', 'standalone', 'minimal-ui'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches)
      || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------------------------
// Écran allumé (Screen Wake Lock)

let wakeWanted = false;
let wakeSentinel = null;

export function isWakeLockSupported() {
  return 'wakeLock' in navigator;
}

async function acquireWakeLock() {
  if (!isWakeLockSupported() || wakeSentinel || document.visibilityState !== 'visible') return;
  try {
    wakeSentinel = await navigator.wakeLock.request('screen');
    wakeSentinel.addEventListener('release', () => { wakeSentinel = null; });
    if (!wakeWanted) releaseWakeLock(); // désactivé pendant la demande
  } catch {
    wakeSentinel = null; // refusé (économie d'énergie, page masquée…) : sans gravité
  }
}

function releaseWakeLock() {
  const s = wakeSentinel;
  wakeSentinel = null;
  if (s) s.release().catch(() => {});
}

/**
 * Garder l'écran allumé (true) ou non (false). Le souhait est mémorisé : le verrou est repris
 * automatiquement quand la page revient au premier plan. Renvoie une promesse résolue à
 * l'état effectif (true si l'écran est effectivement maintenu allumé).
 */
export async function setWakeLock(on) {
  wakeWanted = Boolean(on);
  if (wakeWanted) await acquireWakeLock();
  else releaseWakeLock();
  return Boolean(wakeSentinel);
}

/** Vrai si l'écran est actuellement maintenu allumé. */
export function isWakeLockActive() {
  return Boolean(wakeSentinel);
}

// -----------------------------------------------------------------------------------------------
// Orientation

/**
 * Tente de verrouiller l'écran en portrait. Ne fonctionne que dans l'application installée
 * (ou en plein écran) ; ailleurs, l'échec est silencieux. Renvoie Promise<boolean>.
 */
export async function lockPortrait() {
  try {
    if (!screen.orientation || typeof screen.orientation.lock !== 'function') return false;
    if (!isStandalone() && !document.fullscreenElement) return false;
    await screen.orientation.lock('portrait');
    return true;
  } catch {
    return false;
  }
}
