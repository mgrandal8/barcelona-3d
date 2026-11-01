// Uso: node scripts/prueba-contenido.mjs [url-base] [bloques]
// Comprueba la sesión 14 (contenido real y legal) sobre el build (vite preview):
//   rutas  URL por ficha e idioma (/lugar/<id>/, /ca/…, /en/…), enlaces viejos con ?lugar= y ?lang=
//   ficha  foto de Wikimedia con autor y licencia, fuente oficial con fecha, en los tres idiomas
//   legal  «Privacidad y créditos»: privacidad, analítica, créditos de las 11 fotos; axe sin fallos
//   seo    HTML estático de cada ruta (título, canónica, hreflang, og, JSON-LD, texto), sitemap y robots
// Va en la versión ligera (?modo=ligero): la ficha y los diálogos son los mismos y no hace falta esperar a la maqueta.
import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:5190/')
const bloques = (process.argv[3] ?? 'rutas,ficha,legal,seo').split(',')
const browser = await chromium.launch()
let fallos = 0
const ok = (c, msg) => {
  if (!c) fallos++
  console.log(c ? 'OK ' : 'FALLO', msg)
}

/** Abre ruta (relativa a la base, con su consulta) en la versión ligera y espera a que esté lista. */
async function abrir(ruta) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'es-ES', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  const url = new URL(ruta, base)
  url.searchParams.set('captura', '1')
  url.searchParams.set('modo', 'ligero')
  await page.goto(url.href)
  await page.waitForFunction(() => window.__estado?.getState().carga.listo, null, { timeout: 120000 })
  await page.evaluate(() => window.__estado.getState().cerrarPortada())
  return { ctx, page, errores }
}
const camino = (page) => new URL(page.url()).pathname
const estado = (page, f) => page.evaluate(`(${f})(window.__estado.getState())`)
const fin = async ({ ctx, errores }) => {
  ok(!errores.length, 'sin errores de consola' + (errores.length ? ':\n  ' + errores.join('\n  ') : ''))
  await ctx.close()
}

if (bloques.includes('rutas')) {
  let p = await abrir('en/lugar/colom/')
  ok((await estado(p.page, (s) => s.seleccionado)) === 'colom' && (await estado(p.page, (s) => s.idioma)) === 'en', '/en/lugar/colom/ abre la ficha de Colom en inglés')
  ok((await p.page.locator('.panel.abierto h2').innerText()) === 'Columbus Monument', 'con su nombre en inglés')
  await p.page.locator('.menu .idioma button', { hasText: 'CA' }).click({ force: true })
  await p.page.waitForFunction(() => location.pathname.includes('/ca/'))
  ok(camino(p.page) === '/ca/lugar/colom/', 'al pasar al catalán, /ca/lugar/colom/')
  await p.page.evaluate(() => window.__estado.getState().setSeleccionado('park-guell'))
  ok(camino(p.page) === '/ca/lugar/park-guell/', 'otra ficha cambia la ruta: ' + camino(p.page))
  await p.page.evaluate(() => window.__estado.getState().setSeleccionado(null))
  ok(camino(p.page) === '/ca/', 'al cerrar la ficha, /ca/')
  ok(new URL(p.page.url()).searchParams.get('modo') === 'ligero', 'los demás parámetros se conservan')
  await fin(p)

  p = await abrir('?lugar=catedral&lang=en')
  ok(camino(p.page) === '/en/lugar/catedral/' && !p.page.url().includes('lugar=') && !p.page.url().includes('lang='), 'un enlace viejo (?lugar=&lang=) pasa a /en/lugar/catedral/: ' + p.page.url())
  ok((await p.page.locator('.panel.abierto h2').innerText()) === 'Cathedral & Gothic Quarter', 'y abre la ficha')
  await fin(p)

  p = await abrir('lugar/no-existe/')
  ok((await estado(p.page, (s) => s.seleccionado)) === null && camino(p.page) === '/', 'una ficha que no existe va a la vista general')
  await fin(p)
}

if (bloques.includes('ficha')) {
  const p = await abrir('lugar/sagrada-familia/')
  const img = p.page.locator('.panel-foto img')
  await img.scrollIntoViewIfNeeded()
  await p.page.waitForFunction(() => document.querySelector('.panel-foto img')?.complete)
  ok((await img.evaluate((i) => i.naturalWidth)) === 600, 'la foto carga (600 px de ancho)')
  ok((await img.getAttribute('alt')) === 'Sagrada Família', 'con texto alternativo')
  const pie = await p.page.locator('.panel-foto figcaption').innerText()
  ok(pie.includes('Canaan') && pie.includes('CC BY-SA 4.0') && pie.includes('recortada'), 'crédito: autor, licencia y «recortada»: ' + pie)
  ok((await p.page.locator('.panel-foto figcaption a[rel~="license"]').getAttribute('href')).includes('creativecommons.org'), 'enlace a la licencia')
  ok((await p.page.locator('.panel-foto figcaption a').first().getAttribute('href')).includes('commons.wikimedia.org'), 'enlace a la página de Commons')
  ok((await p.page.locator('.panel-datos dd').nth(1).innerText()).includes('26 €'), 'precio real (26 €)')
  const fuente = p.page.locator('.panel-fuente a')
  ok((await fuente.getAttribute('href')) === 'https://sagradafamilia.org/es/horarios-como-llegar', 'fuente: la web oficial')
  ok((await p.page.locator('.panel-fuente').innerText()).includes('1 de noviembre de 2026'), 'con la fecha de consulta')
  await p.page.locator('.menu .idioma button', { hasText: 'CA' }).click({ force: true })
  ok((await p.page.locator('.panel-fuente').innerText()).includes('1 de novembre'), 'la fecha en catalán: ' + (await p.page.locator('.panel-fuente').innerText()))
  await p.page.locator('.menu .idioma button', { hasText: 'EN' }).click({ force: true })
  ok((await p.page.locator('.panel-foto figcaption').innerText()).includes('cropped'), 'el crédito en inglés')
  // un monumento en la calle no tiene web oficial
  await p.page.evaluate(() => window.__estado.getState().setSeleccionado('arc-de-triomf'))
  ok((await p.page.locator('.panel-fuente').innerText()).includes('Street monument'), 'el Arc de Triomf: monumento en la calle, sin fuente')
  await fin(p)
}

if (bloques.includes('legal')) {
  const p = await abrir('')
  await p.page.locator('.atribucion-legal').click({ force: true })
  const d = p.page.locator('.dialogo[role="dialog"]')
  await d.waitFor()
  ok((await d.getAttribute('aria-label')) === 'Privacidad y créditos', 'la atribución abre «Privacidad y créditos»')
  const texto = await d.innerText()
  ok(texto.includes('no usa cookies') && texto.includes('se queda en tu dispositivo'), 'privacidad: sin cookies y ubicación local')
  ok(texto.includes('No hay analítica'), 'sin analítica configurada, lo dice')
  ok(texto.includes('OpenStreetMap') && texto.includes('ODbL') && texto.includes('Terrain Tiles'), 'créditos del mapa y del relieve')
  ok((await d.locator('.legal-fotos li').count()) === 11, '11 fotos con su crédito')
  ok((await d.locator('.legal-fotos a[rel~="license"]').count()) === 11, 'cada una con el enlace a su licencia')
  const axe = await new AxeBuilder({ page: p.page }).include('.dialogo').analyze()
  ok(!axe.violations.length, 'axe en el diálogo: ' + (axe.violations.map((v) => v.id).join(', ') || 'sin fallos'))
  await p.page.keyboard.press('Escape')
  // también desde la ayuda
  await p.page.evaluate(() => window.__estado.getState().setDialogo('ayuda'))
  await p.page.locator('.dialogo-pie button').click({ force: true })
  ok((await estado(p.page, (s) => s.dialogo)) === 'legal', 'la ayuda lleva a «Privacidad y créditos»')
  await p.page.keyboard.press('Escape')
  // la ficha con foto también pasa axe
  await p.page.evaluate(() => window.__estado.getState().setSeleccionado('casa-mila'))
  await p.page.waitForSelector('.panel.abierto .panel-foto img')
  const axe2 = await new AxeBuilder({ page: p.page }).include('.panel').analyze()
  ok(!axe2.violations.length, 'axe en la ficha con foto: ' + (axe2.violations.map((v) => v.id).join(', ') || 'sin fallos'))
  await fin(p)
}

if (bloques.includes('seo')) {
  const get = async (ruta) => {
    const r = await fetch(new URL(ruta, base))
    return { estado: r.status, texto: await r.text() }
  }
  const sitio = 'https://mgrandal8.github.io/barcelona-3d/'
  const { estado: e, texto: h } = await get('lugar/sagrada-familia/')
  ok(e === 200, '/lugar/sagrada-familia/ existe como fichero (200)')
  ok(h.includes('<title>Sagrada Família · Barcelona 3D</title>'), 'título de la ficha')
  ok(h.includes(`<link rel="canonical" href="${sitio}lugar/sagrada-familia/" />`), 'URL canónica')
  ok(['es', 'ca', 'en', 'x-default'].every((i) => h.includes(`hreflang="${i}"`)), 'hreflang de los tres idiomas y x-default')
  ok(h.includes(`<meta property="og:image" content="${sitio}og/sagrada-familia.jpg" />`), 'og:image de la maqueta')
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])
  ok(ld['@type'] === 'TouristAttraction' && ld.geo.latitude === 41.40359 && ld.sameAs.includes('sagradafamilia.org'), 'JSON-LD TouristAttraction con coordenadas y web oficial')
  ok(/<div id="root">\s*<article class="seo">[\s\S]*<h1>Sagrada Família<\/h1>[\s\S]*26 €/.test(h), 'el texto de la ficha va en el HTML (h1, precio)')
  ok((h.match(/<a href="\/lugar\//g) ?? []).length === 12, 'enlaces internos a las 11 fichas (y a la propia)')
  const en = (await get('en/lugar/park-guell/')).texto
  ok(en.includes('<html lang="en">') && en.includes('og:locale" content="en_GB"') && en.includes('monumental area'), '/en/lugar/park-guell/ en inglés')
  const ca = (await get('ca/')).texto
  ok(ca.includes('<html lang="ca">') && ca.includes('Guia en una maqueta 3D'), '/ca/ en catalán')
  const inicio = (await get('')).texto
  ok(inicio.includes(`<link rel="canonical" href="${sitio}" />`) && inicio.includes('og:image" content="' + sitio + 'og/general.jpg'), 'la portada con su canónica y su imagen')
  const mapa = (await get('sitemap.xml')).texto
  ok((mapa.match(/<loc>/g) ?? []).length === 36, 'sitemap con 36 URL (12 rutas × 3 idiomas)')
  ok((await get('robots.txt')).texto.includes(`Sitemap: ${sitio}sitemap.xml`), 'robots.txt apunta al sitemap')
  const og = await fetch(new URL('og/colom.jpg', base))
  ok(og.ok && og.headers.get('content-type')?.includes('jpeg'), 'las imágenes og existen')
  const ids = [...h.matchAll(/href="\/lugar\/([^/]+)\//g)].map((m) => m[1])
  const fotos = await Promise.all(ids.map((id) => fetch(new URL(`fotos/${id}.webp`, base)).then((r) => r.ok)))
  ok(fotos.length >= 11 && fotos.every(Boolean), 'las fotos de todos los lugares existen')
}

await browser.close()
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK')
process.exit(fallos ? 1 : 0)
