import { use, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Monumento as Datos } from '../data/monumentos'
import { useEstado } from '../store'
import { cargarDatos } from './datos'
import { OrigenCtx } from './monumentos/comun'

const tmp = new THREE.Vector3()

/** Pin flotante que se ve desde la vista general; se encoge al acercarse. */
function Pin({ altura, activo }: { altura: number; activo: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ camera, clock }) => {
    const g = ref.current
    if (!g) return
    g.getWorldPosition(tmp)
    const s = THREE.MathUtils.clamp(camera.position.distanceTo(tmp) / 30, 0.12, 1.4)
    g.scale.setScalar(s)
    g.position.y = altura + 0.6 * s + Math.sin(clock.elapsedTime * 2) * 0.08 * s
    g.rotation.y = clock.elapsedTime * 0.8
  })
  const color = activo ? '#ffcf4a' : '#e2553a'
  return (
    <group ref={ref}>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.16, 0.42, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.35, 0.0]}>
        <sphereGeometry args={[0.09, 10, 6]} />
        <meshStandardMaterial color="#fff6e8" />
      </mesh>
    </group>
  )
}

function Anillo({ radio }: { radio: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.RingGeometry(radio * 0.92, radio, 64).rotateX(-Math.PI / 2), [radio])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = (clock.elapsedTime * 0.8) % 1
    m.scale.setScalar(1 + t * 0.25)
    ;(m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t)
  })
  return (
    <mesh ref={ref} geometry={geo} position-y={0.03} renderOrder={2}>
      <meshBasicMaterial color="#ffd36b" transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function Monumento({ m, children }: { m: Datos; children: ReactNode }) {
  const d = use(cargarDatos())
  const [x, z] = m.pos
  const origen = useMemo(() => ({ x, z, y: d.alturaY(x, z) }), [d, x, z])
  const hover = useEstado((s) => s.hover === m.id)
  const seleccionado = useEstado((s) => s.seleccionado === m.id)
  const { setHover, setSeleccionado } = useEstado.getState()

  return (
    <group position={[x, origen.y, z]}>
      <group
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(m.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          if (useEstado.getState().hover === m.id) setHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          setSeleccionado(m.id)
        }}
      >
        <OrigenCtx value={origen}>{children}</OrigenCtx>
        {!seleccionado && <Pin altura={m.alturaMarcador} activo={hover} />}
      </group>
      {(hover || seleccionado) && <Anillo radio={Math.max(m.radio, 0.35) * 1.15} />}
      {hover && !seleccionado && (
        <Html position={[0, m.alturaMarcador, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="etiqueta">
            <strong>{m.nombre}</strong>
            <span>{m.barrio}</span>
          </div>
        </Html>
      )}
    </group>
  )
}
