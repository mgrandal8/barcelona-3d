// Imágenes para redes (og:image, 1200 × 630) de la vista general y de cada lugar, hechas con la propia maqueta:
// abre la página en modo captura, va a cada lugar, abre «Compartir» y guarda su imagen en public/og/<id>.jpg.
// Uso: node scripts/imagenes-og.mjs [url-base] [id…]   (sin ids: general y todos los lugares; «general» es la vista general)
// Con SwiftShader cada vista tarda casi un minuto y el navegador se cae tras unas cuantas: van en lotes de LOTE.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const LOTE = 4
const base = process.argv[2] ?? 'http://localhost:5190/'
const ids = process.argv.slice(3)
const todos = ['general', ...[...readFileSync('src/data/monumentos.ts', 'utf8').matchAll(/^\s+id: '([^']+)'/gm)].map((m) => m[1])]
const pendientes = ids.length ? ids : todos
mkdirSync('public/og', { recursive: true })

async function lote(vistas) {
  // más alta que 1200 × 630 para que el recorte pueda poner el lugar por encima del rótulo
  const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const pagina = await navegador.newPage({ locale: 'es-ES', viewport: { width: 1200, height: 960 } })
  const url = new URL(base)
  url.searchParams.set('captura', '1')
  url.searchParams.set('postpro', '0')
  // el rótulo de la imagen lleva el dominio de la web publicada, no el de local
  url.searchParams.set('dominio', 'mgrandal8.github.io')
  await pagina.goto(url.href)
  await pagina.waitForFunction(() => window.__controles && window.__estado.getState().carga.listo, null, { timeout: 180000 })
  await pagina.waitForTimeout(15000)
  for (const id of vistas) {
    await pagina.evaluate((id) => window.__estado.getState().setSeleccionado(id === 'general' ? null : id), id)
    await pagina.waitForTimeout(3000)
    await pagina.waitForFunction(() => !window.__enVuelo(), null, { timeout: 180000, polling: 1000 })
    await pagina.waitForTimeout(5000)
    await pagina.evaluate(() => window.__estado.getState().setDialogo('compartir'))
    const img = pagina.locator('.compartir-imagen img')
    await img.waitFor({ timeout: 180000 })
    // la imagen es un PNG en un blob: se pasa a JPEG, que pesa mucho menos para una vista previa
    const datos = await img.evaluate(async (el) => {
      await el.decode()
      const c = Object.assign(document.createElement('canvas'), { width: el.naturalWidth, height: el.naturalHeight })
      c.getContext('2d').drawImage(el, 0, 0)
      return c.toDataURL('image/jpeg', 0.84)
    })
    writeFileSync(`public/og/${id}.jpg`, Buffer.from(datos.split(',')[1], 'base64'))
    console.log('og:', id)
    await pagina.evaluate(() => window.__estado.getState().setDialogo(null))
    await pagina.waitForTimeout(1000)
  }
  await navegador.close()
}

for (let i = 0; i < pendientes.length; i += LOTE) await lote(pendientes.slice(i, i + LOTE))
process.exit(0)
