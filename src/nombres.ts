import { useEffect, useState } from 'react'
import { descomprimir } from './scene/gzip'

// Nombres de distritos, barrios y calles principales (public/datos/nombres.json.gz, de
// scripts/datos/procesar.mjs). Como los pines: scene/Nombres.tsx los proyecta y decide cuáles caben,
// y ui/CapaNombres.tsx mueve los textos HTML. Sin three. Van aparte de la ciudad: no retrasan la carga.

/** l: 0 distrito o municipio, 1 barrio, 2 calle (con su ángulo `a` en el plano xz); p: prioridad (tamaño). */
export type Nombre = { n: string; x: number; z: number; l: 0 | 1 | 2; a?: number; p: number }

let promesa: Promise<Nombre[]> | null = null

export function cargarNombres() {
  promesa ??= (async () => {
    const r = await fetch(import.meta.env.BASE_URL + 'datos/nombres.json.gz')
    if (!r.ok) throw new Error(`nombres: ${r.status}`)
    return JSON.parse(new TextDecoder().decode(await descomprimir(await r.arrayBuffer()))) as Nombre[]
  })()
  promesa.catch(() => {
    promesa = null
  })
  return promesa
}

/** Los nombres cuando ya han llegado (null mientras tanto, si fallan o con `?nombres=0`). */
export function useNombres() {
  const [n, setN] = useState<Nombre[] | null>(null)
  useEffect(() => {
    if (!CON_NOMBRES) return
    let vigente = true
    cargarNombres().then(
      (d) => vigente && setN(d),
      () => {},
    )
    return () => {
      vigente = false
    }
  }, [])
  return n
}

export const CON_NOMBRES = new URLSearchParams(location.search).get('nombres') !== '0'

/** Posición en pantalla (px), ángulo (grados) y si se ve, por índice del fichero. */
export const pantallaNombres = { x: [] as number[], y: [] as number[], ang: [] as number[], ver: [] as boolean[] }

const oyentes = new Set<() => void>()
export function alFotogramaNombres(f: () => void) {
  oyentes.add(f)
  return () => void oyentes.delete(f)
}
export const avisarNombres = () => oyentes.forEach((f) => f())

/** Caja aproximada de un nombre en pantalla, sin medir el DOM (se usa para que no se pisen). */
export function tamNombre(n: Nombre): [number, number] {
  const letra = n.l === 0 ? 9.2 : n.l === 1 ? 7 : 6.4
  return [n.n.length * letra + 12, n.l === 0 ? 22 : 18]
}

if (new URLSearchParams(location.search).has('captura')) Object.assign(window, { __nombres: pantallaNombres })
