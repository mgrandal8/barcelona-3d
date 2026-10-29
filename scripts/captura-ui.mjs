// Uso: node scripts/captura-ui.mjs url salida.png [clicSelector]
// Captura de página completa (canvas + interfaz HTML) con page.screenshot.
import { chromium } from 'playwright'

const [url, salida, clic] = process.argv.slice(2)
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: Number(process.env.ANCHO ?? 1200), height: Number(process.env.ALTO ?? 750) } })
const errores = []
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
page.on('pageerror', (e) => errores.push(String(e)))
await page.goto(url)
await page.waitForSelector('canvas')
await page.waitForTimeout(Number(process.env.ESPERA ?? 25000))
if (clic) {
  await page.click(clic)
  await page.waitForTimeout(Number(process.env.ESPERA_CLIC ?? 8000))
}
await page.screenshot({ path: salida, timeout: 120000 })
console.log('captura:', salida, '| url final:', page.url())
if (errores.length) console.log('ERRORES DE CONSOLA:\n' + errores.join('\n'))
await browser.close()
process.exit(0)
