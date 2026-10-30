import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PE, type WheelEvent as WE } from 'react'
import { useLugares, useT, useTour } from '../i18n'
import { useEstado } from '../store'
import { cargarPlano, type Plano } from '../scene/datos'
import { ESCALA } from '../scene/geo'
import { sondeo } from '../calidad'

// Versión ligera, sin three: el mapa del suelo en 2D (el mismo que pinta la maqueta), con los lugares,
// la ruta del tour y tu posición. La lista, las fichas, los tours y la ayuda son los de siempre.

type Vista = { s: number; ox: number; oy: number }

/** Escena (x, z) → píxel de la imagen del plano. */
function aImagen(p: Plano, ancho: number, x: number, z: number) {
  const { uMin, uMax, vMin } = p.meta.rect
  const metrosPx = (uMax - uMin) / ancho
  return [(x * ESCALA - uMin) / metrosPx, (z * ESCALA - vMin) / metrosPx] as const
}

/** Encaja el plano entero en el recuadro. */
function encajar(iw: number, ih: number, w: number, h: number): Vista {
  const s = Math.min(w / iw, h / ih) * 0.96
  return { s, ox: (w - iw * s) / 2, oy: (h - ih * s) / 2 }
}

export function VersionLigera() {
  const t = useT().ligera
  const lugares = useLugares()
  const seleccionado = useEstado((s) => s.seleccionado)
  const hover = useEstado((s) => s.hover)
  const ubicacion = useEstado((s) => s.ubicacion)
  const tour = useTour(useEstado((s) => s.tour))
  const [plano, setPlano] = useState<Plano | null>(null)
  const [tam, setTam] = useState({ w: innerWidth, h: innerHeight })
  const [vista, setVista] = useState<Vista | null>(null)
  const caja = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let vigente = true
    cargarPlano().then(
      (p) => {
        if (!vigente) return
        setPlano(p)
        useEstado.getState().setCarga({ progreso: 1, texto: 'listo', listo: true })
      },
      () => vigente && useEstado.getState().setFallo('datos'),
    )
    return () => {
      vigente = false
    }
  }, [])

  useLayoutEffect(() => {
    const c = caja.current!
    const ro = new ResizeObserver(() => setTam({ w: c.clientWidth, h: c.clientHeight }))
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  const iw = plano?.imagen.width ?? 1
  const ih = plano?.imagen.height ?? 1
  const v = vista ?? encajar(iw, ih, tam.w, tam.h)
  const minS = encajar(iw, ih, tam.w, tam.h).s * 0.8
  const maxS = minS * 16

  // dibujo: el plano y, encima, la ruta del tour
  useEffect(() => {
    const c = lienzo.current
    if (!c || !plano) return
    const dpr = Math.min(2, devicePixelRatio || 1)
    c.width = Math.round(tam.w * dpr)
    c.height = Math.round(tam.h * dpr)
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.ox, dpr * v.oy)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(plano.imagen, 0, 0)
    if (tour) {
      const pts = tour.paradas.flatMap((p) => {
        const m = lugares.find((l) => l.id === p.id)
        return m ? [aImagen(plano, iw, m.pos[0], m.pos[1])] : []
      })
      ctx.strokeStyle = tour.color
      ctx.lineWidth = 4 / v.s
      ctx.setLineDash([10 / v.s, 8 / v.s])
      ctx.lineCap = 'round'
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
    }
  }, [plano, tam, v.s, v.ox, v.oy, tour, lugares, iw])

  /** Escala `f` alrededor del punto (px, py) de la pantalla. */
  const zoom = (f: number, px = tam.w / 2, py = tam.h / 2) => {
    const s = Math.min(maxS, Math.max(minS, v.s * f))
    const k = s / v.s
    setVista({ s, ox: px - (px - v.ox) * k, oy: py - (py - v.oy) * k })
  }

  // al elegir un lugar (aquí o en la lista) se centra, dejando sitio a la ficha: a la derecha en escritorio, abajo en móvil
  useEffect(() => {
    if (!plano || !seleccionado) return
    const m = lugares.find((l) => l.id === seleccionado)
    if (!m) return
    const [x, y] = aImagen(plano, iw, m.pos[0], m.pos[1])
    const movil = tam.w <= 720
    setVista((anterior) => {
      const s = Math.max((anterior ?? encajar(iw, ih, tam.w, tam.h)).s, minS * 3)
      return { s, ox: tam.w * (movil ? 0.5 : 0.38) - x * s, oy: tam.h * (movil ? 0.25 : 0.5) - y * s }
    })
    // solo al cambiar de lugar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado, plano])

  // arrastrar con un dedo o el ratón; pellizcar con dos
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const abajo = (e: PE) => {
    if ((e.target as HTMLElement).closest('button')) return
    caja.current!.setPointerCapture(e.pointerId)
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const mover = (e: PE) => {
    const p = punteros.current
    const antes = p.get(e.pointerId)
    if (!antes) return
    const ahora = { x: e.clientX, y: e.clientY }
    if (p.size === 1) {
      setVista({ ...v, ox: v.ox + ahora.x - antes.x, oy: v.oy + ahora.y - antes.y })
    } else if (p.size === 2) {
      const otro = [...p.entries()].find(([id]) => id !== e.pointerId)![1]
      const d0 = Math.hypot(antes.x - otro.x, antes.y - otro.y)
      const d1 = Math.hypot(ahora.x - otro.x, ahora.y - otro.y)
      const r = caja.current!.getBoundingClientRect()
      if (d0 > 0) zoom(d1 / d0, (ahora.x + otro.x) / 2 - r.left, (ahora.y + otro.y) / 2 - r.top)
    }
    p.set(e.pointerId, ahora)
  }
  const arriba = (e: PE) => punteros.current.delete(e.pointerId)
  const rueda = (e: WE) => {
    const r = caja.current!.getBoundingClientRect()
    zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
  }

  const enPantalla = (x: number, z: number) => {
    const [ix, iy] = aImagen(plano!, iw, x, z)
    return { left: v.ox + ix * v.s, top: v.oy + iy * v.s }
  }
  const { setSeleccionado, setHover } = useEstado.getState()

  return (
    <div
      ref={caja}
      className="plano"
      data-listo={plano ? '1' : '0'}
      role="region"
      aria-label={t.mapa}
      onPointerDown={abajo}
      onPointerMove={mover}
      onPointerUp={arriba}
      onPointerCancel={arriba}
      onWheel={rueda}
    >
      <canvas ref={lienzo} style={{ width: tam.w, height: tam.h }} aria-hidden="true" />
      {plano &&
        lugares.map((m, i) => (
          <button
            key={m.id}
            className={['plano-pin', m.id === seleccionado && 'activo', m.id === hover && 'hover'].filter(Boolean).join(' ')}
            style={enPantalla(m.pos[0], m.pos[1])}
            onClick={() => setSeleccionado(m.id)}
            onPointerEnter={() => setHover(m.id)}
            onPointerLeave={() => setHover(null)}
            aria-label={`${i + 1}. ${m.nombre}`}
            title={m.nombre}
          >
            {i + 1}
            {(m.id === seleccionado || m.id === hover) && <span>{m.nombre}</span>}
          </button>
        ))}
      {plano && ubicacion?.dentro && <span className="plano-yo" style={enPantalla(ubicacion.x, ubicacion.z)} title={t.tuPosicion} />}
      {!plano && <p className="plano-cargando">{t.cargando}</p>}
      <div className="plano-zoom">
        <button onClick={() => zoom(1.5)} aria-label={t.acercar} title={t.acercar}>
          +
        </button>
        <button onClick={() => zoom(1 / 1.5)} aria-label={t.alejar} title={t.alejar}>
          −
        </button>
        <button onClick={() => setVista(null)} aria-label={t.todo} title={t.todo}>
          ⤢
        </button>
      </div>
    </div>
  )
}

/** Aviso de la versión ligera; si hay WebGL, deja volver a la maqueta. */
export function AvisoLigera() {
  const t = useT().ligera
  return (
    <p className="ligera-aviso" role="status">
      {sondeo.webgl ? t.aviso : t.sinWebgl}
      {sondeo.webgl && <button onClick={() => useEstado.getState().setModo('3d')}>{t.probar3d}</button>}
    </p>
  )
}
