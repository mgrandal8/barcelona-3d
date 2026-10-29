import { use, useMemo } from 'react'
import * as THREE from 'three'
import { cargarDatos } from '../datos'
import { M, Y, azar, mat, OrigenCtx, teñirCaras, useLocal, useSuelo } from './comun'

// Origen en la playa de la Barceloneta. El Hotel W (la "vela") y la torre de Sant Sebastià
// van en sus coordenadas, al final del paseo de Joan de Borbó.

const W: [number, number] = [41.36849, 2.19006]
const TORRE_SANT_SEBASTIA: [number, number] = [41.3722, 2.188]
const ESTEL_FERIT: [number, number] = [41.3774, 2.1925]
const SOMBRILLAS = ['#e2553a', '#f0c33c', '#3f7fc4', '#f4f0e6', '#5fa35a', '#e9884a']

function geoVela() {
  // planta en forma de lente: cara convexa al mar y espalda casi recta
  const L = 0.42
  const f = new THREE.Shape()
  const n = 24
  for (let i = 0; i <= n; i++) {
    const t = i / n
    f[i ? 'lineTo' : 'moveTo'](-L + 2 * L * t, -0.16 * Math.sin(Math.PI * t))
  }
  for (let i = n - 1; i > 0; i--) {
    const t = i / n
    f.lineTo(-L + 2 * L * t, 0.03 * Math.sin(Math.PI * t))
  }
  const H = Y(99)
  const g = new THREE.ExtrudeGeometry(f, { depth: H, bevelEnabled: false, steps: 12 })
  g.rotateX(-Math.PI / 2) // la forma pasa a ser la planta: y de la forma → −z
  // como una vela hinchada: la cara al mar se recoge hacia arriba y la coronación sube en el centro
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const t = y / H
    const z = p.getZ(i)
    p.setZ(i, z > 0 ? z * (1 - 0.7 * t * t) : z)
    p.setY(i, y * (0.8 + 0.2 * Math.cos((x / L) * Math.PI * 0.5)))
  }
  // franjas de cristal: reflejos claros y oscuros por plantas
  return teñirCaras(g, (i, c) => {
    const banda = Math.floor((c.y / H) * 14)
    return azar(i * 5 + banda) < 0.15 ? '#dceef7' : banda % 2 ? '#7fb0d0' : '#97c2dc'
  })
}

/** Busca el punto de arena (terreno casi a nivel del mar) más cercano. */
function enArena(d: { alturaM: (x: number, z: number) => number }, x: number, z: number): [number, number] {
  let mejor: [number, number] = [x, z]
  let dmin = Infinity
  for (let dx = -0.4; dx <= 0.4; dx += 0.02) {
    for (let dz = -0.4; dz <= 0.4; dz += 0.02) {
      const h = d.alturaM(x + dx, z + dz)
      const dist = dx * dx + dz * dz
      if (h > 0.8 && h < 2 && dist < dmin) {
        dmin = dist
        mejor = [x + dx, z + dz]
      }
    }
  }
  return mejor
}

export function Barceloneta() {
  const d = use(cargarDatos())
  const o = use(OrigenCtx)
  const suelo = useSuelo()
  const local = useLocal()
  const [wx, wz] = local(...W)
  const [tx, tz] = local(...TORRE_SANT_SEBASTIA)
  const [ex0, ez0] = local(...ESTEL_FERIT)
  const [ex, ez] = useMemo(() => {
    const [x, z] = enArena(d, o.x + ex0, o.z + ez0)
    return [x - o.x, z - o.z]
  }, [d, o, ex0, ez0])
  const vela = useMemo(() => geoVela(), [])
  // sombrillas solo donde hay arena (terreno casi a nivel del mar)
  const sombrillas = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = []
    let i = 0
    for (let x = -0.9; x <= 0.9; x += 0.06) {
      for (let z = -0.9; z <= 0.9; z += 0.06) {
        i++
        const px = x + (azar(i) - 0.5) * 0.04
        const pz = z + (azar(i * 7) - 0.5) * 0.04
        const h = d.alturaM(o.x + px, o.z + pz)
        if (h < 0.6 || h > 2.2 || azar(i * 3) < 0.45) continue
        out.push({ x: px, z: pz, c: SOMBRILLAS[Math.floor(azar(i * 11) * SOMBRILLAS.length)] })
      }
    }
    return out
  }, [d, o])

  return (
    <group>
      {/* Hotel W */}
      <group position={[wx, suelo(wx, wz), wz]} rotation-y={-0.63}>
        <mesh geometry={vela} material={mat('#fff', { vertexColors: true, roughness: 0.2, metalness: 0.25 })} castShadow receiveShadow />
        <mesh position={[0, 0.05, 0.13]} material={mat('#e4e0d6')} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.1, 0.2]} />
        </mesh>
      </group>
      {/* torre de Sant Sebastià del teleférico del puerto */}
      <group position={[tx, suelo(tx, tz), tz]}>
        <mesh position={[0, Y(78) / 2, 0]} material={mat('#c8553a')} castShadow>
          <boxGeometry args={[0.05, Y(78), 0.05]} />
        </mesh>
        <mesh position={[0, Y(78) + 0.03, 0]} material={mat('#5a5f66')} castShadow>
          <boxGeometry args={[0.12, 0.06, 0.12]} />
        </mesh>
      </group>
      {/* L'Estel Ferit: cubos apilados y torcidos */}
      <group position={[ex, suelo(ex, ez), ez]} scale={1.6}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[(k % 2) * 0.008 - 0.004, M(2.6) * (k + 0.5), (k % 3) * 0.006]} rotation-y={k * 0.25} rotation-z={(k - 1.5) * 0.06} material={mat('#9a5a3a', { roughness: 0.6, metalness: 0.4 })} castShadow>
            <boxGeometry args={[M(2.4), M(2.4), M(2.4)]} />
          </mesh>
        ))}
      </group>
      {sombrillas.map((s, i) => (
        <group key={i} position={[s.x, suelo(s.x, s.z), s.z]}>
          <mesh position={[0, 0.02, 0]} material={mat('#efe6d2')}>
            <cylinderGeometry args={[0.002, 0.002, 0.04, 3]} />
          </mesh>
          <mesh position={[0, 0.045, 0]} material={mat(s.c)} castShadow>
            <coneGeometry args={[0.022, 0.012, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
