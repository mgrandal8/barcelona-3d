import { ESCALA } from './geo'

export type Meta = { rect: { uMin: number; uMax: number; vMin: number; vMax: number }; paso: number; nu: number; nv: number }

/** Altura del terreno en metros reales (bilineal) en coordenadas de escena. Sin DOM: la usa también el worker. */
export function crearAlturaM({ rect, paso, nu, nv }: Meta, alturas: Int16Array) {
  return (x: number, z: number) => {
    const fi = Math.min(nu - 1.001, Math.max(0, (x * ESCALA - rect.uMin) / paso))
    const fj = Math.min(nv - 1.001, Math.max(0, (z * ESCALA - rect.vMin) / paso))
    const i = Math.floor(fi)
    const j = Math.floor(fj)
    const tx = fi - i
    const tz = fj - j
    const a = alturas[j * nu + i]
    const b = alturas[j * nu + i + 1]
    const c = alturas[(j + 1) * nu + i]
    const d = alturas[(j + 1) * nu + i + 1]
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) / 10
  }
}

/**
 * Altura máxima de los tejados por celdas (unidades de escena), para saber si un edificio tapa un punto
 * sin hacer raycasting sobre millones de triángulos. La rellena el worker de edificios.
 */
export type Rejilla = { x0: number; z0: number; paso: number; nx: number; nz: number; y: Float32Array; max: number }

export function crearRejilla({ rect }: Meta, paso = 0.2): Rejilla {
  const x0 = rect.uMin / ESCALA
  const z0 = rect.vMin / ESCALA
  const nx = Math.ceil((rect.uMax - rect.uMin) / ESCALA / paso)
  const nz = Math.ceil((rect.vMax - rect.vMin) / ESCALA / paso)
  return { x0, z0, paso, nx, nz, y: new Float32Array(nx * nz), max: 0 }
}

/** Sube a `y` las celdas de la caja (x0, z0)–(x1, z1). */
export function elevarRejilla(r: Rejilla, x0: number, z0: number, x1: number, z1: number, y: number) {
  const i0 = Math.max(0, Math.floor((x0 - r.x0) / r.paso))
  const i1 = Math.min(r.nx - 1, Math.floor((x1 - r.x0) / r.paso))
  const j0 = Math.max(0, Math.floor((z0 - r.z0) / r.paso))
  const j1 = Math.min(r.nz - 1, Math.floor((z1 - r.z0) / r.paso))
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const k = j * r.nx + i
      if (y > r.y[k]) r.y[k] = y
    }
  if (y > r.max) r.max = y
}

/** ¿Hay algún tejado entre el punto `a` y la cámara `c`? Avanza por la rejilla desde el punto. */
export function tapado(r: Rejilla, ax: number, ay: number, az: number, cx: number, cy: number, cz: number) {
  const dx = cx - ax
  const dy = cy - ay
  const dz = cz - az
  const largo = Math.hypot(dx, dz)
  const paso = r.paso * 0.7
  // el primer tramo es el propio lugar: alrededor de cada monumento ya no hay edificios de OSM
  for (let t = paso * 2; t < largo; t += paso) {
    const f = t / largo
    const y = ay + dy * f
    if (y > r.max) return false
    const i = Math.floor((ax + dx * f - r.x0) / r.paso)
    const j = Math.floor((az + dz * f - r.z0) / r.paso)
    if (i < 0 || j < 0 || i >= r.nx || j >= r.nz) return false
    if (r.y[j * r.nx + i] > y) return true
  }
  return false
}
