import { useEstado } from './store'
import { rutaDe } from './rutas'

// Analítica sin cookies, apagada por defecto. Se enciende en el build con:
//   VITE_ANALITICA_URL      endpoint compatible con la API de eventos de Plausible (p. ej. https://plausible.io/api/event)
//   VITE_ANALITICA_DOMINIO  el dominio dado de alta en el servicio (p. ej. mgrandal8.github.io)
//   VITE_ANALITICA_NOMBRE   el nombre que sale en «Privacidad y créditos» (por defecto, Plausible)
// No guarda nada en el navegador ni manda identificadores: solo la URL de la ficha, el referer y el nombre del evento.
// No cuenta nada con «No rastrear» o «Control global de privacidad», en local ni en modo captura.

const URL_EVENTOS = import.meta.env.VITE_ANALITICA_URL as string | undefined
const DOMINIO = import.meta.env.VITE_ANALITICA_DOMINIO as string | undefined

/** La analítica está configurada en este build (lo dice la página de privacidad). */
export const ANALITICA = URL_EVENTOS && DOMINIO ? ((import.meta.env.VITE_ANALITICA_NOMBRE as string | undefined) ?? 'Plausible') : null

function permitida() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return false
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) return false
  return !new URLSearchParams(location.search).has('captura')
}

/** Manda un evento; `props` son datos agregables (id del lugar, del tour…), nunca datos de la persona. */
export function evento(nombre: string, props?: Record<string, string>) {
  if (!ANALITICA || !permitida()) return
  const s = useEstado.getState()
  // la URL es la ruta de la ficha sin parámetros: así las visitas se agrupan por lugar e idioma
  const url = location.origin + import.meta.env.BASE_URL + rutaDe(s.seleccionado, s.idioma)
  const cuerpo = JSON.stringify({ name: nombre, url, domain: DOMINIO, referrer: document.referrer || null, props })
  // text/plain para que no haga falta preflight CORS; keepalive para que salga aunque se cierre la página
  fetch(URL_EVENTOS!, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {})
}

/** Cuenta la visita y, después, cada ficha abierta (como página vista), tour, imagen compartida, idioma y versión ligera. */
export function iniciarAnalitica() {
  if (!ANALITICA) return
  evento('pageview')
  if (useEstado.getState().modo === 'ligero') evento('Versión ligera')
  useEstado.subscribe((s, a) => {
    if (s.seleccionado && s.seleccionado !== a.seleccionado) evento('pageview')
    if (s.tour && s.tour !== a.tour) evento('Tour', { tour: s.tour })
    if (s.reproduciendo && !a.reproduciendo && s.tour) evento('Tour automático', { tour: s.tour })
    if (s.dialogo === 'compartir' && a.dialogo !== 'compartir') evento('Compartir')
    if (s.idioma !== a.idioma) evento('Idioma', { idioma: s.idioma })
    if (s.modo === 'ligero' && a.modo !== 'ligero') evento('Versión ligera')
  })
}
