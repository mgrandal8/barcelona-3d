// Uso: node scripts/prueba-a11y.mjs [url-base] [bloques]
// Comprueba la sesión 12: axe en cada pantalla, recorrido solo con teclado, «reducir movimiento»,
// y oclusión y grupos de los pines. Y, de la sesión 10, los nombres de distritos, barrios y calles.
// bloques: lista separada por comas (axe,teclado,movimiento,pines,nombres); por defecto, todos.
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:5181/')
const bloques = (process.argv[3] ?? 'axe,teclado,movimiento,pines,nombres').split(',')
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const browser = await chromium.launch({ args: ARGS })
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

async function abrir(params, opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 }, locale: 'es-ES', ...opciones })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  const url = new URL(base)
  url.search = params
  await page.goto(url.href)
  return { ctx, page, errores }
}
const listo = (page) => page.waitForFunction(() => window.__estado?.getState().carga.listo, null, { timeout: 240000 })
const estado = (page, f) => page.evaluate(`(${f})(window.__estado.getState())`)
const pines = (page) => page.evaluate(() => ({ ver: [...window.__pines.ver], grupos: window.__pines.grupos.map((g) => [...g]) }))
const posicion = (page) => page.evaluate(() => window.__controles.getPosition(new window.__controles.camera.position.constructor()).toArray())
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const activo = (page) =>
  page.evaluate(() => {
    const a = document.activeElement
    return { clase: a?.className ?? '', lugar: a?.dataset?.lugar ?? null, enDialogo: !!a?.closest('.dialogo'), etiqueta: a?.tagName }
  })

/** axe sin violaciones serias ni críticas (el canvas se deja fuera: es la maqueta, con su etiqueta). */
async function axe(page, nombre) {
  const r = await new AxeBuilder({ page }).exclude('canvas').analyze()
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  ok(graves.length === 0, `axe · ${nombre}` + graves.map((v) => `\n      ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`).join(''))
}

if (bloques.includes('axe')) {
  // con «reducir movimiento» no hay fundidos: axe no mide colores a medio aparecer
  const quieto = { reducedMotion: 'reduce' }
  // portada (sin ?captura, que la salta)
  {
    const { ctx, page } = await abrir('', quieto)
    await page.waitForSelector('.portada-botones button', { timeout: 240000 })
    // que termine la animación de entrada: a medio fundido axe mide colores mezclados
    await page.waitForTimeout(1500)
    await axe(page, 'portada')
    await ctx.close()
  }
  const { ctx, page, errores } = await abrir('?captura=1&postpro=0', quieto)
  await listo(page)
  await page.waitForTimeout(2000)
  await axe(page, 'mapa')
  await estado(page, (s) => s.setSeleccionado('sagrada-familia'))
  await page.waitForTimeout(1500)
  await axe(page, 'ficha')
  await estado(page, (s) => s.setSeleccionado(null))
  for (const d of ['tours', 'guia', 'ayuda']) {
    await page.evaluate((d) => window.__estado.getState().setDialogo(d), d)
    await page.waitForTimeout(800)
    await axe(page, `diálogo ${d}`)
  }
  await estado(page, (s) => s.setDialogo(null))
  await estado(page, (s) => s.empezarTour('gaudi'))
  await page.waitForTimeout(1500)
  await axe(page, 'tour')
  ok(errores.length === 0, 'sin errores de página' + (errores.length ? ': ' + errores.join(' | ') : ''))
  await ctx.close()
  {
    const { ctx, page } = await abrir('?captura=1&modo=ligero', quieto)
    await page.waitForFunction(() => document.querySelector('.plano')?.dataset.listo === '1', null, { timeout: 120000 })
    await axe(page, 'versión ligera')
    await ctx.close()
  }
}

if (bloques.includes('teclado')) {
  const { ctx, page } = await abrir('?captura=1&postpro=0')
  await listo(page)
  await page.waitForTimeout(2000)
  await page.keyboard.press('Tab')
  ok((await activo(page)).clase.includes('saltar'), 'el primer Tab va al enlace «Ir a la lista»')
  // Tab hasta el primer pin
  let a
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    a = await activo(page)
    if (a.clase.includes('pin') && a.lugar) break
  }
  ok(!!a?.lugar, 'se llega a un pin con el tabulador: ' + a?.lugar)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  ok((await estado(page, (s) => s.seleccionado)) === a.lugar, 'Intro en el pin abre su ficha')
  ok((await activo(page)).etiqueta === 'H2', 'el foco pasa al título de la ficha')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  ok((await estado(page, (s) => s.seleccionado)) === null, 'Esc cierra la ficha')
  ok((await activo(page)).lugar === a.lugar, 'el foco vuelve al pin')
  // diálogo: el foco no se escapa y vuelve al cerrar
  await page.keyboard.press('?')
  await page.waitForTimeout(500)
  let dentro = true
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    dentro &&= (await activo(page)).enDialogo
  }
  ok(dentro, 'Tab no sale del diálogo de ayuda')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  ok((await activo(page)).lugar === a.lugar, 'al cerrar el diálogo el foco vuelve adonde estaba')
  // la maqueta con el teclado
  await page.locator('.maqueta').focus()
  const p0 = await posicion(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('+')
  await page.waitForTimeout(3000)
  const p1 = await posicion(page)
  ok(distancia(p0, p1) > 1, `flechas y + mueven la cámara (${distancia(p0, p1).toFixed(1)} u)`)
  await page.keyboard.press('Home')
  await page.waitForTimeout(4000)
  ok(distancia(await posicion(page), [-2, 62, 78.4]) < 1, 'Inicio vuelve a la vista general')
  await ctx.close()
}

if (bloques.includes('movimiento')) {
  const { ctx, page } = await abrir('?captura=1&postpro=0', { reducedMotion: 'reduce' })
  await listo(page)
  await page.waitForTimeout(1500)
  await estado(page, (s) => s.setSeleccionado('casa-batllo'))
  await page.waitForTimeout(1200)
  const a = await posicion(page)
  await page.waitForTimeout(3000)
  const b = await posicion(page)
  ok(distancia(a, [-2, 62, 78.4]) > 20 && distancia(a, b) < 0.05, `con «reducir movimiento» la cámara llega sin vuelo (${distancia(a, b).toFixed(3)} u después)`)
  await ctx.close()
}

if (bloques.includes('pines')) {
  {
    const { ctx, page } = await abrir('?captura=1&postpro=0')
    await listo(page)
    await page.waitForTimeout(3000)
    const n = await page.locator('.capa-pines .pin[data-ver="1"]').count()
    ok(n >= 6, `vista general: ${n} pines visibles`)
    await ctx.close()
  }
  {
    // a ras de calle, detrás de los edificios del Eixample, el pin de la Casa Batlló queda tapado
    const { ctx, page } = await abrir('?captura=1&postpro=0&cam=2.6,0.75,3.2,-0.42,1.3,0.21')
    await listo(page)
    await page.waitForFunction(() => window.__pines.ver.length === 8, null, { timeout: 60000 })
    await page.waitForTimeout(3000)
    ok((await pines(page)).ver[1] === false, 'pin tapado por un edificio: oculto')
    await page.evaluate(() => window.__controles.setLookAt(2.6, 4, 3.2, -0.42, 1.3, 0.21, false))
    await page.waitForTimeout(3000)
    ok((await pines(page)).ver[1] === true, 'con la cámara más alta: visible')
    await ctx.close()
  }
  {
    // muy lejos, la Casa Batlló y la Catedral se juntan; al pulsar el grupo, la cámara se acerca y se separan
    const { ctx, page } = await abrir('?captura=1&postpro=0&cam=6,150,190,2,0,-4')
    await listo(page)
    await page.waitForTimeout(3000)
    const { grupos } = await pines(page)
    ok(grupos.length > 0, 'desde lejos hay grupos: ' + JSON.stringify(grupos))
    await page.locator('.pin-grupo').first().click({ force: true })
    await page.waitForTimeout(8000)
    const despues = (await pines(page)).grupos.flat()
    ok(grupos[0].every((id) => !despues.includes(id)), 'al pulsar el grupo se separan: ' + JSON.stringify(despues))
    await ctx.close()
  }
}

if (bloques.includes('nombres')) {
  // qué nombres se ven (nivel y caja en pantalla), leídos del DOM
  const vistos = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.capa-nombres span[data-ver="1"]')].map((s) => {
        const r = s.getBoundingClientRect()
        return { n: s.textContent, clase: s.className, caja: [r.left, r.top, r.right, r.bottom] }
      }),
    )
  const cajasPines = (page) =>
    page.evaluate(() => [...document.querySelectorAll('.capa-pines .pin[data-ver="1"] .pin-num')].map((p) => { const r = p.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }))
  const choca = (a, b) => a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2
  const { ctx, page, errores } = await abrir('?captura=1&postpro=0', { reducedMotion: 'reduce' })
  await listo(page)
  await page.waitForFunction(() => document.querySelectorAll('.capa-nombres span[data-ver="1"]').length > 0, null, { timeout: 60000 })
  await page.waitForTimeout(2000)
  let n = await vistos(page)
  ok(n.filter((x) => x.clase === 'nombre-distrito').length >= 6 && n.every((x) => x.clase === 'nombre-distrito'), `vista general: ${n.length} distritos y municipios, sin barrios ni calles`)
  const p = await cajasPines(page)
  ok(!n.some((x) => p.some((c) => choca(x.caja, c))), 'ningún nombre pisa un pin')
  ok(!n.some((x, i) => n.some((y, j) => i < j && choca(x.caja, y.caja))), 'ningún nombre pisa a otro')
  const lista = await page.locator('#lista').boundingBox()
  ok(!n.some((x) => choca(x.caja, [lista.x, lista.y, lista.x + lista.width, lista.y + lista.height])), 'ninguno queda debajo de la lista')
  // a media altura, barrios; de cerca, calles (con el Passeig de Gràcia)
  // dos veces: la primera vista tras cargar a veces no se aplica; con la máquina cargada, se espera a que salgan
  const esperar = (clase) =>
    page.waitForFunction((c) => document.querySelectorAll(`.capa-nombres .${c}[data-ver="1"]`).length > 0, clase, { timeout: 60000 }).catch(() => {})
  for (let k = 0; k < 2; k++) {
    await page.evaluate(() => window.__controles.setLookAt(2, 26, 32, 0, 0, 6, false))
    await page.waitForTimeout(1500)
  }
  await esperar('nombre-barrio')
  await page.waitForTimeout(1500)
  n = await vistos(page)
  ok(n.filter((x) => x.clase === 'nombre-barrio').length >= 5, `a media altura: ${n.filter((x) => x.clase === 'nombre-barrio').length} barrios`)
  await page.evaluate(() => window.__controles.setLookAt(0, 7, 12, 0, 0, 3, false))
  await esperar('nombre-calle')
  await page.waitForTimeout(3000)
  n = await vistos(page)
  ok(n.some((x) => x.n === 'Passeig de Gràcia') && n.filter((x) => x.clase === 'nombre-calle').length >= 3, `de cerca: ${n.filter((x) => x.clase === 'nombre-calle').map((x) => x.n).join(', ')}`)
  ok(await page.locator('.capa-nombres').getAttribute('aria-hidden') === 'true', 'la capa de nombres no la lee el lector de pantalla')
  ok(!errores.length, 'sin errores: ' + errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo OK')
process.exit(fallos ? 1 : 0)
