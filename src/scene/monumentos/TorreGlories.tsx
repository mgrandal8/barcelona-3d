import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vivo } from '../hora'
import { Y, azar, mat, teñirCaras, torno } from './comun'

// Origen en el centro de la torre. Bala o géiser de 144 m con la piel de lamas de colores:
// rojos y naranjas abajo, azules y grises arriba.

const ALTO = Y(144)
const R = 0.19
const ABAJO = ['#b8402f', '#cf5a36', '#d9763e', '#a83a32', '#c96a4a']
const MEDIO = ['#c96a4a', '#8a6a8a', '#4f78a8', '#d9763e', '#6c8fb8']
const ARRIBA = ['#5e86b4', '#7fa2c6', '#9db5cb', '#b9c7d2', '#4f78a8']

/**
 * Iluminación LED nocturna: una segunda piel algo mayor, aditiva, cuyas caras cambian de color en
 * ondas que suben por la torre y giran a su alrededor.
 */
function Leds({ piel }: { piel: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Mesh>(null)
  const { geo, caras } = useMemo(() => {
    const geo = piel.clone()
    const p = geo.attributes.position
    const caras = Array.from({ length: p.count / 3 }, (_, t) => {
      let x = 0, y = 0, z = 0
      for (let k = 0; k < 3; k++) {
        x += p.getX(t * 3 + k) / 3
        y += p.getY(t * 3 + k) / 3
        z += p.getZ(t * 3 + k) / 3
      }
      return { h: y / ALTO, a: Math.atan2(z, x) }
    })
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.count * 3), 3))
    return { geo, caras }
  }, [piel])
  const r = useMemo(
    () => ({
      material: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      c: new THREE.Color(),
    }),
    [],
  )
  useFrame(({ clock }) => {
    const m = ref.current!
    m.visible = vivo.noche > 0.05
    if (!m.visible) return
    const t = clock.elapsedTime
    r.material.opacity = vivo.noche
    const col = geo.attributes.color as THREE.BufferAttribute
    caras.forEach(({ h, a }, i) => {
      const tono = (h * 0.9 - t * 0.06 + Math.sin(a * 2 + t * 0.8) * 0.08 + 10) % 1
      const brillo = 0.3 + 0.25 * Math.max(0, Math.sin(h * 18 - t * 2.2 + a))
      r.c.setHSL(tono, 0.95, brillo)
      for (let k = 0; k < 3; k++) col.setXYZ(i * 3 + k, r.c.r * 1.3, r.c.g * 1.3, r.c.b * 1.3)
    })
    col.needsUpdate = true
  })
  return <mesh ref={ref} geometry={geo} material={r.material} scale={[1.03, 1.002, 1.03]} />
}

export function TorreGlories() {
  const piel = useMemo(() => {
    const perfil: [number, number][] = [[0, 0]]
    const n = 22
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const y = ALTO * t
      // fuste casi recto y remate elíptico desde el 55 %
      const u = (t - 0.58) / 0.42
      const r = t < 0.58 ? R * (1 - 0.05 * t) : R * 0.97 * Math.max(0, 1 - u ** 2.6) ** 0.42
      perfil.push([Math.max(r, 0.0001), y])
    }
    const g = torno(perfil, 20)
    return teñirCaras(g, (i, c) => {
      const t = c.y / ALTO + (azar(i) - 0.5) * 0.25
      const paleta = t < 0.35 ? ABAJO : t < 0.6 ? MEDIO : ARRIBA
      return paleta[Math.floor(azar(i * 3 + 1) * paleta.length)]
    })
  }, [])
  const cupula = useMemo(() => new THREE.SphereGeometry(R * 0.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [])
  return (
    <group>
      <mesh geometry={piel} material={mat('#fff', { vertexColors: true, roughness: 0.45, metalness: 0.15 })} castShadow receiveShadow />
      <Leds piel={piel} />
      <mesh geometry={cupula} position={[0, ALTO * 0.9, 0]} material={mat('#d6ecf7', { transparent: true, opacity: 0.6, roughness: 0.1 })} />
      {/* plaza de acceso */}
      <mesh position={[0, 0.005, 0]} rotation-x={-Math.PI / 2} material={mat('#d9d3c6')} receiveShadow>
        <circleGeometry args={[R + 0.08, 24]} />
      </mesh>
    </group>
  )
}
