// Uso: node scripts/medir-carga.mjs [url] [repeticiones]
// Mide la carga en el navegador headless: tiempo hasta que la ciudad está lista, bytes de red
// y tareas largas del hilo principal (lo que congela la portada y la barra de progreso).
import { chromium } from 'playwright'
const url = new URL(process.argv[2] ?? 'http://localhost:5176/')
url.search = '?captura=1&postpro=0'
const veces = Number(process.argv[3] ?? 1)
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (let r = 0; r < veces; r++) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 750 } })
  const errores = []
  const t0 = Date.now()
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' && errores.push(m.text()), m.text().startsWith('T ') && console.log(m.text(), Date.now() - t0)))
  await page.addInitScript(() => {
    window.__largas = []
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__largas.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true })
  })
  let bytes = 0
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength))
  await page.goto(url.href)
  await page.waitForFunction(() => window.__estado?.getState().carga.listo, null, { timeout: 300000, polling: 200 })
  const total = Date.now() - t0
  const r2 = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const largas = window.__largas.toSorted((a, b) => b[1] - a[1])
    return { dcl: Math.round(nav.domContentLoadedEventEnd), largas: largas.slice(0, 5), bloqueo: largas.reduce((s, l) => s + l[1], 0) }
  })
  console.log(JSON.stringify({ listo_ms: total, red_MB: +(bytes / 1e6).toFixed(2), ...r2 }))
  if (errores.length) console.log('ERRORES:\n' + errores.join('\n'))
  await page.close()
}
await browser.close()
