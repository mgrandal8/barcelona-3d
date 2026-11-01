import { useMemo } from 'react'
import * as THREE from 'three'
import { Y, mat, torno } from './comun'

// Origen en el centro del monumento (partes de OSM: plataforma de 28 m, escalones de 18 m, pedestal
// de 13 m de alto, columna hasta 53 m y la estatua encima, hasta 60). +z apunta al mar.
// La columna y la estatua van algo engordadas para que se lean desde lejos.

const PIEDRA = '#d9ccb2'
const BRONCE = '#6e5c44'
const HIERRO = '#7a705c'

export function Colom() {
  // fuste con éntasis y anillos, de 13 a 51 m
  const columna = useMemo(
    () =>
      torno(
        [
          [0.0, Y(13)],
          [0.04, Y(13)],
          [0.04, Y(15)],
          [0.03, Y(15.5)],
          [0.024, Y(30)],
          [0.03, Y(30.5)],
          [0.03, Y(31.5)],
          [0.022, Y(32)],
          [0.019, Y(48)],
          [0.04, Y(50)],
          [0.045, Y(51)],
          [0.0, Y(51)],
        ],
        10,
      ),
    [],
  )
  const pedestal = useMemo(() => new THREE.CylinderGeometry(0.06, 0.07, Y(8), 8), [])
  const brazo = useMemo(() => new THREE.CylinderGeometry(0.004, 0.005, 0.045, 5).rotateX(Math.PI / 2), [])

  return (
    <group>
      {/* plataforma y escalones */}
      <mesh position-y={Y(1) / 2} material={mat('#cfc3aa')} receiveShadow castShadow>
        <cylinderGeometry args={[0.14, 0.14, Y(1), 24]} />
      </mesh>
      <mesh position-y={Y(1) + Y(4) / 2} material={mat(PIEDRA)} receiveShadow castShadow>
        <cylinderGeometry args={[0.085, 0.095, Y(4), 8]} />
      </mesh>
      {/* los ocho leones de bronce en los escalones */}
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8
        return (
          <mesh key={k} position={[Math.cos(a) * 0.105, Y(1) + 0.012, Math.sin(a) * 0.105]} rotation-y={-a} material={mat(BRONCE, { metalness: 0.5, roughness: 0.5 })} castShadow>
            <boxGeometry args={[0.03, 0.022, 0.014]} />
          </mesh>
        )
      })}
      {/* pedestal octogonal con relieves y las cuatro figuras de bronce */}
      <mesh geometry={pedestal} position-y={Y(5) + Y(8) / 2} material={mat(PIEDRA)} castShadow receiveShadow />
      {Array.from({ length: 4 }, (_, k) => {
        const a = (k / 4) * Math.PI * 2
        return (
          <mesh key={k} position={[Math.cos(a) * 0.075, Y(9), Math.sin(a) * 0.075]} material={mat(BRONCE, { metalness: 0.5, roughness: 0.5 })} castShadow>
            <capsuleGeometry args={[0.008, 0.03, 2, 5]} />
          </mesh>
        )
      })}
      <mesh geometry={columna} material={mat(HIERRO, { metalness: 0.45, roughness: 0.55 })} castShadow />
      {/* globo bajo la estatua (el mirador está aquí) */}
      <mesh position-y={Y(52)} material={mat(BRONCE, { metalness: 0.5, roughness: 0.45 })} castShadow>
        <sphereGeometry args={[0.03, 10, 6]} />
      </mesh>
      {/* Colón, señalando el mar */}
      <group position-y={Y(53)}>
        <mesh position-y={Y(3.5) / 2} material={mat(BRONCE, { metalness: 0.5, roughness: 0.45 })} castShadow>
          <cylinderGeometry args={[0.008, 0.016, Y(3.5), 6]} />
        </mesh>
        <mesh position-y={Y(3.5) + 0.01} material={mat(BRONCE, { metalness: 0.5, roughness: 0.45 })} castShadow>
          <sphereGeometry args={[0.009, 6, 5]} />
        </mesh>
        <mesh geometry={brazo} position={[0.004, Y(3.1), 0.025]} rotation-x={-0.35} material={mat(BRONCE, { metalness: 0.5, roughness: 0.45 })} castShadow />
      </group>
    </group>
  )
}
