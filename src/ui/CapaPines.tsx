import { useEffect, useRef } from 'react'
import { useLugares, useT, useTour } from '../i18n'
import { useEstado } from '../store'
import { alFotograma, pantalla, useGrupos } from '../pines'
import { Pin } from './Pin'

// Pines de la maqueta como botones HTML encima del canvas: se leen igual desde la vista general que de
// cerca, se enfocan con el teclado, se juntan si se solapan y se esconden si un edificio los tapa.
// Dónde va cada uno lo calcula scene/Pines.tsx; aquí solo se mueven, sin re-render por fotograma.

const mover = (b: HTMLElement, x: number, y: number) => {
  b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`
}

/** Muestra u oculta un pin: oculto no recibe clics ni foco, ni lo lee el lector de pantalla. */
function mostrar(b: HTMLElement, ver: boolean) {
  const valor = ver ? '1' : '0'
  if (b.dataset.ver === valor) return
  b.dataset.ver = valor
  b.tabIndex = ver ? 0 : -1
  b.setAttribute('aria-hidden', String(!ver))
}

export function CapaPines() {
  const lugares = useLugares()
  const tour = useTour(useEstado((s) => s.tour))
  const seleccionado = useEstado((s) => s.seleccionado)
  const hover = useEstado((s) => s.hover)
  const portada = useEstado((s) => s.portada)
  const grupos = useGrupos()
  const t = useT()
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const botonesGrupo = useRef(new Map<string, HTMLButtonElement>())
  const indice = (id: string) => lugares.findIndex((m) => m.id === id)

  useEffect(
    () =>
      alFotograma(() => {
        const enGrupo = new Set(pantalla.grupos.flat())
        lugares.forEach((m, i) => {
          const b = botones.current[i]
          if (!b) return
          mover(b, pantalla.x[i] ?? 0, pantalla.y[i] ?? 0)
          mostrar(b, !!pantalla.ver[i] && !enGrupo.has(m.id))
        })
        for (const g of pantalla.grupos) {
          const b = botonesGrupo.current.get(g.join('+'))
          if (!b) continue
          const is = g.map((id) => lugares.findIndex((m) => m.id === id))
          mover(b, is.reduce((s, i) => s + pantalla.x[i], 0) / is.length, is.reduce((s, i) => s + pantalla.y[i], 0) / is.length)
          mostrar(b, true)
        }
      }),
    [lugares],
  )

  const paradas = tour?.paradas.map((p) => p.id) ?? []
  const num = (id: string) => (paradas.includes(id) ? paradas.indexOf(id) + 1 : indice(id) + 1)
  const { setSeleccionado, setHover, volarA } = useEstado.getState()

  return (
    <div className="capa-pines" inert={portada}>
      {lugares.map((m, i) => {
        const p = paradas.indexOf(m.id)
        const n = num(m.id)
        const parada = tour && p >= 0 ? t.panel.parada(n, paradas.length) : null
        return (
          <Pin
            key={m.id}
            ref={(b) => {
              botones.current[i] = b
            }}
            id={m.id}
            num={n}
            nombre={m.nombre}
            sub={parada ?? m.barrio}
            etiqueta={parada ? `${m.nombre}, ${parada}` : `${n}. ${m.nombre}`}
            color={p >= 0 ? tour?.color : undefined}
            activo={m.id === seleccionado}
            hover={m.id === hover}
            apagado={!!tour && p < 0}
            onClick={() => setSeleccionado(m.id)}
            onHover={(dentro) => (dentro ? setHover(m.id) : useEstado.getState().hover === m.id && setHover(null))}
          />
        )
      })}
      {grupos.map((g) => {
        const miembros = g.map((id) => lugares[indice(id)])
        const nums = g.map(num)
        const nombres = miembros.map((m) => m.nombre)
        const clave = g.join('+')
        return (
          <button
            key={clave}
            ref={(b) => {
              if (b) botonesGrupo.current.set(clave, b)
              else botonesGrupo.current.delete(clave)
            }}
            className="pin pin-grupo"
            style={tour && g.some((id) => paradas.includes(id)) ? { ['--color' as string]: tour.color } : undefined}
            aria-label={t.pines.grupo(nombres.join(', '))}
            title={nombres.join(' · ')}
            onClick={() => {
              // se acerca lo justo para que los pines del grupo se separen
              const pts = miembros.map((m) => m.pos)
              const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
              const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length
              const ancho = Math.max(...pts.flatMap((a) => pts.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]))))
              volarA(cx, cz, Math.min(45, Math.max(5, ancho * 8)))
            }}
          >
            <span className="pin-num" aria-hidden="true">
              {nums.length <= 3 ? nums.join(' · ') : t.pines.lugares(nums.length)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
