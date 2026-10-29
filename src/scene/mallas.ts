import * as THREE from 'three'
import type { DatosCiudad } from './datos'
import { ESCALA, metrosAY } from './geo'
import { crearMascara } from './texturaSuelo'
import { aleatorio } from './edificios'

const FONDO_ZOCALO = -1.6
const FONDO_MAR = -0.16
const PASO_MALLA = 20

let mascaraCache: ReturnType<typeof crearMascara> | null = null
const mascara = (d: DatosCiudad) => (mascaraCache ??= crearMascara(d))

// ------------------------------------------------------------ terreno

/** El relieve no trae batimetría: el mar y las dársenas se hunden a mano. */
export function esAgua(d: DatosCiudad, x: number, z: number) {
  return d.alturaM(x, z) <= 0.3 || mascara(d).en(x * ESCALA, z * ESCALA) === 3
}

export function crearMallaTerreno(d: DatosCiudad) {
  const { rect } = d.meta
  const nu = Math.round((rect.uMax - rect.uMin) / PASO_MALLA) + 1
  const nv = Math.round((rect.vMax - rect.vMin) / PASO_MALLA) + 1
  const pos = new Float32Array(nu * nv * 3)
  const uv = new Float32Array(nu * nv * 2)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * nu + i
      const x = (rect.uMin + i * PASO_MALLA) / ESCALA
      const z = (rect.vMin + j * PASO_MALLA) / ESCALA
      pos[k * 3] = x
      pos[k * 3 + 1] = esAgua(d, x, z) ? FONDO_MAR : metrosAY(d.alturaM(x, z))
      pos[k * 3 + 2] = z
      uv[k * 2] = i / (nu - 1)
      uv[k * 2 + 1] = j / (nv - 1)
    }
  }
  const idx = new Uint32Array((nu - 1) * (nv - 1) * 6)
  let o = 0
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i
      const b = a + 1
      const c = a + nu
      const e = c + 1
      idx.set([a, c, b, b, c, e], o)
      o += 6
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeVertexNormals()
  return g
}

/** Paredes laterales de la maqueta, siguiendo el borde del relieve (`terreno` = crearMallaTerreno). */
export function crearZocalo(d: DatosCiudad, terreno: THREE.BufferGeometry) {
  const { rect } = d.meta
  const nu = Math.round((rect.uMax - rect.uMin) / PASO_MALLA) + 1
  const nv = Math.round((rect.vMax - rect.vMin) / PASO_MALLA) + 1
  const p = terreno.attributes.position
  const borde: number[] = []
  for (let i = 0; i < nu; i++) borde.push(i)
  for (let j = 1; j < nv; j++) borde.push(j * nu + nu - 1)
  for (let i = nu - 2; i >= 0; i--) borde.push((nv - 1) * nu + i)
  for (let j = nv - 2; j >= 0; j--) borde.push(j * nu)
  const pts: number[] = []
  const cols: number[] = []
  const arriba = new THREE.Color('#9a7652')
  const abajo = new THREE.Color('#4e3a2b')
  for (let k = 0; k < borde.length - 1; k++) {
    const a = borde[k]
    const b = borde[k + 1]
    const ax = p.getX(a), ay = p.getY(a), az = p.getZ(a)
    const bx = p.getX(b), by = p.getY(b), bz = p.getZ(b)
    pts.push(ax, ay, az, bx, by, bz, ax, FONDO_ZOCALO, az, bx, by, bz, bx, FONDO_ZOCALO, bz, ax, FONDO_ZOCALO, az)
    for (const c of [arriba, arriba, abajo, arriba, abajo, abajo]) cols.push(c.r, c.g, c.b)
  }
  const z = new THREE.BufferGeometry()
  z.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  z.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  z.computeVertexNormals()
  return z
}

// ------------------------------------------------------------ árboles

export type Arbol = { x: number; y: number; z: number; s: number; c: number }

export function generarArboles(d: DatosCiudad) {
  const m = mascara(d)
  const { uMin, uMax, vMin, vMax } = d.meta.rect
  const out: Arbol[] = []
  let semilla = 1
  const rnd = () => aleatorio(semilla++)
  const paso = 32
  for (let u = uMin; u < uMax; u += paso) {
    for (let v = vMin; v < vMax; v += paso) {
      const pu = u + rnd() * paso
      const pv = v + rnd() * paso
      const tipo = m.en(pu, pv)
      const r = rnd()
      if (tipo === 0 || tipo === 3 || (tipo === 2 && r > 0.75)) continue
      const x = pu / ESCALA
      const z = pv / ESCALA
      if (d.alturaM(x, z) <= 0.5) continue
      out.push({ x, y: d.alturaY(x, z), z, s: tipo === 1 ? 0.11 + rnd() * 0.07 : 0.08 + rnd() * 0.04, c: rnd() })
    }
  }
  return out
}
