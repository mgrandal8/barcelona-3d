import { useMemo } from 'react'
import * as THREE from 'three'
import { M, Y, azar, mat, teñirCaras, torno } from './comun'

// Origen en el crucero. Nave a lo largo de z: ábside hacia −z (Provença),
// fachada de la Gloria hacia +z (Mallorca). Nacimiento en +x (Marina), Pasión en −x (Sardenya).

const PIEDRA = '#d9c8a6'
const PIEDRA_VIEJA = '#c4aa82'
const PIEDRA_CLARA = '#e8e0cf'
const MOSAICO = ['#d24a3c', '#f0c33c', '#5f9e57', '#f4f0e6', '#d8763a']

/** Campanario: fuste cilíndrico que se afila en parábola y remata en un pináculo de mosaico. */
function geoCampanario(alto: number, r: number) {
  const perfil: [number, number][] = [[0, 0], [r, 0], [r, alto * 0.5]]
  for (let i = 1; i <= 6; i++) {
    const t = i / 6
    perfil.push([r * (1 - t * t * 0.78), alto * (0.5 + t * 0.32)])
  }
  perfil.push([0, alto * 0.84])
  return torno(perfil, 10)
}

function geoPinaculo(alto: number, r: number, semilla: number) {
  const g = torno([[0, 0], [r * 0.9, 0], [r * 1.1, alto * 0.35], [r * 0.6, alto * 0.7], [r * 0.3, alto * 0.85], [0, alto]], 6)
  return teñirCaras(g, (i) => MOSAICO[Math.floor(azar(i + semilla) * MOSAICO.length)])
}

function Campanario({ x, z, alto, color }: { x: number; z: number; alto: number; color: string }) {
  const r = M(4.2)
  const cuerpo = useMemo(() => geoCampanario(alto, r), [alto, r])
  const punta = useMemo(() => geoPinaculo(alto * 0.17, r * 0.55, Math.round(x * 100 + z * 1000)), [alto, r, x, z])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={cuerpo} material={mat(color)} castShadow receiveShadow />
      <mesh geometry={punta} position={[0, alto * 0.83, 0]} material={mat('#fff', { vertexColors: true, roughness: 0.5 })} castShadow />
    </group>
  )
}

/** Torre de las de la cubierta central: cuerpo facetado con remate. */
function TorreCentral({ x, z, alto, r, remate }: { x: number; z: number; alto: number; r: number; remate: React.ReactNode }) {
  const g = useMemo(() => {
    const perfil: [number, number][] = [[0, 0], [r, 0], [r, alto * 0.45]]
    for (let i = 1; i <= 6; i++) {
      const t = i / 6
      perfil.push([r * (1 - t * 0.8) , alto * (0.45 + t * 0.55)])
    }
    perfil.push([0, alto])
    return torno(perfil, 12)
  }, [alto, r])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={g} material={mat(PIEDRA_CLARA)} castShadow receiveShadow />
      <group position={[0, alto, 0]}>{remate}</group>
    </group>
  )
}

function Cruz() {
  // cruz de cuatro brazos de la torre de Jesucristo (vidrio y cerámica blanca)
  const brazo = M(5)
  const cristal = mat('#f2f6fa', { emissive: '#cfe3ff', emissiveIntensity: 0.4, roughness: 0.3 })
  return (
    <group>
      <mesh position={[0, Y(9), 0]} material={cristal} castShadow>
        <boxGeometry args={[M(2.6), Y(18), M(2.6)]} />
      </mesh>
      <mesh position={[0, Y(12), 0]} material={cristal} castShadow>
        <boxGeometry args={[brazo * 2.4, Y(2.6), M(2.4)]} />
      </mesh>
      <mesh position={[0, Y(12), 0]} material={cristal} castShadow>
        <boxGeometry args={[M(2.4), Y(2.6), brazo * 2.4]} />
      </mesh>
    </group>
  )
}

function Grua({ x, z, alto, giro }: { x: number; z: number; alto: number; giro: number }) {
  const amarillo = mat('#f2b632')
  return (
    <group position={[x, 0, z]} rotation-y={giro}>
      <mesh position={[0, alto / 2, 0]} material={amarillo} castShadow>
        <boxGeometry args={[0.022, alto, 0.022]} />
      </mesh>
      <mesh position={[0.18, alto, 0]} material={amarillo} castShadow>
        <boxGeometry args={[0.62, 0.016, 0.016]} />
      </mesh>
      <mesh position={[-0.1, alto - 0.012, 0]} material={mat('#8a8f96')}>
        <boxGeometry args={[0.07, 0.04, 0.035]} />
      </mesh>
      <mesh position={[0, alto + 0.05, 0]} material={amarillo}>
        <coneGeometry args={[0.014, 0.1, 4]} />
      </mesh>
    </group>
  )
}

export function SagradaFamilia() {
  const naveAlta = Y(45)
  const naveBaja = Y(30)
  const piedra = mat(PIEDRA)
  const vieja = mat(PIEDRA_VIEJA)

  const abside = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.2, 0.2, naveBaja * 1.15, 14, 1, false, Math.PI / 2, Math.PI)
    return g
  }, [naveBaja])

  // pórtico inclinado de la Pasión: columnas como huesos
  const huesos = useMemo(() => [-0.12, -0.07, -0.025, 0.025, 0.07, 0.12], [])

  return (
    <group>
      {/* zócalo de la manzana */}
      <mesh position={[0, -0.04, 0.06]} material={mat('#d8cdb8')} receiveShadow>
        <boxGeometry args={[0.98, 0.1, 1.06]} />
      </mesh>
      {/* nave central y laterales (+z hasta la Gloria) */}
      <mesh position={[0, naveAlta / 2, 0.33]} material={piedra} castShadow receiveShadow>
        <boxGeometry args={[0.15, naveAlta, 0.4]} />
      </mesh>
      <mesh position={[0, naveBaja / 2, 0.33]} material={piedra} castShadow receiveShadow>
        <boxGeometry args={[0.45, naveBaja, 0.4]} />
      </mesh>
      {/* cubierta de la nave: pináculos en hilera */}
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i}>
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, naveBaja + 0.07, 0.17 + i * 0.065]} material={mat(PIEDRA_CLARA)} castShadow>
              <coneGeometry args={[0.022, 0.16, 5]} />
            </mesh>
          ))}
          <mesh position={[0, naveAlta + 0.03, 0.17 + i * 0.065]} rotation-y={Math.PI / 4} material={mat('#e8d9b4')} castShadow>
            <coneGeometry args={[0.07, 0.07, 4]} />
          </mesh>
        </group>
      ))}
      {/* crucero */}
      <mesh position={[0, naveAlta / 2, 0]} material={piedra} castShadow receiveShadow>
        <boxGeometry args={[0.58, naveAlta, 0.15]} />
      </mesh>
      <mesh position={[0, naveBaja / 2, 0]} material={piedra} castShadow receiveShadow>
        <boxGeometry args={[0.58, naveBaja, 0.3]} />
      </mesh>
      {/* ábside y torre de María */}
      <mesh position={[0, naveBaja * 0.575, -0.15]} rotation-y={Math.PI} geometry={abside} material={piedra} castShadow receiveShadow />
      {Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI + (i / 6) * Math.PI
        return (
          <mesh key={i} position={[Math.cos(a) * 0.2, naveBaja * 1.15 + 0.06, -0.15 + Math.sin(a) * 0.2]} material={mat(PIEDRA_CLARA)} castShadow>
            <coneGeometry args={[0.02, 0.14, 5]} />
          </mesh>
        )
      })}
      <TorreCentral
        x={0}
        z={-0.24}
        alto={Y(130)}
        r={0.07}
        remate={
          <mesh position={[0, Y(5), 0]} material={mat('#fff8e0', { emissive: '#ffe9a8', emissiveIntensity: 0.9, roughness: 0.3 })} castShadow>
            <icosahedronGeometry args={[0.045, 0]} />
          </mesh>
        }
      />
      {/* torre de Jesucristo y los cuatro evangelistas */}
      <TorreCentral x={0} z={0} alto={Y(155)} r={0.11} remate={<Cruz />} />
      {[
        [1, 1, '#c9a861'],
        [-1, 1, '#b8804f'],
        [1, -1, '#c3c0b0'],
        [-1, -1, '#d9cdb0'],
      ].map(([sx, sz, c]) => (
        <TorreCentral
          key={`${sx}${sz}`}
          x={(sx as number) * 0.1}
          z={(sz as number) * 0.1}
          alto={Y(128)}
          r={0.045}
          remate={
            <mesh position={[0, Y(4), 0]} material={mat(c as string)} castShadow>
              <dodecahedronGeometry args={[0.03, 0]} />
            </mesh>
          }
        />
      ))}
      {/* fachada del Nacimiento (+x): piedra antigua y oscura, cuatro campanarios */}
      <mesh position={[0.31, naveBaja * 0.6, 0]} material={vieja} castShadow receiveShadow>
        <boxGeometry args={[0.07, naveBaja * 1.2, 0.36]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.35, naveBaja * 0.85, s * 0.05]} material={mat('#b09672')} castShadow>
          <coneGeometry args={[0.04, naveBaja * 0.9, 6]} />
        </mesh>
      ))}
      <mesh position={[0.36, naveBaja * 1.05, 0]} material={mat('#7f9a68')} castShadow>
        <coneGeometry args={[0.045, 0.22, 6]} />
      </mesh>
      {[
        [-0.15, Y(98)],
        [-0.05, Y(107)],
        [0.05, Y(107)],
        [0.15, Y(98)],
      ].map(([z, h]) => (
        <Campanario key={`n${z}`} x={0.33} z={z} alto={h} color={PIEDRA_VIEJA} />
      ))}
      {/* fachada de la Pasión (−x): piedra clara y lisa, pórtico de columnas inclinadas */}
      <mesh position={[-0.31, naveBaja * 0.6, 0]} material={mat('#d4c6a8')} castShadow receiveShadow>
        <boxGeometry args={[0.07, naveBaja * 1.2, 0.36]} />
      </mesh>
      <mesh position={[-0.4, naveBaja * 0.62, 0]} material={mat('#e3d8c0')} castShadow>
        <boxGeometry args={[0.06, 0.03, 0.34]} />
      </mesh>
      {huesos.map((z) => (
        <mesh key={z} position={[-0.375, naveBaja * 0.31, z]} rotation-z={0.28} material={mat('#e3d8c0')} castShadow>
          <cylinderGeometry args={[0.009, 0.014, naveBaja * 0.64, 5]} />
        </mesh>
      ))}
      {[
        [-0.15, Y(107)],
        [-0.05, Y(112)],
        [0.05, Y(112)],
        [0.15, Y(107)],
      ].map(([z, h]) => (
        <Campanario key={`p${z}`} x={-0.33} z={z} alto={h} color="#d2c3a2" />
      ))}
      {/* fachada de la Gloria (+z), aún en obras */}
      <mesh position={[0, naveBaja * 0.45, 0.56]} material={mat('#cbbd9f')} castShadow receiveShadow>
        <boxGeometry args={[0.45, naveBaja * 0.9, 0.06]} />
      </mesh>
      {[-0.15, -0.05, 0.05, 0.15].map((x) => (
        <mesh key={x} position={[x, naveBaja * 0.95, 0.56]} material={mat('#bfb39a')} castShadow>
          <cylinderGeometry args={[0.035, 0.04, naveBaja * 0.3, 8]} />
        </mesh>
      ))}
      <Grua x={0.17} z={0.5} alto={Y(150)} giro={2.2} />
      <Grua x={-0.2} z={-0.38} alto={Y(125)} giro={-0.6} />
    </group>
  )
}
