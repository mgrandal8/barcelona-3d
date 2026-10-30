// Marco de referencia de la maqueta.
// Origen cerca de Passeig de Gràcia / Diagonal, girado 45° para que la
// cuadrícula del Eixample quede alineada con los ejes:
//   u (eje x de la escena) → hacia el noreste (Besòs)
//   v (eje z de la escena) → hacia el sureste (el mar)
// Todo en metros.

export const LAT0 = 41.392
export const LON0 = 2.165
const M_LAT = 110540
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
const S = Math.SQRT1_2

export const RECT = { uMin: -5500, uMax: 6500, vMin: -6000, vMax: 4500 }

export function proyectar(lat, lon) {
  const e = (lon - LON0) * M_LON
  const n = (lat - LAT0) * M_LAT
  return [(e + n) * S, (e - n) * S]
}

export function desproyectar(u, v) {
  const e = (u + v) * S
  const n = (u - v) * S
  return [LAT0 + n / M_LAT, LON0 + e / M_LON]
}

/** Polígono "lat lon lat lon ..." para el filtro poly: de Overpass. */
export function polyOverpass(r) {
  const esq = [
    [r.uMin, r.vMin],
    [r.uMax, r.vMin],
    [r.uMax, r.vMax],
    [r.uMin, r.vMax],
  ]
  return esq.map(([u, v]) => desproyectar(u, v).map((x) => x.toFixed(6)).join(' ')).join(' ')
}

export const CRUDOS = new URL('../../datos-crudos/', import.meta.url).pathname
export const SALIDA = new URL('../../public/datos/', import.meta.url).pathname

/** Douglas-Peucker sobre [[u, v], ...] con tolerancia en metros. */
export function simplificar(pts, tol) {
  if (pts.length < 4) return pts
  const t2 = tol * tol
  const marca = new Uint8Array(pts.length)
  marca[0] = marca[pts.length - 1] = 1
  const pila = [[0, pts.length - 1]]
  while (pila.length) {
    const [a, b] = pila.pop()
    const [ax, ay] = pts[a]
    const [bx, by] = pts[b]
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy || 1e-9
    let max = 0
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2))
      const ex = ax + t * dx - pts[i][0]
      const ey = ay + t * dy - pts[i][1]
      const d = ex * ex + ey * ey
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (max > t2 && idx > 0) {
      marca[idx] = 1
      pila.push([a, idx], [idx, b])
    }
  }
  return pts.filter((_, i) => marca[i])
}
