// Service worker de « Une année à la ferme » : tout le jeu hors ligne, sans jamais mélanger deux
// versions.
//
// Le jeu publié est construit par tools/build.js : UN fichier JavaScript et UN fichier CSS dont le
// nom contient l'empreinte du contenu (dist/game.<empreinte>.js / .css), et des images/sons appelés
// avec « ?v=<empreinte> ». Une page index.html, quelle que soit sa version, ne désigne donc que des
// fichiers qui lui correspondent exactement : c'est ce qui rend les choix ci-dessous sûrs.
//
// - Précache : la liste PRECACHE (générée par tools/build.js, avec une empreinte par fichier).
//   Les entrées sont rangées sous la clé « chemin?__rev=<empreinte> » dans un cache unique : d'une
//   version à l'autre, seuls les fichiers modifiés sont retéléchargés. Chaque fichier téléchargé est
//   vérifié (SHA-256) : si le CDN sert encore l'ancienne version, l'installation échoue proprement
//   et sera retentée plus tard.
//     « core » (page, paquet JS/CSS, police, images, icônes, manifeste, ~1 Mo) : téléchargé à
//       l'installation ;
//     « lazy » (sons, ~25 Mo en deux formats) : rangé au premier usage (le jeu les précharge en
//       fond), seulement le format que le navigateur utilise ; vérifié de la même façon.
// - Requêtes :
//     navigation (index.html, ?…)  → RÉSEAU D'ABORD (revalidé, jamais une vieille copie du cache
//                                     HTTP), délai de 5 s ; hors ligne ou réseau trop lent → page de
//                                     la version installée (cohérente avec son précache) ;
//     fichiers précachés           → cache d'abord ; si l'adresse porte « ?v=<empreinte> » et
//                                     qu'elle ne correspond pas à la version en cache → réseau ;
//     requêtes « Range » (audio)   → réponse 206 construite à partir du fichier complet en cache ;
//     autres requêtes du même site → réseau d'abord, cache en secours ;
//     autres sites                 → non interceptées.
// - Mise à jour : le nouveau service worker s'active tout de suite (skipWaiting) : tout le code du
//   jeu est dans un seul fichier déjà exécuté, aucune page ouverte ne peut donc charger un morceau
//   de code d'une autre version. La page compare sa version à celle du service worker
//   (src/pwa.js) et propose « Nouvelle version disponible — Recharger » si elle est plus ancienne.
//   À l'activation, les entrées obsolètes et les anciens caches sont supprimés.
//
// Toutes les adresses sont relatives à l'emplacement de ce fichier : le jeu fonctionne aussi dans
// un sous-dossier (GitHub Pages : https://madec01.github.io/Seve/).

// <precache> — bloc généré par tools/build.js : ne pas modifier à la main
const VERSION = '7a73da6224d8';
// 138 fichiers, 26.1 Mo ; installés d'emblée (core) : 56 fichiers, 1.04 Mo
const PRECACHE = [
  ["index.html", 'fc341c72ee06dcd4', 25863, 'core'],
  ["manifest.webmanifest", 'c406b9280302ded5', 1562, 'core'],
  ["dist/game.edf28a990a.js", 'b17a4d663f328249', 802986, 'core'],
  ["dist/game.85f90c30bf.css", '85f90c30bfcefc83', 97779, 'core'],
  ["assets/audio/ambience/bees.mp3", 'a0fd6a9f8b4f57e0', 536786, 'lazy'],
  ["assets/audio/ambience/bees.ogg", '0391e2b371b08a96', 400705, 'lazy'],
  ["assets/audio/ambience/birds.mp3", 'b142bbde6b7d5d29', 2776602, 'lazy'],
  ["assets/audio/ambience/birds.ogg", '423ae3c86f921f50', 2202194, 'lazy'],
  ["assets/audio/ambience/rain.mp3", '7d95cb23ce7dce2b', 712508, 'lazy'],
  ["assets/audio/ambience/rain.ogg", '57aa4718f38cd7f9', 642105, 'lazy'],
  ["assets/audio/ambience/wind.mp3", '082ac9200562e5fb', 126260, 'lazy'],
  ["assets/audio/ambience/wind.ogg", 'f93f4aceae8c122a', 91783, 'lazy'],
  ["assets/audio/music/autumn.mp3", '64c89a4fe6cd440d', 894958, 'lazy'],
  ["assets/audio/music/autumn.ogg", '512acf4f44d97497', 847422, 'lazy'],
  ["assets/audio/music/festival-intro.mp3", '27cfcaf9790f62a4', 163570, 'lazy'],
  ["assets/audio/music/festival-intro.ogg", '665d883a019d2a7c', 190015, 'lazy'],
  ["assets/audio/music/festival-loop.mp3", '8ac6bbfd592b611a', 1025373, 'lazy'],
  ["assets/audio/music/festival-loop.ogg", 'ab65059db1ea8826', 859451, 'lazy'],
  ["assets/audio/music/festival.mp3", 'ed7944cbb5bc92b9', 1198435, 'lazy'],
  ["assets/audio/music/festival.ogg", '097849c62fb13976', 1066123, 'lazy'],
  ["assets/audio/music/menu.mp3", 'baf19e1dba805e1c', 1138111, 'lazy'],
  ["assets/audio/music/menu.ogg", 'f70ff9e6900d3a17', 971422, 'lazy'],
  ["assets/audio/music/night.mp3", 'dfdc7f41cbc7eadf', 1173724, 'lazy'],
  ["assets/audio/music/night.ogg", '66d5b5166313bb9b', 1092443, 'lazy'],
  ["assets/audio/music/spring.mp3", '32e7c6d1d2fc957d', 862688, 'lazy'],
  ["assets/audio/music/spring.ogg", '0cdc44cff0c95c2c', 970677, 'lazy'],
  ["assets/audio/music/summer.mp3", '28ce0967b1b8b571', 937844, 'lazy'],
  ["assets/audio/music/summer.ogg", '38a049b2aa49266b', 972595, 'lazy'],
  ["assets/audio/music/winter.mp3", 'b7a6285c39118c23', 1732540, 'lazy'],
  ["assets/audio/music/winter.ogg", 'c5d8d67fcae075bc', 1865469, 'lazy'],
  ["assets/audio/sfx/bankrupt.mp3", '94e50788650c59f8', 15793, 'lazy'],
  ["assets/audio/sfx/bankrupt.ogg", '421d13d90211bf16', 17431, 'lazy'],
  ["assets/audio/sfx/bees.mp3", 'ef081fa8f0790e55', 56561, 'lazy'],
  ["assets/audio/sfx/bees.ogg", '68135e45d83ee5c9', 40863, 'lazy'],
  ["assets/audio/sfx/build.mp3", 'f96afd323a32d8e8', 6004, 'lazy'],
  ["assets/audio/sfx/build.ogg", '91d42eb067c3bece', 11700, 'lazy'],
  ["assets/audio/sfx/buy.mp3", '90d05fac1ff1092b', 27758, 'lazy'],
  ["assets/audio/sfx/buy.ogg", '407a2253fc2fefd6', 23914, 'lazy'],
  ["assets/audio/sfx/chicken.mp3", '4a8d4bb9f106ec0c', 12740, 'lazy'],
  ["assets/audio/sfx/chicken.ogg", 'f888543e9cf02a5d', 13530, 'lazy'],
  ["assets/audio/sfx/click.mp3", 'cc9219204d0eab52', 1686, 'lazy'],
  ["assets/audio/sfx/click.ogg", '81fd7d224b7c7189', 5173, 'lazy'],
  ["assets/audio/sfx/close.mp3", 'd1f6d243018a4904', 6092, 'lazy'],
  ["assets/audio/sfx/close.ogg", '8d4916b4e6872bda', 9196, 'lazy'],
  ["assets/audio/sfx/coin.mp3", '785211c28f339fdf', 13719, 'lazy'],
  ["assets/audio/sfx/coin.ogg", 'afc8dbdcc7053d58', 13580, 'lazy'],
  ["assets/audio/sfx/confirm.mp3", 'f3b72de0a7c6cbe4', 4634, 'lazy'],
  ["assets/audio/sfx/confirm.ogg", '495c27ab6d3c5988', 6326, 'lazy'],
  ["assets/audio/sfx/cow.mp3", 'f0248666cf52b9b1', 31683, 'lazy'],
  ["assets/audio/sfx/cow.ogg", '252b90e846c51419', 28179, 'lazy'],
  ["assets/audio/sfx/dig.mp3", '4ae679689ecffdeb', 6722, 'lazy'],
  ["assets/audio/sfx/dig.ogg", '86a72ca25586ee56', 9175, 'lazy'],
  ["assets/audio/sfx/error.mp3", 'b8f3b3bf65480140', 4636, 'lazy'],
  ["assets/audio/sfx/error.ogg", '94e14c4fc03dd36c', 7655, 'lazy'],
  ["assets/audio/sfx/frost-jingle.mp3", '1473e3e46c040503', 13603, 'lazy'],
  ["assets/audio/sfx/frost-jingle.ogg", 'fc83dfe8df8c144e', 15215, 'lazy'],
  ["assets/audio/sfx/frost.mp3", '48a7643b72625dd5', 3714, 'lazy'],
  ["assets/audio/sfx/frost.ogg", 'f2c83a95ee327f54', 8039, 'lazy'],
  ["assets/audio/sfx/harvest.mp3", 'a4dea31e26628a24', 2859, 'lazy'],
  ["assets/audio/sfx/harvest.ogg", '104e9c63fed44d68', 6298, 'lazy'],
  ["assets/audio/sfx/hover.mp3", '818dca25abbd1396', 1400, 'lazy'],
  ["assets/audio/sfx/hover.ogg", '0eaef792f389ad69', 4952, 'lazy'],
  ["assets/audio/sfx/open.mp3", 'be93588a9e55c659', 6929, 'lazy'],
  ["assets/audio/sfx/open.ogg", '6ee551988132bc3b', 9497, 'lazy'],
  ["assets/audio/sfx/page.mp3", '43022d771bf053dc', 16328, 'lazy'],
  ["assets/audio/sfx/page.ogg", 'a7d62dfb283e69d3', 12848, 'lazy'],
  ["assets/audio/sfx/plant.mp3", '13b840adc4220c4f', 4370, 'lazy'],
  ["assets/audio/sfx/plant.ogg", '777ce935668337ba', 7676, 'lazy'],
  ["assets/audio/sfx/rooster.mp3", 'aa5d9b6bdd1f42c9', 63929, 'lazy'],
  ["assets/audio/sfx/rooster.ogg", '85ac6f0a90280cc6', 48343, 'lazy'],
  ["assets/audio/sfx/rot.mp3", 'a32c6b09a9e6bb40', 3376, 'lazy'],
  ["assets/audio/sfx/rot.ogg", '3f2e140ed687c32a', 6433, 'lazy'],
  ["assets/audio/sfx/season-end.mp3", '2df810b06112d4cd', 10813, 'lazy'],
  ["assets/audio/sfx/season-end.ogg", '34273d6fd64ac845', 13044, 'lazy'],
  ["assets/audio/sfx/sheep.mp3", '5d9d7a6ca7ee4993', 33868, 'lazy'],
  ["assets/audio/sfx/sheep.ogg", '648657b50675423e', 32016, 'lazy'],
  ["assets/audio/sfx/toggle.mp3", 'ca5dd2087a8047f1', 3016, 'lazy'],
  ["assets/audio/sfx/toggle.ogg", '0aa33c00e3841eec', 6414, 'lazy'],
  ["assets/audio/sfx/unlock.mp3", 'eba62d5d6ccd8071', 7421, 'lazy'],
  ["assets/audio/sfx/unlock.ogg", '89ca071d3b37a1e5', 10292, 'lazy'],
  ["assets/audio/sfx/victory.mp3", '387f1c86779f7c50', 19186, 'lazy'],
  ["assets/audio/sfx/victory.ogg", '582e7e9c9fe438b7', 19375, 'lazy'],
  ["assets/audio/sfx/warning.mp3", '981d3805c438bb5e', 5962, 'lazy'],
  ["assets/audio/sfx/warning.ogg", '14e8bfdb92deae18', 7606, 'lazy'],
  ["assets/audio/sfx/water.mp3", '898376bf9f725470', 49516, 'lazy'],
  ["assets/audio/sfx/water.ogg", '5e3fde1d073426cb', 43670, 'lazy'],
  ["assets/fonts/JerseyFerme-Bold.woff2", '5a0b3c6fc315dd10', 8844, 'core'],
  ["assets/fonts/JerseyFerme-Regular.woff2", '921e5a900c757d6a', 9176, 'core'],
  ["assets/icons/apple-touch-icon.png", '207355e92ef9dfa2', 1174, 'core'],
  ["assets/icons/favicon-32.png", '535e1f2a1bd8c4ec', 727, 'core'],
  ["assets/icons/favicon-48.png", '58de2e31e833c24e', 757, 'core'],
  ["assets/icons/icon-192.png", '9909cab8e44388b3', 1615, 'core'],
  ["assets/icons/icon-512.png", '7933ec77229a1877', 3799, 'core'],
  ["assets/icons/icon-maskable-192.png", '955883df454e3ac1', 1168, 'core'],
  ["assets/icons/icon-maskable-512.png", 'adfb6dc71f0d09e7', 2647, 'core'],
  ["assets/icons/icon-monochrome-512.png", '0e59bf529a1bdbba', 1506, 'core'],
  ["assets/sprites/career.png", 'a05ea5957d8b0ab0', 89751, 'core'],
  ["assets/sprites/extra.png", '098e40185d5f7f51', 1950, 'core'],
  ["assets/sprites/tiny-farm.png", '0c4b3b4058cacf6a', 5866, 'core'],
  ["assets/sprites/tiny-town.png", '3a54d99ecde790d4', 5042, 'core'],
  ["assets/sprites/ui/banner-red-ribbon.png", 'a9c09c09bbfd099d', 594, 'core'],
  ["assets/sprites/ui/banner-red.png", 'e25d37fce435ce01', 571, 'core'],
  ["assets/sprites/ui/bar-red-slate.png", '67d9426c9c51149e', 312, 'core'],
  ["assets/sprites/ui/button-close.png", '4237f83967b7b6ab', 198, 'core'],
  ["assets/sprites/ui/button-red.png", 'b2f03467f990179c', 162, 'core'],
  ["assets/sprites/ui/button-slate-close.png", '0f395624d17a58f0', 203, 'core'],
  ["assets/sprites/ui/button-slate.png", '6f312a0eb18c6698', 166, 'core'],
  ["assets/sprites/ui/checkbox-off.png", 'a88107a698a36b67', 172, 'core'],
  ["assets/sprites/ui/checkbox-on.png", 'dae54cd3c5734aae', 210, 'core'],
  ["assets/sprites/ui/favicon.png", '6e10cce65f2ed7a9', 391, 'core'],
  ["assets/sprites/ui/gauge-red.png", '5ff80b2f522379fc', 245, 'core'],
  ["assets/sprites/ui/icon-alert.png", '127c0d53366e12f8', 139, 'core'],
  ["assets/sprites/ui/icon-arrow-up.png", '5ea441f0ecaceb39', 162, 'core'],
  ["assets/sprites/ui/icon-dot.png", 'bee6b4e1ae9e6776', 143, 'core'],
  ["assets/sprites/ui/icon-plus-red.png", 'fa2a4ab5fb651c08', 165, 'core'],
  ["assets/sprites/ui/icon-plus.png", '484b00221459f594', 156, 'core'],
  ["assets/sprites/ui/icon-warning.png", 'bf9665a22cd9f343', 131, 'core'],
  ["assets/sprites/ui/icons.png", '841d055e54530205', 2942, 'core'],
  ["assets/sprites/ui/panel-parchment-grid.png", '4b073a2bdfaed7d8', 344, 'core'],
  ["assets/sprites/ui/panel-parchment-ornate.png", 'ba01f4acbef326fb', 699, 'core'],
  ["assets/sprites/ui/panel-parchment-worn.png", '9038e017f743a31e', 342, 'core'],
  ["assets/sprites/ui/panel-parchment.png", '6dcb4d98118bae52', 223, 'core'],
  ["assets/sprites/ui/panel-slate-blue.png", 'e342b58e547c28d3', 451, 'core'],
  ["assets/sprites/ui/panel-slate-green.png", '650eea75f693a23f', 469, 'core'],
  ["assets/sprites/ui/panel-slate-light.png", 'bcb0b32f78657522', 228, 'core'],
  ["assets/sprites/ui/panel-slate-red.png", 'cbb8506677449d53', 442, 'core'],
  ["assets/sprites/ui/panel-slate.png", 'fab7ffebc26741e6', 206, 'core'],
  ["assets/sprites/ui/panel-water-grid.png", '6c4df351145a8ab4', 343, 'core'],
  ["assets/sprites/ui/panel-wood-ornate.png", '813a37b214879933', 634, 'core'],
  ["assets/sprites/ui/panel-wood-worn.png", 'fcf15bb08c471a50', 304, 'core'],
  ["assets/sprites/ui/panel-wood.png", 'dffbbd8e9e87059c', 199, 'core'],
  ["assets/sprites/ui/radio-off.png", 'a30ab47e223d6099', 208, 'core'],
  ["assets/sprites/ui/radio-on.png", 'af910bc437f48814', 220, 'core'],
  ["assets/sprites/ui/round-parchment.png", 'b33632dda9100f70', 344, 'core'],
  ["assets/sprites/ui/round-wood.png", '5e218733d935467f', 317, 'core'],
  ["assets/sprites/ui/slot-parchment.png", '57ce96c6f85e42d1', 196, 'core'],
  ["assets/sprites/ui/slot-wood.png", '77631b56d79873e0', 174, 'core'],
  ["assets/sprites/v3.png", '897aacf1899d5794', 18649, 'core'],
];
// </precache>

const CACHE = 'ferme-precache-v2';   // fichiers versionnés (entrées « ?__rev= »)
const RUNTIME = 'ferme-runtime-v2';  // copies des autres requêtes du même site (secours hors ligne)
const KEEP = new Set([CACHE, RUNTIME]);
const CONCURRENCY = 6;
const RETRIES = 3;
const NAVIGATION_TIMEOUT = 5000; // ms avant de servir la page de la version installée

const BASE = new URL('./', self.location).href; // racine du jeu (…/Seve/)
const INDEX_URL = new URL('index.html', BASE).href;

// chemin absolu (sans requête) → { key, hash, lazy }
const ENTRIES = new Map(
  PRECACHE.map(([path, hash, , kind]) => {
    const url = new URL(path, BASE).href;
    return [url, { key: `${url}?__rev=${hash}`, hash, path, lazy: kind === 'lazy' }];
  }),
);
const WANTED_KEYS = new Set([...ENTRIES.values()].map((e) => e.key));

// ---------------------------------------------------------------------------------------------
// Vérification des fichiers téléchargés.

async function sha16(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function storedResponse(body, type) {
  const headers = new Headers();
  headers.set('Content-Type', type || 'application/octet-stream');
  headers.set('Content-Length', String(body.byteLength));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(body, { status: 200, statusText: 'OK', headers });
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
      return storedResponse(body, res.headers.get('Content-Type'));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------------------------
// Installation : téléchargement (vérifié) des fichiers « core » qui ne sont pas encore en cache.

async function precache() {
  const cache = await caches.open(CACHE);
  const present = new Set((await cache.keys()).map((r) => r.url));
  const todo = [...ENTRIES.entries()].filter(([, e]) => !e.lazy && !present.has(e.key));
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
  event.waitUntil(precache().then(() => self.skipWaiting()));
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
    await caches.delete(RUNTIME); // copies de l'ancienne version : inutiles
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

/**
 * Page du jeu : réseau d'abord (revalidé auprès du serveur : jamais une vieille copie du cache
 * HTTP), puis, hors ligne ou au bout de NAVIGATION_TIMEOUT, la page de la version installée.
 * Les deux sont cohérentes : chaque index.html ne désigne que des fichiers à empreinte.
 */
async function handleNavigation(request) {
  const network = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res.redirected) return Response.redirect(res.url, 302);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  });
  const fallback = async () => (await fromPrecache(INDEX_URL)) || (await caches.match(request, { cacheName: RUNTIME, ignoreSearch: true }));
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(resolve, NAVIGATION_TIMEOUT, 'slow'); });
  try {
    const first = await Promise.race([network, slow]);
    if (first !== 'slow') return first;
    const cached = await fallback();
    return cached || (await network);
  } catch (err) {
    const cached = await fallback();
    if (cached) return cached;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Télécharge un fichier « lazy » (son) et le range s'il est bien celui de cette version. */
async function fetchAndStore(request, e) {
  const res = await fetch(request.url, { credentials: 'same-origin' });
  if (!res.ok || res.status !== 200) return res;
  const body = await res.arrayBuffer();
  const type = res.headers.get('Content-Type');
  if ((await sha16(body)) === e.hash) {
    const copy = storedResponse(body.slice(0), type);
    caches.open(CACHE).then((c) => c.put(e.key, copy)).catch(() => {});
  }
  return storedResponse(body, type);
}

async function handlePrecached(request, url, e) {
  const cached = await fromPrecache(url);
  let res = cached;
  if (!res) res = e.lazy ? await fetchAndStore(request, e) : await fetch(request);
  const range = request.headers.get('Range');
  return range && res.status === 200 ? rangeResponse(res, range) : res;
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
    // Seules les pages du jeu (racine ou index.html) : un autre fichier HTML (dev.html, outils)
    // passe par le réseau.
    const path = url.pathname.slice(new URL(BASE).pathname.length);
    if (path === '' || path === 'index.html') {
      event.respondWith(handleNavigation(request));
      return;
    }
  }

  const clean = url.origin + url.pathname; // sans « ?… » ni « #… »
  const e = ENTRIES.get(clean);
  if (e) {
    // « ?v=<empreinte> » d'une autre version (page plus récente ou plus ancienne que ce service
    // worker) : on ne sert pas notre copie, c'est le réseau qui répond.
    const v = url.searchParams.get('v');
    if (v && !e.hash.startsWith(v)) {
      event.respondWith(fetch(request));
      return;
    }
    // Autres paramètres (« ?r= » d'un nouvel essai du chargeur, « ?__rev= »…) : réseau aussi.
    if ([...url.searchParams.keys()].some((k) => k !== 'v')) return;
    event.respondWith(handlePrecached(request, clean, e));
    return;
  }
  event.respondWith(handleRuntime(request));
});
