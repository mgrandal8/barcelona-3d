import { create } from 'zustand'
import { porId } from './data/monumentos'
import { tourPorId } from './data/tours'
import { momentoDeUrl, type Momento } from './scene/momento'
import { guardarIdioma, idiomaInicial, type Idioma } from './i18n/idioma'
import type { Textos } from './i18n/es'

export type ClaveCarga = keyof Textos['carga']

export type Dialogo = 'tours' | 'guia' | 'ayuda'

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
  setSeleccionado: (id: string | null) => void
  setHover: (id: string | null) => void
  setMomento: (m: Momento) => void
  empezarTour: (id: string) => void
  setDialogo: (d: Dialogo | null) => void
  cerrarPortada: () => void
  setCarga: (c: Partial<Estado['carga']>) => void
  setIdioma: (i: Idioma) => void
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
    set({ tour: t.id, dialogo: null, portada: false })
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
}))
