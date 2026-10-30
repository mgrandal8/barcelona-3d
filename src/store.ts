import { create } from 'zustand'
import { porId } from './data/monumentos'
import { tourPorId } from './data/tours'
import { momentoDeUrl, type Momento } from './scene/momento'
import { guardarIdioma, idiomaInicial, type Idioma } from './i18n/idioma'
import type { Textos } from './i18n/es'
import { guardarModo, modoInicial, nivelInicial, NIVELES, PERFILES, type Modo, type Nivel } from './calidad'

export type ClaveCarga = keyof Textos['carga']

export type Dialogo = 'tours' | 'guia' | 'ayuda'

/** Posición del usuario (GPS o simulada) en grados y en la escena. */
export type Ubicacion = { lat: number; lon: number; precision: number; x: number; z: number; dentro: boolean; simulada: boolean }
/** Uso sin conexión: si hay red, si la copia del service worker está lista, si hay versión nueva y si se puede instalar. */
export type Red = { enLinea: boolean; copia: 'no-disponible' | 'guardando' | 'lista'; nueva: boolean; instalable: boolean }
/** Por qué no se ve la maqueta: datos (red o worker), código (un chunk), webgl (no se pudo crear el contexto) o contexto (se perdió). */
export type Fallo = 'datos' | 'codigo' | 'webgl' | 'contexto'
export type EstadoUbicacion = 'apagada' | 'buscando' | 'ok' | 'denegada' | 'error' | 'no-disponible'

type Estado = {
  seleccionado: string | null
  hover: string | null
  momento: Momento
  /** Tour en curso: sus paradas se recorren con la ficha. */
  tour: string | null
  dialogo: Dialogo | null
  /** Portada "Descubre Barcelona" encima del mapa. */
  portada: boolean
  carga: { progreso: number; texto: ClaveCarga; listo: boolean }
  idioma: Idioma
  ubicacion: Ubicacion | null
  estadoUbicacion: EstadoUbicacion
  /** Petición de vuelo de cámara a un punto (n cambia en cada petición, aunque el punto se repita). */
  vuelo: { x: number; z: number; n: number } | null
  /** Capa de metro y FGC encima de la maqueta. */
  metro: boolean
  red: Red
  /** Maqueta 3D o versión ligera (mapa 2D y fichas). */
  modo: Modo
  calidad: Nivel
  fallo: Fallo | null
  /** Cambia en cada «Reintentar»: es la key de la escena. */
  reintentos: number
  setSeleccionado: (id: string | null) => void
  setHover: (id: string | null) => void
  setMomento: (m: Momento) => void
  empezarTour: (id: string) => void
  setDialogo: (d: Dialogo | null) => void
  cerrarPortada: () => void
  setCarga: (c: Partial<Estado['carga']>) => void
  setIdioma: (i: Idioma) => void
  setUbicacion: (u: Ubicacion | null, estado: EstadoUbicacion) => void
  volarA: (x: number, z: number) => void
  setMetro: (v: boolean) => void
  setRed: (r: Partial<Red>) => void
  setModo: (m: Modo) => void
  /** Un nivel menos de calidad (o directamente baja). */
  bajarCalidad: (aBaja?: boolean) => void
  setFallo: (f: Fallo | null) => void
  reintentar: () => void
}

const params = new URLSearchParams(location.search)
const inicial = porId(params.get('lugar'))?.id ?? null
const tourInicial = tourPorId(params.get('tour'))
const enTour = (tour: string | null, id: string | null) => !!id && !!tourPorId(tour)?.paradas.some((p) => p.id === id)

/** Cambia un parámetro de la barra sin recargar, para poder compartir el enlace. */
function ponerParam(clave: string, valor: string | null) {
  const url = new URL(location.href)
  if (valor) url.searchParams.set(clave, valor)
  else url.searchParams.delete(clave)
  history.replaceState(null, '', url)
}

export const useEstado = create<Estado>((set, get) => ({
  seleccionado: inicial,
  hover: null,
  momento: momentoDeUrl(),
  tour: enTour(tourInicial?.id ?? null, inicial) ? tourInicial!.id : null,
  dialogo: null,
  // con un enlace a un lugar o en modo captura se entra directo al mapa
  portada: !inicial && !params.has('captura'),
  carga: { progreso: 0, texto: 'preparando', listo: false },
  idioma: idiomaInicial(),
  ubicacion: null,
  estadoUbicacion: 'apagada',
  vuelo: null,
  metro: params.get('metro') === '1',
  red: { enLinea: navigator.onLine, copia: 'no-disponible', nueva: false, instalable: false },
  modo: modoInicial(),
  calidad: nivelInicial(),
  fallo: null,
  reintentos: 0,
  setSeleccionado: (id) => {
    // elegir un lugar que no es del tour (o volver al mapa) termina el tour
    const tour = enTour(get().tour, id) ? get().tour : null
    set({ seleccionado: id, tour })
    ponerParam('lugar', id)
    ponerParam('tour', tour)
  },
  setHover: (id) => set({ hover: id }),
  setMomento: (m) => {
    set({ momento: m })
    ponerParam('hora', m === 'dia' ? null : m)
  },
  empezarTour: (id) => {
    const t = tourPorId(id)
    if (!t) return
    // los tours se mueven en metro: se enciende la capa
    set({ tour: t.id, dialogo: null, portada: false })
    get().setMetro(true)
    get().setMomento(t.momento)
    get().setSeleccionado(t.paradas[0].id)
  },
  setDialogo: (d) => set({ dialogo: d }),
  cerrarPortada: () => set({ portada: false }),
  setCarga: (c) => set({ carga: { ...get().carga, ...c } }),
  setIdioma: (i) => {
    set({ idioma: i })
    guardarIdioma(i)
    ponerParam('lang', i === 'es' ? null : i)
  },
  setMetro: (v) => {
    set({ metro: v })
    ponerParam('metro', v ? '1' : null)
  },
  setRed: (r) => set({ red: { ...get().red, ...r } }),
  setModo: (m) => {
    guardarModo(m)
    ponerParam('modo', null)
    set({ modo: m, fallo: null })
  },
  bajarCalidad: (aBaja) => {
    const i = NIVELES.indexOf(get().calidad)
    set({ calidad: aBaja ? 'baja' : NIVELES[Math.min(i + 1, NIVELES.length - 1)] })
  },
  setFallo: (f) => set({ fallo: f }),
  reintentar: () => set({ fallo: null, reintentos: get().reintentos + 1 }),
  setUbicacion: (u, estado) => set({ ubicacion: u, estadoUbicacion: estado }),
  volarA: (x, z) => {
    // se cierra la ficha para ver el sitio; la cámara procesa el vuelo después del cambio de lugar
    if (get().seleccionado) get().setSeleccionado(null)
    set({ vuelo: { x, z, n: (get().vuelo?.n ?? 0) + 1 } })
  },
}))

/** Perfil de la calidad actual (sombras, postproceso, LOD…). */
export const usePerfil = () => PERFILES[useEstado((s) => s.calidad)]

// modo captura: los scripts de pruebas leen y cambian el estado (también en la versión ligera, sin escena)
if (params.has('captura')) Object.assign(window, { __estado: useEstado })
