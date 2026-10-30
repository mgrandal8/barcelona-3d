// Service worker de Barcelona 3D. Es una plantilla: vite.config.ts (plugin pwa) rellena VERSION y ARCHIVOS
// en cada build y lo deja en dist/sw.js. Guarda el build entero (código, datos e iconos) para usar la guía sin conexión.
const VERSION = '__VERSION__'
const ARCHIVOS = __ARCHIVOS__
const CACHE = 'bcn3d-' + VERSION
// con mala cobertura, la página guardada sale antes que esperar a la red indefinidamente
const ESPERA_RED = 5000

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)))
})

// una versión nueva espera a que el usuario pulse «Recargar»
self.addEventListener('message', (e) => {
  if (e.data === 'activar') self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('bcn3d-') && k !== CACHE) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

// ignoreVary: lo guardado no lleva Origin, y los módulos (crossorigin) sí; con «Vary: Origin» no coincidirían
const buscar = (req) => caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true })
const pagina = () => buscar(new URL('index.html', self.registration.scope).href)

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  // la página: red primero (para ver las versiones nuevas) y, sin red, la guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, ESPERA_RED))]).catch(async () => (await pagina()) ?? fetch(req)),
    )
    return
  }
  // el resto lleva el hash en el nombre (o es un dato que cambia con la versión): caché primero
  e.respondWith(buscar(req).then((r) => r ?? fetch(req)))
})
