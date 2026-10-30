import { ESCALA, metrosAY } from './geo'
import { crearAlturaM, type Meta } from './relieve'
import type { Trozo } from './edificios'
import type { Pedido, Respuesta } from './edificios.worker'
import type { Pedido as PedidoSuelo, Respuesta as RespuestaSuelo } from './terreno.worker'
import { construirSuelo, esAguaEn, pintarSuelo, type Mapa, type Suelo } from './suelo'
import { descomprimir } from './gzip'
import { HUECOS } from '../data/monumentos'
import { useEstado } from '../store'
import { PERFILES, sondeo } from '../calidad'

export type { Meta, Suelo }
export { descomprimir }

export type DatosCiudad = {
  meta: Meta
  alturas: Int16Array
  /** Edificios ya extruidos por el worker; llegan después que el resto. */
  trozos: Promise<Trozo[]>
  /** Malla del terreno, zócalo, árboles, máscara y texturas, hechos en otro worker. */
  suelo: Promise<Suelo>
  /** Altura del terreno en metros reales (bilineal) en coordenadas de escena. */
  alturaM: (x: number, z: number) => number
  /** Altura del terreno en unidades de escena. */
  alturaY: (x: number, z: number) => number
  limites: { xMin: number; xMax: number; zMin: number; zMax: number }
}

let promesa: Promise<DatosCiudad> | null = null

// Tamaño aproximado de public/datos (ya van en gzip). Solo sirve para la barra de carga:
// el servidor no siempre manda Content-Length.
const BYTES_ESTIMADOS = 2.6e6
let recibidos = 0

/** Suma bytes recibidos: la descarga ocupa el 70 % de la barra; el resto es levantar la ciudad. */
function contar(n: number) {
  recibidos += n
  useEstado.getState().setCarga({ progreso: Math.min(0.7, (recibidos / BYTES_ESTIMADOS) * 0.7) })
}

/** Descarga un fichero leyendo el stream, para ir contando los bytes en la pantalla de carga. */
async function descargar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  if (!r.body) return r.arrayBuffer()
  const lector = r.body.getReader()
  const trozos: Uint8Array[] = []
  let n = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    trozos.push(value)
    n += value.length
    contar(value.length)
  }
  const out = new Uint8Array(n)
  let o = 0
  for (const t of trozos) {
    out.set(t, o)
    o += t.length
  }
  return out.buffer
}

const leerJson = async <T,>(url: string) => JSON.parse(new TextDecoder().decode(await descomprimir(await descargar(url)))) as T

/** Extruye los edificios en un worker; la barra avanza del 70 al 95 %. */
function levantarEdificios(edificios: ArrayBuffer, alturas: ArrayBuffer, meta: Meta) {
  return new Promise<Trozo[]>((resolver, fallar) => {
    const w = new Worker(new URL('./edificios.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = ({ data }: MessageEvent<Respuesta>) => {
      if (data.tipo === 'progreso') {
        const { progreso } = useEstado.getState().carga
        useEstado.getState().setCarga({ progreso: Math.max(progreso, 0.7 + data.f * 0.25), texto: 'levantando' })
        return
      }
      w.terminate()
      if (data.tipo === 'listo') resolver(data.trozos)
      else fallar(new Error(data.mensaje))
    }
    w.onerror = (e) => fallar(new Error(e.message))
    const pedido: Pedido = { edificios, alturas, meta, huecos: HUECOS }
    w.postMessage(pedido, [edificios, alturas])
  })
}

/** ¿Se puede dibujar en un worker? (Safari antes de la 16.4 no tiene OffscreenCanvas 2D.) */
const dibujaEnWorker = (() => {
  try {
    return typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(1, 1).getContext('2d')
  } catch {
    return false
  }
})()

const lienzo = (ancho: number, alto: number) => Object.assign(document.createElement('canvas'), { width: ancho, height: alto })

/** Pide el suelo (o solo el plano) al worker del terreno. */
function pedirAlWorker<T>(pedido: Omit<PedidoSuelo, 'url'>, tipo: 'listo' | 'plano') {
  return new Promise<T>((resolver, fallar) => {
    const w = new Worker(new URL('./terreno.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = ({ data }: MessageEvent<RespuestaSuelo>) => {
      if (data.tipo === 'bytes') return contar(data.n)
      w.terminate()
      if (data.tipo === 'error') fallar(new Error(data.mensaje))
      else if (data.tipo === tipo) resolver((data.tipo === 'listo' ? data.suelo : data.imagen) as T)
    }
    w.onerror = (e) => fallar(new Error(e.message))
    const p: PedidoSuelo = { ...pedido, url: base() + 'mapa.json.gz' }
    w.postMessage(p, [p.alturas])
  })
}

const base = () => import.meta.env.BASE_URL + 'datos/'

/** Ancho de la textura del suelo según la calidad con la que se empieza. */
const anchoTextura = () => Math.min(PERFILES[useEstado.getState().calidad].textura, sondeo.maxTextura || 4096)

function levantarSuelo(meta: Meta, alturas: Int16Array): Promise<Suelo> {
  const ancho = anchoTextura()
  if (dibujaEnWorker) return pedirAlWorker<Suelo>({ meta, alturas: alturas.slice().buffer, ancho }, 'listo')
  // plan B: lo mismo en el hilo principal
  return leerJson<Mapa>(base() + 'mapa.json.gz').then((mapa) => construirSuelo(lienzo, (c) => c as HTMLCanvasElement, meta, alturas, mapa, ancho))
}

export function cargarDatos() {
  promesa ??= (async () => {
    useEstado.getState().setCarga({ texto: 'descargando' })
    const pMeta = leerJson<Meta>(base() + 'meta.json')
    const pAlturas = descargar(base() + 'terreno.bin')
    // el worker arranca en cuanto tiene lo suyo, sin esperar al suelo
    const trozos = Promise.all([descargar(base() + 'edificios.bin.gz'), pAlturas, pMeta]).then(([e, a, m]) => levantarEdificios(e, a.slice(0), m))
    const [meta, alturasBuf] = await Promise.all([pMeta, pAlturas])
    const alturas = new Int16Array(alturasBuf)
    const suelo = levantarSuelo(meta, alturas)
    // si fallan antes de que la escena las pida, que no salga «Uncaught (in promise)»: el error llega por use()
    trozos.catch(() => {})
    suelo.catch(() => {})
    const { rect } = meta
    const alturaM = crearAlturaM(meta, alturas)
    return {
      meta,
      alturas,
      trozos,
      suelo,
      alturaM,
      alturaY: (x, z) => metrosAY(Math.max(alturaM(x, z), 0)),
      limites: { xMin: rect.uMin / ESCALA, xMax: rect.uMax / ESCALA, zMin: rect.vMin / ESCALA, zMax: rect.vMax / ESCALA },
    }
  })()
  return promesa
}

/** «Reintentar»: la próxima llamada vuelve a descargarlo todo. */
export function reiniciarDatos() {
  promesa = null
  recibidos = 0
  useEstado.getState().setCarga({ progreso: 0, texto: 'preparando', listo: false })
}

/** El mar y las dársenas, con la máscara del suelo. */
export const esAgua = (d: DatosCiudad, s: Suelo, x: number, z: number) => esAguaEn(s.mascara, d.meta, d.alturaM, x, z)

export type Plano = { meta: Meta; imagen: ImageBitmap | HTMLCanvasElement }
let plano: Promise<Plano> | null = null

/** Versión ligera: solo el mapa 2D (relieve, áreas y calles), sin three ni edificios. */
export function cargarPlano() {
  plano ??= (async () => {
    const [meta, alturasBuf] = await Promise.all([leerJson<Meta>(base() + 'meta.json'), descargar(base() + 'terreno.bin')])
    const alturas = new Int16Array(alturasBuf)
    // en móviles flojos, 2048 px de ancho bastan para el mapa
    const ancho = Math.min(2048, sondeo.maxTextura || 2048)
    if (dibujaEnWorker) return { meta, imagen: await pedirAlWorker<ImageBitmap>({ meta, alturas: alturasBuf, ancho, plano: true }, 'plano') }
    const mapa = await leerJson<Mapa>(base() + 'mapa.json.gz')
    return { meta, imagen: pintarSuelo(lienzo, meta, alturas, mapa, ancho) as HTMLCanvasElement }
  })()
  plano.catch(() => {
    plano = null
  })
  return plano
}
