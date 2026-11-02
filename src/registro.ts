import { evento, ANALITICA } from './analitica'
import { avisar } from './embebido'
import { useEstado } from './store'

// Registro de errores: lo que falla en el navegador de quien visita la guía.
//   - Siempre: se guardan en memoria los últimos 30 (en modo captura, window.__errores: las pruebas comprueban que no hay).
//   - VITE_ERRORES_URL: se manda cada error (como mucho 10 por visita, sin repetir) a ese endpoint con POST de JSON
//     { mensaje, pila, tipo, version, ruta, calidad, modo, navegador }. Sin cookies ni identificadores ni la URL completa.
//   - Con la analítica encendida, además, un evento «Error» con el tipo y el principio del mensaje (sale en Plausible).
//   - En modo embebido, la anfitriona recibe { tipo: 'error', mensaje }.

const URL_ERRORES = import.meta.env.VITE_ERRORES_URL as string | undefined
/** El registro de errores se manda a un servidor en este build (lo dice la página de privacidad). */
export const REGISTRO_REMOTO = !!URL_ERRORES

export type Entrada = { tipo: string; mensaje: string; pila?: string; t: number }
const entradas: Entrada[] = []
const enviados = new Set<string>()
const MAX_ENVIOS = 10

function permitidoEnviar() {
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname) && !import.meta.env.VITE_ERRORES_LOCAL) return false
  return !new URLSearchParams(location.search).has('captura') || !!import.meta.env.VITE_ERRORES_LOCAL
}

/** Apunta un error y, si toca, lo manda. `tipo`: error, promesa, maqueta, fallo… */
export function registrarError(tipo: string, e: unknown) {
  const err = e instanceof Error ? e : null
  const mensaje = (err?.message ?? String(e)).slice(0, 500)
  const pila = err?.stack?.slice(0, 2000)
  entradas.push({ tipo, mensaje, pila, t: Math.round(performance.now()) })
  if (entradas.length > 30) entradas.shift()
  avisar('error', { mensaje: `${tipo}: ${mensaje}` })

  const clave = tipo + mensaje
  if (enviados.has(clave) || enviados.size >= MAX_ENVIOS || !permitidoEnviar()) return
  enviados.add(clave)
  if (ANALITICA) evento('Error', { tipo, mensaje: mensaje.slice(0, 100) })
  if (!URL_ERRORES) return
  const s = useEstado.getState()
  const cuerpo = JSON.stringify({
    mensaje,
    pila,
    tipo,
    version: (import.meta.env.VITE_VERSION as string | undefined) ?? 'local',
    // solo la ruta (la ficha y el idioma), sin parámetros
    ruta: location.pathname,
    calidad: s.calidad,
    modo: s.modo,
    navegador: navigator.userAgent.slice(0, 200),
  })
  // text/plain: sin preflight CORS; keepalive: que salga aunque se cierre la página
  fetch(URL_ERRORES, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {})
}

export function iniciarRegistro() {
  addEventListener('error', (e) => {
    // los fallos al cargar un recurso (<img>, <script>) llegan sin error: se apunta la URL
    const r = e.target as HTMLElement | null
    if (r && r !== (window as unknown) && 'src' in r) registrarError('recurso', `no se pudo cargar ${(r as HTMLImageElement).src}`)
    else registrarError('error', e.error ?? e.message)
  }, true)
  addEventListener('unhandledrejection', (e) => registrarError('promesa', e.reason))
  // la maqueta no se ve (datos, código, WebGL o contexto perdido): también cuenta aunque se recupere con «Reintentar»
  useEstado.subscribe((s, a) => {
    if (s.fallo && s.fallo !== a.fallo) registrarError('fallo', s.fallo)
  })
  if (new URLSearchParams(location.search).has('captura')) Object.assign(window, { __errores: entradas })
}
