import { Color, ShapeUtils, Vector2 } from 'three'
import { aleatorio } from './geo'
import { ESCALA, metrosAY } from './geo'
import { elevarRejilla, type Rejilla } from './relieve'

// Lectura y extrusión de los edificios de OSM. Sin DOM ni WebGL: se ejecuta en edificios.worker.ts.

/** `zona`: distrito de Barcelona o municipio (ver ZONAS en scripts/datos/nombres.mjs), para la paleta. */
export type Edificio = { pts: Float32Array; alto: number; base: number; tipo: number; zona: number }

/** Formato v2 (ver scripts/datos/formato.mjs): columnas y coordenadas en deltas. */
export function leerEdificios(buf: ArrayBuffer): Edificio[] {
  const dv = new DataView(buf)
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'BCN2') throw new Error('edificios: formato desconocido')
  const n = dv.getUint32(4, true)
  const total = dv.getUint32(8, true)
  const nPts = new Uint16Array(buf, 12, n)
  const altos = new Uint16Array(buf, 12 + n * 2, n)
  const bases = new Uint16Array(buf, 12 + n * 4, n)
  const coords = new Int16Array(buf, 12 + n * 6, total * 2)
  const tipos = new Uint8Array(buf, 12 + n * 6 + total * 4, n)
  const out: Edificio[] = new Array(n)
  const k = 1 / 2 / ESCALA
  let c = 0
  let pu = 0
  let pv = 0
  for (let i = 0; i < n; i++) {
    const np = nPts[i]
    const pts = new Float32Array(np * 2)
    let u = pu
    let v = pv
    for (let j = 0; j < np; j++, c += 2) {
      u += coords[c]
      v += coords[c + 1]
      if (j === 0) [pu, pv] = [u, v]
      pts[j * 2] = u * k
      pts[j * 2 + 1] = v * k
    }
    // el tipo lleva la zona en los 4 bits altos
    out[i] = { pts, alto: altos[i] / 10, base: bases[i] / 10, tipo: tipos[i] & 15, zona: tipos[i] >> 4 }
  }
  return out
}

const FACHADAS = ['#f6ead6', '#f1dcb8', '#f7e2cc', '#eccba2', '#f3ece2', '#e9bf98', '#f5d6bd', '#e4ddd0', '#f0e0c0', '#e8d2c4']
const CASAS = ['#f2e6d2', '#efd9b8', '#f5e8d8', '#e9cfae']
const COLOR_TIPO: Record<number, string[]> = {
  1: ['#cdb791', '#c6ad86'],
  2: ['#cfcdc6', '#c3c1bb', '#d6d0c4'],
  3: ['#b9b3a8'],
  4: ['#e8d7ba', '#ddd0bd'],
}
/**
 * Fachadas por zona (índices de ZONAS en scripts/datos/nombres.mjs) y proporción de tejados de teja.
 * La zona 0 (fuera de Barcelona y l'Hospitalet) usa FACHADAS.
 */
const OCRES = ['#e8c48f', '#dcae78', '#e6b98a', '#d9a06e', '#efd3a6', '#c98f62', '#e3c7a0', '#f0dcb8']
const PIEDRA = ['#efe1c6', '#e8d5b0', '#f2e6cf', '#dccaa8', '#e9d9bd', '#d8c3a0', '#f4ead6']
const PASTEL = ['#f2c9a6', '#ecd59b', '#f0b9a0', '#e9d2b8', '#f3dcb2', '#e6bfa0', '#f1e2c8']
const LADRILLO_NUEVO = ['#c98a6a', '#d9a184', '#e3ddd3', '#cfcac0', '#b97a5c', '#e9e4da', '#d7cfc2']
const BLANCOS = ['#f4f0e8', '#ece6da', '#f6efe2', '#e6dfd2', '#f2ead8', '#e9e2d4']
const BARRIO = ['#e8c9a8', '#d8a888', '#efdcc0', '#cf9f80', '#e6d4ba', '#dcb898', '#f0e2cc']
const ZONA: { fachadas: string[]; tejas: number }[] = [
  { fachadas: FACHADAS, tejas: 0.55 },
  { fachadas: OCRES, tejas: 0.5 }, // Ciutat Vella
  { fachadas: PIEDRA, tejas: 0.3 }, // l'Eixample
  { fachadas: BARRIO, tejas: 0.55 }, // Sants-Montjuïc
  { fachadas: BLANCOS, tejas: 0.6 }, // les Corts
  { fachadas: BLANCOS, tejas: 0.7 }, // Sarrià - Sant Gervasi
  { fachadas: PASTEL, tejas: 0.6 }, // Gràcia
  { fachadas: BARRIO, tejas: 0.65 }, // Horta-Guinardó
  { fachadas: BARRIO, tejas: 0.55 }, // Nou Barris
  { fachadas: BARRIO, tejas: 0.6 }, // Sant Andreu
  { fachadas: LADRILLO_NUEVO, tejas: 0.4 }, // Sant Martí
  { fachadas: BARRIO, tejas: 0.5 }, // l'Hospitalet
]
const AZOTEAS = ['#e6e1d8', '#dcd6cb', '#ece7de', '#d6cfc2', '#e9dccb']
const TEJAS = ['#c4643f', '#b85a3b', '#cc744c']


/**
 * Geometría lista para un BufferGeometry: posiciones, colores (Uint8 normalizado) e índices.
 * Los índices de los tejados van primero (`techos` índices) y después los de las paredes.
 */
export type Malla = { pos: Float32Array; col: Uint8Array; idx: Uint32Array; techos: number }
/**
 * Un trozo de ciudad de ~1,5 km. Los edificios bajos y pequeños van aparte (`detalle`):
 * de lejos se dibujan solo sus tejados, sin sombra (LOD).
 */
export type Trozo = { grandes: Malla | null; detalle: Malla | null; centro: [number, number, number]; radio: number }

/** Bajo y pequeño: menos de 13 m de alto y 500 m² de planta. */
const esDetalle = (alto: number, area: number) => alto < 13 && area < 0.05

/** Extruye todos los edificios, agrupados en trozos de `tamTrozo` unidades para descartar los que no se ven. */
export function crearEdificios(
  edificios: Edificio[],
  alturaY: (x: number, z: number) => number,
  huecos: { x: number; z: number; r: number }[],
  tamTrozo = 15,
  progreso?: (f: number) => void,
  /** Si se da, se rellena con la altura de los tejados (para la oclusión de los pines). */
  rejilla?: Rejilla,
): Trozo[] {
  const grupos = new Map<string, number[][]>()
  const areas = new Float32Array(edificios.length)
  const contorno: Vector2[] = []
  edificios.forEach((e, i) => {
    // fuera los edificios cuyo centro cae donde va un monumento modelado a mano
    const n = e.pts.length / 2
    let cx = 0
    let cz = 0
    contorno.length = 0
    for (let k = 0; k < n; k++) {
      cx += e.pts[k * 2]
      cz += e.pts[k * 2 + 1]
      contorno.push(new Vector2(e.pts[k * 2], e.pts[k * 2 + 1]))
    }
    cx /= n
    cz /= n
    if (huecos.some((h) => (cx - h.x) ** 2 + (cz - h.z) ** 2 < h.r * h.r)) return
    areas[i] = Math.abs(ShapeUtils.area(contorno))
    const k = `${Math.floor(e.pts[0] / tamTrozo)},${Math.floor(e.pts[1] / tamTrozo)}`
    if (!grupos.has(k)) grupos.set(k, [[], []])
    grupos.get(k)![esDetalle(e.alto, areas[i]) ? 1 : 0].push(i)
  })
  const c = new Color()
  const cTecho = new Color()

  function malla(ids: number[]): Malla | null {
    if (!ids.length) return null
    let nv = 0
    let ni = 0
    for (const i of ids) {
      const n = edificios[i].pts.length / 2
      nv += n * 3
      ni += n * 6 + (n - 2) * 3
    }
    const pos = new Float32Array(nv * 3)
    const col = new Uint8Array(nv * 3)
    const idx = new Uint32Array(ni)
    // dos pasadas: primero los tejados y luego las paredes, para poder dibujar solo los tejados
    let techos = 0
    for (const i of ids) techos += (edificios[i].pts.length / 2 - 2) * 3
    let v = 0
    let o = techos
    let ot = 0
    for (const i of ids) {
      const e = edificios[i]
      const n = e.pts.length / 2
      let suelo = Infinity
      for (let k = 0; k < n; k++) suelo = Math.min(suelo, alturaY(e.pts[k * 2], e.pts[k * 2 + 1]))
      const r = aleatorio(i)
      // sin base, la pared baja algo más: junto a la costa el suelo cae en rampa hasta el agua
      const y0 = suelo + metrosAY(e.base) - (e.base > 0 ? 0 : 0.06)
      const y1 = suelo + metrosAY(e.alto)
      if (rejilla) {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
        for (let k = 0; k < n; k++) {
          x0 = Math.min(x0, e.pts[k * 2])
          x1 = Math.max(x1, e.pts[k * 2])
          z0 = Math.min(z0, e.pts[k * 2 + 1])
          z1 = Math.max(z1, e.pts[k * 2 + 1])
        }
        elevarRejilla(rejilla, x0, z0, x1, z1, y1)
      }
      const zona = ZONA[e.zona] ?? ZONA[0]
      const paleta = e.alto > 70 ? ['#b4c2cb', '#c9cfd1'] : (COLOR_TIPO[e.tipo] ?? (e.tipo === 5 ? CASAS : zona.fachadas))
      c.set(paleta[Math.floor(r * 97) % paleta.length])
      const conTeja = e.tipo === 5 || (e.tipo === 0 && areas[i] < 0.03 && e.alto < 14 && r < zona.tejas)
      cTecho.set(conTeja ? TEJAS[Math.floor(r * 31) % TEJAS.length] : e.tipo === 1 ? '#bda57e' : AZOTEAS[Math.floor(r * 53) % AZOTEAS.length])
      // anillos: base (n), alto de pared (n), techo (n)
      for (let k = 0; k < n; k++) {
        const x = e.pts[k * 2]
        const z = e.pts[k * 2 + 1]
        pos.set([x, y0, z], (v + k) * 3)
        pos.set([x, y1, z], (v + n + k) * 3)
        pos.set([x, y1, z], (v + 2 * n + k) * 3)
        // un poco más oscuro abajo: oclusión barata
        col.set([c.r * 205, c.g * 205, c.b * 205], (v + k) * 3)
        col.set([c.r * 255, c.g * 255, c.b * 255], (v + n + k) * 3)
        col.set([cTecho.r * 255, cTecho.g * 255, cTecho.b * 255], (v + 2 * n + k) * 3)
      }
      for (let k = 0; k < n; k++) {
        const a = v + k
        const b = v + ((k + 1) % n)
        // los contornos vienen en sentido antihorario (u, v): este orden deja la normal hacia fuera
        idx.set([a, b + n, b, a, a + n, b + n], o)
        o += 6
      }
      contorno.length = 0
      for (let k = 0; k < n; k++) contorno.push(new Vector2(e.pts[k * 2], e.pts[k * 2 + 1]))
      for (const [a, b, t] of ShapeUtils.triangulateShape(contorno, [])) {
        const A = contorno[a], B = contorno[b], C = contorno[t]
        // normal hacia arriba: (B-A)×(C-A) con componente y positiva
        const arriba = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y) > 0
        idx.set(arriba ? [v + 2 * n + a, v + 2 * n + b, v + 2 * n + t] : [v + 2 * n + a, v + 2 * n + t, v + 2 * n + b], ot)
        ot += 3
      }
      v += n * 3
    }
    // (si algún contorno degenerado da menos triángulos, quedan índices 0: triángulos vacíos, inofensivos)
    return { pos, col, idx, techos }
  }

  const trozos: Trozo[] = []
  let hechos = 0
  for (const [grandes, detalle] of grupos.values()) {
    const g = malla(grandes)
    const d = malla(detalle)
    // esfera envolvente del trozo (caja de las posiciones), para el LOD
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const m of [g, d]) {
      if (!m) continue
      for (let i = 0; i < m.pos.length; i++) {
        const a = i % 3
        if (m.pos[i] < min[a]) min[a] = m.pos[i]
        if (m.pos[i] > max[a]) max[a] = m.pos[i]
      }
    }
    const centro = [0, 1, 2].map((a) => (min[a] + max[a]) / 2) as [number, number, number]
    trozos.push({ grandes: g, detalle: d, centro, radio: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 })
    progreso?.(++hechos / grupos.size)
  }
  return trozos
}
