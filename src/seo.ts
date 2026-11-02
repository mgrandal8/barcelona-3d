// SEO: a partir del index.html del build genera una página por ruta (vista general y cada ficha, en cada idioma) con
// título, descripción, URL canónica, idiomas alternativos, Open Graph, Twitter, datos estructurados (schema.org) y el
// texto de la ficha dentro de #root, que React sustituye al arrancar. También el sitemap y robots.txt.
// Lo usa el plugin seo() de vite.config.ts; aquí no hay nada del navegador ni de node.
import { CONSULTADO, MONUMENTOS, porId, type Monumento } from './data/monumentos'
import { textosDe, traducirLugar } from './i18n/textos'
import type { Idioma } from './i18n/idioma'
import { IDIOMAS_RUTA, rutaDe } from './rutas'

export type Pagina = { ruta: string; html: string }

const LOCALE: Record<Idioma, string> = { es: 'es_ES', ca: 'ca_ES', en: 'en_GB' }

const TITULO_GENERAL: Record<Idioma, string> = {
  es: 'Barcelona 3D · Guía en una maqueta 3D de la ciudad',
  ca: 'Barcelona 3D · Guia en una maqueta 3D de la ciutat',
  en: 'Barcelona 3D · A guide on a 3D model of the city',
}
const DESCRIPCION_GENERAL: Record<Idioma, string> = {
  es: 'Guía de Barcelona sobre una maqueta 3D hecha con datos reales: Sagrada Família, Park Güell, la Pedrera y más lugares con horarios y precios oficiales, tours, metro y tu posición. Funciona sin conexión.',
  ca: 'Guia de Barcelona sobre una maqueta 3D feta amb dades reals: la Sagrada Família, el Park Güell, la Pedrera i més llocs amb horaris i preus oficials, tours, metro i la teva posició. Funciona sense connexió.',
  en: 'A guide to Barcelona on a 3D model built from real data: Sagrada Família, Park Güell, La Pedrera and more places with official opening hours and prices, tours, metro and your position. Works offline.',
}
const LUGARES_ET: Record<Idioma, string> = { es: 'Lugares de la guía', ca: 'Llocs de la guia', en: 'Places in the guide' }
const VER_3D: Record<Idioma, string> = { es: 'Ver en la maqueta 3D', ca: 'Mira-ho a la maqueta 3D', en: 'See it on the 3D model' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Corta en la última palabra antes de n caracteres (para la meta descripción). */
function recortar(s: string, n = 158) {
  if (s.length <= n) return s
  const corte = s.slice(0, n - 1)
  return corte.slice(0, corte.lastIndexOf(' ')) + '…'
}

/** Datos estructurados de un lugar (TouristAttraction). */
function jsonLd(m: Monumento, url: string, sitio: string, imagen: string, idioma: Idioma) {
  const gratis = porId(m.id)?.precio === 'Gratis'
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: m.nombre,
    description: m.descripcion,
    url,
    image: imagen,
    inLanguage: idioma,
    geo: { '@type': 'GeoCoordinates', latitude: m.coord[0], longitude: m.coord[1] },
    address: { '@type': 'PostalAddress', addressLocality: 'Barcelona', addressCountry: 'ES' },
    ...(gratis ? { isAccessibleForFree: true } : {}),
    ...(m.web ? { sameAs: m.web } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Barcelona 3D', url: sitio },
  }
}

type Opciones = {
  /** index.html del build. */
  plantilla: string
  /** URL absoluta de la web publicada, con / al final. */
  sitio: string
  /** Base de la web (BASE_URL) para los enlaces internos del texto: así también sirven en local. */
  base: string
  /** Ficheros de public/ (para saber qué imágenes og/ existen). */
  publicos: string[]
}

export function paginas({ plantilla, sitio, base, publicos }: Opciones): Pagina[] {
  const og = (id: string) => (publicos.includes(`og/${id}.jpg`) ? `og/${id}.jpg` : null)
  const salida: Pagina[] = []
  for (const idioma of IDIOMAS_RUTA) {
    const t = textosDe(idioma)
    const lugares = MONUMENTOS.map((m) => traducirLugar(m, idioma))
    for (const m of [null, ...lugares]) {
      const ruta = rutaDe(m?.id ?? null, idioma)
      const url = sitio + ruta
      const titulo = m ? `${m.nombre} · Barcelona 3D` : TITULO_GENERAL[idioma]
      const descripcion = m ? recortar(m.descripcion) : DESCRIPCION_GENERAL[idioma]
      const imagen = sitio + (m ? (og(m.id) ?? m.foto?.archivo ?? 'icono-512.png') : (og('general') ?? 'icono-512.png'))
      const alternos = IDIOMAS_RUTA.map((i) => `<link rel="alternate" hreflang="${i}" href="${sitio + rutaDe(m?.id ?? null, i)}" />`)
      alternos.push(`<link rel="alternate" hreflang="x-default" href="${sitio + rutaDe(m?.id ?? null, 'es')}" />`)
      const cabecera = [
        `<link rel="canonical" href="${url}" />`,
        ...alternos,
        `<meta property="og:type" content="${m ? 'article' : 'website'}" />`,
        `<meta property="og:site_name" content="Barcelona 3D" />`,
        `<meta property="og:title" content="${esc(titulo)}" />`,
        `<meta property="og:description" content="${esc(descripcion)}" />`,
        `<meta property="og:url" content="${url}" />`,
        `<meta property="og:image" content="${imagen}" />`,
        ...(imagen.includes('/og/') ? ['<meta property="og:image:width" content="1200" />', '<meta property="og:image:height" content="630" />'] : []),
        `<meta property="og:locale" content="${LOCALE[idioma]}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        ...(m ? [`<script type="application/ld+json">${JSON.stringify(jsonLd(m, url, sitio, imagen, idioma)).replace(/</g, '\\u003c')}</script>`] : []),
      ].join('\n    ')

      // el texto de la página para buscadores y para quien no tenga JavaScript; React lo sustituye al arrancar
      const enlaces = lugares.map((x) => `<li><a href="${base + rutaDe(x.id, idioma)}">${esc(x.nombre)}</a></li>`).join('')
      const cuerpo = m
        ? `<article class="seo">
      <p>${esc(m.etiqueta)} · ${esc(m.barrio)}</p>
      <h1>${esc(m.nombre)}</h1>
      <p>${esc(m.descripcion)}</p>
      <dl>
        <dt>${esc(t.panel.horario)}</dt><dd>${esc(m.horario)}</dd>
        <dt>${esc(t.panel.precio)}</dt><dd>${esc(m.precio)}</dd>
        <dt>${esc(t.panel.duracion)}</dt><dd>${esc(m.duracion)}</dd>
      </dl>
      <p><strong>${esc(t.panel.consejo)}:</strong> ${esc(m.consejo)}</p>
      ${m.web ? `<p><a href="${esc(m.web)}">${esc(t.panel.fuente)}</a> (${CONSULTADO})</p>` : ''}
      <p><a href="${base + ruta}">${esc(VER_3D[idioma])}</a></p>
      <nav><h2>${esc(LUGARES_ET[idioma])}</h2><ul>${enlaces}</ul></nav>
    </article>`
        : `<article class="seo">
      <h1>${esc(TITULO_GENERAL[idioma])}</h1>
      <p>${esc(DESCRIPCION_GENERAL[idioma])}</p>
      <nav><h2>${esc(LUGARES_ET[idioma])}</h2><ul>${enlaces}</ul></nav>
    </article>`

      const html = plantilla
        .replace(/<html lang="[^"]*">/, `<html lang="${idioma}">`)
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(titulo)}</title>`)
        .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(descripcion)}" />\n    ${cabecera}`)
        .replace('<div id="root"></div>', `<div id="root">\n    ${cuerpo}\n    </div>`)
      salida.push({ ruta, html })
    }
  }
  return salida
}

/** sitemap.xml con todas las rutas y sus versiones en otros idiomas. */
export function sitemap(sitio: string) {
  const urls = [null, ...MONUMENTOS.map((m) => m.id)].flatMap((id) =>
    IDIOMAS_RUTA.map(
      (i) =>
        `  <url>\n    <loc>${sitio + rutaDe(id, i)}</loc>\n    <lastmod>${CONSULTADO}</lastmod>\n${IDIOMAS_RUTA.map((j) => `    <xhtml:link rel="alternate" hreflang="${j}" href="${sitio + rutaDe(id, j)}" />`).join('\n')}\n  </url>`,
    ),
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
}

export const robots = (sitio: string) => `User-agent: *\nAllow: /\n\nSitemap: ${sitio}sitemap.xml\n`
