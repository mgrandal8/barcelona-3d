// Uso: node scripts/prueba-camara.mjs [url-base] [vuelos,entrada,tour,compartir]
// S13: vuelos con curva (suben en los trayectos largos, llegan al encuadre y se cancelan al tocar la maqueta),
// entrada desde la portada y desde un enlace, «Reproducir tour» y compartir (enlace e imagen).
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:5173/')
const bloques = (process.argv[3] ?? 'vuelos,entrada,tour,compartir').split(',')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

async function abrir(params, opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES', ...opciones })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  const url = new URL(base)
  url.search = params
  await page.goto(url.href)
  await page.waitForFunction(() => window.__estado?.getState().carga.listo && window.__controles, null, { timeout: 180000 })
  return { ctx, page, errores }
}

const camara = (page) =>
  page.evaluate(() => {
    const c = window.__controles
    const p = c.camera.position
    const t = c.getTarget(new p.constructor())
    return { x: p.x, y: p.y, z: p.z, tx: t.x, ty: t.y, tz: t.z }
  })

/**
 * Muestrea la cámara mientras dura el vuelo (espera a que empiece, hasta `espera` ms) y un poco después,
 * hasta que se quede quieta. Con SwiftShader cada fotograma tarda: no vale mirar solo si se mueve.
 */
async function seguir(page, max = 120000, espera = 8000) {
  const muestras = [await camara(page)]
  const t0 = Date.now()
  while (Date.now() - t0 < espera && !(await page.evaluate(() => window.__enVuelo()))) await page.waitForTimeout(100)
  let quieta = 0
  while (Date.now() - t0 < max) {
    const m = await camara(page)
    const u = muestras.at(-1)
    muestras.push(m)
    const vuela = await page.evaluate(() => window.__enVuelo())
    if (!vuela && Math.hypot(m.x - u.x, m.y - u.y, m.z - u.z) < 0.002) quieta++
    else quieta = 0
    if (quieta >= 3) break
    await page.waitForTimeout(150)
  }
  return muestras
}

const errores = (e) => ok(e.length === 0, 'sin errores en consola' + (e.length ? ':\n  ' + e.join('\n  ') : ''))

if (bloques.includes('vuelos')) {
  const { ctx, page, errores: e } = await abrir('?captura=1&postpro=0&lugar=sagrada-familia')
  const a = await camara(page)
  // Sagrada Família → Montjuïc: ~40 u, tiene que subir por encima de los dos extremos
  await page.evaluate(() => window.__estado.getState().setSeleccionado('montjuic'))
  const m = await seguir(page)
  const b = m.at(-1)
  const alto = Math.max(...m.map((x) => x.y))
  ok(alto > Math.max(a.y, b.y) + 5, `el vuelo largo sube (máx. ${alto.toFixed(1)} u; extremos ${a.y.toFixed(1)} y ${b.y.toFixed(1)})`)
  ok(Math.hypot(b.tx + 25.1, b.tz - 11.4) < 0.6, `llega mirando a Montjuïc (${b.tx.toFixed(1)}, ${b.tz.toFixed(1)})`)
  // Montjuïc → vista general: baja de lejos sin subir de más
  await page.evaluate(() => window.__estado.getState().setSeleccionado(null))
  const g = await seguir(page)
  ok(Math.max(...g.map((x) => x.y)) <= g.at(-1).y + 0.5, 'a la vista general no sube por encima del final')
  ok(Math.abs(g.at(-1).y - 62) < 1, `vuelve a la vista general (y = ${g.at(-1).y.toFixed(1)})`)
  // tocar la maqueta a mitad de vuelo lo cancela
  await page.evaluate(() => window.__estado.getState().setSeleccionado('park-guell'))
  await page.waitForFunction(() => window.__enVuelo() && window.__controles.camera.position.y < 55, null, { timeout: 60000 })
  await page.mouse.move(640, 400)
  await page.mouse.down()
  await page.mouse.up()
  const c = await seguir(page)
  ok(c.at(-1).y > 6 && c.at(-1).y < 58, `tocar la maqueta para el vuelo a medio camino (y = ${c.at(-1).y.toFixed(1)})`)
  errores(e)
  await ctx.close()
}

// con SwiftShader, tras la carga cada fotograma tarda segundos: las entradas se prueban en una ventana pequeña
const PEQUENA = { viewport: { width: 800, height: 520 } }
if (bloques.includes('entrada')) {
  // portada: la cámara sale del mar (y baja) y sube hasta la vista general mientras se ve la portada
  {
    const { ctx, page, errores: e } = await abrir('?captura=1&postpro=0&entrada=1', PEQUENA)
    const m = await seguir(page, 400000)
    ok(Math.min(...m.map((x) => x.y)) < 10, `la entrada empieza a ras del mar (y mín. ${Math.min(...m.map((x) => x.y)).toFixed(1)})`)
    ok(m.at(-1).y > 40 || m.length > 100, 'y sube hacia la vista general')
    ok(await page.evaluate(() => window.__estado.getState().portada), 'con la portada delante')
    await page.locator('.portada-botones .primario').click({ force: true })
    const g = await seguir(page)
    ok(Math.abs(g.at(-1).y - 62) < 1.5, `«Explorar» deja la vista general (y = ${g.at(-1).y.toFixed(1)})`)
    errores(e)
    await ctx.close()
  }
  // enlace a un lugar: empieza en la vista general y baja al lugar cuando la ciudad está dibujada
  {
    const { ctx, page, errores: e } = await abrir('?captura=1&postpro=0&entrada=1&lugar=casa-batllo', PEQUENA)
    const m = await seguir(page, 400000)
    ok(Math.max(...m.map((x) => x.y)) > 30, `el enlace a un lugar entra desde arriba (y máx. ${Math.max(...m.map((x) => x.y)).toFixed(1)})`)
    ok(m.at(-1).y < 5, `y llega a la Casa Batlló (y = ${m.at(-1).y.toFixed(1)})`)
    errores(e)
    await ctx.close()
  }
  // enlace a una vista (?vista=): llega a esa vista y quita el parámetro de la barra
  {
    const { ctx, page, errores: e } = await abrir('?captura=1&postpro=0&entrada=1&vista=10,20,30,5,0,0', PEQUENA)
    const m = await seguir(page, 400000)
    const f = m.at(-1)
    ok(Math.hypot(f.x - 10, f.y - 20, f.z - 30) < 0.3 && Math.hypot(f.tx - 5, f.tz) < 0.3, `?vista= deja la cámara en la vista (${f.x.toFixed(1)}, ${f.y.toFixed(1)}, ${f.z.toFixed(1)})`)
    ok(!page.url().includes('vista='), 'y quita ?vista= de la barra')
    ok(!(await page.evaluate(() => window.__estado.getState().portada)), 'sin portada')
    errores(e)
    await ctx.close()
  }
}

if (bloques.includes('tour')) {
  const { ctx, page, errores: e } = await abrir('?captura=1&postpro=0')
  const st = () => page.evaluate(() => { const s = window.__estado.getState(); return { sel: s.seleccionado, tour: s.tour, rep: s.reproduciendo, dialogo: s.dialogo, metro: s.metro } })
  await page.evaluate(() => window.__estado.getState().setDialogo('tours'))
  await page.getByRole('button', { name: /Reproducir el tour «Gaudí esencial»/ }).click({ force: true })
  let s = await st()
  ok(s.rep && s.tour === 'gaudi' && s.sel === 'sagrada-familia' && !s.dialogo, '«Reproducir» desde los tours empieza en la primera parada ' + JSON.stringify(s))
  ok(await page.locator('.subtitulo').isVisible(), 'sale el subtítulo con la nota')
  ok((await page.locator('.subtitulo-nota').textContent()).includes('Nacimiento'), 'con la nota del guía de esa parada')
  ok(!(await page.locator('.panel').evaluate((p) => p.classList.contains('abierto'))), 'la ficha se esconde mientras tanto')
  ok(await page.evaluate(() => document.activeElement?.closest('.subtitulo') !== null || document.activeElement === document.body), 'el foco no se queda en la ficha escondida')
  ok((await page.locator('.sr-only[aria-live]').textContent()).includes('Nacimiento'), 'el lector de pantalla lee la nota')
  // gira despacio alrededor de la parada y pasa sola a la siguiente
  await page.waitForFunction(() => window.__estado.getState().seleccionado === 'casa-batllo', null, { timeout: 40000 })
  ok(true, 'pasa sola a la segunda parada')
  // «Siguiente» salta de parada
  await page.locator('.subtitulo').getByRole('button', { name: 'Siguiente parada' }).evaluate((b) => b.click())
  s = await st()
  ok(s.sel === 'casa-mila' && s.rep, 'el botón «Siguiente parada» salta a la tercera')
  // Esc pausa: vuelve la ficha con el foco en el título
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  s = await st()
  ok(!s.rep && s.sel === 'casa-mila' && s.tour === 'gaudi', 'Esc pausa sin terminar el tour')
  ok(await page.locator('.panel').evaluate((p) => p.classList.contains('abierto')), 'la ficha vuelve')
  ok(await page.evaluate(() => document.activeElement?.tagName === 'H2' && !!document.activeElement.closest('.panel')), 'con el foco en su título')
  // desde la ficha se reanuda; en la última parada, al terminar, se para con la ficha abierta
  await page.locator('.panel-tour-play').evaluate((b) => b.click())
  s = await st()
  ok(s.rep, '«Reproducir tour» en la ficha lo reanuda')
  await page.waitForFunction(() => !window.__estado.getState().reproduciendo, null, { timeout: 90000 })
  s = await st()
  ok(s.sel === 'park-guell' && s.tour === 'gaudi', 'al acabar la última parada se para y deja la ficha')
  ok((await page.locator('.subtitulo.fin').textContent()).includes('Fin del tour'), 'con el mensaje de fin')
  errores(e)
  await ctx.close()
}

if (bloques.includes('compartir')) {
  const { ctx, page, errores: e } = await abrir('?captura=1&postpro=0&hora=noche', { permissions: ['clipboard-read', 'clipboard-write'] })
  await page.evaluate(() => window.__estado.getState().setDialogo('compartir'))
  const enlace = await page.locator('.compartir-enlace input').inputValue()
  ok(/vista=-?[\d.]+(%2C|,)/.test(enlace) && enlace.includes('hora=noche') && !enlace.includes('captura') && !enlace.includes('postpro'), 'el enlace lleva la vista y la hora, sin los parámetros de pruebas: ' + enlace)
  await page.waitForSelector('.compartir-imagen img', { timeout: 180000 })
  const img = await page.locator('.compartir-imagen img').evaluate((i) => i.decode().then(() => ({ w: i.naturalWidth, h: i.naturalHeight, src: i.src })))
  ok(img.w === 1200 && img.h === 630, `imagen de ${img.w} × ${img.h}`)
  // la imagen no está vacía: hay variedad de colores en la escena
  const varia = await page.locator('.compartir-imagen img').evaluate((i) => {
    const c = document.createElement('canvas')
    c.width = 120
    c.height = 63
    const x = c.getContext('2d')
    x.drawImage(i, 0, 0, 120, 63)
    const d = x.getImageData(0, 0, 120, 30).data
    const set = new Set()
    for (let k = 0; k < d.length; k += 4) set.add((d[k] >> 4) * 256 + (d[k + 1] >> 4) * 16 + (d[k + 2] >> 4))
    return set.size
  })
  ok(varia > 20, `la imagen tiene la maqueta (${varia} colores distintos arriba)`)
  await page.locator('.compartir-botones').getByRole('button', { name: 'Copiar enlace' }).click({ force: true })
  await page.waitForTimeout(400)
  ok((await page.evaluate(() => navigator.clipboard.readText())) === enlace, 'copiar deja el enlace en el portapapeles')
  ok((await page.locator('.compartir-botones a[download]').getAttribute('download')) === 'barcelona-3d-barcelona.png', 'descarga con nombre de archivo')
  await page.keyboard.press('Escape')
  // con un lugar abierto, el enlace lleva el lugar y no la vista
  // se pulsa con la cámara todavía de camino: la foto espera a que llegue
  await page.evaluate(() => window.__estado.getState().setSeleccionado('casa-batllo'))
  await page.waitForFunction(() => window.__enVuelo(), null, { timeout: 60000 })
  await page.locator('.panel-compartir').evaluate((b) => b.click())
  const enlace2 = await page.locator('.compartir-enlace input').inputValue()
  ok(enlace2.includes('/lugar/casa-batllo/') && !enlace2.includes('vista='), 'desde la ficha, el enlace lleva el lugar: ' + enlace2)
  await page.waitForSelector('.compartir-imagen img', { timeout: 180000 })
  ok((await page.locator('.compartir-botones a[download]').getAttribute('download')) === 'barcelona-3d-casa-batllo.png', 'y la imagen se llama como el lugar')
  // guarda la imagen para revisarla a ojo, ya con la cámara en el lugar
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !window.__enVuelo(), null, { timeout: 300000 })
  await page.locator('.panel-compartir').evaluate((b) => b.click())
  await page.waitForSelector('.compartir-imagen img', { timeout: 180000 })
  const datos = await page.locator('.compartir-imagen img').evaluate(async (i) => {
    const b = await (await fetch(i.src)).blob()
    return [...new Uint8Array(await b.arrayBuffer())]
  })
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('capturas', { recursive: true })
  writeFileSync('capturas/sesion13-compartir-batllo.png', Buffer.from(datos))
  errores(e)
  await ctx.close()
}

await browser.close()
console.log(fallos ? `${fallos} FALLOS` : 'TODO OK')
process.exit(fallos ? 1 : 0)
