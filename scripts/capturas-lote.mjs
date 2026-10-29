// Uso: node scripts/capturas-lote.mjs vistas.json [url-base] [carpeta-salida]
// vistas.json: [{ "nombre": "x", "cam": [px, py, pz, tx, ty, tz] } | { "nombre": "x", "lugar": "id" }, ...]
// Cualquier vista admite "hora": "dia" | "atardecer" | "noche" (espera a que termine la transición).
// Con "lugar" se selecciona como si se hiciera clic (vuelo + ficha) y la captura incluye la interfaz.
// Carga la escena una vez y saca una captura por vista moviendo la cámara (modo ?captura=1).
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const vistas = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const base = process.argv[3] ?? 'http://localhost:5173/'
const salida = process.argv[4] ?? 'capturas'

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: Number(process.env.ANCHO ?? 1200), height: Number(process.env.ALTO ?? 750) } })
const errores = []
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
page.on('pageerror', (e) => errores.push(String(e)))

const url = new URL(base)
url.searchParams.set('captura', '1')
url.searchParams.set('postpro', '0')
await page.goto(url.href)
await page.waitForFunction(() => window.__controles, null, { timeout: 120000 })
await page.waitForTimeout(Number(process.env.ESPERA ?? 20000))
for (const v of vistas) {
  if (v.hora) {
    await page.evaluate((h) => window.__estado.getState().setMomento(h), v.hora)
    await page.waitForTimeout(Number(process.env.ESPERA_HORA ?? 15000))
  }
  if (v.lugar !== undefined) {
    await page.evaluate((id) => window.__estado.getState().setSeleccionado(id), v.lugar)
    await page.waitForTimeout(Number(process.env.ESPERA_LUGAR ?? 15000))
    await page.screenshot({ path: `${salida}/${v.nombre}.png`, timeout: 120000 })
    console.log('captura:', v.nombre)
    continue
  }
  // dos veces: la primera puede llegar antes de que los controles terminen de montarse
  for (let k = 0; k < 2; k++) {
    await page.evaluate((c) => window.__controles.setLookAt(...c, false), v.cam)
    await page.waitForTimeout(Number(process.env.ESPERA_VISTA ?? 4000) / 2)
  }
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
  writeFileSync(`${salida}/${v.nombre}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('captura:', v.nombre)
}
if (errores.length) console.log('ERRORES DE CONSOLA:\n' + errores.join('\n'))
await browser.close()
process.exit(0)
