import { use, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { QuadraticBezierLine, type QuadraticBezierLineRef } from '@react-three/drei'
import { porId } from '../data/monumentos'
import { tourPorId } from '../data/tours'
import { useEstado } from '../store'
import { cargarDatos } from './datos'

type Tramo = { inicio: [number, number, number]; fin: [number, number, number]; medio: [number, number, number] }

/** Arco discontinuo y animado entre dos paradas seguidas del tour. */
function Arco({ t, color }: { t: Tramo; color: string }) {
  const ref = useRef<QuadraticBezierLineRef>(null)
  useFrame((_, dt) => {
    const m = ref.current?.material
    if (m) m.dashOffset -= dt * 1.5
  })
  return (
    <QuadraticBezierLine
      ref={ref}
      start={t.inicio}
      end={t.fin}
      mid={t.medio}
      color={color}
      lineWidth={4.5}
      dashed
      dashSize={0.9}
      gapSize={0.5}
      transparent
      opacity={0.9}
      toneMapped={false}
    />
  )
}

/** Recorrido del tour en curso: arcos de parada a parada (el número de cada parada va en su pin, scene/Pines.tsx). */
export function Ruta() {
  const d = use(cargarDatos())
  const tour = tourPorId(useEstado((s) => s.tour))

  const puntos = useMemo(
    () =>
      (tour?.paradas ?? []).map((p) => {
        const m = porId(p.id)!
        const [x, z] = m.pos
        return [x, d.alturaY(x, z) + m.alturaMarcador + 0.4, z] as [number, number, number]
      }),
    [d, tour],
  )
  const tramos = useMemo<Tramo[]>(
    () =>
      puntos.slice(1).map((fin, i) => {
        const inicio = puntos[i]
        const dist = Math.hypot(fin[0] - inicio[0], fin[2] - inicio[2])
        const medio: [number, number, number] = [(inicio[0] + fin[0]) / 2, Math.max(inicio[1], fin[1]) + dist * 0.3, (inicio[2] + fin[2]) / 2]
        return { inicio, fin, medio }
      }),
    [puntos],
  )

  if (!tour) return null
  return (
    <group>
      {tramos.map((t, i) => (
        <Arco key={`${tour.id}-${i}`} t={t} color={tour.color} />
      ))}
    </group>
  )
}
