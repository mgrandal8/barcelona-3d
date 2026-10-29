import { useMemo } from 'react'
import * as THREE from 'three'
import { Y, azar, mat, matVertices, teñirCaras, useLocal, useSuelo } from './comun'

// Origen en la Plaça de la Natura. El eje del parque baja hacia la entrada de Carrer d'Olot:
// en local, +z apunta a la entrada. Los elementos pequeños van a escala ×1,6 para que se lean.

const TRENCADIS = ['#f4f0e6', '#3f7fc4', '#f0c33c', '#5fa35a', '#d24a3c', '#e9884a', '#7fc4d8']
const ENTRADA: [number, number] = [41.4131, 2.153]

function trencadis(g: THREE.BufferGeometry, semilla: number) {
  return teñirCaras(g, (i) => TRENCADIS[Math.floor(azar(i * 13 + semilla) * TRENCADIS.length)])
}

/** Caseta de la entrada: cuerpo de piedra y tejado de "pastel" con trencadís. */
function Caseta({ x, z, torre }: { x: number; z: number; torre?: boolean }) {
  const tejado = useMemo(
    () => trencadis(new THREE.SphereGeometry(0.06, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1), Math.round(x * 100)),
    [x],
  )
  const torreGeo = useMemo(() => trencadis(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 8, 6), 7), [])
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.05, 0]} material={mat('#c9a477')} castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
      </mesh>
      <mesh geometry={tejado} position={[0, 0.1, 0]} material={matVertices} castShadow />
      <mesh position={[0, 0.19, 0]} material={mat('#f4f0e6')} castShadow>
        <coneGeometry args={[0.02, 0.06, 6]} />
      </mesh>
      {torre && (
        <group position={[0.055, 0, 0.04]}>
          <mesh geometry={torreGeo} position={[0, 0.2, 0]} material={matVertices} castShadow />
          <mesh position={[0, 0.32, 0]} material={mat('#f4f0e6')}>
            <boxGeometry args={[0.032, 0.008, 0.008]} />
          </mesh>
          <mesh position={[0, 0.32, 0]} material={mat('#f4f0e6')}>
            <boxGeometry args={[0.008, 0.008, 0.032]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/** Superelipse de la plaza (planta de OSM: ~86 × 44 m, con el frente hacia +z). */
const PLAZA = { x: 0.02, z: -0.14, a: 0.21, b: 0.43, n: 3 }
function bordePlaza(ang: number, k = 1): [number, number] {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const e = 2 / PLAZA.n
  return [PLAZA.x + PLAZA.a * k * Math.sign(c) * Math.abs(c) ** e, PLAZA.z + PLAZA.b * k * Math.sign(s) * Math.abs(s) ** e]
}

export function ParkGuell() {
  const suelo = useSuelo()
  const local = useLocal()
  const [ex, ez] = local(...ENTRADA)
  const frente: [number, number] = [PLAZA.x, PLAZA.z + PLAZA.b]
  const yFrente = suelo(...frente)
  // la plaza está a nivel con la parte de atrás y en voladizo sobre la sala hipóstila
  const yPlaza = Math.max(suelo(PLAZA.x, PLAZA.z), suelo(PLAZA.x, PLAZA.z - 0.3), yFrente + Y(11))
  const dx = ex - frente[0]
  const dz = ez - frente[1]
  const largo = Math.min(Math.hypot(dx, dz), 0.42)
  const rumbo = Math.atan2(dx, dz)
  const yEntrada = suelo(frente[0] + Math.sin(rumbo) * largo, frente[1] + Math.cos(rumbo) * largo)
  const caida = yFrente - yEntrada

  const losa = useMemo(() => {
    const f = new THREE.Shape()
    for (let i = 0; i <= 64; i++) {
      const [x, z] = bordePlaza((i / 64) * Math.PI * 2)
      if (i === 0) f.moveTo(x, z)
      else f.lineTo(x, z)
    }
    // al tumbar la forma, la extrusión queda hacia abajo desde la superficie
    return new THREE.ExtrudeGeometry(f, { depth: 0.035, bevelEnabled: false }).rotateX(Math.PI / 2)
  }, [])
  const banco = useMemo(() => {
    // banco ondulante por el frente y los costados
    const pts: THREE.Vector3[] = []
    const n = 90
    for (let i = 0; i <= n; i++) {
      const ang = -Math.PI * 0.12 + (i / n) * Math.PI * 1.24
      const k = 0.97 + Math.sin(i * 0.95) * 0.035
      const [x, z] = bordePlaza(ang, k)
      pts.push(new THREE.Vector3(x, 0.018, z))
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 260, 0.015, 5)
    g.scale(1, 1.4, 1)
    return trencadis(g, 3)
  }, [])
  const pretil = useMemo(() => trencadis(new THREE.BoxGeometry(0.012, 0.04, largo - 0.1, 1, 2, 12), 5), [largo])
  const dragon = useMemo(() => trencadis(new THREE.CapsuleGeometry(0.02, 0.08, 3, 6).rotateX(Math.PI / 2), 11), [])
  const columnas = useMemo(() => {
    const out: [number, number][] = []
    for (let x = -0.13; x <= 0.17; x += 0.05) for (const z of [0.1, 0.16, 0.22]) out.push([x, z])
    return out
  }, [])

  return (
    <group>
      {/* núcleo macizo bajo la parte de atrás de la plaza */}
      <mesh position={[PLAZA.x, yPlaza - 0.4, PLAZA.z - 0.12]} material={mat('#b9a17c')} castShadow receiveShadow>
        <boxGeometry args={[PLAZA.a * 1.7, 0.8, PLAZA.b * 1.4]} />
      </mesh>
      <mesh geometry={losa} position={[0, yPlaza, 0]} material={mat('#e6d3a8')} castShadow receiveShadow />
      <mesh geometry={banco} position={[0, yPlaza, 0]} material={matVertices} castShadow />
      {/* sala hipóstila: columnas dóricas bajo el frente de la plaza */}
      {columnas.map(([x, z]) => {
        const yb = Math.min(suelo(x, z), yPlaza - 0.06)
        const h = yPlaza - 0.03 - yb
        return (
          <mesh key={`${x}${z}`} position={[x, yb + h / 2, z]} material={mat('#f3eee2')} castShadow>
            <cylinderGeometry args={[0.012, 0.016, h, 8]} />
          </mesh>
        )
      })}
      {/* escalinata doble con el dragón, de la sala hipóstila a la entrada */}
      <group position={[frente[0], yFrente, frente[1]]} rotation-y={rumbo}>
        <group position={[0, -caida / 2 + 0.02, largo / 2 - 0.05]} rotation-x={Math.atan2(caida, largo)}>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.055, 0, 0]} material={mat('#dccbab')} receiveShadow castShadow>
                <boxGeometry args={[0.06, 0.04, largo - 0.1]} />
              </mesh>
              <mesh geometry={pretil} position={[s * 0.09, 0.03, 0]} material={matVertices} castShadow />
            </group>
          ))}
          <mesh geometry={dragon} position={[0, 0.05, 0.04]} material={matVertices} castShadow />
          <mesh position={[0, 0.04, -0.12]} material={mat('#7fc4d8', { roughness: 0.3 })}>
            <cylinderGeometry args={[0.025, 0.025, 0.015, 8]} />
          </mesh>
        </group>
        {/* las dos casetas de la entrada */}
        <group position={[0, yEntrada - yFrente, largo]}>
          <Caseta x={-0.15} z={0} torre />
          <Caseta x={0.15} z={0} />
          <mesh position={[0, 0.03, 0.06]} material={mat('#c9a477')} castShadow>
            <boxGeometry args={[0.55, 0.06, 0.015]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
