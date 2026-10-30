// Sin three: lo usan la interfaz y el store, que se cargan antes que la escena.
import type { NombreIcono } from '../ui/Icono'

export type Momento = 'dia' | 'atardecer' | 'noche'
export const MOMENTOS: Momento[] = ['dia', 'atardecer', 'noche']
export const ICONO_MOMENTO = { dia: 'sol', atardecer: 'atardecer', noche: 'luna' } as const satisfies Record<Momento, NombreIcono>

export const momentoDeUrl = (): Momento => {
  const h = new URLSearchParams(location.search).get('hora')
  return MOMENTOS.includes(h as Momento) ? (h as Momento) : 'dia'
}
