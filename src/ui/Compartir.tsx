import { useEffect, useMemo, useRef, useState } from 'react'
import { MONUMENTOS } from '../data/monumentos'
import { traducirLugar, traducirTour, useT } from '../i18n'
import { tourPorId } from '../data/tours'
import { useEstado } from '../store'
import { escena } from '../captura'
import { pantalla } from '../pines'
import { colorDe } from './colores'
import { Icono } from './Icono'
import type { Textos } from '../i18n/es'

// Compartir: el enlace a lo que se está viendo (lugar o tour, hora del día, metro y, en la vista general, la
// posición de la cámara) y una imagen de 1200 × 630 para redes, hecha con el último fotograma de la maqueta,
// los pines y un rótulo con el lugar.

const ANCHO = 1200
const ALTO = 630
/** Parámetros que no se comparten: son de pruebas o de este dispositivo. */
const PRIVADOS = ['captura', 'entrada', 'cam', 'vista', 'modo', 'calidad', 'postpro', 'nombres', 'dominio']

function enlaceCompartir() {
  const url = new URL(location.href)
  PRIVADOS.forEach((k) => url.searchParams.delete(k))
  url.hash = ''
  // con un lugar abierto basta con el lugar (se llega volando); si no, la vista de la cámara
  const vista = escena.vista?.()
  if (!useEstado.getState().seleccionado && vista) url.searchParams.set('vista', vista.join(','))
  // las comas de la vista se leen mejor sin escapar (también son válidas en la consulta)
  return url.toString().replace(/%2C/g, ',')
}

/** Título y subtítulo del rótulo (y del texto al compartir). */
function rotulo(t: Textos) {
  const s = useEstado.getState()
  const m = MONUMENTOS.find((x) => x.id === s.seleccionado)
  const lugar = m && traducirLugar(m, s.idioma)
  const tourBase = tourPorId(s.tour)
  const tour = tourBase && traducirTour(tourBase, s.idioma)
  const hora = s.momento === 'dia' ? '' : ` · ${t.hora[s.momento]}`
  if (tour && lugar) {
    const i = tour.paradas.findIndex((p) => p.id === lugar.id)
    return { titulo: tour.nombre, sub: `${lugar.nombre} · ${t.panel.parada(i + 1, tour.paradas.length)}${hora}`, nombre: tour.nombre }
  }
  if (lugar) return { titulo: lugar.nombre, sub: `${lugar.etiqueta} · ${lugar.barrio}${hora}`, nombre: lugar.nombre }
  return { titulo: t.compartir.general, sub: `${t.compartir.lema}${hora}`, nombre: 'Barcelona' }
}

/** Texto a la medida: baja el tamaño hasta que quepa en `ancho`. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, peso: number, tam: number, ancho: number) {
  for (; tam > 16; tam -= 2) {
    ctx.font = `${peso} ${tam}px system-ui, -apple-system, 'Segoe UI', sans-serif`
    if (ctx.measureText(texto).width <= ancho) break
  }
}

async function componerImagen(t: Textos): Promise<Blob | null> {
  const foto = await escena.foto?.()
  if (!foto) return null
  const c = document.createElement('canvas')
  c.width = ANCHO
  c.height = ALTO
  const ctx = c.getContext('2d')
  if (!ctx) return null

  // recorte «cover», centrado en el lugar elegido si lo hay (la ficha lo corre a un lado)
  const s = useEstado.getState()
  const css = document.querySelector<HTMLElement>('.maqueta')?.clientWidth || innerWidth
  const k = foto.width / css
  const i = MONUMENTOS.findIndex((m) => m.id === s.seleccionado)
  const cx = i >= 0 ? pantalla.baseX[i] * k : foto.width / 2
  const cy = i >= 0 ? pantalla.baseY[i] * k : foto.height / 2
  let [sw, sh] = [foto.width, foto.height]
  if (sw / sh > ANCHO / ALTO) sw = sh * (ANCHO / ALTO)
  else sh = sw / (ANCHO / ALTO)
  const sx = Math.min(foto.width - sw, Math.max(0, cx - sw / 2))
  // la base del lugar, un poco por debajo del centro: el edificio cabe por encima y el rótulo no lo tapa
  const sy = Math.min(foto.height - sh, Math.max(0, cy - sh * (i >= 0 ? 0.62 : 0.5)))
  ctx.drawImage(foto, sx, sy, sw, sh, 0, 0, ANCHO, ALTO)
  const escala = ANCHO / sw

  // pines: en un tour, sus paradas con el número de parada; si no, los lugares con el número de la guía
  const paradas = tourPorId(s.tour)?.paradas.map((p) => p.id) ?? []
  const color = tourPorId(s.tour)?.color
  MONUMENTOS.forEach((m, j) => {
    const parada = paradas.indexOf(m.id)
    if (paradas.length && parada < 0) return
    // el lugar elegido no lleva pin en la maqueta, pero en la imagen sí
    if (!pantalla.ver[j] && m.id !== s.seleccionado) return
    const x = (pantalla.x[j] * k - sx) * escala
    const y = (pantalla.y[j] * k - sy) * escala
    if (x < 20 || x > ANCHO - 20 || y < 40 || y > ALTO - 150) return
    const r = 17
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 8
    ctx.fillStyle = parada >= 0 && color ? color : colorDe(m.id)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 7, y - r)
    ctx.lineTo(x + 7, y - r)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y - r - 12, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff'
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = "700 17px system-ui, -apple-system, 'Segoe UI', sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(parada >= 0 ? parada + 1 : j + 1), x, y - r - 11)
  })

  // rótulo sobre un degradado oscuro
  const g = ctx.createLinearGradient(0, ALTO - 230, 0, ALTO)
  g.addColorStop(0, 'rgba(32, 26, 23, 0)')
  g.addColorStop(0.55, 'rgba(32, 26, 23, 0.72)')
  g.addColorStop(1, 'rgba(32, 26, 23, 0.9)')
  ctx.fillStyle = g
  ctx.fillRect(0, ALTO - 230, ANCHO, 230)
  const { titulo, sub } = rotulo(t)
  const margen = 56
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#f4b8a4'
  ctx.font = "800 20px system-ui, -apple-system, 'Segoe UI', sans-serif"
  ctx.fillText('BARCELONA 3D', margen, ALTO - 128)
  ctx.fillStyle = '#fff'
  ajustar(ctx, titulo, 800, 56, ANCHO - margen * 2)
  ctx.fillText(titulo, margen, ALTO - 72)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
  ajustar(ctx, sub, 500, 25, ANCHO - margen * 2 - 260)
  ctx.fillText(sub, margen, ALTO - 34)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = "600 19px system-ui, -apple-system, 'Segoe UI', sans-serif"
  // ?dominio= lo usa scripts/imagenes-og.mjs, que captura en local las imágenes de la web publicada
  ctx.fillText(new URLSearchParams(location.search).get('dominio') ?? location.host, ANCHO - margen, ALTO - 34)

  return new Promise((r) => c.toBlob(r, 'image/png'))
}

/** Contenido del diálogo «Compartir». */
export function Compartir() {
  const t = useT()
  const tc = t.compartir
  const enlace = useMemo(enlaceCompartir, [])
  const conImagen = !!escena.foto
  const [imagen, setImagen] = useState<Blob | null | 'cargando'>(conImagen ? 'cargando' : null)
  const [copiado, setCopiado] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const url = useMemo(() => (imagen instanceof Blob ? URL.createObjectURL(imagen) : null), [imagen])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  useEffect(() => {
    if (!conImagen) return
    let vigente = true
    componerImagen(t)
      .catch(() => null)
      .then((b) => vigente && setImagen(b))
    return () => {
      vigente = false
    }
    // la imagen es de lo que se veía al abrir el diálogo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { nombre } = rotulo(t)
  const archivo = `barcelona-3d-${nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.png`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace)
    } catch {
      // sin permiso para el portapapeles: se selecciona el enlace para copiarlo a mano
      campo.current?.select()
      document.execCommand?.('copy')
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const nativo = typeof navigator.share === 'function'
  const compartir = async () => {
    const datos: ShareData = { title: t.tituloPagina, text: tc.texto(nombre), url: enlace }
    const fichero = imagen instanceof Blob ? new File([imagen], archivo, { type: 'image/png' }) : null
    try {
      if (fichero && navigator.canShare?.({ files: [fichero] })) await navigator.share({ ...datos, files: [fichero] })
      else await navigator.share(datos)
    } catch (e) {
      // cancelar no es un error; si falla con la imagen, se prueba solo con el enlace
      if ((e as DOMException).name !== 'AbortError' && fichero) await navigator.share(datos).catch(() => {})
    }
  }

  return (
    <div className="compartir">
      <p className="dialogo-intro">{tc.intro}</p>
      {conImagen && (
        <figure className="compartir-imagen" aria-busy={imagen === 'cargando'}>
          {url ? <img src={url} alt={tc.imagen} width={ANCHO} height={ALTO} /> : <span>{imagen === 'cargando' ? tc.preparando : ''}</span>}
        </figure>
      )}
      {!conImagen && <p className="panel-aviso">{tc.sinImagen}</p>}
      <label className="compartir-enlace">
        <span>{tc.enlace}</span>
        <input ref={campo} readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <div className="compartir-botones">
        {nativo && (
          <button className="primario" onClick={compartir}>
            <Icono nombre="compartir" /> {tc.compartir}
          </button>
        )}
        <button className={nativo ? '' : 'primario'} onClick={copiar} aria-live="polite">
          <Icono nombre={copiado ? 'check' : 'enlace'} /> {copiado ? tc.copiado : tc.copiar}
        </button>
        {url && (
          <a className="boton" href={url} download={archivo}>
            <Icono nombre="descargar" /> {tc.descargar}
          </a>
        )}
      </div>
    </div>
  )
}
