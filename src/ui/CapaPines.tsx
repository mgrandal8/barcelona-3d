import { useEffect, useRef } from 'react'
import { useLugares, useT, useTour } from '../i18n'
import { useEstado } from '../store'
import { alFotograma, pantalla, useGrupos } from '../pines'
import { Pin } from './Pin'
import { colorDe } from './colores'

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

type Zona = { l: number; t: number; r: number; b: number }
/**
 * Zonas para las flechas del borde (se miden cada medio segundo): la pantalla menos el menú y la barra de abajo
 * y, si la flecha cayera encima de la lista de lugares, otra zona que la deja fuera.
 */
let zonas = { borde: { l: 0, t: 0, r: 0, b: 0 }, sinLista: null as Zona | null, lista: null as DOMRect | null, cuando: -1 }
function medirZonas() {
  const ahora = performance.now()
  if (ahora - zonas.cuando < 500) return zonas
  const [w, h] = [innerWidth, innerHeight]
  const borde = { l: 12, t: 12, r: w - 12, b: h - 12 }
  const lista = document.querySelector('.lista')?.getBoundingClientRect() ?? null
  const menu = document.querySelector('.menu')?.getBoundingClientRect()
  let sinLista: Zona | null = null
  if (w <= 720) {
    // en móvil la lista va arriba y el menú abajo
    if (menu) borde.b = Math.min(borde.b, menu.top - 8)
    if (lista) sinLista = { ...borde, t: Math.max(borde.t, lista.bottom + 8) }
  } else {
    if (menu) borde.t = Math.max(borde.t, menu.bottom + 8)
    borde.b = h - 64
    if (lista) sinLista = { ...borde, l: Math.max(borde.l, lista.right + 10) }
  }
  zonas = { borde, sinLista, lista, cuando: ahora }
  return zonas
}

/** Corta la semirrecta desde el centro de la zona en la dirección (dx, dy) con su borde. */
function cortar(z: Zona, dx: number, dy: number, margen = 22) {
  const cx = (z.l + z.r) / 2
  const cy = (z.t + z.b) / 2
  const kx = dx ? (dx > 0 ? z.r - margen - cx : z.l + margen - cx) / dx : Infinity
  const ky = dy ? (dy > 0 ? z.b - margen - cy : z.t + margen - cy) / dy : Infinity
  const k = Math.min(kx, ky)
  return { x: cx + dx * k, y: cy + dy * k }
}

/** Lleva el punto (x, y) al borde de la pantalla, en la dirección desde el centro; da también el ángulo. */
function alBorde(x: number, y: number, detras: boolean) {
  const { borde, sinLista, lista } = medirZonas()
  const cx = (borde.l + borde.r) / 2
  const cy = (borde.t + borde.b) / 2
  let [dx, dy] = [x - cx, y - cy]
  if (detras) [dx, dy] = [-dx, -dy]
  let p = cortar(borde, dx, dy)
  const encima = lista && lista.width > 0 && p.x > lista.left - 20 && p.x < lista.right + 20 && p.y > lista.top - 20 && p.y < lista.bottom + 20
  if (encima && sinLista) {
    const s = detras ? -1 : 1
    p = cortar(sinLista, s * (x - (sinLista.l + sinLista.r) / 2), s * (y - (sinLista.t + sinLista.b) / 2))
  }
  return { ...p, ang: Math.atan2(dy, dx) }
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
  const flechas = useRef<(HTMLButtonElement | null)[]>([])
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
          const f = flechas.current[i]
          if (!f) return
          const fuera = !!pantalla.fuera[i]
          mostrar(f, fuera)
          if (!fuera) return
          const p = alBorde(pantalla.x[i] ?? 0, pantalla.y[i] ?? 0, !!pantalla.detras[i])
          f.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`
          f.style.setProperty('--ang', `${p.ang.toFixed(3)}rad`)
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
      {/* lugares fuera de la pantalla en la vista general: una flecha en el borde que lleva a ellos */}
      {lugares.map((m, i) => {
        const p = paradas.indexOf(m.id)
        const n = num(m.id)
        return (
          <button
            key={'borde-' + m.id}
            ref={(b) => {
              flechas.current[i] = b
            }}
            className="pin-borde"
            style={{ ['--color' as string]: p >= 0 && tour ? tour.color : colorDe(m.id) }}
            aria-label={t.pines.fuera(`${n}. ${m.nombre}`)}
            title={m.nombre}
            data-ver="0"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setSeleccionado(m.id)}
          >
            <span className="pin-borde-flecha" aria-hidden="true" />
            <span className="pin-borde-num" aria-hidden="true">
              {n}
            </span>
          </button>
        )
      })}
      {grupos.map((g) => {
        const miembros = g.map((id) => lugares[indice(id)])
        const nums = g.map(num)
        const nombres = miembros.map((m) => m.nombre)
        // el nombre accesible empieza por lo que se ve en el pin (WCAG 2.5.3)
        const visible = nums.length <= 3 ? nums.join(' · ') : t.pines.lugares(nums.length)
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
            aria-label={t.pines.grupo(visible, nombres.join(', '))}
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
              {visible}
            </span>
          </button>
        )
      })}
    </div>
  )
}
