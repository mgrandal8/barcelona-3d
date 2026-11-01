import { useMemo } from 'react'
import * as THREE from 'three'
import { Y, azar, mat, matVertices, teñirCaras } from './comun'

// Origen en el centro de la parcela (planta de las partes de OSM). Passeig de Gràcia queda en −x
// y Carrer de Provença en +z; la esquina de las dos calles, redondeada, en (−x, +z).
// Los vecinos están en +x y en −z.

const X0 = -0.24
const X1 = 0.24
const Z0 = -0.155
const Z1 = 0.15
const R = 0.12 // radio de la esquina
const ALTO = Y(24) // cornisa
const PLANTA = ALTO / 7
const PIEDRA = '#e9dfca'
const PIEDRA_SOMBRA = '#d4c6aa'
const HIERRO = '#3b3d33'
const PATIOS: [number, number, number, number][] = [
  // x, z, radio x, radio z
  [-0.1, 0.02, 0.055, 0.065],
  [0.11, -0.01, 0.07, 0.055],
]

/** Recorrido de la fachada a la calle: de la medianera de Passeig de Gràcia a la de Provença. */
function fachada(n: number) {
  const tramos = [Z1 - R - Z0, (Math.PI / 2) * R, X1 - (X0 + R)]
  const total = tramos[0] + tramos[1] + tramos[2]
  const out: { x: number; z: number; nx: number; nz: number; s: number }[] = []
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * total
    if (s <= tramos[0]) out.push({ x: X0, z: Z0 + s, nx: -1, nz: 0, s })
    else if (s <= tramos[0] + tramos[1]) {
      const a = Math.PI - (s - tramos[0]) / R // de −x a +z
      const nx = Math.cos(a)
      const nz = Math.sin(a)
      out.push({ x: X0 + R + nx * R, z: Z1 - R + nz * R, nx, nz, s })
    } else out.push({ x: X0 + R + (s - tramos[0] - tramos[1]), z: Z1, nx: 0, nz: 1, s })
  }
  return out
}

/** Cuánto sale la piedra en cada punto: ondas a lo largo de la calle y cada planta abombada. */
function saliente(s: number, y: number) {
  const planta = (y / PLANTA) % 1
  return 0.007 + 0.006 * Math.sin((s / 0.11) * Math.PI * 2 + y * 9) + 0.005 * Math.sin(planta * Math.PI)
}

/** La coronación sube y baja como una ola. */
const coronacion = (s: number) => ALTO + 0.035 + 0.025 * Math.sin((s / 0.16) * Math.PI * 2 + 0.6)

function geoFachada() {
  const pts = fachada(160)
  const filas = 7 * 6
  const pos: number[] = []
  const col: number[] = []
  const c = new THREE.Color()
  const piedra = new THREE.Color(PIEDRA)
  const sombra = new THREE.Color(PIEDRA_SOMBRA)
  const ventana = new THREE.Color('#6a5f52')
  const vert = (i: number, f: number) => {
    const p = pts[i]
    const top = coronacion(p.s)
    const y = f === filas ? top : Math.min((f / filas) * ALTO, top)
    const w = saliente(p.s, y)
    return [p.x + p.nx * w, y, p.z + p.nz * w]
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const s = (pts[i].s + pts[i + 1].s) / 2
    // huecos: columnas cada ~4,5 m, desplazadas un poco en cada planta (las ventanas de La Pedrera no se alinean)
    for (let f = 0; f < filas; f++) {
      const planta = Math.floor(f / 6)
      const fila = f % 6
      const col0 = ((s + planta * 0.011) / 0.045) % 1
      const esHueco = planta > 0 && fila >= 2 && fila <= 4 && col0 > 0.3 + azar(planta * 13 + Math.floor((s + planta * 0.011) / 0.045)) * 0.08 && col0 < 0.7 && f < filas - 1
      const esBajo = planta === 0 && fila >= 1 && col0 > 0.15 && col0 < 0.85
      if (esHueco || esBajo) c.copy(ventana)
      else c.copy(piedra).lerp(sombra, fila === 0 ? 0.6 : azar(i * 97 + f) * 0.25)
      const a = vert(i, f)
      const b = vert(i + 1, f)
      const cc = vert(i + 1, f + 1)
      const d = vert(i, f + 1)
      for (const p of [a, b, cc, a, cc, d]) {
        pos.push(...p)
        col.push(c.r, c.g, c.b)
      }
    }
    // tapa de la coronación: del borde de la piedra hacia dentro
    const a = vert(i, filas)
    const b = vert(i + 1, filas)
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const ai = [p0.x - p0.nx * 0.03, a[1], p0.z - p0.nz * 0.03]
    const bi = [p1.x - p1.nx * 0.03, b[1], p1.z - p1.nz * 0.03]
    c.copy(piedra)
    for (const p of [a, bi, b, a, ai, bi]) {
      pos.push(...p)
      col.push(c.r, c.g, c.b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** Balcones de hierro forjado: una mancha oscura y retorcida delante de algunos huecos. */
function balcones() {
  const pts = fachada(160)
  const out: { x: number; y: number; z: number; giro: number }[] = []
  for (let planta = 1; planta < 6; planta++) {
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]
      const col0 = ((p.s + planta * 0.011) / 0.045) % 1
      if (Math.abs(col0 - 0.5) > 0.012 || azar(k * 31 + planta) < 0.35) continue
      const y = planta * PLANTA + PLANTA * 0.15
      const w = saliente(p.s, y) + 0.008
      out.push({ x: p.x + p.nx * w, y, z: p.z + p.nz * w, giro: Math.atan2(p.nx, p.nz) })
    }
  }
  return out
}

function geoCuerpo() {
  const f = new THREE.Shape()
  const pts = fachada(48)
  // la forma está en (x, −z): al girarla −90° en x, su "y" pasa a ser −z
  pts.forEach((p, i) => (i ? f.lineTo(p.x, -p.z) : f.moveTo(p.x, -p.z)))
  f.lineTo(X1, -Z0)
  f.lineTo(X0, -Z0)
  for (const [x, z, rx, rz] of PATIOS) {
    const h = new THREE.Path()
    h.absellipse(x, -z, rx, rz, 0, Math.PI * 2, true, 0)
    f.holes.push(h)
  }
  return new THREE.ExtrudeGeometry(f, { depth: ALTO, bevelEnabled: false, curveSegments: 20 }).rotateX(-Math.PI / 2)
}

/** Áticos de la azotea: una cinta de bóvedas que sigue la fachada, retranqueada. */
function geoAtico() {
  const f = new THREE.Shape()
  const ext = fachada(48).map((p) => [p.x - p.nx * 0.045, p.z - p.nz * 0.045])
  const int = fachada(48).map((p) => [p.x - p.nx * 0.1, p.z - p.nz * 0.1])
  ext.forEach(([x, z], i) => (i ? f.lineTo(x, -z) : f.moveTo(x, -z)))
  for (let i = int.length - 1; i >= 0; i--) f.lineTo(int[i][0], -int[i][1])
  const g = new THREE.ExtrudeGeometry(f, { depth: Y(3.5), bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.02, bevelSegments: 2 })
  return g.rotateX(-Math.PI / 2).translate(0, ALTO, 0)
}

/** Guerrero de la azotea: tronco retorcido y "casco" de cuatro brazos. */
function Guerrero({ x, z, h, trencadis, semilla }: { x: number; z: number; h: number; trencadis: boolean; semilla: number }) {
  const cuerpo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.008, 0.016, h, 6, 4).rotateY(semilla)
    // retorcido
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const a = (p.getY(i) / h) * 1.4
      const x0 = p.getX(i)
      const z0 = p.getZ(i)
      p.setXYZ(i, x0 * Math.cos(a) - z0 * Math.sin(a), p.getY(i), x0 * Math.sin(a) + z0 * Math.cos(a))
    }
    if (!trencadis) return g.toNonIndexed()
    return teñirCaras(g, (i) => ['#e9e4d6', '#7aa86a', '#4f7f4a', '#c7c2b2'][Math.floor(azar(i + semilla * 13) * 4)])
  }, [h, trencadis, semilla])
  return (
    <group position={[x, ALTO, z]}>
      <mesh geometry={cuerpo} position-y={h / 2} material={trencadis ? matVertices : mat('#ece5d3')} castShadow />
      <mesh position-y={h + 0.008} rotation-y={semilla} material={mat('#ece5d3')} castShadow>
        <octahedronGeometry args={[0.014, 0]} />
      </mesh>
    </group>
  )
}

export function CasaMila() {
  const piel = useMemo(() => geoFachada(), [])
  const cuerpo = useMemo(() => geoCuerpo(), [])
  const atico = useMemo(() => geoAtico(), [])
  const hierros = useMemo(() => balcones(), [])
  const guerreros = useMemo(() => {
    const out: { x: number; z: number; h: number; t: boolean; s: number }[] = []
    // seis grupos sobre la azotea, alrededor de los patios
    const grupos: [number, number][] = [[-0.17, -0.09], [-0.02, -0.1], [0.0, 0.09], [0.12, 0.09], [0.2, -0.1], [-0.17, 0.08]]
    grupos.forEach(([gx, gz], g) => {
      const n = 3 + Math.floor(azar(g * 7) * 3)
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + g
        out.push({ x: gx + Math.cos(a) * 0.022, z: gz + Math.sin(a) * 0.022, h: 0.045 + azar(g * 11 + k) * 0.035, t: azar(g * 5 + k) < 0.3, s: g * 3 + k })
      }
    })
    return out
  }, [])

  return (
    <group>
      <mesh geometry={cuerpo} material={mat(PIEDRA_SOMBRA)} castShadow receiveShadow />
      <mesh geometry={piel} material={matVertices} castShadow receiveShadow />
      <mesh geometry={atico} material={mat('#efe7d5')} castShadow receiveShadow />
      {hierros.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} rotation-y={b.giro} material={mat(HIERRO, { roughness: 0.6, metalness: 0.3 })}>
          <torusKnotGeometry args={[0.006, 0.0018, 16, 3, 2, 3]} />
        </mesh>
      ))}
      {guerreros.map((g, i) => (
        <Guerrero key={i} x={g.x} z={g.z} h={g.h} trencadis={g.t} semilla={g.s} />
      ))}
    </group>
  )
}
