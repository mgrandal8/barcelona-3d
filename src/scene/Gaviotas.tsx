import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { geoAEscena } from './geo'
import { vivo } from './hora'
import { azar, mat } from './monumentos/comun'

// Bandadas de gaviotas que planean en círculo sobre la playa y el puerto. Exageradas de tamaño
// (14 m de envergadura) para que se vean al acercarse; desde la vista general apenas son puntos.

const BANDADAS: { coord: [number, number]; n: number }[] = [
  { coord: [41.3795, 2.1935], n: 7 }, // playa de la Barceloneta
  { coord: [41.3735, 2.1825], n: 5 }, // Port Vell
  { coord: [41.3875, 2.2005], n: 5 }, // Port Olímpic
]

function useAla() {
  return useMemo(() => {
    // ala en +z desde el cuerpo, con la punta hacia atrás
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0.025, 0, 0, -0.02, 0, 0, -0.035, 0, 0.075], 3))
    g.computeVertexNormals()
    return g
  }, [])
}

export function Gaviotas() {
  const ala = useAla()
  const gaviotas = useMemo(
    () =>
      BANDADAS.flatMap((b, j) => {
        const [x, z] = geoAEscena(...b.coord)
        return Array.from({ length: b.n }, (_, i) => {
          const s = j * 31 + i
          return { x, z, r: 0.5 + azar(s) * 1.3, y: 0.7 + azar(s + 1) * 0.9, fase: azar(s + 2) * 6.28, vel: 0.25 + azar(s + 3) * 0.2, sentido: azar(s + 4) < 0.7 ? 1 : -1 }
        })
      }),
    [],
  )
  const grupo = useRef<THREE.Group>(null)
  const blanco = mat('#f5f5f2', { side: THREE.DoubleSide })
  const gris = mat('#9aa3ab')

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const g = grupo.current!
    // de noche se van a dormir
    g.visible = vivo.noche < 0.6
    if (!g.visible) return
    g.children.forEach((p, i) => {
      const v = gaviotas[i]
      const a = v.fase + v.sentido * t * v.vel / v.r * 0.6
      p.position.set(v.x + Math.cos(a) * v.r, v.y + Math.sin(t * 0.7 + i) * 0.08, v.z + Math.sin(a) * v.r)
      // tangente del círculo e inclinación hacia dentro del giro
      p.rotation.set(-v.sentido * 0.35, -a - (v.sentido * Math.PI) / 2, 0, 'YXZ')
      // aleteo a ratos y planeo el resto del tiempo
      const aleteo = Math.max(0, Math.sin(t * 0.9 + i * 1.7)) > 0.5 ? Math.sin(t * 11 + i) * 0.55 : 0.12
      p.children[1].rotation.x = -aleteo
      p.children[2].rotation.x = aleteo
    })
  })

  return (
    <group ref={grupo}>
      {gaviotas.map((_, i) => (
        <group key={i}>
          <mesh material={gris} rotation-z={Math.PI / 2}>
            <coneGeometry args={[0.009, 0.06, 4]} />
          </mesh>
          <mesh geometry={ala} material={blanco} />
          <mesh geometry={ala} material={blanco} scale-z={-1} />
        </group>
      ))}
    </group>
  )
}
