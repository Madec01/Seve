// Service worker de « Une année à la ferme » : tout le jeu hors ligne.
//
// - Précache : la liste PRECACHE (générée par tools/build-sw-manifest.js, avec une empreinte par
//   fichier) est téléchargée à l'installation. Les entrées sont rangées sous la clé
//   « chemin?__rev=<empreinte> » dans un cache unique : d'une version à l'autre, seuls les fichiers
//   modifiés sont retéléchargés, et une installation interrompue reprend là où elle s'était arrêtée.
//   Chaque fichier téléchargé est vérifié (SHA-256) : si le CDN sert encore l'ancienne version,
//   l'installation échoue proprement et sera retentée plus tard (jamais de mélange de versions).
// - Requêtes :
//     navigation (index.html, ?niveau…)  → index.html de la version installée (cohérent avec les
//                                           JS/CSS en cache), réseau en secours ;
//     fichiers précachés                 → cache d'abord (les fichiers sont versionnés), réseau en secours ;
//     requêtes « Range » (audio)         → réponse 206 construite à partir du fichier complet en cache ;
//     autres requêtes du même site       → réseau d'abord, cache en secours ;
//     autres sites                       → non interceptées.
// - Mise à jour : le nouveau service worker attend ; la page affiche « Nouvelle version disponible —
//   Recharger » et envoie { type: 'SKIP_WAITING' } (voir src/pwa.js, applyUpdate()).
//   À l'activation, les entrées obsolètes et les anciens caches sont supprimés.
//
// Toutes les adresses sont relatives à l'emplacement de ce fichier : le jeu fonctionne aussi dans
// un sous-dossier (GitHub Pages : https://madec01.github.io/Seve/).

// <precache> — bloc généré par tools/build-sw-manifest.js : ne pas modifier à la main
const VERSION = '0a3667198b46';
// 175 fichiers, 25.8 Mo
const PRECACHE = [
  ["assets/audio/ambience/bees.mp3", 'a0fd6a9f8b4f57e0', 536786],
  ["assets/audio/ambience/bees.ogg", '0391e2b371b08a96', 400705],
  ["assets/audio/ambience/birds.mp3", 'b142bbde6b7d5d29', 2776602],
  ["assets/audio/ambience/birds.ogg", '423ae3c86f921f50', 2202194],
  ["assets/audio/ambience/rain.mp3", '7d95cb23ce7dce2b', 712508],
  ["assets/audio/ambience/rain.ogg", '57aa4718f38cd7f9', 642105],
  ["assets/audio/ambience/wind.mp3", '082ac9200562e5fb', 126260],
  ["assets/audio/ambience/wind.ogg", 'f93f4aceae8c122a', 91783],
  ["assets/audio/music/autumn.mp3", '64c89a4fe6cd440d', 894958],
  ["assets/audio/music/autumn.ogg", '512acf4f44d97497', 847422],
  ["assets/audio/music/festival-intro.mp3", '27cfcaf9790f62a4', 163570],
  ["assets/audio/music/festival-intro.ogg", '665d883a019d2a7c', 190015],
  ["assets/audio/music/festival-loop.mp3", '8ac6bbfd592b611a', 1025373],
  ["assets/audio/music/festival-loop.ogg", 'ab65059db1ea8826', 859451],
  ["assets/audio/music/festival.mp3", 'ed7944cbb5bc92b9', 1198435],
  ["assets/audio/music/festival.ogg", '097849c62fb13976', 1066123],
  ["assets/audio/music/menu.mp3", 'baf19e1dba805e1c', 1138111],
  ["assets/audio/music/menu.ogg", 'f70ff9e6900d3a17', 971422],
  ["assets/audio/music/night.mp3", 'dfdc7f41cbc7eadf', 1173724],
  ["assets/audio/music/night.ogg", '66d5b5166313bb9b', 1092443],
  ["assets/audio/music/spring.mp3", '32e7c6d1d2fc957d', 862688],
  ["assets/audio/music/spring.ogg", '0cdc44cff0c95c2c', 970677],
  ["assets/audio/music/summer.mp3", '28ce0967b1b8b571', 937844],
  ["assets/audio/music/summer.ogg", '38a049b2aa49266b', 972595],
  ["assets/audio/music/winter.mp3", 'b7a6285c39118c23', 1732540],
  ["assets/audio/music/winter.ogg", 'c5d8d67fcae075bc', 1865469],
  ["assets/audio/sfx/bankrupt.mp3", '94e50788650c59f8', 15793],
  ["assets/audio/sfx/bankrupt.ogg", '421d13d90211bf16', 17431],
  ["assets/audio/sfx/bees.mp3", 'ef081fa8f0790e55', 56561],
  ["assets/audio/sfx/bees.ogg", '68135e45d83ee5c9', 40863],
  ["assets/audio/sfx/build.mp3", 'f96afd323a32d8e8', 6004],
  ["assets/audio/sfx/build.ogg", '91d42eb067c3bece', 11700],
  ["assets/audio/sfx/buy.mp3", '90d05fac1ff1092b', 27758],
  ["assets/audio/sfx/buy.ogg", '407a2253fc2fefd6', 23914],
  ["assets/audio/sfx/chicken.mp3", '4a8d4bb9f106ec0c', 12740],
  ["assets/audio/sfx/chicken.ogg", 'f888543e9cf02a5d', 13530],
  ["assets/audio/sfx/click.mp3", 'cc9219204d0eab52', 1686],
  ["assets/audio/sfx/click.ogg", '81fd7d224b7c7189', 5173],
  ["assets/audio/sfx/close.mp3", 'd1f6d243018a4904', 6092],
  ["assets/audio/sfx/close.ogg", '8d4916b4e6872bda', 9196],
  ["assets/audio/sfx/coin.mp3", '785211c28f339fdf', 13719],
  ["assets/audio/sfx/coin.ogg", 'afc8dbdcc7053d58', 13580],
  ["assets/audio/sfx/confirm.mp3", 'f3b72de0a7c6cbe4', 4634],
  ["assets/audio/sfx/confirm.ogg", '495c27ab6d3c5988', 6326],
  ["assets/audio/sfx/cow.mp3", 'f0248666cf52b9b1', 31683],
  ["assets/audio/sfx/cow.ogg", '252b90e846c51419', 28179],
  ["assets/audio/sfx/dig.mp3", '4ae679689ecffdeb', 6722],
  ["assets/audio/sfx/dig.ogg", '86a72ca25586ee56', 9175],
  ["assets/audio/sfx/error.mp3", 'b8f3b3bf65480140', 4636],
  ["assets/audio/sfx/error.ogg", '94e14c4fc03dd36c', 7655],
  ["assets/audio/sfx/frost-jingle.mp3", '1473e3e46c040503', 13603],
  ["assets/audio/sfx/frost-jingle.ogg", 'fc83dfe8df8c144e', 15215],
  ["assets/audio/sfx/frost.mp3", '48a7643b72625dd5', 3714],
  ["assets/audio/sfx/frost.ogg", 'f2c83a95ee327f54', 8039],
  ["assets/audio/sfx/harvest.mp3", 'a4dea31e26628a24', 2859],
  ["assets/audio/sfx/harvest.ogg", '104e9c63fed44d68', 6298],
  ["assets/audio/sfx/hover.mp3", '818dca25abbd1396', 1400],
  ["assets/audio/sfx/hover.ogg", '0eaef792f389ad69', 4952],
  ["assets/audio/sfx/open.mp3", 'be93588a9e55c659', 6929],
  ["assets/audio/sfx/open.ogg", '6ee551988132bc3b', 9497],
  ["assets/audio/sfx/page.mp3", '43022d771bf053dc', 16328],
  ["assets/audio/sfx/page.ogg", 'a7d62dfb283e69d3', 12848],
  ["assets/audio/sfx/plant.mp3", '13b840adc4220c4f', 4370],
  ["assets/audio/sfx/plant.ogg", '777ce935668337ba', 7676],
  ["assets/audio/sfx/rooster.mp3", 'aa5d9b6bdd1f42c9', 63929],
  ["assets/audio/sfx/rooster.ogg", '85ac6f0a90280cc6', 48343],
  ["assets/audio/sfx/rot.mp3", 'a32c6b09a9e6bb40', 3376],
  ["assets/audio/sfx/rot.ogg", '3f2e140ed687c32a', 6433],
  ["assets/audio/sfx/season-end.mp3", '2df810b06112d4cd', 10813],
  ["assets/audio/sfx/season-end.ogg", '34273d6fd64ac845', 13044],
  ["assets/audio/sfx/sheep.mp3", '5d9d7a6ca7ee4993', 33868],
  ["assets/audio/sfx/sheep.ogg", '648657b50675423e', 32016],
  ["assets/audio/sfx/toggle.mp3", 'ca5dd2087a8047f1', 3016],
  ["assets/audio/sfx/toggle.ogg", '0aa33c00e3841eec', 6414],
  ["assets/audio/sfx/unlock.mp3", 'eba62d5d6ccd8071', 7421],
  ["assets/audio/sfx/unlock.ogg", '89ca071d3b37a1e5', 10292],
  ["assets/audio/sfx/victory.mp3", '387f1c86779f7c50', 19186],
  ["assets/audio/sfx/victory.ogg", '582e7e9c9fe438b7', 19375],
  ["assets/audio/sfx/warning.mp3", '981d3805c438bb5e', 5962],
  ["assets/audio/sfx/warning.ogg", '14e8bfdb92deae18', 7606],
  ["assets/audio/sfx/water.mp3", '898376bf9f725470', 49516],
  ["assets/audio/sfx/water.ogg", '5e3fde1d073426cb', 43670],
  ["assets/fonts/Jersey15-Regular.ttf", 'dbe00479d62bb3b9', 104236],
  ["assets/fonts/JerseyFerme-Bold.woff2", '5a0b3c6fc315dd10', 8844],
  ["assets/fonts/JerseyFerme-Regular.woff2", '921e5a900c757d6a', 9176],
  ["assets/icons/apple-touch-icon.png", '207355e92ef9dfa2', 1174],
  ["assets/icons/favicon-32.png", '535e1f2a1bd8c4ec', 727],
  ["assets/icons/favicon-48.png", '58de2e31e833c24e', 757],
  ["assets/icons/icon-192.png", '9909cab8e44388b3', 1615],
  ["assets/icons/icon-512.png", '7933ec77229a1877', 3799],
  ["assets/icons/icon-maskable-192.png", '955883df454e3ac1', 1168],
  ["assets/icons/icon-maskable-512.png", 'adfb6dc71f0d09e7', 2647],
  ["assets/icons/icon-monochrome-512.png", '0e59bf529a1bdbba', 1506],
  ["assets/sprites/extra.png", '098e40185d5f7f51', 1950],
  ["assets/sprites/tiny-farm.png", '0c4b3b4058cacf6a', 5866],
  ["assets/sprites/tiny-town.png", '3a54d99ecde790d4', 5042],
  ["assets/sprites/ui/banner-red-ribbon.png", 'a9c09c09bbfd099d', 594],
  ["assets/sprites/ui/banner-red.png", 'e25d37fce435ce01', 571],
  ["assets/sprites/ui/bar-red-slate.png", '67d9426c9c51149e', 312],
  ["assets/sprites/ui/button-close.png", '4237f83967b7b6ab', 198],
  ["assets/sprites/ui/button-red.png", 'b2f03467f990179c', 162],
  ["assets/sprites/ui/button-slate-close.png", '0f395624d17a58f0', 203],
  ["assets/sprites/ui/button-slate.png", '6f312a0eb18c6698', 166],
  ["assets/sprites/ui/checkbox-off.png", 'a88107a698a36b67', 172],
  ["assets/sprites/ui/checkbox-on.png", 'dae54cd3c5734aae', 210],
  ["assets/sprites/ui/favicon.png", '6e10cce65f2ed7a9', 391],
  ["assets/sprites/ui/gauge-red.png", '5ff80b2f522379fc', 245],
  ["assets/sprites/ui/icon-alert.png", '127c0d53366e12f8', 139],
  ["assets/sprites/ui/icon-arrow-up.png", '5ea441f0ecaceb39', 162],
  ["assets/sprites/ui/icon-dot.png", 'bee6b4e1ae9e6776', 143],
  ["assets/sprites/ui/icon-plus-red.png", 'fa2a4ab5fb651c08', 165],
  ["assets/sprites/ui/icon-plus.png", '484b00221459f594', 156],
  ["assets/sprites/ui/icon-warning.png", 'bf9665a22cd9f343', 131],
  ["assets/sprites/ui/icons.png", '841d055e54530205', 2942],
  ["assets/sprites/ui/panel-parchment-grid.png", '4b073a2bdfaed7d8', 344],
  ["assets/sprites/ui/panel-parchment-ornate.png", 'ba01f4acbef326fb', 699],
  ["assets/sprites/ui/panel-parchment-worn.png", '9038e017f743a31e', 342],
  ["assets/sprites/ui/panel-parchment.png", '6dcb4d98118bae52', 223],
  ["assets/sprites/ui/panel-slate-blue.png", 'e342b58e547c28d3', 451],
  ["assets/sprites/ui/panel-slate-green.png", '650eea75f693a23f', 469],
  ["assets/sprites/ui/panel-slate-light.png", 'bcb0b32f78657522', 228],
  ["assets/sprites/ui/panel-slate-red.png", 'cbb8506677449d53', 442],
  ["assets/sprites/ui/panel-slate.png", 'fab7ffebc26741e6', 206],
  ["assets/sprites/ui/panel-water-grid.png", '6c4df351145a8ab4', 343],
  ["assets/sprites/ui/panel-wood-ornate.png", '813a37b214879933', 634],
  ["assets/sprites/ui/panel-wood-worn.png", 'fcf15bb08c471a50', 304],
  ["assets/sprites/ui/panel-wood.png", 'dffbbd8e9e87059c', 199],
  ["assets/sprites/ui/radio-off.png", 'a30ab47e223d6099', 208],
  ["assets/sprites/ui/radio-on.png", 'af910bc437f48814', 220],
  ["assets/sprites/ui/round-parchment.png", 'b33632dda9100f70', 344],
  ["assets/sprites/ui/round-wood.png", '5e218733d935467f', 317],
  ["assets/sprites/ui/slot-parchment.png", '57ce96c6f85e42d1', 196],
  ["assets/sprites/ui/slot-wood.png", '77631b56d79873e0', 174],
  ["css/fonts.css", 'f6a60d8eb500f8f4', 1207],
  ["css/style.css", '568cbb6386a056fd', 65340],
  ["index.html", 'c44edf67845fe7aa', 8759],
  ["manifest.webmanifest", 'c406b9280302ded5', 1562],
  ["src/audio/audio.js", '833e59968773e1a0', 15982],
  ["src/audio/manifest.js", 'bcd255827929807c', 3941],
  ["src/core/calendar.js", 'adf7ac06b4e95cec', 1963],
  ["src/core/economy.js", '84ce1bf05d91e684', 5415],
  ["src/core/events.js", '467b3069052f8d70', 744],
  ["src/core/farm.js", '53f250a4d1c7ba83', 5997],
  ["src/core/game.js", 'c05d0e87b49b79e0', 24784],
  ["src/core/market.js", 'b44b99ed21844017', 1412],
  ["src/core/rng.js", '025e534f65322939', 2719],
  ["src/core/stats.js", '805d6bb7862c93b8', 2127],
  ["src/core/weather.js", '875f3410fa4564a6', 690],
  ["src/data/balance.js", 'd3f28fc92ba51403', 2188],
  ["src/data/crops.js", 'c011ab1a1ddd7943', 1591],
  ["src/data/investments.js", '095673bbf646f849', 3948],
  ["src/data/levels.js", 'bf9b0a69d5b26474', 6618],
  ["src/main.js", '26c82953148a8f14', 44562],
  ["src/pwa.js", '625641ad027af640', 11832],
  ["src/render/assets.js", 'f7d380c1734854a3', 7648],
  ["src/render/atlas.js", 'f5fa36a437ff3ef1', 21103],
  ["src/render/effects.js", 'e97cc5de1031a21e', 35559],
  ["src/render/layout-common.js", '26d7d02798dcb1a7', 9176],
  ["src/render/layout-portrait.js", '3ef02f6b7b1ff1f7', 19152],
  ["src/render/layout.js", 'ece7d711b704bfe8', 14708],
  ["src/render/scene.js", 'ec5d41414b82420a', 52959],
  ["src/storage.js", '8ca43f6dabd9fc8d', 5321],
  ["src/ui/dialogs.js", 'ecad44809c6926a5', 31542],
  ["src/ui/dom.js", '4ce9149d5d52a48f', 5278],
  ["src/ui/field.js", '2dd12f3b67d206f1', 18884],
  ["src/ui/gestures.js", 'ae98ca4707dfecd5', 10330],
  ["src/ui/hud.js", '420ecbc77fcbcaeb', 16491],
  ["src/ui/icons.js", '0171f8b27c837bda', 3990],
  ["src/ui/panel.js", '4f3ce52754586e1e', 16373],
  ["src/ui/sheets.js", '69f0e66f53f93bcf', 8248],
  ["src/ui/tabbar.js", 'df6fca62dd05cf4e', 1880],
  ["src/ui/text.js", 'c08166c9b956236e', 4353],
  ["src/ui/toasts.js", '8d18c790b8818d48', 4000],
  ["src/ui/tooltip.js", 'b2da8b2d915163ab', 3543],
  ["src/ui/tutorial.js", 'd7ef47041f84272f', 24013],
];
// </precache>

const CACHE = 'ferme-precache-v1';   // cache des fichiers versionnés (entrées « ?__rev= »)
const RUNTIME = 'ferme-runtime-v1';  // copies des autres requêtes du même site (secours hors ligne)
const KEEP = new Set([CACHE, RUNTIME]);
const CONCURRENCY = 6;
const RETRIES = 3;

const BASE = new URL('./', self.location).href; // racine du jeu (…/Seve/)
const INDEX_URL = new URL('index.html', BASE).href;

// chemin absolu (sans requête) → { key, hash }
const ENTRIES = new Map(
  PRECACHE.map(([path, hash]) => {
    const url = new URL(path, BASE).href;
    return [url, { key: `${url}?__rev=${hash}`, hash, path }];
  }),
);
const WANTED_KEYS = new Set([...ENTRIES.values()].map((e) => e.key));

// ---------------------------------------------------------------------------------------------
// Installation : téléchargement (vérifié) des fichiers qui ne sont pas encore en cache.

async function sha16(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchVerified(url, hash) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      // 1er essai : on contourne le cache HTTP du navigateur ; ensuite : on contourne aussi le CDN.
      const target = attempt === 0 ? url : `${url}?__rev=${hash}&__try=${attempt}`;
      const res = await fetch(target, { cache: 'reload', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const body = await res.arrayBuffer();
      const got = await sha16(body);
      if (got !== hash) throw new Error(`empreinte inattendue pour ${url} (${got} ≠ ${hash})`);
      const headers = new Headers();
      headers.set('Content-Type', res.headers.get('Content-Type') || 'application/octet-stream');
      headers.set('Content-Length', String(body.byteLength));
      headers.set('Accept-Ranges', 'bytes');
      return new Response(body, { status: 200, statusText: 'OK', headers });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function precache() {
  const cache = await caches.open(CACHE);
  const present = new Set((await cache.keys()).map((r) => r.url));
  const todo = [...ENTRIES.entries()].filter(([, e]) => !present.has(e.key));
  let next = 0;
  let failure = null;
  async function worker() {
    while (next < todo.length && !failure) {
      const [url, e] = todo[next++];
      try {
        await cache.put(e.key, await fetchVerified(url, e.hash));
      } catch (err) {
        failure = err;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (failure) throw failure; // l'installation échoue ; les fichiers déjà rangés restent pour la prochaine fois
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  // Pas de skipWaiting() ici : la page le demande (bouton « Recharger »). Première installation :
  // il n'y a pas d'ancienne version, le service worker s'active tout de suite de lui-même.
});

// ---------------------------------------------------------------------------------------------
// Activation : ménage (entrées d'anciennes versions, anciens caches), puis prise de contrôle.

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('ferme-') && !KEEP.has(name)) await caches.delete(name);
    }
    const cache = await caches.open(CACHE);
    for (const req of await cache.keys()) {
      if (!WANTED_KEYS.has(req.url)) await cache.delete(req);
    }
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch { /* sans importance */ }
    }
    await self.clients.claim();
  })());
});

// ---------------------------------------------------------------------------------------------
// Messages de la page.

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION, files: PRECACHE.length });
  }
});

// ---------------------------------------------------------------------------------------------
// Requêtes.

/** Réponse partielle (206) construite à partir d'une réponse complète, pour un en-tête Range. */
async function rangeResponse(full, rangeHeader) {
  const buf = await full.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec((rangeHeader || '').trim());
  let start;
  let end;
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') { // suffixe : les N derniers octets
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
  }
  const type = full.headers.get('Content-Type') || 'application/octet-stream';
  if (start === undefined || start >= size || end < start) {
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

async function fromPrecache(url) {
  const e = ENTRIES.get(url);
  if (!e) return undefined;
  const cache = await caches.open(CACHE);
  return cache.match(e.key);
}

async function handleNavigation(request) {
  // index.html de la version installée : toujours cohérent avec les scripts et styles en cache.
  const cached = await fromPrecache(INDEX_URL);
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (err) {
    const fallback = await caches.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
}

async function handlePrecached(request, url) {
  const cached = await fromPrecache(url);
  if (cached) {
    const range = request.headers.get('Range');
    return range ? rangeResponse(cached, range) : cached;
  }
  return fetch(request); // pas (encore) en cache : réseau
}

async function handleRuntime(request) {
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      caches.open(RUNTIME).then((c) => c.put(request, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request, { cacheName: RUNTIME });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return; // autre site / hors du jeu

  if (request.mode === 'navigate') {
    // Seules les pages du jeu (racine ou index.html) : un autre fichier HTML (outils) passe par le réseau.
    const path = url.pathname.slice(new URL(BASE).pathname.length);
    if (path === '' || path === 'index.html') {
      event.respondWith(handleNavigation(request));
      return;
    }
  }

  const clean = url.origin + url.pathname; // sans « ?… » ni « #… »
  if (ENTRIES.has(clean)) {
    event.respondWith(handlePrecached(request, clean));
    return;
  }
  event.respondWith(handleRuntime(request));
});
