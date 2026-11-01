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

/** Fecha ISO (AAAA-MM-DD) escrita en el idioma: «1 de noviembre de 2026». */
export const fechaLarga = (iso: string, i: Idioma) =>
  new Intl.DateTimeFormat(i, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'))
