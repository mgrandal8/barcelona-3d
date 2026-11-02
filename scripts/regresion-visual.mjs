// Uso: node scripts/regresion-visual.mjs <url-referencia> <url-nueva> [carpeta-salida] [vistas]
// Regresión visual: saca las mismas vistas de dos builds servidos a la vez (p. ej. main en el 5188 y la rama en el 5191)
// y las compara píxel a píxel. No guarda imágenes de referencia en el repo: por software (SwiftShader) y con otras
// fuentes, cada máquina pinta algo distinto, así que se compara siempre en la misma máquina y en la misma tirada.
//   interfaz  versión ligera (sin WebGL): vista general, ficha, móvil, tours y privacidad (captura de página)
//   maqueta   3D sin interfaz (canvas): vista general de día y de noche y la Casa Batlló de cerca, con ?reloj= para que
//             barcos, gaviotas y nubes estén siempre en el mismo sitio
// Salida: ref/, nueva/ y dif/ (en rojo lo que cambia) con un informe.html; en GitHub Actions, una tabla en el resumen.
// Sale con 1 si alguna vista cambia más del umbral (UMBRAL_INTERFAZ y UMBRAL_MAQUETA, en % de píxeles).
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { chromium } from 'playwright'

const [ref, nueva] = [process.argv[2], process.argv[3]]
if (!ref || !nueva) {
  console.log('Uso: node scripts/regresion-visual.mjs <url-referencia> <url-nueva> [carpeta-salida] [vistas]')
  process.exit(2)
}
const salida = process.argv[4] ?? 'capturas/regresion'
const filtro = process.argv[5]?.split(',')
const UMBRAL = { interfaz: Number(process.env.UMBRAL_INTERFAZ ?? 0.2), maqueta: Number(process.env.UMBRAL_MAQUETA ?? 1) }
// diferencia por canal a partir de la cual un píxel cuenta como distinto (el antialiasing por software baila un poco)
const TOLERANCIA = Number(process.env.TOLERANCIA ?? 32)

const ESCRITORIO = { width: 1200, height: 750 }
const MOVIL = { width: 390, height: 844 }
/** tipo: interfaz (página) o maqueta (canvas). `antes`: lo que se hace con el estado antes de capturar. */
const VISTAS = [
  { nombre: 'ligera-general', tipo: 'interfaz', ruta: '?modo=ligero', vp: ESCRITORIO },
  { nombre: 'ligera-ficha', tipo: 'interfaz', ruta: 'lugar/sagrada-familia/?modo=ligero', vp: ESCRITORIO },
  { nombre: 'ligera-movil-ficha', tipo: 'interfaz', ruta: 'lugar/casa-batllo/?modo=ligero', vp: MOVIL },
  { nombre: 'ligera-tours', tipo: 'interfaz', ruta: '?modo=ligero', vp: ESCRITORIO, antes: (s) => s.setDialogo('tours') },
  { nombre: 'ligera-privacidad', tipo: 'interfaz', ruta: 'ca/?modo=ligero', vp: MOVIL, antes: (s) => s.setDialogo('legal') },
  { nombre: 'maqueta-dia', tipo: 'maqueta', ruta: '?postpro=0', vp: ESCRITORIO },
  { nombre: 'maqueta-noche', tipo: 'maqueta', ruta: '?postpro=0&hora=noche&metro=1', vp: ESCRITORIO },
  { nombre: 'maqueta-batllo', tipo: 'maqueta', ruta: 'lugar/casa-batllo/?postpro=0&hora=atardecer', vp: ESCRITORIO },
].filter((v) => !filtro || filtro.some((f) => v.nombre.includes(f)))

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

async function capturar(base, v) {
  const ctx = await browser.newContext({ viewport: v.vp, locale: 'es-ES', reducedMotion: 'reduce', deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  const url = new URL(v.ruta, base)
  url.searchParams.set('captura', '1')
  url.searchParams.set('reloj', '10')
  await page.goto(url.href)
  await page.waitForFunction(() => window.__estado?.getState().carga.listo, null, { timeout: 300000, polling: 300 })
  if (v.antes) await page.evaluate(`(${v.antes})(window.__estado.getState())`)
  let png
  if (v.tipo === 'interfaz') {
    // fotos y fuentes cargadas, y un respiro para el diálogo
    await page.waitForFunction(() => [...document.images].every((i) => i.complete) && document.fonts.status === 'loaded', null, { timeout: 60000 })
    await page.waitForTimeout(800)
    png = await page.screenshot({ timeout: 120000 })
  } else {
    // unos cuantos fotogramas después de «lista»: la hora del enlace y el LOD ya puestos
    const f0 = await page.evaluate(() => window.__gl?.info.render.frame ?? 0)
    await page.waitForFunction((f) => (window.__gl?.info.render.frame ?? 0) >= f + 8, f0, { timeout: 300000, polling: 500 })
    await page.waitForFunction(() => !window.__enVuelo?.(), null, { timeout: 120000, polling: 500 })
    await page.waitForTimeout(1500)
    const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
    png = Buffer.from(dataUrl.split(',')[1], 'base64')
  }
  await ctx.close()
  return { png, errores }
}

/** % de píxeles distintos y la imagen de diferencias (la referencia apagada, lo que cambia en rojo). */
function comparar(a, b) {
  const A = PNG.sync.read(a)
  const B = PNG.sync.read(b)
  if (A.width !== B.width || A.height !== B.height) return { pct: 100, dif: b }
  const D = new PNG({ width: A.width, height: A.height })
  let distintos = 0
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]), Math.abs(A.data[i + 3] - B.data[i + 3]))
    if (d > TOLERANCIA) {
      distintos++
      D.data.set([230, 30, 30, 255], i)
    } else {
      const g = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 3
      const gris = 255 - (255 - g) * 0.25
      D.data.set([gris, gris, gris, 255], i)
    }
  }
  return { pct: +((distintos / (A.width * A.height)) * 100).toFixed(3), dif: PNG.sync.write(D) }
}

for (const d of ['ref', 'nueva', 'dif']) mkdirSync(`${salida}/${d}`, { recursive: true })
const resultados = []
for (const v of VISTAS) {
  try {
    const a = await capturar(ref, v)
    const b = await capturar(nueva, v)
    const { pct, dif } = comparar(a.png, b.png)
    writeFileSync(`${salida}/ref/${v.nombre}.png`, a.png)
    writeFileSync(`${salida}/nueva/${v.nombre}.png`, b.png)
    writeFileSync(`${salida}/dif/${v.nombre}.png`, dif)
    const bien = pct <= UMBRAL[v.tipo]
    resultados.push({ ...v, pct, bien, errores: b.errores })
    console.log(`${bien ? 'OK ' : 'CAMBIA'} ${v.nombre.padEnd(20)} ${String(pct).padStart(7)} % (umbral ${UMBRAL[v.tipo]} %)${b.errores.length ? '  errores: ' + b.errores.join(' | ') : ''}`)
  } catch (e) {
    resultados.push({ ...v, pct: null, bien: false, errores: [String(e).split('\n')[0]] })
    console.log(`FALLO  ${v.nombre}: ${String(e).split('\n')[0]}`)
  }
}
await browser.close()

const celdas = (r) => ['ref', 'nueva', 'dif'].map((d) => `<figure><img src="${d}/${r.nombre}.png" loading="lazy"><figcaption>${d}</figcaption></figure>`).join('')
const informe = `<!doctype html><meta charset="utf-8"><title>Regresión visual</title>
<style>body{font:14px system-ui;margin:16px;background:#f6f2ea}section{margin:0 0 28px}h2{font-size:16px}
.cambia{color:#b3261e}.fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}img{width:100%;border:1px solid #ccc}</style>
<h1>Regresión visual</h1><p>Referencia: ${ref} · Nueva: ${nueva} · Tolerancia por canal: ${TOLERANCIA}</p>
${resultados.map((r) => `<section><h2 class="${r.bien ? '' : 'cambia'}">${r.nombre}: ${r.pct ?? 'error'} % ${r.bien ? '' : '(por encima del umbral)'}</h2><div class="fotos">${celdas(r)}</div></section>`).join('\n')}`
writeFileSync(`${salida}/informe.html`, informe)

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ['### Regresión visual', '', `Comparado con ${ref}. Las imágenes están en el artefacto «regresion-visual».`, '', '| | Vista | Píxeles distintos | Umbral |', '|---|---|---:|---:|', ...resultados.map((r) => `| ${r.bien ? '✅' : '❌'} | ${r.nombre} | ${r.pct ?? 'error'} % | ${UMBRAL[r.tipo]} % |`), '']
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n'))
}
const malos = resultados.filter((r) => !r.bien)
console.log(malos.length ? `\n${malos.length} vista(s) cambian: mira ${salida}/informe.html` : `\nSin cambios visibles (informe en ${salida}/informe.html)`)
process.exit(malos.length ? 1 : 0)
