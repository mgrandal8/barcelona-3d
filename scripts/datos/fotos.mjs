// Fotos de los lugares desde Wikimedia Commons, con su autor y su licencia.
// Uso: node scripts/datos/fotos.mjs [id…]
// Por cada lugar toma el fichero de FOTOS (o, si no hay, la imagen libre principal de su artículo de Wikipedia),
// baja una miniatura de ANCHO px a public/fotos/<id>.jpg y escribe los créditos en src/data/fotos.json.
// Las fotos se sirven desde la propia web: sin peticiones a terceros y disponibles sin conexión.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const ANCHO = 640
const UA = 'barcelona-3d-demo/1.0 (https://github.com/mgrandal8/barcelona-3d)'

/** id → fichero de Commons elegido a mano, o artículo de la Wikipedia en español del que sacar la imagen principal. */
const FOTOS = {
  'sagrada-familia': { articulo: 'Templo Expiatorio de la Sagrada Familia' },
  'casa-batllo': { articulo: 'Casa Batlló' },
  'park-guell': { articulo: 'Park Güell' },
  // la del artículo es de 2007 (aún Torre Agbar) y muy alargada: mejor la piel LED de noche
  'torre-glories': { fichero: 'Torre Glòries (Torre Agbar) , Barcelona, Spain (Ank Kumar, Infosys Limited) 04.jpg' },
  // el artículo da un mapa de situación; esta es de las obras, como está ahora
  'camp-nou': { fichero: 'Camp Nou under renovation - Sept. 21, 2025.jpg' },
  catedral: { articulo: 'Catedral de Barcelona' },
  // la del artículo es el cartel del museo: mejor el palacio desde las Quatre Columnes
  montjuic: { fichero: 'Palau Nacional Quatre Columnes Barcelona 2013.jpg' },
  barceloneta: { articulo: 'Playa de la Barceloneta' },
  'casa-mila': { articulo: 'Casa Milà' },
  'arc-de-triomf': { articulo: 'Arco de Triunfo de Barcelona' },
  // la columna entera no cabe en 4:3: la estatua señalando al mar sobre el capitel
  colom: { fichero: 'Barcelona - Monument a Colom (3).jpg' },
}

/** fetch con reintentos: Wikimedia corta a veces la conexión (ECONNRESET) o pide calma (429). */
async function pedir(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.ok) return r
    } catch {
      // se reintenta
    }
    await new Promise((ok) => setTimeout(ok, 2500 * (i + 1)))
  }
  throw new Error('No responde: ' + url)
}
const json = async (url) => (await pedir(url)).json()

/** Quita etiquetas HTML y espacios de sobra (los campos de extmetadata vienen en HTML). */
const texto = (html = '') =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

async function ficheroDe(articulo) {
  const q = new URLSearchParams({ action: 'query', format: 'json', titles: articulo, prop: 'pageimages', piprop: 'name', pilicense: 'free', redirects: '1' })
  const r = await json(`https://es.wikipedia.org/w/api.php?${q}`)
  const p = Object.values(r.query.pages)[0]
  if (!p?.pageimage) throw new Error('Sin imagen libre: ' + articulo)
  return p.pageimage
}

const ids = process.argv.slice(2)
const ruta = 'src/data/fotos.json'
let creditos = {}
try {
  creditos = JSON.parse(readFileSync(ruta, 'utf8'))
} catch {
  // primera vez
}
mkdirSync('public/fotos', { recursive: true })

for (const [id, f] of Object.entries(FOTOS)) {
  if (ids.length && !ids.includes(id)) continue
  const fichero = f.fichero ?? (await ficheroDe(f.articulo))
  const q = new URLSearchParams({ action: 'query', format: 'json', titles: 'File:' + fichero, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: String(ANCHO) })
  const r = await json(`https://commons.wikimedia.org/w/api.php?${q}`)
  const info = Object.values(r.query.pages)[0].imageinfo[0]
  const m = info.extmetadata
  const licencia = texto(m.LicenseShortName?.value)
  // solo licencias que dejan reutilizar con atribución
  if (!/^(CC BY|CC0|Public domain|Dominio público)/i.test(licencia)) throw new Error(`${id}: licencia no válida (${licencia})`)
  const img = await pedir(info.thumburl)
  writeFileSync(`public/fotos/${id}.jpg`, Buffer.from(await img.arrayBuffer()))
  creditos[id] = {
    archivo: `fotos/${id}.jpg`,
    ancho: info.thumbwidth,
    alto: info.thumbheight,
    autor: texto(m.Artist?.value) || 'Autor desconocido',
    licencia,
    urlLicencia: m.LicenseUrl?.value ?? null,
    pagina: info.descriptionshorturl ?? info.descriptionurl,
    titulo: fichero,
  }
  // se guarda tras cada foto: si una falla, las anteriores no se pierden
  writeFileSync(ruta, JSON.stringify(creditos, null, 2) + '\n')
  console.log(`${id}: ${fichero} · ${creditos[id].autor} · ${licencia} · ${info.thumbwidth}×${info.thumbheight}`)
}
