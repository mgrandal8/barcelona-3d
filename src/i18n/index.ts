import { MONUMENTOS, porId } from '../data/monumentos'
import { TOURS, tourPorId } from '../data/tours'
import { useEstado } from '../store'
import { textosDe, traducirLugar, traducirTour } from './textos'

export type { Idioma } from './idioma'
export { fechaLarga, textosDe, traducirLugar, traducirTour } from './textos'

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
