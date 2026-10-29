import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { vivo } from './hora'
import { azar } from './monumentos/comun'

// Nubes low-poly que cruzan la maqueta con el viento de poniente (+x) y dan la vuelta al salir.
const X_MIN = -75
const X_MAX = 85
const N = 11

/** Una nube: bolas facetadas de distinto tamaño, más gorda en el centro y con la base aplanada. */
function geometriaNube(semilla: number) {
  const partes: THREE.BufferGeometry[] = []
  const n = 5 + Math.floor(azar(semilla) * 4)
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5
    const r = (1 - Math.abs(t) * 1.1) * (1.1 + azar(semilla * 7 + i) * 0.7)
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.translate(t * 4.2, r * 0.25 + azar(semilla * 3 + i) * 0.5, (azar(semilla * 5 + i) - 0.5) * 1.6)
    partes.push(g.toNonIndexed())
  }
  const g = mergeGeometries(partes)!
  // base plana, como las nubes de buen tiempo
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.15) * (p.getY(i) < 0 ? 0.6 : 1))
  g.computeVertexNormals()
  return g
}

export function Nubes() {
  const grupo = useRef<THREE.Group>(null)
  const nubes = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        geo: geometriaNube(i + 11),
        mat: new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, flatShading: true, transparent: true }),
        x: X_MIN + azar(i * 13 + 2) * (X_MAX - X_MIN),
        y: 24 + azar(i * 17 + 5) * 9,
        z: -55 + azar(i * 19 + 3) * 90,
        escala: 0.9 + azar(i * 23 + 1) * 1.1,
        vel: 0.35 + azar(i * 29 + 7) * 0.35,
      })),
    [],
  )
  const camPos = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, dt) => {
    camera.getWorldPosition(camPos)
    grupo.current!.children.forEach((m, i) => {
      const n = nubes[i]
      n.x += n.vel * Math.min(dt, 0.1)
      if (n.x > X_MAX) n.x = X_MIN
      m.position.x = n.x
      // se desvanece al acercarse la cámara (vuelos bajos) y en los extremos del recorrido
      const d = camPos.distanceTo(m.position)
      const borde = Math.min(1, (n.x - X_MIN) / 10, (X_MAX - n.x) / 10)
      n.mat.opacity = THREE.MathUtils.smoothstep(d, 10, 26) * borde * 0.92
      m.visible = n.mat.opacity > 0.02
      n.mat.color.copy(vivo.nubes)
    })
  })
  return (
    <group ref={grupo}>
      {nubes.map((n, i) => (
        <mesh key={i} geometry={n.geo} material={n.mat} position={[n.x, n.y, n.z]} scale={n.escala} castShadow />
      ))}
    </group>
  )
}
