import { useEffect, useState } from 'react'
import { descomprimir } from './scene/datos'
import { ESCALA } from './scene/geo'

// Metro y FGC urbano (public/datos/transporte.json.gz, de scripts/datos/procesar-transporte.mjs).
// Va aparte de la ciudad: son pocos kB y no retrasan la carga.

export type LineaMetro = { ref: string; color: string; tramos: number[][] }
export type Estacion = { n: string; p: [number, number]; l: string[] }
export type Transporte = { lineas: LineaMetro[]; estaciones: Estacion[]; colores: Record<string, string> }

let promesa: Promise<Transporte> | null = null

export function cargarTransporte() {
  promesa ??= (async () => {
    const r = await fetch(import.meta.env.BASE_URL + 'datos/transporte.json.gz')
    if (!r.ok) throw new Error(`transporte: ${r.status}`)
    const d = JSON.parse(new TextDecoder().decode(await descomprimir(await r.arrayBuffer()))) as Omit<Transporte, 'colores'>
    return { ...d, colores: Object.fromEntries(d.lineas.map((l) => [l.ref, l.color])) }
  })()
  return promesa
}

/** Los datos de transporte cuando ya han llegado (null mientras tanto, o si fallan). */
export function useTransporte() {
  const [t, setT] = useState<Transporte | null>(null)
  useEffect(() => {
    let vigente = true
    cargarTransporte().then(
      (d) => vigente && setT(d),
      () => {},
    )
    return () => {
      vigente = false
    }
  }, [])
  return t
}

/** Estación más cercana a un punto de la escena, con la distancia en metros. */
export function estacionCercana(t: Transporte, x: number, z: number) {
  let mejor: Estacion | null = null
  let d2 = Infinity
  for (const e of t.estaciones) {
    const dx = e.p[0] / ESCALA - x
    const dz = e.p[1] / ESCALA - z
    const d = dx * dx + dz * dz
    if (d < d2) {
      d2 = d
      mejor = e
    }
  }
  return mejor && { estacion: mejor, metros: Math.sqrt(d2) * ESCALA }
}

/** Texto oscuro sobre los colores claros (L4 amarilla, L11 verde lima, L12 lila). */
export function textoSobre(color: string) {
  const n = parseInt(color.slice(1), 16)
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#1d1a17' : '#ffffff'
}
