// Uso: node scripts/prueba-utilidad.mjs [url-base] [bloques]
// Comprueba los añadidos de la fase 8: idiomas, ubicación, metro (y la PWA con prueba-pwa.mjs).
// bloques: lista separada por comas (idioma,ubicacion,metro); por defecto, todos.
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:5176/')
const bloques = (process.argv[3] ?? 'idioma,ubicacion,metro').split(',')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

/** Abre una página nueva con los parámetros dados y espera al store. */
async function abrir(params, opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 }, locale: 'es-ES', ...opciones })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  const url = new URL(base)
  url.search = '?captura=1&postpro=0&' + params
  await page.goto(url.href)
  await page.waitForFunction(() => window.__estado, null, { timeout: 120000 })
  return { ctx, page, errores }
}
const estado = (page, f) => page.evaluate(`(${f})(window.__estado.getState())`)
const texto = (page, sel) => page.locator(sel).first().innerText()

if (bloques.includes('idioma')) {
  const { ctx, page, errores } = await abrir('lugar=sagrada-familia&lang=en')
  ok((await estado(page, (s) => s.idioma)) === 'en', '?lang=en pone el inglés')
  ok((await texto(page, '.panel-datos dt')).trim().toLowerCase() === 'opening hours', 'ficha en inglés')
  ok((await texto(page, '.panel-texto')).includes('unfinished masterpiece'), 'descripción traducida')
  ok((await page.evaluate(() => document.documentElement.lang)) === 'en', '<html lang="en">')
  await page.locator('.menu .idioma button', { hasText: 'ES' }).click()
  await page.waitForTimeout(300)
  ok((await texto(page, '.panel-datos dt')).trim().toLowerCase() === 'horario', 'al pulsar ES la ficha vuelve al español')
  ok(!page.url().includes('lang='), 'en español la URL no lleva lang')
  ok((await page.evaluate(() => document.documentElement.lang)) === 'es', '<html lang="es">')
  await page.evaluate(() => window.__estado.getState().empezarTour('gaudi'))
  await page.locator('.menu .idioma button', { hasText: 'EN' }).click()
  await page.waitForTimeout(300)
  ok((await texto(page, '.panel-tour')).includes('stop 1 of 3'), 'tour en inglés')
  if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
  await ctx.close()
}

if (bloques.includes('ubicacion')) {
  // GPS junto a la Sagrada Família
  let { ctx, page, errores } = await abrir('', { geolocation: { latitude: 41.4027, longitude: 2.1745, accuracy: 25 }, permissions: ['geolocation'] })
  await page.evaluate(() => window.__estado.getState().cerrarPortada())
  await page.locator('.ubicacion-boton').click()
  await page.waitForFunction(() => window.__estado.getState().estadoUbicacion === 'ok', null, { timeout: 20000 })
  let s = await estado(page, (s) => ({ u: s.ubicacion, vuelo: s.vuelo }))
  ok(s.u?.dentro && !s.u.simulada && s.vuelo?.n === 1, 'GPS dentro de la maqueta y vuelo ' + JSON.stringify(s))
  ok((await texto(page, '.ubicacion-tarjeta')).includes('±25 m'), 'tarjeta con la precisión')
  await page.evaluate(() => window.__estado.getState().setSeleccionado('sagrada-familia'))
  await page.waitForTimeout(300)
  const dist = await texto(page, '.panel-distancia')
  ok(/A 1[0-9]0 m de ti · ~\d+ min a pie/.test(dist), 'distancia en la ficha: ' + dist)
  await page.locator('.ubicacion-boton').click()
  await page.waitForTimeout(300)
  s = await estado(page, (s) => ({ sel: s.seleccionado, n: s.vuelo?.n }))
  ok(s.sel === null && s.n === 2, 'el segundo toque cierra la ficha y vuelve a centrar')
  await page.locator('.lista-cerca input').check()
  ok((await texto(page, '.lista li strong')) === 'Sagrada Família', '«cerca de mí» pone primero la Sagrada Família')
  if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
  await ctx.close()

  // GPS en Madrid: fuera de la maqueta, con la opción de simular
  ;({ ctx, page, errores } = await abrir('', { geolocation: { latitude: 40.4168, longitude: -3.7038 }, permissions: ['geolocation'] }))
  await page.evaluate(() => window.__estado.getState().cerrarPortada())
  await page.locator('.ubicacion-boton').click()
  await page.waitForFunction(() => window.__estado.getState().estadoUbicacion === 'ok', null, { timeout: 20000 })
  ok((await texto(page, '.ubicacion-tarjeta')).includes('fuera de la maqueta'), 'aviso fuera de la maqueta')
  ok((await estado(page, (s) => s.vuelo)) === null, 'fuera de la maqueta no hay vuelo')
  await page.locator('.ubicacion-tarjeta button.primario').click()
  s = await estado(page, (s) => s.ubicacion)
  ok(s?.dentro && s.simulada, 'simular la Plaça de Catalunya')
  await ctx.close()

  // sin permiso
  ;({ ctx, page, errores } = await abrir(''))
  await page.evaluate(() => window.__estado.getState().cerrarPortada())
  await page.locator('.ubicacion-boton').click()
  await page.waitForFunction(() => ['denegada', 'error'].includes(window.__estado.getState().estadoUbicacion), null, { timeout: 30000 })
  ok((await texto(page, '.ubicacion-tarjeta')).length > 10, 'sin permiso: ' + (await estado(page, (s) => s.estadoUbicacion)))
  await ctx.close()

  // ?pos= simula desde el principio
  ;({ ctx, page, errores } = await abrir('pos=41.38704,2.17007&lugar=catedral&lang=en'))
  await page.waitForTimeout(300)
  const d2 = await texto(page, '.panel-distancia')
  ok(/from you · ~\d+ min walk/.test(d2), '?pos= y distancia en inglés: ' + d2)
  await ctx.close()
}

if (fallos) console.log(`${fallos} fallo(s)`)
await browser.close()
process.exit(fallos ? 1 : 0)
