import { use, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEstado } from '../store'
import { cargarDatos } from './datos'
import { ESCALA } from './geo'

const tmp = new THREE.Vector3()
const disco = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)
const aro = new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2)

// siempre por encima de edificios y terreno: sin prueba de profundidad y dibujado al final
const capa = (color: string, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false })

/** Punto azul con halo de precisión: la posición del usuario sobre la maqueta. */
export function MiPosicion() {
  const d = use(cargarDatos())
  const u = useEstado((s) => s.ubicacion)
  const punto = useRef<THREE.Group>(null)
  const pulso = useRef<THREE.Mesh>(null)
  const mats = useMemo(() => ({ halo: capa('#3b82f6', 0.16), borde: capa('#ffffff'), centro: capa('#2563eb'), pulso: capa('#3b82f6', 0.6) }), [])

  useFrame(({ camera, clock }) => {
    const g = punto.current
    if (!g) return
    // tamaño casi constante en pantalla, como los pines
    g.getWorldPosition(tmp)
    g.scale.setScalar(THREE.MathUtils.clamp(camera.position.distanceTo(tmp) / 32, 0.06, 1.4))
    const t = (clock.elapsedTime * 0.6) % 1
    pulso.current?.scale.setScalar(0.3 + t * 0.9)
    mats.pulso.opacity = 0.6 * (1 - t)
  })

  if (!u?.dentro) return null
  const y = d.alturaY(u.x, u.z) + 0.04
  return (
    <group position={[u.x, y, u.z]}>
      <mesh geometry={disco} material={mats.halo} scale={Math.max(u.precision / ESCALA, 0.08)} renderOrder={30} />
      <group ref={punto}>
        <mesh ref={pulso} geometry={aro} material={mats.pulso} renderOrder={31} />
        <mesh geometry={disco} material={mats.borde} scale={0.3} renderOrder={32} />
        <mesh geometry={disco} material={mats.centro} scale={0.22} renderOrder={33} />
      </group>
    </group>
  )
}
