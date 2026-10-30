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

if (fallos) console.log(`${fallos} fallo(s)`)
await browser.close()
process.exit(fallos ? 1 : 0)
