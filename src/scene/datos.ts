import { ESCALA, metrosAY } from './geo'
import { crearAlturaM, type Meta } from './relieve'
import type { Trozo } from './edificios'
import type { Pedido, Respuesta } from './edificios.worker'
import { HUECOS } from '../data/monumentos'
import { useEstado } from '../store'

export type { Meta }
export type Area = { t: string; r: number[][] }
export type Linea = { t: string; a: number; p: number[] }

export type DatosCiudad = {
  meta: Meta
  alturas: Int16Array
  /** Edificios ya extruidos por el worker; llegan después que el resto. */
  trozos: Promise<Trozo[]>
  areas: Area[]
  lineas: Linea[]
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
    recibidos += value.length
    // la descarga ocupa el 70 % de la barra; el resto es levantar la ciudad
    useEstado.getState().setCarga({ progreso: Math.min(0.7, (recibidos / BYTES_ESTIMADOS) * 0.7) })
  }
  const out = new Uint8Array(n)
  let o = 0
  for (const t of trozos) {
    out.set(t, o)
    o += t.length
  }
  return out.buffer
}

/** gzip (1f 8b) → descomprime; si el servidor ya lo ha descomprimido, se usa tal cual. */
async function descomprimir(buf: ArrayBuffer) {
  const b = new Uint8Array(buf, 0, 2)
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
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

export function cargarDatos() {
  promesa ??= (async () => {
    const base = import.meta.env.BASE_URL + 'datos/'
    useEstado.getState().setCarga({ texto: 'descargando' })
    const pMeta = leerJson<Meta>(base + 'meta.json')
    const pAlturas = descargar(base + 'terreno.bin')
    // el worker arranca en cuanto tiene lo suyo, sin esperar al mapa
    const trozos = Promise.all([descargar(base + 'edificios.bin.gz'), pAlturas, pMeta]).then(([e, a, m]) => levantarEdificios(e, a.slice(0), m))
    const [meta, alturasBuf, mapa] = await Promise.all([pMeta, pAlturas, leerJson<{ areas: Area[]; lineas: Linea[] }>(base + 'mapa.json.gz')])
    useEstado.getState().setCarga({ texto: 'levantando' })
    const alturas = new Int16Array(alturasBuf)
    const { rect } = meta
    const alturaM = crearAlturaM(meta, alturas)
    return {
      meta,
      alturas,
      trozos,
      areas: mapa.areas,
      lineas: mapa.lineas,
      alturaM,
      alturaY: (x, z) => metrosAY(Math.max(alturaM(x, z), 0)),
      limites: { xMin: rect.uMin / ESCALA, xMax: rect.uMax / ESCALA, zMin: rect.vMin / ESCALA, zMax: rect.vMax / ESCALA },
    }
  })()
  return promesa
}
