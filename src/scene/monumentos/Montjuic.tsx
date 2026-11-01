import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Y, mat, matFoco, useLocal, useSuelo } from './comun'
import { vivo } from '../hora'

// Origen en el Palau Nacional (MNAC). La fachada mira a Plaça d'Espanya: en local, −z apunta
// hacia la Font Màgica. El castillo va en su coordenada, en lo alto de la montaña.

const FONT: [number, number] = [41.3713, 2.1517]
const CASTELL: [number, number] = [41.3633, 2.1661]
const PIEDRA = '#ecdfc3'
const CUPULA = '#b9b2a2'

function TorrePalau({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, Y(46) / 2, 0]} material={matFoco(PIEDRA, 0.3)} castShadow receiveShadow>
        <boxGeometry args={[0.06, Y(46), 0.06]} />
      </mesh>
      <mesh position={[0, Y(46) + 0.03, 0]} material={matFoco(CUPULA, 0.18)} castShadow>
        <sphereGeometry args={[0.035, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, Y(46) + 0.08, 0]} material={matFoco(CUPULA, 0.18)}>
        <coneGeometry args={[0.012, 0.06, 6]} />
      </mesh>
    </group>
  )
}


function Palau({ base }: { base: number }) {
  const cuerpo = Y(24)
  // piedra algo más clara que antes (la fachada queda a contraluz de día), iluminada de noche
  const piedra = matFoco('#efe2c6', 0.32)
  // podio: del punto más bajo del terreno a la cota del palacio, con terraza delantera
  const podio = -base
  const ventanas = useMemo(() => {
    const out: { x: number; y: number; z: number; ry: number }[] = []
    // fachada principal (−z) y laterales (±x), dos filas
    for (const y of [cuerpo * 0.3, cuerpo * 0.68]) {
      for (let x = -0.6; x <= 0.6; x += 0.075) if (Math.abs(x) > 0.24) out.push({ x, y, z: -0.376, ry: 0 })
      for (const s of [-1, 1]) for (let z = -0.3; z <= 0.3; z += 0.075) out.push({ x: s * 0.651, y, z, ry: Math.PI / 2 })
    }
    return out
  }, [cuerpo])
  return (
    <group>
      <mesh position={[0, base + podio / 2, 0.05]} material={matFoco('#d3c09c', 0.22)} castShadow receiveShadow>
        <boxGeometry args={[1.42, podio, 0.95]} />
      </mesh>
      {/* terraza delantera con balaustrada y escalera central hacia las cascadas */}
      <mesh position={[0, base + podio / 2, -0.46]} material={matFoco('#dccba8', 0.22)} castShadow receiveShadow>
        <boxGeometry args={[1.1, podio, 0.12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.33, 0.012, -0.515]} material={mat('#f1e6cf')} castShadow>
          <boxGeometry args={[0.44, 0.024, 0.012]} />
        </mesh>
      ))}
      {Array.from({ length: 5 }, (_, k) => (
        <mesh key={k} position={[0, -k * 0.022 - 0.011, -0.51 - k * 0.022]} material={mat('#e7d8bb')} receiveShadow>
          <boxGeometry args={[0.2, 0.022, 0.03]} />
        </mesh>
      ))}
      {/* cuerpo del palacio */}
      <mesh position={[0, cuerpo / 2, 0]} material={piedra} castShadow receiveShadow>
        <boxGeometry args={[1.3, cuerpo, 0.75]} />
      </mesh>
      <mesh position={[0, cuerpo + 0.008, 0]} material={matFoco('#e2d2b2', 0.3)} castShadow>
        <boxGeometry args={[1.33, 0.016, 0.78]} />
      </mesh>
      {ventanas.map((v, i) => (
        <mesh key={i} position={[v.x, v.y, v.z]} rotation-y={v.ry} material={mat('#5d5246')}>
          <boxGeometry args={[0.03, 0.06, 0.004]} />
        </mesh>
      ))}
      {/* cuerpo central más alto, con la cúpula inspirada en San Pedro */}
      <mesh position={[0, cuerpo + 0.05, 0]} material={piedra} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.1, 0.5]} />
      </mesh>
      <mesh position={[0, cuerpo + 0.15, 0.03]} material={piedra} castShadow>
        <cylinderGeometry args={[0.16, 0.17, 0.12, 16]} />
      </mesh>
      {Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2
        return (
          <mesh key={k} position={[Math.cos(a) * 0.166, cuerpo + 0.15, 0.03 + Math.sin(a) * 0.166]} rotation-y={-a + Math.PI / 2} material={mat('#5d5246')}>
            <boxGeometry args={[0.02, 0.05, 0.004]} />
          </mesh>
        )
      })}
      <mesh position={[0, cuerpo + 0.21, 0.03]} material={matFoco(CUPULA, 0.18)} castShadow>
        <sphereGeometry args={[0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, cuerpo + 0.4, 0.03]} material={piedra} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.06, 8]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <TorrePalau key={`${sx}${sz}`} x={sx * 0.3} z={sz * 0.24} />),
      )}
      {/* cúpulas menores de las alas */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.48, cuerpo, 0]} material={matFoco(CUPULA, 0.18)} castShadow>
          <sphereGeometry args={[0.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      {/* pórtico de columnas, adelantado sobre la fachada */}
      <mesh position={[0, cuerpo * 0.04, -0.4]} material={matFoco('#e2d2b2', 0.3)} receiveShadow>
        <boxGeometry args={[0.46, cuerpo * 0.08, 0.06]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-0.18 + i * 0.04, cuerpo * 0.45, -0.41]} material={matFoco('#f6eedd', 0.35)} castShadow>
          <cylinderGeometry args={[0.009, 0.01, cuerpo * 0.75, 6]} />
        </mesh>
      ))}
      <mesh position={[0, cuerpo * 0.86, -0.405]} material={piedra} castShadow>
        <boxGeometry args={[0.46, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

/** Chorros de la Font Màgica: conos translúcidos que suben y bajan; de noche, espectáculo de colores. */
function Chorros() {
  const ref = useRef<THREE.Group>(null)
  const foco = useRef<THREE.PointLight>(null)
  const r = useMemo(
    () => ({
      agua: new THREE.MeshStandardMaterial({ color: '#d8f1ff', transparent: true, opacity: 0.7, emissive: '#9fd8ff', emissiveIntensity: 0.6, roughness: 0.1, flatShading: true }),
      noche: new THREE.Color(),
      dia: new THREE.Color('#9fd8ff'),
    }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    r.noche.setHSL((t * 0.07) % 1, 0.9, 0.55)
    r.agua.emissive.lerpColors(r.dia, r.noche, vivo.noche)
    r.agua.emissiveIntensity = 0.6 + vivo.noche * 2.4
    foco.current!.color.copy(r.noche)
    foco.current!.intensity = vivo.noche * 1.5
    ref.current?.children.forEach((c, i) => {
      const s = 0.75 + Math.sin(clock.elapsedTime * 1.4 + i * 0.7) * 0.25
      c.scale.y = s
      c.position.y = (c.userData.h * s) / 2
    })
  })
  const chorros = useMemo(() => {
    const out: { x: number; z: number; h: number; r: number }[] = [{ x: 0, z: 0, h: 0.42, r: 0.05 }]
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      out.push({ x: Math.cos(a) * 0.17, z: Math.sin(a) * 0.12, h: 0.2, r: 0.025 })
    }
    return out
  }, [])
  return (
    <>
      <group ref={ref}>
        {chorros.map((c, i) => (
          <mesh key={i} position={[c.x, c.h / 2, c.z]} userData={{ h: c.h }} material={r.agua}>
            <coneGeometry args={[c.r, c.h, 7]} />
          </mesh>
        ))}
      </group>
      <pointLight ref={foco} position={[0, 0.35, 0]} distance={2.5} decay={1.5} intensity={0} />
    </>
  )
}

function Castell() {
  // fortaleza abaluartada: cuadrado con cuatro baluartes en punta
  const geo = useMemo(() => {
    const f = new THREE.Shape()
    const L = 0.42
    const B = 0.2
    const pts: [number, number][] = []
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4
      const c = Math.cos(a)
      const s = Math.sin(a)
      // esquina con baluarte en punta de flecha, en el sentido del recorrido (si no, el polígono se cruza)
      pts.push([c * L + s * B * 0.5, s * L - c * B * 0.5], [c * (L + B), s * (L + B)], [c * L - s * B * 0.5, s * L + c * B * 0.5])
    }
    pts.forEach(([x, z], i) => (i ? f.lineTo(x, z) : f.moveTo(x, z)))
    return new THREE.ExtrudeGeometry(f, { depth: 0.28, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.14, 0)
  }, [])
  return (
    <group>
      <mesh geometry={geo} material={mat('#c2a57c')} castShadow receiveShadow />
      <mesh position={[0, 0.2, 0]} material={mat('#d4bc96')} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.12, 0.36]} />
      </mesh>
      <mesh position={[0, 0.15, 0]} material={mat('#7c9b5a')}>
        <boxGeometry args={[0.5, 0.005, 0.5]} />
      </mesh>
      <mesh position={[0.12, 0.38, 0.12]} material={mat('#8a7a66')}>
        <cylinderGeometry args={[0.004, 0.004, 0.24, 4]} />
      </mesh>
      <mesh position={[0.15, 0.47, 0.12]} material={mat('#f0c33c')}>
        <boxGeometry args={[0.06, 0.04, 0.004]} />
      </mesh>
    </group>
  )
}

export function Montjuic() {
  const suelo = useSuelo()
  const local = useLocal()
  const [fx, fz] = local(...FONT)
  const [cx, cz] = local(...CASTELL)
  // la fachada mira a la fuente
  const giro = Math.atan2(-fx, -fz)
  let base = 0
  for (const [x, z] of [[-0.65, -0.37], [0.65, -0.37], [-0.65, 0.37], [0.65, 0.37], [0, -0.37]]) {
    const s = Math.sin(giro)
    const c = Math.cos(giro)
    base = Math.min(base, suelo(x * c + z * s, -x * s + z * c))
  }
  const yFont = suelo(fx, fz)
  const dist = Math.hypot(fx, fz)

  // escalinatas y cascadas entre la fuente y el palacio
  const tramos = 6
  return (
    <group>
      <group rotation-y={giro}>
        <Palau base={base - 0.1} />
        {Array.from({ length: tramos }, (_, i) => {
          const t0 = 0.4 + (i / tramos) * (dist - 0.65)
          const t1 = 0.4 + ((i + 1) / tramos) * (dist - 0.65)
          const z = -(t0 + t1) / 2
          const s = Math.sin(giro)
          const c = Math.cos(giro)
          const y = Math.max(suelo(z * s, z * c), yFont) + 0.01
          return (
            <group key={i}>
              <mesh position={[0, y - 0.05, z]} material={mat('#e3d3b3')} receiveShadow castShadow>
                <boxGeometry args={[0.34, 0.1, t1 - t0 + 0.01]} />
              </mesh>
              <mesh position={[0, y + 0.003, z]} material={mat('#5fb4dc', { roughness: 0.15, emissive: '#3a8ab8', emissiveIntensity: 0.25 })}>
                <boxGeometry args={[0.07, 0.006, t1 - t0]} />
              </mesh>
            </group>
          )
        })}
        {/* las cuatro columnas de Puig i Cadafalch */}
        {[-0.09, -0.03, 0.03, 0.09].map((x) => {
          const z = -(dist - 0.38)
          const s = Math.sin(giro)
          const c = Math.cos(giro)
          const y = suelo(z * s + x * c, z * c - x * s)
          return (
            <mesh key={x} position={[x * 2.2, y + Y(20) / 2, z]} material={mat('#efe4cc')} castShadow>
              <cylinderGeometry args={[0.012, 0.014, Y(20), 8]} />
            </mesh>
          )
        })}
      </group>
      {/* Font Màgica */}
      <group position={[fx, yFont, fz]} rotation-y={giro}>
        <mesh position={[0, 0.02, 0]} material={mat('#d9cdb4')} receiveShadow>
          <cylinderGeometry args={[0.3, 0.32, 0.04, 24]} />
        </mesh>
        <mesh position={[0, 0.042, 0]} scale={[1, 1, 0.75]} material={mat('#4fb0de', { roughness: 0.1, emissive: '#2f7fae', emissiveIntensity: 0.35 })}>
          <cylinderGeometry args={[0.27, 0.27, 0.01, 24]} />
        </mesh>
        <Chorros />
      </group>
      <group position={[cx, suelo(cx, cz), cz]} rotation-y={giro}>
        <Castell />
      </group>
    </group>
  )
}
