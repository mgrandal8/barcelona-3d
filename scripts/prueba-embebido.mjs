// Uso: node scripts/prueba-embebido.mjs [url-base] [bloques]
// Comprueba el modo embebido (?embed=1) desde la página anfitriona de ejemplo (public/embebido/anfitrion.html):
//   datos     el JSON de ejemplo cambia precio y horario (también en inglés), los tours son los suyos, sin portada
//   mensajes  listo, seleccion y reservar llegan a la anfitriona; abrir, tour, idioma y hora llegan a la guía
//   seguridad un JSON de otro origen se rechaza (avisa con «error» y sigue con los datos de la demo); fuera de embed no hay «Reservar»
//   maqueta   lo mismo en 3D: la anfitriona recibe «listo» con modo 3d
// Los bloques ligeros van con ?modo=ligero (misma ficha y diálogos, sin esperar a la maqueta).
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:5191/')
const bloques = (process.argv[3] ?? 'datos,mensajes,seguridad,maqueta').split(',')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

/** Abre la anfitriona con los parámetros dados (pasan a la guía) y espera al mensaje «listo». */
async function anfitriona(params = 'modo=ligero&captura=1') {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 }, locale: 'es-ES', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(new URL('embebido/anfitrion.html?' + params, base).href)
  await page.waitForFunction(() => window.mensajes?.some((m) => m.tipo === 'listo'), null, { timeout: 240000, polling: 300 })
  const guia = page.frameLocator('#guia')
  const marco = page.frames().find((f) => f.url().includes('embed=1'))
  return { ctx, page, guia, marco, errores }
}
const mensajes = (page, tipo) => page.evaluate((t) => window.mensajes.filter((m) => m.tipo === t), tipo)
const esperarMensaje = (page, f) => page.waitForFunction(f, null, { timeout: 30000, polling: 200 })

if (bloques.includes('datos') || bloques.includes('mensajes')) {
  const { ctx, page, guia, marco, errores } = await anfitriona()
  const [listo] = await mensajes(page, 'listo')
  ok(listo.datos === 'externos' && listo.modo === 'ligero', `«listo» con datos externos: ${JSON.stringify(listo)}`)
  ok(JSON.stringify(listo.tours) === '["modernista","puerto-atardecer"]', 'los tours son los del JSON')
  ok(listo.lugares.length === 11, '«listo» lista los 11 lugares')
  ok(!(await marco.evaluate(() => window.__estado.getState().portada)), 'sin portada')
  ok(await marco.evaluate(() => document.documentElement.classList.contains('embebido')), '<html class="embebido">')

  if (bloques.includes('datos')) {
    await marco.evaluate(() => window.__estado.getState().setSeleccionado('sagrada-familia'))
    const ficha = guia.locator('.panel.abierto')
    await ficha.waitFor({ timeout: 20000 })
    const datos = await ficha.locator('.panel-datos').innerText()
    ok(datos.includes('34 € con guía de la agencia') && datos.includes('9:00, 12:00 y 16:00'), 'precio y horario del JSON en la ficha')
    ok((await ficha.locator('.panel-fuente').innerText()).includes('facilitados por Agencia de ejemplo'), 'la fuente dice de quién son los datos')
    ok((await ficha.locator('.panel-texto').innerText()).includes('obra maestra inacabada'), 'la descripción sigue siendo la de la guía')
    ok((await ficha.locator('.panel-reservar').innerText()).trim() === 'Reservar', 'botón «Reservar» en la ficha')
    await marco.evaluate(() => window.__estado.getState().setIdioma('en'))
    await page.waitForTimeout(300)
    const en = await ficha.locator('.panel-datos').innerText()
    ok(en.includes('€34 with the agency') && en.includes('Guided visits'), 'en inglés, la traducción del JSON')
    ok((await ficha.locator('.panel-texto').innerText()).includes('unfinished masterpiece'), 'en inglés, la descripción traducida de la guía')
    await marco.evaluate(() => window.__estado.getState().setIdioma('ca'))
    await marco.evaluate(() => window.__estado.getState().setSeleccionado('casa-batllo'))
    await page.waitForTimeout(300)
    ok((await ficha.locator('.panel-reservar').count()) === 0, 'sin «reserva» en el JSON, la ficha no tiene «Reservar»')
    ok((await ficha.locator('.panel-fuente').innerText()).includes('web oficial'), 'un lugar sin cambios conserva su fuente oficial')
    await marco.evaluate(() => {
      const s = window.__estado.getState()
      s.setIdioma('es')
      s.setSeleccionado(null)
      s.setDialogo('tours')
    })
    const dialogo = guia.locator('.dialogo')
    await dialogo.waitFor({ timeout: 20000 })
    ok((await dialogo.locator('h2').first().innerText()).trim() === 'Tours', 'el diálogo ya no dice «de ejemplo»')
    ok((await dialogo.locator('.tour').count()) === 2, 'dos tours en el diálogo')
    ok((await dialogo.locator('.tour-reservar').count()) === 2, 'cada tour con «Reservar»')
    await dialogo.locator('.tour-reservar').first().click({ force: true })
    await esperarMensaje(page, () => window.mensajes.some((m) => m.tipo === 'reservar'))
    const [r] = await mensajes(page, 'reservar')
    ok(r.tour === 'modernista' && r.reserva === 'lk-tour-modernista' && r.lugar === null && r.idioma === 'es', `«reservar» desde el diálogo: ${JSON.stringify(r)}`)
    ok(await page.locator('#reserva.visible').isVisible(), 'la anfitriona abre su reserva')
    await marco.evaluate(() => window.__estado.getState().setDialogo(null))
  }

  if (bloques.includes('mensajes')) {
    await page.evaluate(() => (window.mensajes.length = 0))
    await page.getByRole('button', { name: 'Abrir Sagrada Família' }).click()
    await esperarMensaje(page, () => window.mensajes.some((m) => m.tipo === 'seleccion' && m.lugar === 'sagrada-familia'))
    ok((await marco.evaluate(() => window.__estado.getState().seleccionado)) === 'sagrada-familia', '«abrir» desde la anfitriona abre la ficha y vuelve «seleccion»')
    await page.getByRole('button', { name: 'Tour modernista' }).click()
    await esperarMensaje(page, () => window.mensajes.some((m) => m.tipo === 'seleccion' && m.tour === 'modernista'))
    ok((await marco.evaluate(() => window.__estado.getState().tour)) === 'modernista', '«tour» empieza el tour del JSON')
    const nota = await guia.locator('.panel-tour-nota').innerText()
    ok(nota.includes('fachada del Nacimiento'), 'la nota de la parada es la del JSON')
    await guia.locator('.panel-reservar').click({ force: true })
    await esperarMensaje(page, () => window.mensajes.some((m) => m.tipo === 'reservar'))
    const [r] = await mensajes(page, 'reservar')
    ok(r.tour === 'modernista' && r.lugar === 'sagrada-familia' && r.reserva === 'lk-tour-modernista', `en un tour, «Reservar este tour»: ${JSON.stringify(r)}`)
    await page.getByRole('button', { name: 'Noche' }).click()
    await page.getByRole('button', { name: 'EN' }).click()
    await page.waitForTimeout(500)
    const s = await marco.evaluate(() => ({ m: window.__estado.getState().momento, i: window.__estado.getState().idioma }))
    ok(s.m === 'noche' && s.i === 'en', `«hora» e «idioma» desde la anfitriona: ${JSON.stringify(s)}`)
    // un mensaje de otra ventana (no la anfitriona) no hace nada
    await marco.evaluate(() => window.postMessage({ tipo: 'abrir', lugar: 'colom' }, '*'))
    await page.waitForTimeout(500)
    ok((await marco.evaluate(() => window.__estado.getState().seleccionado)) !== 'colom', 'los mensajes que no vienen de la anfitriona se ignoran')
    ok((await mensajes(page, 'error')).length === 0, 'ningún error')
  }
  ok((await marco.evaluate(() => window.__errores.length)) === 0, 'registro de errores vacío')
  if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
  await ctx.close()
}

if (bloques.includes('seguridad')) {
  const { ctx, page, guia, marco } = await anfitriona('modo=ligero&captura=1&datos=' + encodeURIComponent('https://example.com/datos.json'))
  const [listo] = await mensajes(page, 'listo')
  ok(listo.datos === 'error', `JSON de otro origen: «listo» con datos «error» (${listo.datos})`)
  const [e] = await mensajes(page, 'error')
  ok(e?.mensaje.includes('origen no permitido'), `y un «error»: ${e?.mensaje}`)
  ok(JSON.stringify(listo.tours) === '["gaudi","ciutat-vella","noche"]', 'sigue con los tours de la demo')
  await marco.evaluate(() => window.__estado.getState().setSeleccionado('sagrada-familia'))
  await guia.locator('.panel.abierto').waitFor({ timeout: 20000 })
  ok((await guia.locator('.panel-reservar').count()) === 0, 'sin datos externos no hay «Reservar»')
  await ctx.close()

  // la guía normal, sin embed: ni «Reservar» ni clase embebido, aunque el enlace traiga ?datos=
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'es-ES' })
  const p2 = await ctx2.newPage()
  await p2.goto(new URL('lugar/sagrada-familia/?captura=1&modo=ligero&datos=embebido/ejemplo.json', base).href)
  await p2.locator('.panel.abierto').waitFor({ timeout: 60000 })
  ok((await p2.locator('.panel-reservar').count()) === 0 && !(await p2.locator('.panel-datos').innerText()).includes('34 €'), 'sin ?embed=1 se ignora ?datos=')
  await ctx2.close()
}

if (bloques.includes('maqueta')) {
  const { ctx, page, marco, errores } = await anfitriona('captura=1&postpro=0')
  const [listo] = await mensajes(page, 'listo')
  ok(listo.modo === '3d' && listo.datos === 'externos', `en 3D, «listo» cuando la maqueta está cargada: ${JSON.stringify(listo)}`)
  ok(!!(await marco.$('canvas')), 'hay canvas')
  ok((await marco.evaluate(() => window.__errores.length)) === 0, 'registro de errores vacío')
  if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
  await ctx.close()
}

await browser.close()
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien')
process.exit(fallos ? 1 : 0)
