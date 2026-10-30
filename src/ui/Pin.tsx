import type { CSSProperties, Ref } from 'react'
import { MONUMENTOS } from '../data/monumentos'

// Pin de un lugar: un botón con su número (el de la lista) del color de su categoría; con el ratón
// o el foco despliega el nombre. Lo usan la maqueta (scene/Pines.tsx) y la versión ligera.

/** Color de cada categoría (la `etiqueta` de data/monumentos.ts), con contraste ≥ 4,5:1 frente al blanco. */
const COLOR_CATEGORIA: Record<string, string> = {
  Gaudí: '#b4472d',
  Modernismo: '#a2366a',
  'Arquitectura contemporánea': '#2f6596',
  Deporte: '#3b4f96',
  Gótico: '#6d4c35',
  'Museos y vistas': '#85570c',
  Mar: '#1c6a86',
}
const colorDe = (id: string) => COLOR_CATEGORIA[MONUMENTOS.find((m) => m.id === id)?.etiqueta ?? ''] ?? '#b4472d'

export type PropsPin = {
  id: string
  /** Lo que va dentro del pin: el número de la guía o el de la parada. */
  num: number
  nombre: string
  sub: string
  etiqueta: string
  /** Color de la ruta si el lugar es parada del tour en curso. */
  color?: string
  activo?: boolean
  hover?: boolean
  /** En un tour, los lugares que no son paradas quedan en segundo plano. */
  apagado?: boolean
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLButtonElement>
  onClick: () => void
  onHover: (dentro: boolean) => void
}

export function Pin({ id, num, nombre, sub, etiqueta, color, activo, hover, apagado, className, style, ref, onClick, onHover }: PropsPin) {
  return (
    <button
      ref={ref}
      className={['pin', activo && 'activo', hover && 'hover', apagado && 'apagado', className].filter(Boolean).join(' ')}
      style={{ ['--color' as string]: color ?? colorDe(id), ...style }}
      onClick={onClick}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      aria-label={etiqueta}
      data-lugar={id}
    >
      <span className="pin-num" aria-hidden="true">
        {num}
      </span>
      <span className="pin-nombre" aria-hidden="true">
        <strong>{nombre}</strong>
        <small>{sub}</small>
      </span>
    </button>
  )
}
