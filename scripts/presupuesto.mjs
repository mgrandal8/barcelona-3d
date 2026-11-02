// Uso: node scripts/presupuesto.mjs [url-para-medir-la-carga]
// Comprueba el presupuesto de peso y de carga (presupuesto.json) sobre dist/ (hay que hacer antes el build).
//   peso   kB con gzip: lo que pide index.html al abrir (JS + modulepreload + CSS), todo el JS, cada chunk grande,
//          los workers y los datos de la ciudad (ya comprimidos); y que los chunks pesados no se precarguen
//   carga  con una URL (vite preview): primer pintado (la portada), MB de red hasta la ciudad lista y tiempo hasta lista
//          (por software, así que el límite es holgado: sirve para ver saltos grandes, no décimas)
// Sale con 1 si algo se pasa. En GitHub Actions, además, escribe la tabla en el resumen del job.
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const P = JSON.parse(readFileSync('presupuesto.json', 'utf8'))
const filas = []
let fallos = 0
const kB = (b) => +(b / 1024).toFixed(1)
const gz = (f) => gzipSync(readFileSync(f), { level: 9 }).length
function fila(nombre, valor, limite, unidad = 'kB') {
  const bien = valor <= limite
  if (!bien) fallos++
  filas.push({ nombre, valor, limite, unidad, bien })
}

// --- peso ---
const html = readFileSync('dist/index.html', 'utf8')
const pedidos = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="(?:modulepreload|stylesheet)"[^>]*\shref)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])
const enDist = (url) => 'dist/' + url.replace(/^.*?assets\//, 'assets/')
fila('Arranque (index.html: JS y CSS)', kB(pedidos.reduce((s, u) => s + gz(enDist(u)), 0)), P.peso.inicial)
const assets = readdirSync('dist/assets')
const js = assets.filter((f) => f.endsWith('.js'))
const css = assets.filter((f) => f.endsWith('.css'))
fila('CSS', kB(css.reduce((s, f) => s + gz('dist/assets/' + f), 0)), P.peso.css)
fila('Todo el JS', kB(js.reduce((s, f) => s + gz('dist/assets/' + f), 0)), P.peso.js_total)
for (const [nombre, limite] of Object.entries(P.peso.chunks)) {
  const f = js.find((x) => x.startsWith(nombre + '-'))
  if (!f) {
    fallos++
    filas.push({ nombre: `chunk ${nombre}`, valor: 'no está', limite, unidad: 'kB', bien: false })
  } else fila(`chunk ${nombre}`, kB(gz('dist/assets/' + f)), limite)
}
fila('Workers', kB(js.filter((f) => f.includes('.worker-')).reduce((s, f) => s + gz('dist/assets/' + f), 0)), P.peso.workers)
// los .gz ya van comprimidos: se cuenta lo que baja
const datos = readdirSync('dist/datos').reduce((s, f) => s + (f.endsWith('.gz') ? statSync('dist/datos/' + f).size : gz('dist/datos/' + f)), 0)
fila('Datos de la ciudad', kB(datos), P.peso.datos)
for (const nombre of P.sin_precarga) {
  const precargado = pedidos.some((u) => u.includes(`/${nombre}-`))
  if (precargado) fallos++
  filas.push({ nombre: `${nombre} no se precarga`, valor: precargado ? 'sí' : 'no', limite: 'no', unidad: '', bien: !precargado })
}

// --- carga ---
const url = process.argv[2]
if (url) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width: 1200, height: 750 }, locale: 'es-ES' })
  let bytes = 0
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength))
  const t0 = Date.now()
  // con la portada (sin ?captura no se ve el estado: se espera a que desaparezca la tarjeta de carga)
  const u = new URL(url)
  u.search = '?captura=1&entrada=1&postpro=0'
  await page.goto(u.href)
  await page.waitForFunction(() => window.__estado?.getState().carga.listo, null, { timeout: P.carga.listo_ms + 60000, polling: 250 })
  const listo = Date.now() - t0
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1)
  const errores = await page.evaluate(() => window.__errores?.length ?? 0)
  await browser.close()
  fila('Primer pintado (portada)', Math.round(fcp), P.carga.primer_pintado_ms, 'ms')
  fila('Red de la página hasta la ciudad lista (sin workers)', +(bytes / 1e6).toFixed(2), P.carga.red_MB, 'MB')
  fila('Ciudad lista (por software)', listo, P.carga.listo_ms, 'ms')
  fila('Errores registrados', errores, 0, '')
}

const ancho = Math.max(...filas.map((f) => f.nombre.length))
for (const f of filas) console.log(`${f.bien ? 'OK ' : 'PASA'} ${f.nombre.padEnd(ancho)}  ${String(f.valor).padStart(8)} ${f.unidad}  (límite ${f.limite})`)
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ['### Presupuesto de peso y carga', '', '| | Medida | Límite |', '|---|---:|---:|', ...filas.map((f) => `| ${f.bien ? '✅' : '❌'} ${f.nombre} | ${f.valor} ${f.unidad} | ${f.limite} ${f.unidad} |`), '']
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n'))
}
console.log(fallos ? `\n${fallos} medida(s) fuera de presupuesto` : '\nDentro del presupuesto')
process.exit(fallos ? 1 : 0)
