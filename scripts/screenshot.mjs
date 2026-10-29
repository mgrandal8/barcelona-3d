// Uso: node scripts/screenshot.mjs [url-base] [carpeta-salida]
// Saca capturas de la vista general y de cada lugar (?lugar=id).
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5173/'
const salida = process.argv[3] ?? 'capturas'
const lugares = (process.env.LUGARES ?? '').split(',').filter(Boolean)
const ancho = Number(process.env.ANCHO ?? 1200)
const alto = Number(process.env.ALTO ?? 750)

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
const errores = []
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
page.on('pageerror', (e) => errores.push(String(e)))

for (const lugar of ['', ...lugares]) {
  const url = new URL(base)
  url.searchParams.set('captura', '1')
  url.searchParams.set('intro', '0')
  if (lugar) url.searchParams.set('lugar', lugar)
  if (process.env.POSTPRO === '0') url.searchParams.set('postpro', '0')
  if (process.env.CAM) url.searchParams.set('cam', process.env.CAM)
  await page.goto(url.href)
  await page.waitForSelector('canvas')
  await page.waitForTimeout(Number(process.env.ESPERA ?? 6000))
  const archivo = `${salida}/${lugar || process.env.NOMBRE || 'general'}.png`
  // Leer el canvas directamente: más fiable que page.screenshot con WebGL por software
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
  writeFileSync(archivo, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('captura:', archivo)
}
if (errores.length) console.log('ERRORES DE CONSOLA:\n' + errores.join('\n'))
await browser.close()
