// Uso: node scripts/prueba-ui.mjs [url-base]
// Comprueba la lógica de la interfaz: tour desde la URL, tecla ?, Esc con diálogo abierto y fin del tour.
import { chromium } from 'playwright'
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
const url = new URL(process.argv[2] ?? 'http://localhost:5173/')
url.search = '?captura=1&postpro=0&lugar=catedral&tour=ciutat-vella'
await page.goto(url.href)
await page.waitForFunction(() => window.__estado, null, { timeout: 120000 })
const st = () => page.evaluate(() => { const s = window.__estado.getState(); return { sel: s.seleccionado, tour: s.tour, dialogo: s.dialogo, portada: s.portada, listo: s.carga.listo } })
const ok = (c, msg) => console.log(c ? 'OK ' : 'FALLO', msg)
let s = await st(); ok(s.tour === 'ciutat-vella' && s.sel === 'catedral' && !s.portada, 'tour desde la URL ' + JSON.stringify(s))
await page.keyboard.press('?'); await page.waitForTimeout(500)
s = await st(); ok(s.dialogo === 'ayuda', 'la tecla ? abre la ayuda')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
s = await st(); ok(s.dialogo === null && s.sel === 'catedral', 'Esc cierra solo el diálogo')
await page.evaluate(() => window.__estado.getState().setSeleccionado('barceloneta'))
s = await st(); ok(s.tour === 'ciutat-vella', 'una parada del tour mantiene el tour')
await page.evaluate(() => window.__estado.getState().setSeleccionado('camp-nou'))
s = await st(); ok(s.tour === null && !page.url().includes('tour='), 'un lugar fuera del tour lo termina')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
s = await st(); ok(s.sel === null, 'Esc vuelve al mapa')
await page.waitForFunction(() => window.__estado.getState().carga.listo, null, { timeout: 120000 })
ok(true, 'carga terminada')
if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
await browser.close(); process.exit(0)
