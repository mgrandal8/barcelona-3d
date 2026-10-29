import * as THREE from 'three'
import type { DatosCiudad } from './datos'

const COLOR_AREA: Record<string, string> = {
  campo: '#cfd39a',
  hierba: '#b9d18c',
  bosque: '#79a35c',
  parque: '#a2c97d',
  cementerio: '#c3c7ae',
  industrial: '#d6d1c7',
  ferrocarril: '#cdc5b7',
  deporte: '#93c46f',
  peatonal: '#efe7d6',
  muelle: '#d2cbbd',
  playa: '#f0dcac',
  agua: '#5ea9cb',
}
const ORDEN = Object.keys(COLOR_AREA)

const COLOR_LINEA: Record<string, string> = {
  tren: '#ab9f8f',
  autopista: '#c4bcae',
  principal: '#f6f0e4',
  secundaria: '#f1eadd',
  peatonal: '#f5eddc',
  muelle: '#d2cbbd',
  rio: '#6aaecd',
}

const CIUDAD = [221, 213, 198]
const MONTE = [190, 196, 150]
const FONDO_MAR = [96, 140, 150]
const ARENA_MAR = [205, 192, 150]

type Colores = (t: string) => string | null

/** Dibuja áreas y líneas del mapa sobre un contexto 2D (1 px = metrosPx metros). */
function dibujarMapa(ctx: CanvasRenderingContext2D, d: DatosCiudad, metrosPx: number, colores: Colores, lineas: Colores | null, anchoMin = 1) {
  const { uMin, vMin } = d.meta.rect
  const X = (u: number) => (u - uMin) / metrosPx
  const Y = (v: number) => (v - vMin) / metrosPx
  for (const clase of ORDEN) {
    const color = colores(clase)
    if (!color) continue
    ctx.fillStyle = color
    for (const a of d.areas) {
      if (a.t !== clase) continue
      ctx.beginPath()
      for (const r of a.r) {
        ctx.moveTo(X(r[0]), Y(r[1]))
        for (let i = 2; i < r.length; i += 2) ctx.lineTo(X(r[i]), Y(r[i + 1]))
        ctx.closePath()
      }
      ctx.fill('evenodd')
    }
  }
  if (!lineas) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const clase of Object.keys(COLOR_LINEA)) {
    const color = lineas(clase)
    if (!color) continue
    ctx.strokeStyle = color
    for (const l of d.lineas) {
      if (l.t !== clase) continue
      ctx.lineWidth = Math.max(anchoMin, l.a / metrosPx)
      ctx.beginPath()
      ctx.moveTo(X(l.p[0]), Y(l.p[1]))
      for (let i = 2; i < l.p.length; i += 2) ctx.lineTo(X(l.p[i]), Y(l.p[i + 1]))
      ctx.stroke()
    }
  }
}

/** Capa base a partir del relieve: mar, ciudad y monte. */
function capaRelieve(d: DatosCiudad) {
  const { nu, nv } = d.meta
  const c = document.createElement('canvas')
  c.width = nu
  c.height = nv
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(nu, nv)
  const mezcla = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t)
  for (let i = 0; i < nu * nv; i++) {
    const h = d.alturas[i] / 10
    let col: number[]
    if (h <= 0.3) col = mezcla(ARENA_MAR, FONDO_MAR, Math.min(1, -h / 15))
    else col = mezcla(CIUDAD, MONTE, Math.min(1, Math.max(0, (h - 120) / 120)))
    img.data.set([col[0], col[1], col[2], 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function crearTexturaSuelo(d: DatosCiudad, gl: THREE.WebGLRenderer) {
  const { uMin, uMax, vMin, vMax } = d.meta.rect
  const ancho = Math.min(4096, gl.capabilities.maxTextureSize)
  const metrosPx = (uMax - uMin) / ancho
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = Math.round((vMax - vMin) / metrosPx)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(capaRelieve(d), 0, 0, c.width, c.height)
  dibujarMapa(ctx, d, metrosPx, (t) => COLOR_AREA[t], (t) => COLOR_LINEA[t])
  const tex = new THREE.CanvasTexture(c)
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = gl.capabilities.getMaxAnisotropy()
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
}

const COLOR_FAROLAS: Record<string, string> = {
  autopista: '#ff9a3c',
  principal: '#ffc26b',
  secundaria: '#c98a45',
  peatonal: '#7a5a34',
  muelle: '#6a5030',
}

/** Luces nocturnas del suelo: calles en ámbar sobre negro, para usar como emissiveMap del terreno. */
export function crearTexturaLuces(d: DatosCiudad, gl: THREE.WebGLRenderer) {
  const { uMin, uMax, vMin, vMax } = d.meta.rect
  const ancho = Math.min(2048, gl.capabilities.maxTextureSize)
  const metrosPx = (uMax - uMin) / ancho
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = Math.round((vMax - vMin) / metrosPx)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  // plazas y zonas peatonales con un resplandor tenue
  dibujarMapa(ctx, d, metrosPx, (t) => (t === 'peatonal' ? '#3a2a18' : null), (t) => COLOR_FAROLAS[t] ?? null, 1.2)
  const tex = new THREE.CanvasTexture(c)
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Máscara a 10 m/px: rojo = bosque, verde = parque, azul = agua. */
export function crearMascara(d: DatosCiudad) {
  const { uMin, uMax, vMin, vMax } = d.meta.rect
  const metrosPx = 10
  const c = document.createElement('canvas')
  c.width = Math.round((uMax - uMin) / metrosPx)
  c.height = Math.round((vMax - vMin) / metrosPx)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  dibujarMapa(ctx, d, metrosPx, (t) => (t === 'bosque' ? '#ff0000' : t === 'parque' ? '#00ff00' : t === 'agua' ? '#0000ff' : t === 'deporte' ? '#000000' : null), null)
  const datos = ctx.getImageData(0, 0, c.width, c.height).data
  return {
    ancho: c.width,
    alto: c.height,
    metrosPx,
    /** 0 nada, 1 bosque, 2 parque, 3 agua */
    en(u: number, v: number) {
      const px = Math.floor((u - uMin) / metrosPx)
      const py = Math.floor((v - vMin) / metrosPx)
      if (px < 0 || py < 0 || px >= c.width || py >= c.height) return 0
      const i = (py * c.width + px) * 4
      return datos[i] > 128 ? 1 : datos[i + 1] > 128 ? 2 : datos[i + 2] > 128 ? 3 : 0
    },
  }
}
