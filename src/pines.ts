import { useSyncExternalStore } from 'react'

// Puente entre la escena y la capa de pines, sin three: scene/Pines.tsx proyecta los lugares en cada
// fotograma y deja aquí su posición en pantalla; ui/CapaPines.tsx mueve los botones HTML.
// Los índices son los de MONUMENTOS (el orden de la guía).

export const pantalla = {
  x: [] as number[],
  y: [] as number[],
  /** Delante de la cámara, sin un edificio delante y sin ocultar (el lugar elegido no lleva pin). */
  ver: [] as boolean[],
  /** Lugares que se solapan en pantalla, por id; solo cambia cuando cambia la composición. */
  grupos: [] as string[][],
}

const oyentesFotograma = new Set<() => void>()
const oyentesGrupos = new Set<() => void>()

export function alFotograma(f: () => void) {
  oyentesFotograma.add(f)
  return () => void oyentesFotograma.delete(f)
}
export const avisarFotograma = () => oyentesFotograma.forEach((f) => f())

export function ponerGrupos(g: string[][]) {
  pantalla.grupos = g
  oyentesGrupos.forEach((f) => f())
}

const suscribir = (f: () => void) => {
  oyentesGrupos.add(f)
  return () => void oyentesGrupos.delete(f)
}
export const useGrupos = () => useSyncExternalStore(suscribir, () => pantalla.grupos)

// modo captura: las pruebas leen dónde está cada pin y si se ve
if (new URLSearchParams(location.search).has('captura')) Object.assign(window, { __pines: pantalla })
