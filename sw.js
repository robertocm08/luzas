// =====================================================================
// sw.js — "Service worker": un pequeño programa que el navegador guarda
// y que se coloca entre la app e Internet. Sirve para:
//   - Guardar los archivos de la app en el móvil → abre rápido y sin conexión.
//   - Guardar los últimos datos descargados → se ven aunque no haya Internet.
//   - Mostrar las notificaciones del aviso de la luz.
//
// Si cambias la lista de archivos, sube el número de VERSION para que los
// móviles borren la copia antigua.
// =====================================================================
const VERSION = 'v1';
const CACHE_APP = `luzas-app-${VERSION}`;
const CACHE_DATOS = 'luzas-datos';
const DESARROLLO = ['localhost', '127.0.0.1'].includes(self.location.hostname);

const ARCHIVOS_APP = [
  './',
  'index.html',
  'manifest.json',
  'css/estilos.css',
  'js/app.js',
  'js/calculos.js',
  'js/fuentes.js',
  'js/formato.js',
  'js/datos-luz.js',
  'js/luz.js',
  'js/aviso.js',
  'iconos/icono.svg',
  'iconos/icono-192.png',
];

// Al instalarse: descarga y guarda los archivos de la app.
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(ARCHIVOS_APP)).then(() => self.skipWaiting()));
});

// Al activarse: borra las copias de versiones antiguas.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres
        .filter((n) => n.startsWith('luzas-app-') && n !== CACHE_APP)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Cada vez que la app pide algo a Internet pasa por aquí.
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);

  // Solo nos ocupamos de nuestros propios archivos. Las APIs externas (REE...)
  // van directas; la app ya guarda su propia copia de esos datos.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/data/')) {
    // DATOS: primero Internet (queremos lo más nuevo); si falla, la copia guardada.
    evento.respondWith(
      fetch(peticion)
        .then((resp) => {
          if (resp.ok) { const copia = resp.clone(); caches.open(CACHE_DATOS).then((c) => c.put(peticion, copia)); }
          return resp;
        })
        .catch(() => caches.match(peticion, { ignoreSearch: true }).then((r) => r ?? Response.error())),
    );
    return;
  }

  // En tu ordenador (localhost) siempre primero lo nuevo, para ver tus cambios al momento.
  if (DESARROLLO) {
    evento.respondWith(fetch(peticion).catch(() => caches.match(peticion, { ignoreSearch: true })));
    return;
  }

  // ARCHIVOS DE LA APP: se sirve la copia guardada al instante (rápido) y, a la
  // vez, se descarga la versión nueva para la próxima vez.
  evento.respondWith(
    caches.open(CACHE_APP).then(async (cache) => {
      const guardada = await cache.match(peticion, { ignoreSearch: true });
      const nueva = fetch(peticion)
        .then((resp) => { if (resp.ok) cache.put(peticion, resp.clone()); return resp; })
        .catch(() => guardada ?? caches.match('index.html'));
      return guardada ?? nueva;
    }),
  );
});

// Al pulsar una notificación, abre (o trae al frente) la app en la pantalla de la luz.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((ventanas) => {
      const abierta = ventanas.find((v) => 'focus' in v);
      return abierta ? abierta.focus() : self.clients.openWindow('./#luz');
    }),
  );
});
