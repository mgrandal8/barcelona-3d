// Recorta las fotos de public/fotos/*.jpg a 4:3 (ANCHO × ALTO) y las guarda en WebP, con el Chromium de Playwright
// (no hace falta ImageMagick). Borra los .jpg y actualiza src/data/fotos.json.
// Uso: node scripts/datos/comprimir-fotos.mjs  (después de fotos.mjs)
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ANCHO = 600
const ALTO = 450
const CALIDAD = 0.8
/** Punto vertical (0 arriba, 1 abajo) que se conserva al recortar las fotos altas. */
const FOCO = { 'casa-batllo': 0.4, catedral: 0.3, 'camp-nou': 0.45 }

const ruta = 'src/data/fotos.json'
const creditos = JSON.parse(readFileSync(ruta, 'utf8'))
const navegador = await chromium.launch()
const pagina = await navegador.newPage()

for (const [id, c] of Object.entries(creditos)) {
  if (!c.archivo.endsWith('.jpg')) continue
  const datos = 'data:image/jpeg;base64,' + readFileSync('public/' + c.archivo).toString('base64')
  const webp = await pagina.evaluate(
    async ({ datos, ancho, alto, foco, calidad }) => {
      const img = new Image()
      img.src = datos
      await img.decode()
      // recorte «cover»: la escala que llena el lienzo y, en el eje sobrante, el foco
      const k = Math.max(ancho / img.width, alto / img.height)
      const [w, h] = [ancho / k, alto / k]
      const sx = (img.width - w) / 2
      const sy = (img.height - h) * foco
      const lienzo = document.createElement('canvas')
      Object.assign(lienzo, { width: ancho, height: alto })
      const g = lienzo.getContext('2d')
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, sx, sy, w, h, 0, 0, ancho, alto)
      return lienzo.toDataURL('image/webp', calidad)
    },
    { datos, ancho: ANCHO, alto: ALTO, foco: FOCO[id] ?? 0.5, calidad: CALIDAD },
  )
  const archivo = `fotos/${id}.webp`
  writeFileSync('public/' + archivo, Buffer.from(webp.split(',')[1], 'base64'))
  rmSync('public/' + c.archivo)
  Object.assign(creditos[id], { archivo, ancho: ANCHO, alto: ALTO, recortada: true })
  console.log(`${id}: ${archivo}`)
}

await navegador.close()
writeFileSync(ruta, JSON.stringify(creditos, null, 2) + '\n')
