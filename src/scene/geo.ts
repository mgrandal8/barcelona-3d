// Marco de la maqueta (mismo que scripts/datos/comun.mjs).
// Metros reales → unidades de escena: 1 unidad = 100 m, alturas exageradas.

export const LAT0 = 41.392
export const LON0 = 2.165
const M_LAT = 110540
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)

export const ESCALA = 100
export const EXAGERACION = 1.6

/** lat/lon → [x, z] de escena. */
export function geoAEscena(lat: number, lon: number): [number, number] {
  const e = (lon - LON0) * M_LON
  const n = (lat - LAT0) * M_LAT
  return [((e + n) * Math.SQRT1_2) / ESCALA, ((e - n) * Math.SQRT1_2) / ESCALA]
}

export const metrosAY = (m: number) => (m * EXAGERACION) / ESCALA
