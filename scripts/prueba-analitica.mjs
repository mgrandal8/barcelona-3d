// Uso: node scripts/prueba-analitica.mjs <url-base>
// Comprueba la analítica sin cookies con un build hecho con
//   VITE_ANALITICA_URL=https://analitica.prueba/api/event VITE_ANALITICA_DOMINIO=prueba \
//   VITE_ERRORES_URL=https://errores.prueba/api npx vite build --outDir <dir>
// y servido en una dirección que no sea localhost (en local no cuenta), p. ej. la IP de WSL:
//   npx vite preview --outDir <dir> --host 0.0.0.0 --port 5191  →  node scripts/prueba-analitica.mjs http://172.x.x.x:5191/
// También el registro de errores (src/registro.ts). Las peticiones a los endpoints se interceptan: no sale nada a la red.
import { chromium } from 'playwright'

const base = new URL(process.argv[2])
const ENDPOINT = 'https://analitica.prueba/api/event'
const ERRORES = 'https://errores.prueba/api'
const browser = await chromium.launch()
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

async function abrir(ruta, { gpc = false } = {}) {
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1200, height: 800 } })
  if (gpc) await ctx.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }))
  const eventos = []
  await ctx.route(ENDPOINT, async (r) => {
    eventos.push({ ...JSON.parse(r.request().postData()), tipo: r.request().headers()['content-type'] })
    await r.fulfill({ status: 202, body: 'ok' })
  })
  const errores = []
  await ctx.route(ERRORES, async (r) => {
    errores.push(JSON.parse(r.request().postData()))
    await r.fulfill({ status: 202, body: 'ok' })
  })
  const page = await ctx.newPage()
  const url = new URL(ruta, base)
  url.searchParams.set('modo', 'ligero')
  await page.goto(url.href)
  await page.waitForFunction(() => document.querySelector('.panel, .portada'))
  await page.waitForTimeout(1500)
  return { ctx, page, eventos, errores }
}

let { ctx, page, eventos, errores } = await abrir('lugar/colom/')
ok(errores.length === 0, 'al cargar, ningún error')
ok(eventos[0]?.name === 'pageview' && eventos.filter((e) => e.name === 'pageview').length === 1, 'al cargar, una página vista')
ok(eventos.some((e) => e.name === 'Versión ligera'), 'y el evento «Versión ligera» (se abrió con ?modo=ligero)')
ok(eventos[0]?.url === new URL('lugar/colom/', base).href, 'con la URL de la ficha, sin parámetros: ' + eventos[0]?.url)
ok(eventos[0]?.domain === 'prueba' && eventos[0]?.tipo === 'text/plain', 'dominio configurado y text/plain (sin preflight)')
ok(Object.keys(eventos[0] ?? {}).every((k) => ['name', 'url', 'domain', 'referrer', 'props', 'tipo'].includes(k)), 'sin identificadores ni datos de más')
ok((await ctx.cookies()).length === 0, 'sin cookies')
const guardado = await page.evaluate(() => Object.keys(localStorage).filter((k) => !['bcn3d-modo', 'bcn3d-idioma'].includes(k)))
ok(guardado.length === 0, 'nada nuevo en localStorage: ' + guardado.join(', '))
// botón «Siguiente» de la ficha: otra página vista; y un tour
await page.locator('.panel.abierto .panel-nav button').last().click({ force: true })
await page.waitForTimeout(500)
ok(eventos.at(-1)?.name === 'pageview' && eventos.at(-1).url.endsWith('/lugar/sagrada-familia/'), 'otra ficha, otra página vista: ' + eventos.at(-1)?.url)
await page.evaluate(() => document.querySelector('.atribucion-legal')?.click())
await page.waitForSelector('.legal')
ok((await page.locator('.legal').innerText()).includes('con Plausible: sin cookies'), 'la privacidad dice que hay analítica (Plausible)')
ok((await page.locator('.legal').innerText()).includes('informe técnico del error'), 'y que se manda un informe si algo falla')

// registro de errores: un error sin capturar y una promesa rechazada, cada uno una vez aunque se repita
await page.evaluate(() => {
  for (let i = 0; i < 3; i++) setTimeout(() => {
    throw new Error('fallo de prueba')
  })
  Promise.reject(new Error('promesa de prueba'))
})
await page.waitForTimeout(1500)
ok(errores.length === 2, `dos informes de error (sin repetir): ${errores.map((e) => e.tipo + ' ' + e.mensaje).join(' | ')}`)
const e = errores.find((x) => x.tipo === 'error')
ok(e?.mensaje === 'fallo de prueba' && e.pila?.includes('Error') && e.ruta === new URL('lugar/sagrada-familia/', base).pathname, 'con mensaje, pila y ruta sin parámetros')
ok(Object.keys(e ?? {}).every((k) => ['mensaje', 'pila', 'tipo', 'version', 'ruta', 'calidad', 'modo', 'navegador'].includes(k)), 'sin datos de más: ' + Object.keys(e ?? {}).join(', '))
ok(eventos.filter((x) => x.name === 'Error').length === 2 && eventos.some((x) => x.name === 'Error' && x.props?.tipo === 'promesa'), 'y dos eventos «Error» en la analítica')
await ctx.close()

;({ ctx, eventos } = await abrir('lugar/colom/', { gpc: true }))
ok(eventos.length === 0, 'con «Control global de privacidad» no se manda nada')
await ctx.close()

await browser.close()
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK')
process.exit(fallos ? 1 : 0)
