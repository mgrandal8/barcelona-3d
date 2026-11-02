// Rutas de la guía: cada ficha tiene su URL propia e indexable, en cada idioma.
//   /              vista general en español
//   /lugar/<id>/   ficha en español
//   /ca/…  /en/…   lo mismo en catalán e inglés
// El build genera un index.html por ruta con su título, descripción e imagen (scripts/seo.ts), así que funcionan en un
// servidor estático como GitHub Pages; en desarrollo, Vite sirve index.html para cualquier ruta.
// Sin dependencias del store: lo usan el store, Compartir y el script de SEO.

export const IDIOMAS_RUTA = ['es', 'ca', 'en'] as const
export type IdiomaRuta = (typeof IDIOMAS_RUTA)[number]

/** Lugar e idioma de una ruta relativa a la base (sin la base delante, p. ej. «en/lugar/colom/»). */
export function leerRuta(relativa: string): { idioma: IdiomaRuta | null; lugar: string | null } {
  const partes = relativa.split('/').filter(Boolean)
  let idioma: IdiomaRuta | null = null
  if (partes[0] === 'ca' || partes[0] === 'en') idioma = partes.shift() as IdiomaRuta
  const lugar = partes[0] === 'lugar' && partes[1] ? decodeURIComponent(partes[1]) : null
  return { idioma, lugar }
}

/** Ruta relativa a la base de una ficha (o de la vista general, sin lugar). */
export const rutaDe = (lugar: string | null, idioma: string) =>
  (idioma === 'es' ? '' : `${idioma}/`) + (lugar ? `lugar/${encodeURIComponent(lugar)}/` : '')

const base = () => import.meta.env.BASE_URL

/** Lugar e idioma de la página actual. */
export function rutaActual() {
  const p = location.pathname
  return leerRuta(p.startsWith(base()) ? p.slice(base().length) : p)
}

/** Cambia la ruta de la barra (sin recargar) a la ficha y el idioma dados, conservando los demás parámetros. */
export function ponerRuta(lugar: string | null, idioma: string) {
  const url = new URL(location.href)
  url.pathname = base() + rutaDe(lugar, idioma)
  // la ruta sustituye a los parámetros antiguos (?lugar=, ?lang=), que siguen funcionando en los enlaces viejos
  url.searchParams.delete('lugar')
  url.searchParams.delete('lang')
  if (url.href !== location.href) history.replaceState(null, '', url)
}
