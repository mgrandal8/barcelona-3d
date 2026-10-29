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
