import { useEstado } from './store'

// PWA: registro del service worker (dist/sw.js, lo genera vite.config.ts), avisos de versión nueva y de red,
// e instalación. Solo en el build: en desarrollo no hay sw.js, y en modo captura no se quiere caché.

type AvisoInstalar = Event & { prompt: () => Promise<void> }

let registro: ServiceWorkerRegistration | null = null
let pedirInstalar: AvisoInstalar | null = null
let recargarAlCambiar = false

export function iniciarPwa() {
  const { setRed } = useEstado.getState()
  addEventListener('online', () => setRed({ enLinea: true }))
  addEventListener('offline', () => setRed({ enLinea: false }))
  // Chrome y Edge avisan de que se puede instalar: se guarda el aviso para el botón de la ayuda
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pedirInstalar = e as AvisoInstalar
    setRed({ instalable: true })
  })
  addEventListener('appinstalled', () => setRed({ instalable: false }))

  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || new URLSearchParams(location.search).has('captura')) return
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargarAlCambiar) location.reload()
  })
  // después de la carga: que el service worker no le quite red a los datos de la ciudad
  const registrar = async () => {
    const base = import.meta.env.BASE_URL
    registro = await navigator.serviceWorker.register(base + 'sw.js', { scope: base })
    const mirar = () => {
      const r = registro!
      setRed({
        copia: r.active ? 'lista' : 'guardando',
        // hay una versión nueva esperando y ya había otra controlando la página
        nueva: !!r.waiting && !!navigator.serviceWorker.controller,
      })
    }
    mirar()
    registro.addEventListener('updatefound', () => {
      mirar()
      registro!.installing?.addEventListener('statechange', mirar)
    })
    navigator.serviceWorker.ready.then(mirar)
  }
  if (document.readyState === 'complete') registrar()
  else addEventListener('load', () => registrar(), { once: true })
}

/** «Recargar»: activa la versión nueva y, cuando toma el control, recarga. */
export function actualizar() {
  if (!registro?.waiting) return location.reload()
  recargarAlCambiar = true
  registro.waiting.postMessage('activar')
}

export async function instalar() {
  if (!pedirInstalar) return
  await pedirInstalar.prompt()
  pedirInstalar = null
  useEstado.getState().setRed({ instalable: false })
}

export const esIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches
