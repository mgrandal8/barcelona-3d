import { useMemo } from 'react'
import * as THREE from 'three'
import { Y, mat } from './comun'

// Origen en el centro del césped. El eje largo del campo va girado −0,40 rad (datos de OSM).
// Gradas como bandas entre superelipses: de casi rectángulo (junto al campo) a elipse (fachada).

const GIRO = -0.4
const N = 96
const INT = { a: 0.42, b: 0.62, n: 6 }
const EXT = { a: 1.0, b: 1.2, n: 2.3 }
const AZUL = '#1f4f9c'
const GRANA = '#9e2140'
const GRIS = '#bfc4c8'

/** [t (0 = campo, 1 = fachada), altura, color] */
const PERFIL: [number, number, string][] = [
  [0, 0.02, AZUL],
  [0.3, 0.22, GRIS],
  [0.33, 0.22, GRIS],
  [0.33, 0.27, GRANA],
  [0.64, 0.5, GRIS],
  [0.67, 0.5, GRIS],
  [0.67, 0.55, AZUL],
  [1, Y(48), '#e9ecee'],
]

function punto(t: number, ang: number) {
  const a = INT.a + (EXT.a - INT.a) * t
  const b = INT.b + (EXT.b - INT.b) * t
  const n = INT.n + (EXT.n - INT.n) * t
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  return [a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]
}

function geoGradas() {
  const pos: number[] = []
  const col: number[] = []
  const c = new THREE.Color()
  const cara = (p: number[][], color: string) => {
    c.set(color)
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(...p[i])
      col.push(c.r, c.g, c.b)
    }
  }
  for (let k = 0; k < PERFIL.length - 1; k++) {
    const [t0, y0, col0] = PERFIL[k]
    const [t1, y1] = PERFIL[k + 1]
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2
      const a1 = ((i + 1) / N) * Math.PI * 2
      const [x00, z00] = punto(t0, a0)
      const [x01, z01] = punto(t0, a1)
      const [x10, z10] = punto(t1, a0)
      const [x11, z11] = punto(t1, a1)
      cara([[x00, y0, z00], [x10, y1, z10], [x11, y1, z11], [x01, y0, z01]], col0)
    }
  }
  // fachada exterior, con una franja blaugrana arriba
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2
    const a1 = ((i + 1) / N) * Math.PI * 2
    const [x0, z0] = punto(1, a0)
    const [x1, z1] = punto(1, a1)
    const alto = PERFIL[PERFIL.length - 1][1]
    cara([[x0, alto, z0], [x0, -0.05, z0], [x1, -0.05, z1], [x1, alto, z1]], '#dfe3e6')
    cara([[x0, alto - 0.08, z0], [x0, alto - 0.13, z0], [x1, alto - 0.13, z1], [x1, alto - 0.08, z1]].map(([x, y, z]) => [x * 1.003, y, z * 1.003]), i % 8 < 4 ? AZUL : GRANA)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function geoCubierta() {
  // anillo de la cubierta nueva, sobre la grada alta
  const alto = PERFIL[PERFIL.length - 1][1] + 0.05
  const forma = new THREE.Shape()
  const hueco = new THREE.Path()
  for (let i = 0; i <= N; i++) {
    const ang = (i / N) * Math.PI * 2
    const [x, z] = punto(1.03, ang)
    const [xi, zi] = punto(0.62, ang)
    if (i === 0) {
      forma.moveTo(x, z)
      hueco.moveTo(xi, zi)
    } else {
      forma.lineTo(x, z)
      hueco.lineTo(xi, zi)
    }
  }
  forma.holes.push(hueco)
  const g = new THREE.ExtrudeGeometry(forma, { depth: 0.025, bevelEnabled: false })
  g.rotateX(Math.PI / 2)
  g.translate(0, alto + 0.025, 0)
  return g
}

function texturaCesped() {
  const cv = document.createElement('canvas')
  cv.width = 136
  cv.height = 210
  const x = cv.getContext('2d')!
  for (let i = 0; i < 14; i++) {
    x.fillStyle = i % 2 ? '#4f9a3f' : '#5aa848'
    x.fillRect(0, i * 15, 136, 15)
  }
  x.strokeStyle = '#f4f4ee'
  x.lineWidth = 2
  x.strokeRect(4, 4, 128, 202)
  x.beginPath()
  x.moveTo(4, 105)
  x.lineTo(132, 105)
  x.stroke()
  x.beginPath()
  x.arc(68, 105, 18, 0, Math.PI * 2)
  x.stroke()
  x.strokeRect(36, 4, 64, 32)
  x.strokeRect(36, 174, 64, 32)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function CampNou() {
  const gradas = useMemo(() => geoGradas(), [])
  const cubierta = useMemo(() => geoCubierta(), [])
  const cesped = useMemo(() => texturaCesped(), [])
  return (
    <group rotation-y={GIRO}>
      <mesh geometry={gradas} material={mat('#fff', { vertexColors: true, side: THREE.DoubleSide })} castShadow receiveShadow />
      <mesh geometry={cubierta} material={mat('#f4f5f2', { transparent: true, opacity: 0.85 })} castShadow receiveShadow />
      <mesh position={[0, 0.021, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[INT.a * 1.9, INT.b * 1.9]} />
        <meshStandardMaterial color="#5aa848" roughness={1} />
      </mesh>
      <mesh position={[0, 0.024, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[0.68, 1.05]} />
        <meshStandardMaterial map={cesped} roughness={1} />
      </mesh>
    </group>
  )
}
