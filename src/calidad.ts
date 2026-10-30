// Qué puede dibujar este dispositivo: si hay WebGL, con qué calidad empezar y si conviene la versión ligera.
// Sin three: se decide antes de descargar la escena.

export type Nivel = 'alta' | 'media' | 'baja'
export type Modo = '3d' | 'ligero'
export const NIVELES: Nivel[] = ['alta', 'media', 'baja']

export type Perfil = {
  /** Tope del devicePixelRatio. */
  dprMax: number
  /** Lado del mapa de sombras del sol; 0 = sin sombras. */
  sombras: number
  postpro: 'completo' | 'ligero' | 'no'
  /** Distancia (al borde del trozo) a partir de la cual de las casas bajas solo se dibujan los tejados. */
  lejos: number
  /** Ancho de la textura del suelo en píxeles. */
  textura: number
}

export const PERFILES: Record<Nivel, Perfil> = {
  alta: { dprMax: 2, sombras: 4096, postpro: 'completo', lejos: 70, textura: 4096 },
  media: { dprMax: 1.5, sombras: 2048, postpro: 'ligero', lejos: 50, textura: 4096 },
  baja: { dprMax: 1, sombras: 0, postpro: 'no', lejos: 35, textura: 2048 },
}

export type Sondeo = { webgl: boolean; software: boolean; maxTextura: number }

/** Abre un contexto WebGL de prueba y lo suelta enseguida. */
function sondear(): Sondeo {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return { webgl: false, software: false, maxTextura: 0 }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    const r = { webgl: true, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer), maxTextura: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return r
  } catch {
    return { webgl: false, software: false, maxTextura: 0 }
  }
}

export const sondeo = sondear()

const params = new URLSearchParams(location.search)
const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
const memoria = nav.deviceMemory ?? 8
const nucleos = navigator.hardwareConcurrency || 8
const tactil = matchMedia('(pointer: coarse)').matches
const movil = tactil && Math.min(screen.width, screen.height) < 600

/** Calidad forzada por la URL (pruebas): entonces no se baja sola. */
export const calidadFija = NIVELES.find((n) => n === params.get('calidad')) ?? null

/** ?calidad= manda; en modo captura, alta (que las capturas por software no cambien); si no, según el dispositivo. */
export function nivelInicial(): Nivel {
  if (calidadFija) return calidadFija
  if (params.has('captura')) return 'alta'
  if (sondeo.software || nav.connection?.saveData || memoria <= 2) return 'baja'
  if (memoria <= 4 || nucleos <= 4 || movil || sondeo.maxTextura < 8192) return 'media'
  return 'alta'
}

const CLAVE_MODO = 'bcn3d-modo'

/** ?modo= manda; sin WebGL, ligero; si no, la última elección; y en móviles muy flojos, ligero. */
export function modoInicial(): Modo {
  const url = params.get('modo')
  if (url === 'ligero' || url === '3d') return url
  if (!sondeo.webgl) return 'ligero'
  try {
    const g = localStorage.getItem(CLAVE_MODO)
    if (g === 'ligero' || g === '3d') return g
  } catch {
    // sin almacenamiento se decide por el dispositivo
  }
  return movil && memoria <= 1 ? 'ligero' : '3d'
}

export function guardarModo(m: Modo) {
  try {
    localStorage.setItem(CLAVE_MODO, m)
  } catch {
    // la próxima vez se vuelve a decidir por el dispositivo
  }
}
