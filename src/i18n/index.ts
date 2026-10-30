import { MONUMENTOS, porId, type Monumento } from '../data/monumentos'
import { TOURS, tourPorId, type Tour } from '../data/tours'
import { useEstado } from '../store'
import { en } from './en'
import { es } from './es'
import type { Idioma, Traduccion } from './idioma'

export type { Idioma }

// el español es el idioma de los datos: no lleva traducción
const TRADUCCIONES: Record<Idioma, Traduccion | null> = { es: null, en }

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

/** Textos de la interfaz en el idioma elegido. */
export const useT = () => textosDe(useEstado((s) => s.idioma))

export function useLugar(id: string | null) {
  const i = useEstado((s) => s.idioma)
  const m = porId(id)
  return m && traducirLugar(m, i)
}

export function useLugares() {
  const i = useEstado((s) => s.idioma)
  return MONUMENTOS.map((m) => traducirLugar(m, i))
}

export function useTour(id: string | null) {
  const i = useEstado((s) => s.idioma)
  const t = tourPorId(id)
  return t && traducirTour(t, i)
}

export function useTours() {
  const i = useEstado((s) => s.idioma)
  return TOURS.map((t) => traducirTour(t, i))
}
