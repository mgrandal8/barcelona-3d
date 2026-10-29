import { useMemo } from 'react'
import * as THREE from 'three'
import { Y, azar, mat, matVertices, teñirCaras } from './comun'

// Origen en el centro de la parcela. Fachada a Passeig de Gràcia en +x; el bloque sigue hacia −x.
// La Casa Amatller queda al lado, en +z.

const ANCHO = 0.15 // fachada (z)
const FONDO = 0.35 // (x)
const ALTO = Y(26)
const FRENTE = FONDO / 2
const TRENCADIS = ['#8fc0d4', '#a9d2cf', '#c3dfe8', '#dfe9d0', '#eec3bb', '#f0e0b0', '#6fa3c4', '#d5e6ee', '#f4efe6', '#f4efe6']
const ESCAMAS = ['#3f8f6a', '#4a9a7a', '#3a6fae', '#5c82b8', '#c96b7a', '#d98a8a', '#e0b45a']

export function CasaBatllo() {
  const fachada = useMemo(() => {
    const g = new THREE.PlaneGeometry(ANCHO, ALTO - 0.09, 14, 26).rotateY(Math.PI / 2)
    return teñirCaras(g, (i) => TRENCADIS[Math.floor(azar(i * 7) * TRENCADIS.length)])
  }, [])
  // lomo del dragón: medio cilindro tumbado a lo largo de la fachada, con escamas
  const lomo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.045, 0.045, ANCHO * 0.9, 8, 9, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)
    g.scale(1, 1.3, 1)
    return teñirCaras(g, (i, c) => {
      const t = (c.z / (ANCHO * 0.9) + 0.5) * (ESCAMAS.length - 1)
      return ESCAMAS[Math.min(ESCAMAS.length - 1, Math.max(0, Math.round(t + (azar(i) - 0.5) * 1.6)))]
    })
  }, [])
  const huesos = [-0.055, -0.018, 0.018, 0.055]
  const balcones = useMemo(() => {
    const out: [number, number][] = []
    for (let f = 0; f < 4; f++) for (const z of [-0.045, 0, 0.045]) out.push([0.13 + f * 0.055, z])
    return out
  }, [])

  return (
    <group>
      <mesh position={[0, ALTO / 2, 0]} material={mat('#ddd3c0')} castShadow receiveShadow>
        <boxGeometry args={[FONDO, ALTO, ANCHO]} />
      </mesh>
      <mesh geometry={fachada} position={[FRENTE + 0.002, 0.09 + (ALTO - 0.09) / 2, 0]} material={matVertices} />
      {/* planta noble de piedra con columnas como huesos */}
      <mesh position={[FRENTE + 0.006, 0.045, 0]} material={mat('#d8c39c')} castShadow>
        <boxGeometry args={[0.012, 0.09, ANCHO]} />
      </mesh>
      <mesh position={[FRENTE + 0.008, 0.07, 0]} material={mat('#3b4148')}>
        <boxGeometry args={[0.012, 0.035, ANCHO * 0.86]} />
      </mesh>
      {huesos.map((z) => (
        <mesh key={z} position={[FRENTE + 0.016, 0.07, z]} material={mat('#efe6d2')} castShadow>
          <cylinderGeometry args={[0.005, 0.007, 0.045, 5]} />
        </mesh>
      ))}
      {/* balcones-máscara */}
      {balcones.map(([y, z]) => (
        <mesh key={`${y}${z}`} position={[FRENTE + 0.01, y, z]} material={mat('#f1ece2')} castShadow>
          <sphereGeometry args={[0.012, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      {/* tejado: el dragón */}
      <mesh geometry={lomo} position={[FRENTE - 0.045, ALTO, -0.008]} material={matVertices} castShadow />
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[FRENTE - 0.045, ALTO + 0.06, -0.06 + i * 0.016]} material={mat(i % 2 ? '#e6c05a' : '#d98a4a')}>
          <sphereGeometry args={[0.008, 6, 4]} />
        </mesh>
      ))}
      {/* torrecilla con la cruz de cuatro brazos, en el lado de la Casa Amatller */}
      <mesh position={[FRENTE - 0.03, ALTO + 0.06, 0.062]} material={mat('#efe6d2')} castShadow>
        <cylinderGeometry args={[0.011, 0.014, 0.12, 8]} />
      </mesh>
      <mesh position={[FRENTE - 0.03, ALTO + 0.13, 0.062]} material={mat('#e0b45a', { roughness: 0.4 })} castShadow>
        <sphereGeometry args={[0.018, 8, 6]} />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[FRENTE - 0.03, ALTO + 0.165, 0.062]} rotation-y={r} material={mat('#e0b45a')}>
          <boxGeometry args={[0.03, 0.008, 0.008]} />
        </mesh>
      ))}
      <mesh position={[FRENTE - 0.03, ALTO + 0.165, 0.062]} material={mat('#e0b45a')}>
        <boxGeometry args={[0.008, 0.035, 0.008]} />
      </mesh>
      {/* chimeneas de colores en la azotea */}
      {[
        [-0.02, -0.04, '#5e9fb8'],
        [-0.06, 0.03, '#e3a8a0'],
        [-0.1, -0.02, '#c9d9a8'],
      ].map(([x, z, c]) => (
        <mesh key={`${x}`} position={[x as number, ALTO + 0.03, z as number]} material={mat(c as string)} castShadow>
          <cylinderGeometry args={[0.008, 0.012, 0.06, 6]} />
        </mesh>
      ))}
    </group>
  )
}
