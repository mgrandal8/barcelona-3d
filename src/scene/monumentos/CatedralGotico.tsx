import { useMemo } from 'react'
import * as THREE from 'three'
import { M, Y, mat, matVertices, teñirCaras, useSuelo } from './comun'

// Origen en el centro de la catedral. Nave a lo largo de z: fachada neogótica hacia −z (Pla de la Seu),
// cabecera hacia +z. El cimborrio está sobre el primer tramo, detrás de la fachada,
// los dos campanarios octogonales sobre el crucero y el claustro al suroeste (−x).

const PIEDRA = '#cdb994'
const PIEDRA_OSCURA = '#b49f7c'
const NAVE = Y(28)
const CAPILLAS = Y(18)

function Aguja({ x, y, z, alto, r }: { x: number; y: number; z: number; alto: number; r: number }) {
  return (
    <mesh position={[x, y + alto / 2, z]} material={mat('#d9c7a2')} castShadow>
      <coneGeometry args={[r, alto, 8]} />
    </mesh>
  )
}

export function CatedralGotico() {
  const suelo = useSuelo()
  const yClaustro = suelo(-0.3, 0.1)
  const contrafuertes = useMemo(() => Array.from({ length: 9 }, (_, i) => -0.36 + i * 0.08), [])
  const abside = useMemo(() => new THREE.CylinderGeometry(0.2, 0.2, CAPILLAS, 10, 1, false, -Math.PI / 2, Math.PI), [])
  const absideAlto = useMemo(() => new THREE.CylinderGeometry(0.085, 0.085, NAVE, 8, 1, false, -Math.PI / 2, Math.PI), [])
  const hastial = useMemo(() => {
    const f = new THREE.Shape([new THREE.Vector2(-0.15, 0), new THREE.Vector2(0.15, 0), new THREE.Vector2(0, 0.12)])
    return new THREE.ExtrudeGeometry(f, { depth: 0.035, bevelEnabled: false })
  }, [])
  // cuerpo de campanas: caras alternas con ventanales oscuros
  const campanario = useMemo(
    () => teñirCaras(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8, 1), (i) => (i < 16 && Math.floor(i / 2) % 2 ? '#4a4038' : PIEDRA)),
    [],
  )
  const tejado = useMemo(() => {
    // cubierta a dos aguas de la nave
    const f = new THREE.Shape([new THREE.Vector2(-0.085, 0), new THREE.Vector2(0.085, 0), new THREE.Vector2(0, 0.06)])
    return new THREE.ExtrudeGeometry(f, { depth: 0.72, bevelEnabled: false }).translate(0, 0, -0.42)
  }, [])

  return (
    <group>
      <mesh position={[0, -0.03, 0]} material={mat(PIEDRA_OSCURA)} receiveShadow>
        <boxGeometry args={[0.44, 0.08, 0.95]} />
      </mesh>
      {/* capillas laterales y naves */}
      <mesh position={[0, CAPILLAS / 2, -0.05]} material={mat(PIEDRA_OSCURA)} castShadow receiveShadow>
        <boxGeometry args={[0.4, CAPILLAS, 0.74]} />
      </mesh>
      <mesh position={[0, NAVE / 2, -0.05]} material={mat(PIEDRA)} castShadow receiveShadow>
        <boxGeometry args={[0.17, NAVE, 0.74]} />
      </mesh>
      <mesh geometry={tejado} position={[0, NAVE, 0]} material={mat('#a99a80')} castShadow />
      {/* cabecera con girola */}
      <mesh geometry={abside} position={[0, CAPILLAS / 2, 0.32]} material={mat(PIEDRA_OSCURA)} castShadow receiveShadow />
      <mesh geometry={absideAlto} position={[0, NAVE / 2, 0.32]} material={mat(PIEDRA)} castShadow receiveShadow />
      {/* contrafuertes con pináculos */}
      {contrafuertes.map((z) =>
        [-1, 1].map((s) => (
          <group key={`${z}${s}`}>
            <mesh position={[s * 0.12, (NAVE + 0.04) / 2, z]} material={mat(PIEDRA)} castShadow>
              <boxGeometry args={[0.045, NAVE + 0.04, 0.022]} />
            </mesh>
            <Aguja x={s * 0.12} y={NAVE + 0.04} z={z} alto={0.08} r={0.012} />
          </group>
        )),
      )}
      {/* fachada neogótica con sus agujas */}
      <mesh position={[0, NAVE * 0.62, -0.44]} material={mat('#d6c4a0')} castShadow receiveShadow>
        <boxGeometry args={[0.3, NAVE * 1.24, 0.04]} />
      </mesh>
      <mesh geometry={hastial} position={[0, NAVE * 1.24, -0.46]} material={mat('#d6c4a0')} castShadow />
      <mesh position={[0, NAVE * 0.35, -0.462]} material={mat('#5d5247')}>
        <boxGeometry args={[0.06, NAVE * 0.55, 0.01]} />
      </mesh>
      <mesh position={[0, NAVE * 0.85, -0.462]} material={mat('#6e7b8e')}>
        <circleGeometry args={[0.035, 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.135, NAVE * 0.7, -0.44]} material={mat('#d6c4a0')} castShadow>
            <cylinderGeometry args={[0.03, 0.034, NAVE * 1.4, 8]} />
          </mesh>
          <Aguja x={s * 0.135} y={NAVE * 1.4} z={-0.44} alto={Y(18)} r={0.032} />
          <Aguja x={s * 0.07} y={NAVE * 1.24} z={-0.44} alto={0.1} r={0.012} />
        </group>
      ))}
      {/* cimborrio: tambor octogonal y aguja de 70 m */}
      <mesh position={[0, NAVE + 0.09, -0.32]} material={mat(PIEDRA)} castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.18, 8]} />
      </mesh>
      <Aguja x={0} y={NAVE + 0.18} z={-0.32} alto={Y(70) - NAVE - 0.18} r={0.05} />
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4
        return <Aguja key={k} x={Math.cos(a) * 0.06} y={NAVE + 0.18} z={-0.32 + Math.sin(a) * 0.06} alto={0.12} r={0.01} />
      })}
      {/* campanarios octogonales del crucero (53 m, sin aguja) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.15, (Y(53) - 0.14) / 2, 0.1]} material={mat(PIEDRA)} castShadow receiveShadow>
            <cylinderGeometry args={[0.038, 0.042, Y(53) - 0.14, 8]} />
          </mesh>
          <mesh geometry={campanario} position={[s * 0.15, Y(53) - 0.07, 0.1]} material={matVertices} castShadow />
          <mesh position={[s * 0.15, Y(53) + 0.01, 0.1]} material={mat('#c2ad88')} castShadow>
            <cylinderGeometry args={[0.044, 0.04, 0.02, 8]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => {
            const a = (k / 4) * Math.PI * 2
            return <Aguja key={k} x={s * 0.15 + Math.cos(a) * 0.035} y={Y(53) + 0.02} z={0.1 + Math.sin(a) * 0.035} alto={0.05} r={0.007} />
          })}
        </group>
      ))}
      {/* claustro con su jardín, palmeras y el estanque de las ocas */}
      <group position={[-0.31, yClaustro, 0.1]}>
        {[
          [0, -0.12, 0.24, 0.04],
          [0, 0.12, 0.24, 0.04],
          [-0.1, 0, 0.04, 0.2],
          [0.1, 0, 0.04, 0.2],
        ].map(([x, z, w, d]) => (
          <mesh key={`${x}${z}`} position={[x, Y(9) / 2, z]} material={mat(PIEDRA_OSCURA)} castShadow receiveShadow>
            <boxGeometry args={[w, Y(9), d]} />
          </mesh>
        ))}
        <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} material={mat('#6f9e4f')} receiveShadow>
          <planeGeometry args={[0.16, 0.2]} />
        </mesh>
        <mesh position={[0.03, 0.015, 0.04]} rotation-x={-Math.PI / 2} material={mat('#4aa3c8', { roughness: 0.2 })}>
          <circleGeometry args={[0.02, 10]} />
        </mesh>
        {[
          [-0.04, -0.05],
          [0.04, -0.03],
          [-0.03, 0.05],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, M(8), 0]} material={mat('#8a6a4a')}>
              <cylinderGeometry args={[0.003, 0.004, M(16), 4]} />
            </mesh>
            <mesh position={[0, M(16), 0]} material={mat('#5f8f45')} castShadow>
              <coneGeometry args={[0.025, 0.018, 6]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
