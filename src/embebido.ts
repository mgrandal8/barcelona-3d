import { MONUMENTOS, porId, type Monumento, type Reserva } from './data/monumentos'
import { TOURS, tourPorId, type Tour } from './data/tours'
import { ajustarTraduccionLugar, ponerTraduccionesTours } from './i18n/textos'
import { IDIOMAS, type Idioma } from './i18n/idioma'
import { MOMENTOS, type Momento } from './scene/momento'
import { useEstado } from './store'

// Modo embebido (?embed=1): la guía dentro de un iframe de otra web (p. ej. Lokalu), que pone sus propios datos y reservas.
//
//   ?embed=1                     sin portada, sin service worker ni analítica (la web anfitriona cuenta lo suyo)
//   &datos=<url del JSON>        lugares y tours de la anfitriona (formato en docs/embebido.md y public/embebido/ejemplo.json)
//   &origen=<https://anfitrion>  origen al que se mandan los mensajes y del único que se aceptan (sin él, «*» y cualquiera)
//
// El JSON solo se acepta del mismo origen que la guía o de los orígenes de VITE_EMBED_ORIGENES (separados por comas):
// si no, cualquiera podría enseñar en esta web precios o enlaces de reserva falsos con un enlace preparado.
//
// Mensajes a la anfitriona (window.parent.postMessage), todos con { fuente: 'barcelona-3d', version: 1, tipo, … }:
//   listo      la guía ya se ve: { lugares: ids[], tours: ids[], idioma, modo, datos: 'externos' | 'demo' | 'error' }
//   seleccion  ficha abierta o cerrada: { lugar, tour }
//   reservar   botón «Reservar»: { lugar, tour, reserva (el id del JSON), idioma, momento }
//   error      algo ha fallado: { mensaje }
// Mensajes que acepta: { tipo: 'abrir', lugar } (null cierra la ficha), { tipo: 'tour', id, reproducir? },
//   { tipo: 'idioma', idioma }, { tipo: 'hora', momento }.

const params = new URLSearchParams(location.search)
export const EMBEBIDO = params.has('embed')
export const FUENTE = 'barcelona-3d'

/** Origen de la anfitriona, si lo da el enlace y es un origen válido. */
const ORIGEN = (() => {
  const o = params.get('origen')
  if (!o) return null
  try {
    const u = new URL(o)
    return /^https?:$/.test(u.protocol) ? u.origin : null
  } catch {
    return null
  }
})()

const enIframe = () => {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

/** Manda un mensaje a la anfitriona; devuelve false si la guía no está embebida en un iframe. */
export function avisar(tipo: string, datos: Record<string, unknown> = {}) {
  if (!EMBEBIDO || !enIframe()) return false
  window.parent.postMessage({ fuente: FUENTE, version: 1, tipo, ...datos }, ORIGEN ?? '*')
  return true
}

/** «Reservar»: se avisa a la anfitriona; fuera de un iframe se abre la URL de la reserva, si la hay. */
export function reservar(r: Reserva, lugar: string | null, tour: string | null) {
  const s = useEstado.getState()
  if (avisar('reservar', { lugar, tour, reserva: r.id ?? null, idioma: s.idioma, momento: s.momento })) return
  if (r.url) window.open(r.url, '_blank', 'noopener')
}

// --- datos externos ---

export type EstadoDatos = 'demo' | 'externos' | 'error'
export let estadoDatos: EstadoDatos = 'demo'
/** Nombre de la anfitriona (lo dice la ficha: «Horario y precio de Lokalu»). */
export let anfitrion: string | null = null
/** El JSON trae sus propios tours (el diálogo deja de decir «de ejemplo»). */
export let toursPropios = false

const LARGO = 2000
const texto = (x: unknown, largo = LARGO) => (typeof x === 'string' && x.trim() && x.length <= largo ? x.trim() : undefined)
const httpsUrl = (x: unknown) => {
  const s = texto(x, 500)
  if (!s) return undefined
  try {
    return new URL(s).protocol === 'https:' ? s : undefined
  } catch {
    return undefined
  }
}
const objeto = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null)

function leerReserva(x: unknown): Reserva | undefined {
  if (x === true) return {}
  const o = objeto(x)
  if (!o) return undefined
  return { id: texto(o.id, 200), url: httpsUrl(o.url) }
}

const CAMPOS_LUGAR = ['nombre', 'etiqueta', 'barrio', 'descripcion', 'horario', 'precio', 'duracion', 'consejo'] as const
const CAMPOS_TRADUCIBLES = ['nombre', 'etiqueta', 'descripcion', 'horario', 'precio', 'duracion', 'consejo']

/** Campos de texto válidos de un objeto (solo los de la lista). */
function textos(o: Record<string, unknown>, campos: readonly string[]) {
  const r: Record<string, string> = {}
  for (const c of campos) {
    const v = texto(o[c])
    if (v) r[c] = v
  }
  return r
}

function aplicarLugares(lugares: Record<string, unknown>, avisos: string[]) {
  for (const [id, x] of Object.entries(lugares)) {
    const m = porId(id)
    const o = objeto(x)
    // solo lugares que ya están en la maqueta: un lugar nuevo necesitaría su modelo 3D
    if (!m || !o) {
      avisos.push(`lugar desconocido: ${id}`)
      continue
    }
    const cambios = textos(o, CAMPOS_LUGAR) as Partial<Monumento>
    Object.assign(m, cambios)
    if ('reserva' in o) m.reserva = leerReserva(o.reserva)
    if ('web' in o) m.web = httpsUrl(o.web)
    // si cambia el horario o el precio, ya no son los «de la web oficial consultados el …»
    if ((cambios.horario || cambios.precio) && !('web' in o)) m.web = undefined
    if (cambios.horario || cambios.precio) m.fuenteDatos = anfitrion ?? undefined
    const propias: Partial<Record<Idioma, Record<string, string>>> = {}
    for (const i of IDIOMAS) {
      const t = objeto(o[i])
      if (t && i !== 'es') propias[i] = textos(t, CAMPOS_TRADUCIBLES)
    }
    ajustarTraduccionLugar(id, Object.keys(cambios), propias)
  }
}

function leerTour(x: unknown, avisos: string[]): { tour: Tour; trad: Partial<Record<Idioma, { nombre: string; resumen: string; duracion: string; precio: string; notas: string[] }>> } | null {
  const o = objeto(x)
  const id = o && texto(o.id, 60)
  if (!o || !id || !/^[a-z0-9-]+$/.test(id)) {
    avisos.push('tour sin id válido')
    return null
  }
  const paradas = (Array.isArray(o.paradas) ? o.paradas : [])
    .map((p) => objeto(p))
    .filter((p): p is Record<string, unknown> => !!p && !!porId(String(p.id)))
    .map((p) => ({ id: String(p.id), nota: texto(p.nota) ?? '' }))
  if (paradas.length < 2 || paradas.length > 12) {
    avisos.push(`tour ${id}: necesita de 2 a 12 paradas que sean lugares de la maqueta`)
    return null
  }
  const base = tourPorId(id)
  const color = typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : (base?.color ?? '#d8603f')
  const iconos = ['lagarto', 'velero', 'luna', 'estrella', 'brujula', 'guia', 'sol'] as const
  const icono = iconos.includes(o.icono as (typeof iconos)[number]) ? (o.icono as Tour['icono']) : (base?.icono ?? 'estrella')
  const tour: Tour = {
    id,
    nombre: texto(o.nombre, 120) ?? id,
    resumen: texto(o.resumen) ?? '',
    duracion: texto(o.duracion, 60) ?? '',
    precio: texto(o.precio, 120) ?? '',
    momento: MOMENTOS.includes(o.momento as Momento) ? (o.momento as Momento) : 'dia',
    icono,
    color,
    paradas,
    reserva: leerReserva(o.reserva),
  }
  const trad: Partial<Record<Idioma, { nombre: string; resumen: string; duracion: string; precio: string; notas: string[] }>> = {}
  for (const i of ['ca', 'en'] as const) {
    const t = objeto(o[i])
    if (!t) continue
    const notas = Array.isArray(t.notas) ? t.notas.map((n) => texto(n) ?? '') : []
    trad[i] = {
      nombre: texto(t.nombre, 120) ?? tour.nombre,
      resumen: texto(t.resumen) ?? tour.resumen,
      duracion: texto(t.duracion, 60) ?? tour.duracion,
      precio: texto(t.precio, 120) ?? tour.precio,
      notas: paradas.map((p, k) => notas[k] || p.nota),
    }
  }
  return { tour, trad }
}

/** Valida el JSON y lo aplica a los lugares y tours (se llama antes de pintar la interfaz). Devuelve los avisos. */
export function aplicarDatos(json: unknown): string[] {
  const avisos: string[] = []
  const o = objeto(json)
  if (!o || o.version !== 1) throw new Error('datos externos: falta "version": 1')
  anfitrion = texto(o.anfitrion, 80) ?? null
  const lugares = objeto(o.lugares)
  if (lugares) aplicarLugares(lugares, avisos)
  if (Array.isArray(o.tours)) {
    const leidos = o.tours.map((t) => leerTour(t, avisos)).filter((t) => !!t)
    // sin ningún tour válido se quedan los de la demo
    if (leidos.length) {
      TOURS.splice(0, TOURS.length, ...leidos.map((l) => l.tour))
      ponerTraduccionesTours(Object.fromEntries(leidos.map((l) => [l.tour.id, l.trad])))
      toursPropios = true
    }
  }
  // el estado se calculó con los tours de antes: un ?tour= de la anfitriona se vuelve a mirar
  const s = useEstado.getState()
  const t = tourPorId(params.get('tour') ?? s.tour)
  const tour = t && s.seleccionado && t.paradas.some((p) => p.id === s.seleccionado) ? t.id : null
  if (tour !== s.tour) useEstado.setState({ tour })
  return avisos
}

/** El JSON se acepta del mismo origen o de los orígenes configurados en el build. */
export function origenPermitido(url: URL) {
  const extra = ((import.meta.env.VITE_EMBED_ORIGENES as string | undefined) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return url.origin === location.origin || extra.includes(url.origin)
}

/** Descarga y aplica ?datos=. Si falla, la guía sigue con los datos de la demo y se avisa a la anfitriona. */
export async function cargarDatosExternos() {
  const datos = params.get('datos')
  if (!EMBEBIDO || !datos) return
  try {
    const url = new URL(datos, location.href)
    if (!origenPermitido(url)) throw new Error(`datos externos: origen no permitido (${url.origin})`)
    // que una anfitriona lenta no deje la guía en blanco: a los 8 s se sigue sin sus datos
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), credentials: 'omit' })
    if (!r.ok) throw new Error(`datos externos: HTTP ${r.status}`)
    const avisos = aplicarDatos(await r.json())
    for (const a of avisos) console.warn('datos externos:', a)
    estadoDatos = 'externos'
  } catch (e) {
    estadoDatos = 'error'
    console.error(e)
    avisar('error', { mensaje: String((e as Error)?.message ?? e) })
  }
}

/** Avisos a la anfitriona (listo, seleccion) y órdenes que llegan de ella. */
export function iniciarEmbebido() {
  if (!EMBEBIDO) return
  document.documentElement.classList.add('embebido')
  let dicho = false
  const decirListo = () => {
    const s = useEstado.getState()
    if (dicho || !s.carga.listo) return
    dicho = true
    avisar('listo', { lugares: MONUMENTOS.map((m) => m.id), tours: TOURS.map((t) => t.id), idioma: s.idioma, modo: s.modo, datos: estadoDatos })
  }
  decirListo()
  useEstado.subscribe((s, a) => {
    decirListo()
    if (s.seleccionado !== a.seleccionado || s.tour !== a.tour) avisar('seleccion', { lugar: s.seleccionado, tour: s.tour })
  })
  addEventListener('message', (e: MessageEvent) => {
    // solo de la ventana que contiene a la guía y, si se dio ?origen=, solo de ese origen
    if (e.source !== window.parent || e.source === window || (ORIGEN && e.origin !== ORIGEN)) return
    const d = objeto(e.data)
    if (!d) return
    const s = useEstado.getState()
    switch (d.tipo) {
      case 'abrir':
        if (d.lugar === null) s.setSeleccionado(null)
        else if (porId(String(d.lugar))) {
          s.cerrarPortada()
          s.setSeleccionado(String(d.lugar))
        }
        break
      case 'tour':
        if (tourPorId(String(d.id))) (d.reproducir ? s.reproducirTour : s.empezarTour)(String(d.id))
        break
      case 'idioma':
        if (IDIOMAS.includes(d.idioma as Idioma)) s.setIdioma(d.idioma as Idioma)
        break
      case 'hora':
        if (MOMENTOS.includes(d.momento as Momento)) s.setMomento(d.momento as Momento)
        break
    }
  })
}
