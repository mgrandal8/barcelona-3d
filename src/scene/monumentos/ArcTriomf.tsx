import { useMemo } from 'react'
import * as THREE from 'three'
import { Y, mat, matFoco, useSuelo } from './comun'

// Origen en el centro del arco (planta de OSM: 28 × 12,6 m, 29 m de alto). El paso va a lo largo de z:
// en −z queda Passeig de Sant Joan y en +z el paseo de Lluís Companys baja hasta la Ciutadella.

const ANCHO = 0.28
const FONDO = 0.126
const ALTO = Y(25) // hasta la cornisa
const LUZ = 0.1 // ancho del paso
const ARRANQUE = Y(12) // donde empieza el arco
const LADRILLO = '#b65a3c'
const LADRILLO_OSCURO = '#94452e'
const PIEDRA = '#e7d8bb'

function geoArco() {
  const f = new THREE.Shape()
  f.moveTo(-ANCHO / 2, 0)
  f.lineTo(-LUZ / 2, 0)
  f.lineTo(-LUZ / 2, ARRANQUE)
  f.absarc(0, ARRANQUE, LUZ / 2, Math.PI, 0, true)
  f.lineTo(LUZ / 2, 0)
  f.lineTo(ANCHO / 2, 0)
  f.lineTo(ANCHO / 2, ALTO)
  f.lineTo(-ANCHO / 2, ALTO)
  f.closePath()
  return new THREE.ExtrudeGeometry(f, { depth: FONDO, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -FONDO / 2)
}

/** Palmera: tronco fino algo curvado y un penacho de hojas caídas. */
function Palmera({ x, y, z, h }: { x: number; y: number; z: number; h: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position-y={h / 2} material={mat('#8a7458')} castShadow>
        <cylinderGeometry args={[0.005, 0.008, h, 5]} />
      </mesh>
      {Array.from({ length: 7 }, (_, k) => (
        <mesh key={k} position={[Math.cos((k / 7) * Math.PI * 2) * 0.022, h - 0.006, Math.sin((k / 7) * Math.PI * 2) * 0.022]} rotation={[0, -(k / 7) * Math.PI * 2, -0.5]} material={mat('#4f8a3c')} castShadow>
          <boxGeometry args={[0.05, 0.003, 0.012]} />
        </mesh>
      ))}
    </group>
  )
}

/** Farola modernista del paseo: fuste oscuro con brazos y globos. */
function Farola({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position-y={0.04} material={mat('#3a3f3a', { metalness: 0.4, roughness: 0.5 })}>
        <cylinderGeometry args={[0.0025, 0.004, 0.08, 5]} />
      </mesh>
      <mesh position-y={0.082} material={mat('#fff3cf', { emissive: '#ffd98a', emissiveIntensity: 0.4 })}>
        <sphereGeometry args={[0.006, 6, 4]} />
      </mesh>
    </group>
  )
}

export function ArcTriomf() {
  const suelo = useSuelo()
  const arco = useMemo(() => geoArco(), [])
  const y0 = suelo(0, 0)
  const paseo = useMemo(() => {
    const palmeras: { x: number; z: number; h: number }[] = []
    const farolas: { x: number; z: number }[] = []
    for (let z = 0.3; z < 2.0; z += 0.13) {
      for (const s of [-1, 1]) {
        palmeras.push({ x: s * 0.22, z: z + (s > 0 ? 0.06 : 0), h: 0.14 + ((z * 37) % 1) * 0.04 })
        if (Math.round(z / 0.13) % 2 === 0) farolas.push({ x: s * 0.12, z })
      }
    }
    return { palmeras, farolas }
  }, [])

  return (
    <group>
      <group position-y={y0}>
        {/* zócalo de piedra y arco de ladrillo */}
        <mesh position={[0, Y(1.5) / 2, 0]} material={matFoco(PIEDRA, 0.3)} receiveShadow castShadow>
          <boxGeometry args={[ANCHO + 0.02, Y(1.5), FONDO + 0.02]} />
        </mesh>
        <mesh geometry={arco} material={matFoco(LADRILLO, 0.3)} castShadow receiveShadow />
        {/* friso de piedra con relieves, por las dos caras */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[0, Y(17.5), s * (FONDO / 2 + 0.004)]} material={matFoco(PIEDRA, 0.3)} castShadow>
              <boxGeometry args={[ANCHO - 0.02, Y(3), 0.008]} />
            </mesh>
            {Array.from({ length: 9 }, (_, k) => (
              <mesh key={k} position={[-0.11 + k * 0.0275, Y(17.5), s * (FONDO / 2 + 0.009)]} material={mat('#d9c8a6')}>
                <boxGeometry args={[0.012, Y(1.8), 0.004]} />
              </mesh>
            ))}
            {/* pilastras de ladrillo más oscuro a los lados del paso */}
            {[-1, 1].map((k) => (
              <mesh key={k} position={[k * (LUZ / 2 + 0.018), ALTO / 2, s * (FONDO / 2 + 0.003)]} material={matFoco(LADRILLO_OSCURO, 0.3)} castShadow>
                <boxGeometry args={[0.022, ALTO, 0.006]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* cornisa, ático y remates */}
        <mesh position={[0, ALTO + 0.008, 0]} material={matFoco(PIEDRA, 0.3)} castShadow>
          <boxGeometry args={[ANCHO + 0.016, 0.016, FONDO + 0.016]} />
        </mesh>
        <mesh position={[0, ALTO + 0.016 + Y(2) / 2, 0]} material={matFoco(LADRILLO, 0.3)} castShadow>
          <boxGeometry args={[ANCHO * 0.7, Y(2), FONDO * 0.8]} />
        </mesh>
        {/* escudo central */}
        <mesh position={[0, ALTO + 0.03, 0]} material={matFoco(PIEDRA, 0.3)} castShadow>
          <sphereGeometry args={[0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* cuatro pináculos en las esquinas, con su cupulita */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <group key={`${sx}${sz}`} position={[sx * (ANCHO / 2 - 0.016), ALTO + 0.016, sz * (FONDO / 2 - 0.016)]}>
              <mesh position-y={Y(2.5) / 2} material={matFoco(LADRILLO_OSCURO, 0.3)} castShadow>
                <boxGeometry args={[0.03, Y(2.5), 0.03]} />
              </mesh>
              <mesh position-y={Y(2.5) + 0.012} material={matFoco(PIEDRA, 0.3)} castShadow>
                <sphereGeometry args={[0.018, 8, 5]} />
              </mesh>
            </group>
          )),
        )}
      </group>
      {/* paseo de Lluís Companys */}
      <mesh position={[0, suelo(0, 1.1) + 0.004, 1.1]} rotation-x={-Math.PI / 2} receiveShadow material={mat('#ddc9a3')}>
        <planeGeometry args={[0.36, 1.8]} />
      </mesh>
      {paseo.palmeras.map((p, i) => (
        <Palmera key={i} x={p.x} y={suelo(p.x, p.z)} z={p.z} h={p.h} />
      ))}
      {paseo.farolas.map((f, i) => (
        <Farola key={i} x={f.x} y={suelo(f.x, f.z)} z={f.z} />
      ))}
    </group>
  )
}
