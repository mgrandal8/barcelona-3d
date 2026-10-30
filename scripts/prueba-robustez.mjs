// Uso: node scripts/prueba-robustez.mjs [url-base] [bloques]
// Comprueba la sesión 9: versión ligera, sin WebGL, error de datos con «Reintentar», postproceso diferido,
// calidad baja y contexto WebGL perdido.
// bloques: lista separada por comas (ligera,sinwebgl,datos,postpro,calidad,contexto); por defecto, todos.
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:5176/')
const bloques = (process.argv[3] ?? 'ligera,sinwebgl,datos,postpro,calidad,contexto').split(',')
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
let browser = await chromium.launch({ args: ARGS })
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

/** Abre una página con los parámetros dados; `antes` puede poner rutas o scripts antes de cargar. */
async function abrir(params, antes) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 }, locale: 'es-ES' })
  const page = await ctx.newPage()
  const errores = []
  const pedidos = []
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('request', (r) => pedidos.push(r.url()))
  await antes?.(page)
  const url = new URL(base)
  url.search = '?captura=1&' + params
  await page.goto(url.href)
  await page.waitForFunction(() => window.__estado, null, { timeout: 120000 })
  return { ctx, page, errores, pedidos }
}
const listo = (page) => page.waitForFunction(() => window.__estado.getState().carga.listo, null, { timeout: 240000 })
const estado = (page, f) => page.evaluate(`(${f})(window.__estado.getState())`)
// three: el chunk del build o el módulo pre-empaquetado de Vite en desarrollo
const esThree = (u) => /assets\/three-|\.vite\/deps\/three\.js/.test(u)

if (bloques.includes('ligera')) {
  const { ctx, page, errores, pedidos } = await abrir('modo=ligero')
  await page.waitForSelector('.plano canvas', { timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('.plano')?.dataset.listo === '1', null, { timeout: 120000 })
  ok((await page.locator('.plano-pin').count()) === 8, 'versión ligera: mapa 2D con 8 pines')
  ok(await page.locator('.ligera-aviso').isVisible(), 'aviso de versión ligera')
  await page.locator('.plano-pin').nth(1).click({ force: true })
  await page.waitForTimeout(500)
  ok(!!(await estado(page, (s) => s.seleccionado)), 'clic en un pin selecciona el lugar')
  ok(await page.locator('.panel').first().isVisible(), 'se abre la ficha')
  ok(!pedidos.some((u) => u.includes('edificios.bin')), 'no descarga los edificios')
  ok(!pedidos.some(esThree), 'no descarga three')
  ok((await page.locator('canvas').count()) === 1, 'sin canvas WebGL (solo el del plano)')
  // «Ver la maqueta 3D» cambia de modo y levanta la escena
  await page.locator('.ligera-aviso button').click({ force: true })
  await listo(page)
  ok((await estado(page, (s) => s.modo)) === '3d', '«Ver la maqueta 3D» vuelve a la maqueta')
  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''))
  await ctx.close()
}

if (bloques.includes('sinwebgl')) {
  await browser.close()
  browser = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] })
  const { ctx, page, errores, pedidos } = await abrir('')
  await page.waitForSelector('.plano canvas', { timeout: 60000 })
  ok((await estado(page, (s) => s.modo)) === 'ligero', 'sin WebGL entra en la versión ligera')
  ok((await page.locator('.ligera-aviso').innerText()).includes('no puede mostrar la maqueta 3D'), 'aviso de que no hay 3D')
  ok((await page.locator('.ligera-aviso button').count()) === 0, 'sin botón para probar la 3D')
  ok(!pedidos.some(esThree), 'no descarga three')
  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''))
  await ctx.close()
  await browser.close()
  browser = await chromium.launch({ args: ARGS })
}

if (bloques.includes('datos')) {
  const { ctx, page } = await abrir('postpro=0', (p) => p.route('**/edificios.bin.gz', (r) => r.abort()))
  await page.waitForFunction(() => window.__estado.getState().fallo, null, { timeout: 120000 })
  ok((await estado(page, (s) => s.fallo)) === 'datos', 'sin edificios.bin.gz: fallo de datos')
  ok(await page.locator('.carga .fallo').isVisible(), 'la tarjeta de carga muestra el error')
  await page.unroute('**/edificios.bin.gz')
  await page.locator('.fallo button', { hasText: 'Reintentar' }).click({ force: true })
  await listo(page)
  ok((await estado(page, (s) => s.fallo)) === null, '«Reintentar» levanta la maqueta')
  ok(await page.locator('.carga.oculta').count() === 1, 'la tarjeta de carga se va')
  await ctx.close()
}

if (bloques.includes('postpro')) {
  const { ctx, page } = await abrir('calidad=alta')
  await page.evaluate(() =>
    window.__estado.subscribe((s) => {
      if (s.carga.listo && !window.__tListo) window.__tListo = performance.now()
    }),
  )
  await listo(page)
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((r) => /postpro/i.test(r.name)), null, { timeout: 120000 })
  const r = await page.evaluate(() => ({
    t: window.__tListo,
    inicio: Math.min(...performance.getEntriesByType('resource').filter((r) => /postpro/i.test(r.name)).map((r) => r.startTime)),
  }))
  ok(r.t && r.inicio > r.t, `el postproceso se pide después de «listo» (${Math.round(r.inicio - r.t)} ms después)`)
  await ctx.close()
}

if (bloques.includes('calidad')) {
  const { ctx, page, pedidos } = await abrir('calidad=baja')
  await listo(page)
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => ({ sombras: window.__gl.shadowMap.enabled, dpr: window.__gl.getPixelRatio() }))
  ok(r.sombras === false, '?calidad=baja: sin sombras')
  ok(r.dpr === 1, '?calidad=baja: dpr 1')
  ok(!pedidos.some((u) => /postpro/i.test(u)), '?calidad=baja: sin postproceso')
  await ctx.close()
}

if (bloques.includes('contexto')) {
  const { ctx, page } = await abrir('postpro=0')
  await listo(page)
  await page.evaluate(() => {
    window.__glViejo = window.__gl
    window.__gl.getContext().getExtension('WEBGL_lose_context').loseContext()
  })
  await page.waitForFunction(() => window.__estado.getState().fallo === 'contexto', null, { timeout: 60000 })
  ok(await page.locator('.carga .fallo').isVisible(), 'contexto perdido: aviso con «Reintentar»')
  await page.locator('.fallo button', { hasText: 'Reintentar' }).click({ force: true })
  await page.waitForFunction(() => window.__gl && window.__gl !== window.__glViejo && !window.__gl.getContext().isContextLost(), null, { timeout: 120000 })
  await page.waitForTimeout(2000)
  ok((await estado(page, (s) => s.fallo)) === null && (await page.locator('.carga.oculta').count()) === 1, 'la maqueta vuelve con un contexto nuevo')
  await ctx.close()
}

await browser.close()
console.log(fallos ? `${fallos} FALLOS` : 'TODO OK')
process.exit(fallos ? 1 : 0)
