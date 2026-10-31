import { useEffect, useRef } from 'react'
import { alFotogramaNombres, pantallaNombres as P, useNombres } from '../nombres'
import { useEstado } from '../store'

// Nombres de distritos, barrios y calles encima de la maqueta, por debajo de los pines. Son decorativos
// (la lista y las fichas ya dicen dónde está cada lugar): sin foco, sin clics y ocultos al lector de pantalla.
// Dónde va cada uno y cuáles caben lo calcula scene/Nombres.tsx; aquí solo se mueven.

const CLASE = ['nombre-distrito', 'nombre-barrio', 'nombre-calle']

export function CapaNombres() {
  const nombres = useNombres()
  const noche = useEstado((s) => s.momento) === 'noche'
  const textos = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(
    () =>
      alFotogramaNombres(() => {
        textos.current.forEach((s, i) => {
          if (!s) return
          const ver = P.ver[i] ? '1' : '0'
          if (s.dataset.ver !== ver) s.dataset.ver = ver
          // los ocultos se desvanecen donde estaban
          if (ver === '1')
            s.style.transform = `translate3d(${(P.x[i] ?? 0).toFixed(1)}px, ${(P.y[i] ?? 0).toFixed(1)}px, 0) translate(-50%, -50%) rotate(${(P.ang[i] ?? 0).toFixed(1)}deg)`
        })
      }),
    [nombres],
  )

  if (!nombres) return null
  return (
    <div className={`capa-nombres ${noche ? 'de-noche' : ''}`} aria-hidden="true">
      {nombres.map((n, i) => (
        <span
          key={i}
          ref={(s) => {
            textos.current[i] = s
          }}
          className={CLASE[n.l]}
          data-ver="0"
        >
          {n.n}
        </span>
      ))}
    </div>
  )
}
