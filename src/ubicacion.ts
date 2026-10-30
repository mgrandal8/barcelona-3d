import { ESCALA, geoAEscena } from './scene/geo'
import { useEstado, type Ubicacion } from './store'
import type { Idioma } from './i18n/idioma'

// La posición del usuario: GPS del navegador o simulada (?pos=lat,lon o el botón del aviso «fuera de la maqueta»).

export const PLAZA_CATALUNYA: [number, number] = [41.38704, 2.17007]

// rectángulo de la maqueta en escena (RECT de scripts/datos/comun.mjs, en unidades de 100 m)
const LIMITES = { xMin: -55, xMax: 65, zMin: -60, zMax: 45 }

let vigilancia: number | null = null
let volarAlLlegar = false

function crear(lat: number, lon: number, precision: number, simulada: boolean): Ubicacion {
  const [x, z] = geoAEscena(lat, lon)
  const dentro = x > LIMITES.xMin && x < LIMITES.xMax && z > LIMITES.zMin && z < LIMITES.zMax
  return { lat, lon, precision, x, z, dentro, simulada }
}

function volar(u: Ubicacion) {
  if (u.dentro) useEstado.getState().volarA(u.x, u.z)
}

/** Pone una posición fija (sin GPS) y deja de vigilar el real. */
export function simularPosicion(lat: number, lon: number, conVuelo = true) {
  if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia)
  vigilancia = null
  const u = crear(lat, lon, 15, true)
  useEstado.getState().setUbicacion(u, 'ok')
  if (conVuelo) volar(u)
}

/** ?pos=lat,lon: posición simulada desde el principio (pruebas, o para quien no está en Barcelona). */
export function ubicacionDeUrl() {
  const p = new URLSearchParams(location.search).get('pos')?.split(',').map(Number)
  if (p?.length === 2 && p.every(Number.isFinite)) simularPosicion(p[0], p[1], false)
}

/** Botón «dónde estoy»: la primera vez pide permiso y empieza a seguir el GPS; después, vuelve a centrar. */
export function activarUbicacion() {
  const { ubicacion, estadoUbicacion, setUbicacion } = useEstado.getState()
  if (ubicacion && (ubicacion.simulada || vigilancia !== null)) return volar(ubicacion)
  if (estadoUbicacion === 'buscando') return
  if (!('geolocation' in navigator)) return setUbicacion(null, 'no-disponible')
  setUbicacion(null, 'buscando')
  volarAlLlegar = true
  vigilancia = navigator.geolocation.watchPosition(
    (p) => {
      const u = crear(p.coords.latitude, p.coords.longitude, Math.round(p.coords.accuracy), false)
      useEstado.getState().setUbicacion(u, 'ok')
      if (volarAlLlegar) volar(u)
      volarAlLlegar = false
    },
    (e) => {
      if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia)
      vigilancia = null
      // sin https el navegador también contesta PERMISSION_DENIED
      useEstado.getState().setUbicacion(null, e.code === e.PERMISSION_DENIED ? 'denegada' : 'error')
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
  )
}

/** Distancia en línea recta, en metros, de la ubicación a un punto de la escena. */
export const distanciaM = (u: Ubicacion, [x, z]: readonly [number, number]) => Math.hypot(x - u.x, z - u.z) * ESCALA

/** A pie: las calles alargan la línea recta ~30 %, a 4,8 km/h (80 m por minuto). */
export const minutosAPie = (m: number) => Math.max(1, Math.round((m * 1.3) / 80))

export function formatoDistancia(m: number, idioma: Idioma) {
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${new Intl.NumberFormat(idioma, { maximumFractionDigits: m < 9500 ? 1 : 0 }).format(m / 1000)} km`
}
