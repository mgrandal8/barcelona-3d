import { use, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Monumento as Datos } from '../data/monumentos'
import { useEstado } from '../store'
import { cargarDatos } from './datos'
import { OrigenCtx } from './monumentos/comun'

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
        {/* el pin (HTML) va en scene/Pines.tsx */}
        <OrigenCtx value={origen}>{children}</OrigenCtx>
      </group>
      {(hover || seleccionado) && <Anillo radio={Math.max(m.radio, 0.35) * 1.15} />}
    </group>
  )
}
