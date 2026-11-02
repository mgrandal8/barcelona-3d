import { useFrame } from '@react-three/fiber'
import { createContext, use } from 'react'
import * as THREE from 'three'
import { cargarDatos } from '../datos'
import { geoAEscena, metrosAY } from '../geo'
import { vivo } from '../hora'

/** Origen del monumento en la escena: x, z y la altura del suelo ahí. */
export type Origen = { x: number; z: number; y: number }
export const OrigenCtx = createContext<Origen>({ x: 0, z: 0, y: 0 })

/** Metros reales → altura de escena (con la exageración). */
export const Y = metrosAY
/** Metros reales → distancia horizontal de escena. */
export const M = (m: number) => m / 100

/** Altura del suelo relativa al origen del monumento, en coordenadas locales (sin giro). */
export function useSuelo() {
  const d = use(cargarDatos())
  const o = use(OrigenCtx)
  return (lx: number, lz: number) => d.alturaY(o.x + lx, o.z + lz) - o.y
}

/** lat/lon → posición local [x, z] respecto al origen del monumento. */
export function useLocal() {
  const o = use(OrigenCtx)
  return (lat: number, lon: number): [number, number] => {
    const [x, z] = geoAEscena(lat, lon)
    return [x - o.x, z - o.z]
  }
}

const cache = new Map<string, THREE.MeshStandardMaterial>()

/** Material compartido de la maqueta: plano y mate salvo que se pida otra cosa. */
export function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const k = color + JSON.stringify(extra)
  let m = cache.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra })
    cache.set(k, m)
  }
  return m
}

export const matVertices = mat('#ffffff', { vertexColors: true })

/** Número pseudoaleatorio estable a partir de un entero. */
export function azar(i: number) {
  let t = (i * 2654435761 + 1013904223) >>> 0
  t ^= t >>> 15
  t = Math.imul(t, 0x2c1b3c6d)
  t ^= t >>> 12
  return ((t >>> 0) % 10000) / 10000
}

/** Pinta cada triángulo de una geometría con un color (trencadís, mosaicos). */
export function teñirCaras(g: THREE.BufferGeometry, color: (i: number, centro: THREE.Vector3) => string | THREE.Color) {
  const ng = g.index ? g.toNonIndexed() : g
  const p = ng.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const centro = new THREE.Vector3()
  for (let t = 0; t < p.count / 3; t++) {
    centro.set(0, 0, 0)
    for (let k = 0; k < 3; k++) centro.add(new THREE.Vector3().fromBufferAttribute(p, t * 3 + k))
    centro.divideScalar(3)
    c.set(color(t, centro))
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (t * 3 + k) * 3)
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3))
  ng.computeVertexNormals()
  return ng
}

/** Torno a partir de un perfil [radio, altura]. */
export function torno(perfil: [number, number][], lados = 12) {
  return new THREE.LatheGeometry(
    perfil.map(([r, y]) => new THREE.Vector2(r, y)),
    lados,
  )
}

const focos: { m: THREE.MeshStandardMaterial; k: number }[] = []
const cacheFocos = new Map<string, THREE.MeshStandardMaterial>()

/**
 * Material de un monumento que de noche iluminan los focos: brilla con un tono cálido según vivo.noche.
 * `k` es cuánto se enciende. Lo actualiza useFocos() (en Monumentos), una vez por fotograma para todos.
 */
export function matFoco(color: string, k = 0.3) {
  const clave = color + k
  let m = cacheFocos.get(clave)
  if (!m) {
    // el brillo parte del color de la pieza (con algo de luz cálida), para que el ladrillo siga siendo rojo
    const emissive = new THREE.Color(color).lerp(new THREE.Color('#ffc98a'), 0.35)
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, emissive, emissiveIntensity: 0 })
    cacheFocos.set(clave, m)
    focos.push({ m, k })
  }
  return m
}

export function useFocos() {
  useFrame(() => {
    for (const f of focos) f.m.emissiveIntensity = vivo.noche * f.k * 1.6
  })
}
