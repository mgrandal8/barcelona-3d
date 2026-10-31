// Distancia con signo a la costa real (OSM), en metros: positiva en tierra, negativa en el mar.
// La usa la malla del terreno para que el agua corte el suelo justo en la línea de costa y no en la
// rejilla de 20 m. Sin three ni DOM (va en el worker del suelo).

import type { Mapa } from './suelo'

type Seg = { ax: number; ay: number; bx: number; by: number; medio: number }

const CELDA = 100

/** Distancia del punto (px, py) al segmento. */
function dSeg(s: Seg, px: number, py: number) {
  const dx = s.bx - s.ax
  const dy = s.by - s.ay
  const l2 = dx * dx + dy * dy || 1e-9
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / l2))
  return Math.hypot(s.ax + t * dx - px, s.ay + t * dy - py)
}

function dentro(px: number, py: number, r: number[]) {
  let c = false
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Cubos de segmentos por celdas de 100 m. */
function cubos(lineas: number[][], medio: (i: number) => number) {
  const m = new Map<number, Seg[]>()
  const clave = (i: number, j: number) => i * 100003 + j
  lineas.forEach((p, k) => {
    for (let i = 2; i < p.length; i += 2) {
      const s: Seg = { ax: p[i - 2], ay: p[i - 1], bx: p[i], by: p[i + 1], medio: medio(k) }
      const r = s.medio
      for (let ci = Math.floor((Math.min(s.ax, s.bx) - r) / CELDA); ci <= Math.floor((Math.max(s.ax, s.bx) + r) / CELDA); ci++)
        for (let cj = Math.floor((Math.min(s.ay, s.by) - r) / CELDA); cj <= Math.floor((Math.max(s.ay, s.by) + r) / CELDA); cj++) {
          const c = clave(ci, cj)
          if (!m.has(c)) m.set(c, [])
          m.get(c)!.push(s)
        }
    }
  })
  return (u: number, v: number) => m.get(clave(Math.floor(u / CELDA), Math.floor(v / CELDA)))
}

/**
 * `null` si el mapa no trae la costa (datos antiguos). Si no, una función que da la distancia con signo
 * hasta `alcance` metros (más lejos devuelve ±alcance, con el lado que diga `marAprox`). Los diques y espigones (líneas `muelle`)
 * cuentan como tierra con su anchura (al menos 24 m, para que la malla de 20 m no los pierda), y también,
 * lejos de la costa, lo que en el relieve pasa de 1,5 m (`alturaM` en metros, con u y v en metros).
 */
export function crearCosta(mapa: Mapa, alcance: number, marAprox: (u: number, v: number) => boolean, alturaM: (u: number, v: number) => number) {
  const mar = mapa.areas.find((a) => a.t === 'mar')
  if (!mar || !mapa.costa) return null
  const enCosta = cubos(mapa.costa, () => alcance)
  const muelles = mapa.lineas.filter((l) => l.t === 'muelle')
  const enMuelle = cubos(
    muelles.map((l) => l.p),
    (k) => Math.max(12, muelles[k].a / 2),
  )
  // muelles con superficie (man_made cerrados): también tierra, con su contorno
  const areas = mapa.areas.filter((a) => a.t === 'muelle')
  const anillosMuelle = areas.flatMap((a) => a.r.map((r) => [...r, r[0], r[1]]))
  const enArea = cubos(anillosMuelle, () => alcance)
  const esMar = (u: number, v: number) => mar.r.filter((r) => dentro(u, v, r)).length % 2 === 1
  return (u: number, v: number) => {
    const ss = enCosta(u, v)
    let d = alcance
    if (ss) for (const s of ss) d = Math.min(d, dSeg(s, u, v))
    // el polígono exacto solo cerca de la costa; lejos basta la máscara
    const signo = (d < alcance ? esMar(u, v) : marAprox(u, v)) ? -1 : 1
    let s = signo * d
    // muelles que OSM deja fuera de la costa (el Moll Adossat): lejos de la línea, el relieve manda
    if (s <= -alcance) s = Math.max(s, (alturaM(u, v) - 1.5) * 20)
    const ms = enMuelle(u, v)
    if (ms) for (const m of ms) s = Math.max(s, m.medio - dSeg(m, u, v))
    if (s < alcance) {
      const as = enArea(u, v)
      if (as) {
        let da = alcance
        for (const m of as) da = Math.min(da, dSeg(m, u, v))
        const dentroMuelle = areas.some((a) => a.r.filter((r) => dentro(u, v, r)).length % 2 === 1)
        s = Math.max(s, dentroMuelle ? da : -da)
      }
    }
    return s
  }
}
