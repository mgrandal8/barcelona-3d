// Textos y traducciones sin React ni store: también los usa el build (src/seo.ts).
import type { Monumento } from '../data/monumentos'
import type { Tour } from '../data/tours'
import { ca } from './ca'
import { en } from './en'
import { es } from './es'
import type { Idioma, Traduccion } from './idioma'

// el español es el idioma de los datos: no lleva traducción
const TRADUCCIONES: Record<Idioma, Traduccion | null> = { es: null, ca, en }

export const textosDe = (i: Idioma) => TRADUCCIONES[i]?.textos ?? es

export function traducirLugar(m: Monumento, i: Idioma): Monumento {
  const t = TRADUCCIONES[i]?.lugares[m.id]
  return t ? { ...m, ...t } : m
}

export function traducirTour(t: Tour, i: Idioma): Tour {
  const x = TRADUCCIONES[i]?.tours[t.id]
  if (!x) return t
  const { notas, ...resto } = x
  return { ...t, ...resto, paradas: t.paradas.map((p, k) => ({ ...p, nota: notas[k] ?? p.nota })) }
}

/**
 * Modo embebido: un JSON externo ha cambiado (en español) los campos `campos` del lugar `id`. Esos campos dejan de
 * traducirse (si no, el catalán y el inglés enseñarían el texto viejo) salvo que el JSON traiga su traducción en `propias`.
 */
export function ajustarTraduccionLugar(id: string, campos: string[], propias: Partial<Record<Idioma, Record<string, string>>>) {
  for (const i of ['ca', 'en'] as const) {
    const tr = TRADUCCIONES[i]!
    const actual: Record<string, string> = { ...tr.lugares[id] }
    for (const c of campos) delete actual[c]
    tr.lugares[id] = { ...actual, ...propias[i] }
  }
}

/** Modo embebido: los tours del JSON externo sustituyen a los de la demo; sus traducciones son las que traiga el JSON. */
export function ponerTraduccionesTours(porTour: Record<string, Partial<Record<Idioma, Traduccion['tours'][string]>>>) {
  for (const i of ['ca', 'en'] as const) {
    const tr = TRADUCCIONES[i]!
    tr.tours = {}
    for (const [id, t] of Object.entries(porTour)) if (t[i]) tr.tours[id] = t[i]!
  }
}

/** Fecha ISO (AAAA-MM-DD) escrita en el idioma: «1 de noviembre de 2026». */
export const fechaLarga = (iso: string, i: Idioma) =>
  new Intl.DateTimeFormat(i, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))
