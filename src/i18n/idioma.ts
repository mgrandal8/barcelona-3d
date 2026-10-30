import type { Monumento } from '../data/monumentos'
import type { Textos } from './es'

export type Idioma = 'es' | 'en'
export const IDIOMAS: Idioma[] = ['es', 'en']

type TextoLugar = Pick<Monumento, 'nombre' | 'etiqueta' | 'descripcion' | 'horario' | 'precio' | 'duracion' | 'consejo'>

/** Un idioma que no es el español: textos de la interfaz y campos que cambian en lugares y tours (por id). */
export type Traduccion = {
  textos: Textos
  lugares: Record<string, Partial<TextoLugar>>
  tours: Record<string, { nombre: string; resumen: string; duracion: string; precio: string; notas: string[] }>
}

const CLAVE = 'bcn3d-idioma'
const esIdioma = (x: string | null | undefined): x is Idioma => IDIOMAS.includes(x as Idioma)

/** ?lang= manda; si no, la última elección y, si no, el idioma del navegador. */
export function idiomaInicial(): Idioma {
  const url = new URLSearchParams(location.search).get('lang')
  if (esIdioma(url)) return url
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (esIdioma(guardado)) return guardado
  } catch {
    // sin almacenamiento se decide por el navegador
  }
  const nav = navigator.language?.slice(0, 2)
  return esIdioma(nav) ? nav : nav === 'ca' ? 'es' : 'en'
}

export function guardarIdioma(i: Idioma) {
  try {
    localStorage.setItem(CLAVE, i)
  } catch {
    // no pasa nada: la próxima vez se vuelve a detectar
  }
}
