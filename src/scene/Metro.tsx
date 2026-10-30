import { use, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { cargarTransporte } from '../transporte'
import { Lineas } from '../ui/Lineas'
import { cargarDatos } from './datos'
import { ESCALA } from './geo'

const ALTO = 0.2
const PASO = 0.4
const CERCA = 16
const MAX_ETIQUETAS = 24
// por encima de esta altura de cámara la capa se pinta sobre la ciudad, como un plano; por debajo, los edificios la tapan
const ALTURA_PLANO = 16

const disco = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)
const capa = (color: string) => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, toneMapped: false })
const tmp = new THREE.Vector3()
const m4 = new THREE.Matrix4()
const escala = new THREE.Vector3()
const sinGiro = new THREE.Quaternion()

/** Capa de metro y FGC: trazados con el color de cada línea, estaciones y sus nombres de cerca. */
export function Metro() {
  const d = use(cargarDatos())
  const t = use(cargarTransporte())

  // trazados apoyados en el relieve: se densifican para que no atraviesen las lomas
  const trazos = useMemo(
    () =>
      t.lineas.flatMap((l) =>
        l.tramos.map((tramo) => {
          const pts: THREE.Vector3[] = []
          for (let i = 0; i + 3 < tramo.length; i += 2) {
            const [x0, z0, x1, z1] = [tramo[i], tramo[i + 1], tramo[i + 2], tramo[i + 3]].map((v) => v / ESCALA)
            const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / PASO))
            for (let k = 0; k < n; k++) {
              const x = x0 + ((x1 - x0) * k) / n
              const z = z0 + ((z1 - z0) * k) / n
              pts.push(new THREE.Vector3(x, d.alturaY(x, z) + ALTO, z))
            }
          }
          const [xf, zf] = [tramo[tramo.length - 2] / ESCALA, tramo[tramo.length - 1] / ESCALA]
          pts.push(new THREE.Vector3(xf, d.alturaY(xf, zf) + ALTO, zf))
          return { ref: l.ref, color: l.color, pts }
        }),
      ),
    [d, t],
  )
  const estaciones = useMemo(
    () =>
      t.estaciones.map((e) => {
        const x = e.p[0] / ESCALA
        const z = e.p[1] / ESCALA
        return { ...e, pos: new THREE.Vector3(x, d.alturaY(x, z) + ALTO, z) }
      }),
    [d, t],
  )

  const borde = useRef<THREE.InstancedMesh>(null)
  const centro = useRef<THREE.InstancedMesh>(null)
  const mats = useMemo(() => ({ borde: capa('#1d1a17'), centro: capa('#ffffff') }), [])
  const [hover, setHover] = useState<number | null>(null)
  const [cercanas, setCercanas] = useState<number[]>([])
  const reloj = useRef(0)
  const grupo = useRef<THREE.Group>(null)
  const plano = useRef<boolean | null>(null)

  useFrame(({ camera }, dt) => {
    const b = borde.current
    const c = centro.current
    if (!b || !c) return
    // tamaño casi constante en pantalla
    estaciones.forEach((e, i) => {
      const s = THREE.MathUtils.clamp(camera.position.distanceTo(e.pos) * 0.0055, 0.035, 0.6) * (i === hover ? 1.4 : 1)
      b.setMatrixAt(i, m4.compose(e.pos, sinGiro, escala.setScalar(s)))
      c.setMatrixAt(i, m4.compose(tmp.copy(e.pos).setY(e.pos.y + 0.001), sinGiro, escala.setScalar(s * 0.62)))
    })
    b.instanceMatrix.needsUpdate = true
    c.instanceMatrix.needsUpdate = true
    // el raycast la recalcula cuando la necesite, con las posiciones de este fotograma
    b.boundingSphere = null
    // de lejos, la capa encima de todo; de cerca, que no cruce los monumentos
    const encima = camera.position.y > ALTURA_PLANO
    if (encima !== plano.current) {
      plano.current = encima
      grupo.current?.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m) m.depthTest = !encima
      })
    }
    // los nombres, solo de las estaciones cercanas a la cámara (y unas pocas)
    reloj.current -= dt
    if (reloj.current > 0) return
    reloj.current = 0.3
    const lista = estaciones
      .map((e, i) => [i, camera.position.distanceTo(e.pos)] as const)
      .filter(([, dist]) => dist < CERCA)
      .sort((a, b) => a[1] - b[1])
      .slice(0, MAX_ETIQUETAS)
      .map(([i]) => i)
    setCercanas((prev) => (prev.join() === lista.join() ? prev : lista))
  })

  const etiquetas = hover !== null && !cercanas.includes(hover) ? [...cercanas, hover] : cercanas

  return (
    <group ref={grupo}>
      {trazos.map((tr, i) => (
        <group key={i}>
          <Line points={tr.pts} color="#ffffff" lineWidth={6} transparent depthWrite={false} opacity={0.85} renderOrder={20} toneMapped={false} />
          <Line points={tr.pts} color={tr.color} lineWidth={3.2} transparent depthWrite={false} renderOrder={21} toneMapped={false} />
        </group>
      ))}
      <instancedMesh
        ref={borde}
        args={[disco, mats.borde, estaciones.length]}
        renderOrder={22}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (e.instanceId !== undefined && e.instanceId !== hover) setHover(e.instanceId)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          // en táctil no hay hover: el toque muestra el nombre
          e.stopPropagation()
          if (e.instanceId !== undefined) setHover(e.instanceId)
        }}
      />
      <instancedMesh ref={centro} args={[disco, mats.centro, estaciones.length]} renderOrder={23} frustumCulled={false} raycast={() => null} />
      {etiquetas.map((i) => {
        const e = estaciones[i]
        return (
          <Html key={e.n + i} position={e.pos} center zIndexRange={[14, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`estacion-etiqueta ${i === hover ? 'activa' : ''}`}>
              <Lineas refs={e.l} t={t} />
              <span>{e.n}</span>
            </div>
          </Html>
        )
      })}
    </group>
  )
}
