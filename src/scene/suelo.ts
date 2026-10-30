// Suelo de la maqueta sin three ni DOM: texturas dibujadas desde OSM, máscara de agua y parques, malla del
// terreno, zócalo y árboles. Lo usa terreno.worker.ts (con OffscreenCanvas) y, si el navegador no puede
// dibujar en un worker, el hilo principal con canvas normales.
import { ESCALA, metrosAY } from './geo'
import { crearAlturaM, type Meta } from './relieve'
import { aleatorio } from './edificios'

export type Area = { t: string; r: number[][] }
export type Linea = { t: string; a: number; p: number[] }
export type Mapa = { areas: Area[]; lineas: Linea[] }

type Lienzo = OffscreenCanvas | HTMLCanvasElement
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
export type CrearLienzo = (ancho: number, alto: number) => Lienzo
/** Lienzo → imagen para la textura (ImageBitmap en el worker, el propio canvas en el hilo principal). */
export type AImagen = (l: Lienzo) => ImageBitmap | HTMLCanvasElement

const ctx2d = (l: Lienzo, opciones?: CanvasRenderingContext2DSettings) => l.getContext('2d', opciones) as Ctx2D

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

const COLOR_FAROLAS: Record<string, string> = {
  autopista: '#ff9a3c',
  principal: '#ffc26b',
  secundaria: '#c98a45',
  peatonal: '#7a5a34',
  muelle: '#6a5030',
}

const CIUDAD = [221, 213, 198]
const MONTE = [190, 196, 150]
const COLOR_FONDO_MAR = [96, 140, 150]
const COLOR_ARENA_MAR = [205, 192, 150]

type Colores = (t: string) => string | null

/** Dibuja áreas y líneas del mapa sobre un contexto 2D (1 px = metrosPx metros). */
function dibujarMapa(ctx: Ctx2D, meta: Meta, mapa: Mapa, metrosPx: number, colores: Colores, lineas: Colores | null, anchoMin = 1) {
  const { uMin, vMin } = meta.rect
  const X = (u: number) => (u - uMin) / metrosPx
  const Y = (v: number) => (v - vMin) / metrosPx
  for (const clase of ORDEN) {
    const color = colores(clase)
    if (!color) continue
    ctx.fillStyle = color
    for (const a of mapa.areas) {
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
    for (const l of mapa.lineas) {
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
function capaRelieve(crear: CrearLienzo, meta: Meta, alturas: Int16Array) {
  const { nu, nv } = meta
  const c = crear(nu, nv)
  const ctx = ctx2d(c)
  const img = ctx.createImageData(nu, nv)
  const mezcla = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t)
  for (let i = 0; i < nu * nv; i++) {
    const h = alturas[i] / 10
    let col: number[]
    if (h <= 0.3) col = mezcla(COLOR_ARENA_MAR, COLOR_FONDO_MAR, Math.min(1, -h / 15))
    else col = mezcla(CIUDAD, MONTE, Math.min(1, Math.max(0, (h - 120) / 120)))
    img.data.set([col[0], col[1], col[2], 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Lienzo de `ancho` px que cubre toda la maqueta. */
function lienzoMaqueta(crear: CrearLienzo, meta: Meta, ancho: number) {
  const { uMin, uMax, vMin, vMax } = meta.rect
  const metrosPx = (uMax - uMin) / ancho
  return { c: crear(ancho, Math.round((vMax - vMin) / metrosPx)), metrosPx }
}

/** Textura del suelo: relieve, áreas y calles. También es el plano de la versión ligera. */
export function pintarSuelo(crear: CrearLienzo, meta: Meta, alturas: Int16Array, mapa: Mapa, ancho: number) {
  const { c, metrosPx } = lienzoMaqueta(crear, meta, ancho)
  const ctx = ctx2d(c)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(capaRelieve(crear, meta, alturas), 0, 0, c.width, c.height)
  dibujarMapa(ctx, meta, mapa, metrosPx, (t) => COLOR_AREA[t], (t) => COLOR_LINEA[t])
  return c
}

/** Luces nocturnas del suelo: calles en ámbar sobre negro, para usar como emissiveMap del terreno. */
function pintarLuces(crear: CrearLienzo, meta: Meta, mapa: Mapa, ancho: number) {
  const { c, metrosPx } = lienzoMaqueta(crear, meta, ancho)
  const ctx = ctx2d(c)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  // plazas y zonas peatonales con un resplandor tenue
  dibujarMapa(ctx, meta, mapa, metrosPx, (t) => (t === 'peatonal' ? '#3a2a18' : null), (t) => COLOR_FAROLAS[t] ?? null, 1.2)
  return c
}

/** Máscara a 10 m/px: 0 nada, 1 bosque, 2 parque, 3 agua. */
export type Mascara = { ancho: number; alto: number; metrosPx: number; clases: Uint8Array }

function crearMascara(crear: CrearLienzo, meta: Meta, mapa: Mapa): Mascara {
  const { uMin, uMax, vMin, vMax } = meta.rect
  const metrosPx = 10
  const c = crear(Math.round((uMax - uMin) / metrosPx), Math.round((vMax - vMin) / metrosPx))
  const ctx = ctx2d(c, { willReadFrequently: true })
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  dibujarMapa(ctx, meta, mapa, metrosPx, (t) => (t === 'bosque' ? '#ff0000' : t === 'parque' ? '#00ff00' : t === 'agua' ? '#0000ff' : t === 'deporte' ? '#000000' : null), null)
  const px = ctx.getImageData(0, 0, c.width, c.height).data
  const clases = new Uint8Array(c.width * c.height)
  for (let i = 0; i < clases.length; i++) clases[i] = px[i * 4] > 128 ? 1 : px[i * 4 + 1] > 128 ? 2 : px[i * 4 + 2] > 128 ? 3 : 0
  return { ancho: c.width, alto: c.height, metrosPx, clases }
}

/** Clase de la máscara en metros (u, v) del marco de la maqueta. */
export function claseEn(m: Mascara, meta: Meta, u: number, v: number) {
  const px = Math.floor((u - meta.rect.uMin) / m.metrosPx)
  const py = Math.floor((v - meta.rect.vMin) / m.metrosPx)
  if (px < 0 || py < 0 || px >= m.ancho || py >= m.alto) return 0
  return m.clases[py * m.ancho + px]
}

type AlturaM = (x: number, z: number) => number

/** El relieve no trae batimetría: el mar y las dársenas se hunden a mano. */
export const esAguaEn = (m: Mascara, meta: Meta, alturaM: AlturaM, x: number, z: number) =>
  alturaM(x, z) <= 0.3 || claseEn(m, meta, x * ESCALA, z * ESCALA) === 3

const FONDO_ZOCALO = -1.6
const FONDO_MAR = -0.16
const PASO_MALLA = 20

const rejilla = (meta: Meta) => ({
  nu: Math.round((meta.rect.uMax - meta.rect.uMin) / PASO_MALLA) + 1,
  nv: Math.round((meta.rect.vMax - meta.rect.vMin) / PASO_MALLA) + 1,
})

/** Normales de vértice sumando las de las caras, como BufferGeometry.computeVertexNormals. */
function normales(pos: Float32Array, idx: Uint32Array) {
  const n = new Float32Array(pos.length)
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3
    const b = idx[k + 1] * 3
    const c = idx[k + 2] * 3
    const e1x = pos[c] - pos[b], e1y = pos[c + 1] - pos[b + 1], e1z = pos[c + 2] - pos[b + 2]
    const e2x = pos[a] - pos[b], e2y = pos[a + 1] - pos[b + 1], e2z = pos[a + 2] - pos[b + 2]
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    for (const v of [a, b, c]) {
      n[v] += nx
      n[v + 1] += ny
      n[v + 2] += nz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l
    n[i + 1] /= l
    n[i + 2] /= l
  }
  return n
}

function mallaTerreno(meta: Meta, alturaM: AlturaM, m: Mascara) {
  const { rect } = meta
  const { nu, nv } = rejilla(meta)
  const pos = new Float32Array(nu * nv * 3)
  const uv = new Float32Array(nu * nv * 2)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * nu + i
      const x = (rect.uMin + i * PASO_MALLA) / ESCALA
      const z = (rect.vMin + j * PASO_MALLA) / ESCALA
      pos[k * 3] = x
      pos[k * 3 + 1] = esAguaEn(m, meta, alturaM, x, z) ? FONDO_MAR : metrosAY(alturaM(x, z))
      pos[k * 3 + 2] = z
      uv[k * 2] = i / (nu - 1)
      uv[k * 2 + 1] = j / (nv - 1)
    }
  }
  const idx = new Uint32Array((nu - 1) * (nv - 1) * 6)
  let o = 0
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i
      const b = a + 1
      const c = a + nu
      const e = c + 1
      idx.set([a, c, b, b, c, e], o)
      o += 6
    }
  }
  return { pos, uv, idx, nor: normales(pos, idx) }
}

/** Color hexadecimal sRGB → componentes lineales, como hace THREE.Color. */
function lineal(hex: string) {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)
  })
}

/** Paredes laterales de la maqueta, siguiendo el borde del relieve (`p` = posiciones de mallaTerreno). */
function zocalo(meta: Meta, p: Float32Array) {
  const { nu, nv } = rejilla(meta)
  const borde: number[] = []
  for (let i = 0; i < nu; i++) borde.push(i)
  for (let j = 1; j < nv; j++) borde.push(j * nu + nu - 1)
  for (let i = nu - 2; i >= 0; i--) borde.push((nv - 1) * nu + i)
  for (let j = nv - 2; j >= 0; j--) borde.push(j * nu)
  const pts: number[] = []
  const cols: number[] = []
  const arriba = lineal('#9a7652')
  const abajo = lineal('#4e3a2b')
  for (let k = 0; k < borde.length - 1; k++) {
    const a = borde[k] * 3
    const b = borde[k + 1] * 3
    const ax = p[a], ay = p[a + 1], az = p[a + 2]
    const bx = p[b], by = p[b + 1], bz = p[b + 2]
    pts.push(ax, ay, az, bx, by, bz, ax, FONDO_ZOCALO, az, bx, by, bz, bx, FONDO_ZOCALO, bz, ax, FONDO_ZOCALO, az)
    for (const c of [arriba, arriba, abajo, arriba, abajo, abajo]) cols.push(...c)
  }
  return { pos: new Float32Array(pts), col: new Float32Array(cols) }
}

/** Árboles en bosques y parques: x, y, z, escala y un azar para el color y el giro (5 valores por árbol). */
function arboles(meta: Meta, alturaM: AlturaM, m: Mascara) {
  const { uMin, uMax, vMin, vMax } = meta.rect
  const out: number[] = []
  let semilla = 1
  const rnd = () => aleatorio(semilla++)
  const paso = 32
  for (let u = uMin; u < uMax; u += paso) {
    for (let v = vMin; v < vMax; v += paso) {
      const pu = u + rnd() * paso
      const pv = v + rnd() * paso
      const tipo = claseEn(m, meta, pu, pv)
      const r = rnd()
      if (tipo === 0 || tipo === 3 || (tipo === 2 && r > 0.75)) continue
      const x = pu / ESCALA
      const z = pv / ESCALA
      const h = alturaM(x, z)
      if (h <= 0.5) continue
      out.push(x, metrosAY(Math.max(h, 0)), z, tipo === 1 ? 0.11 + rnd() * 0.07 : 0.08 + rnd() * 0.04, rnd())
    }
  }
  return new Float32Array(out)
}

export type Suelo = {
  terreno: { pos: Float32Array; uv: Float32Array; idx: Uint32Array; nor: Float32Array }
  zocalo: { pos: Float32Array; col: Float32Array }
  arboles: Float32Array
  mascara: Mascara
  texSuelo: ImageBitmap | HTMLCanvasElement
  texLuces: ImageBitmap | HTMLCanvasElement
}

/** Todo el suelo de la maqueta. `anchoTextura`: px de la textura del suelo (la de luces, la mitad). */
export function construirSuelo(crear: CrearLienzo, aImagen: AImagen, meta: Meta, alturas: Int16Array, mapa: Mapa, anchoTextura: number): Suelo {
  const alturaM = crearAlturaM(meta, alturas)
  const mascara = crearMascara(crear, meta, mapa)
  const terreno = mallaTerreno(meta, alturaM, mascara)
  return {
    terreno,
    zocalo: zocalo(meta, terreno.pos),
    arboles: arboles(meta, alturaM, mascara),
    mascara,
    texSuelo: aImagen(pintarSuelo(crear, meta, alturas, mapa, anchoTextura)),
    texLuces: aImagen(pintarLuces(crear, meta, mapa, anchoTextura / 2)),
  }
}

/** Buffers que se pueden transferir del worker al hilo principal. */
export const transferibles = (s: Suelo): Transferable[] => [
  s.terreno.pos.buffer,
  s.terreno.uv.buffer,
  s.terreno.idx.buffer,
  s.terreno.nor.buffer,
  s.zocalo.pos.buffer,
  s.zocalo.col.buffer,
  s.arboles.buffer,
  s.mascara.clases.buffer,
  ...[s.texSuelo, s.texLuces].filter((t): t is ImageBitmap => typeof ImageBitmap !== 'undefined' && t instanceof ImageBitmap),
]
