// Uso: node scripts/prueba-pwa.mjs guardar|sin-red [url] [perfil]
// Comprueba la PWA sobre el build (en desarrollo no hay service worker), en dos fases con el mismo perfil:
//   BASE=/barcelona-3d/ npm run build && BASE=/barcelona-3d/ npx vite preview --port 5177 --strictPort
//   node scripts/prueba-pwa.mjs guardar http://localhost:5177/barcelona-3d/   (con el servidor: guarda la copia)
//   … se para el servidor …
//   node scripts/prueba-pwa.mjs sin-red http://localhost:5177/barcelona-3d/   (sin servidor: todo sale de la caché)
// Parar el servidor de verdad es más fiable que el modo sin red de Playwright, que no siempre alcanza al service worker.
// Sin ?captura (que desactiva el service worker): se mira el DOM en vez del store.
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'

const fase = process.argv[2]
const base = new URL(process.argv[3] ?? 'http://localhost:5177/barcelona-3d/')
const perfil = process.argv[4] ?? `${tmpdir()}/bcn3d-prueba-pwa`
const ctx = await chromium.launchPersistentContext(perfil, {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  viewport: { width: 1200, height: 750 },
  locale: 'es-ES',
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
const errores = []
page.on('pageerror', (e) => errores.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
page.on('requestfailed', (r) => errores.push(`petición fallida: ${r.url()} (${r.failure()?.errorText})`))
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}
const url = (q) => new URL('?postpro=0&' + q, base).href
// la portada enseña los botones cuando la maqueta está lista
const esperarListo = () =>
  page.waitForSelector('.portada-botones button.primario', { timeout: 240000 }).catch(async (e) => {
    // para saber en qué paso se ha quedado
    console.log('estado:', await page.locator('.progreso small').allInnerTexts().catch(() => []), '\n' + errores.join('\n'))
    throw e
  })

if (fase === 'guardar') {
  await page.goto(url('lang=es'))
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 120000 })
  ok(true, 'el service worker controla la página')
  const guardados = await page.evaluate(async () => {
    const nombres = []
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) nombres.push(new URL(r.url).pathname)
    return nombres
  })
  ok(
    ['datos/edificios.bin.gz', 'datos/transporte.json.gz', 'index.html', 'edificios.worker'].every((f) => guardados.some((g) => g.includes(f))),
    `caché con ${guardados.length} ficheros (datos, worker, index.html)`,
  )
  await esperarListo()
  await page.locator('.portada-botones button.primario').click()
  await page.keyboard.press('?')
  ok((await page.locator('.sin-conexion').innerText()).includes('Disponible sin conexión'), 'la ayuda dice que está disponible sin conexión')
} else {
  // además del servidor parado, el navegador sin red (para navigator.onLine y el aviso)
  await ctx.setOffline(true)
  await page.goto(url('lang=es'), { timeout: 120000, waitUntil: 'commit' })
  await esperarListo()
  ok(true, 'sin red: la maqueta carga entera desde la caché')
  await page.waitForSelector('.aviso-red.sin-red', { timeout: 10000 }).catch(() => {})
  ok((await page.locator('.aviso-red').innerText().catch(() => '')).includes('copia guardada'), 'aviso «sin conexión: copia guardada»')

  // un enlace a un lugar, en inglés, también sin red
  await page.goto(url('lugar=park-guell&lang=en'), { timeout: 120000, waitUntil: 'commit' })
  await page.waitForSelector('.panel.abierto h2', { timeout: 240000 })
  ok((await page.locator('.panel.abierto h2').innerText()) === 'Park Güell', 'sin red, un enlace ?lugar= abre la ficha')
  await page.waitForFunction(() => document.querySelector('.carga.oculta'), null, { timeout: 240000 })
  ok(true, 'sin red, la carga del enlace termina')
}

if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
if (fallos) console.log(`${fallos} fallo(s)`)
await ctx.close()
process.exit(fallos ? 1 : 0)
