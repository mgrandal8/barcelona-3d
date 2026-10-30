/// <reference lib="webworker" />
import { construirSuelo, pintarSuelo, transferibles, type Mapa, type Suelo } from './suelo'
import { descomprimir } from './gzip'
import type { Meta } from './relieve'

// Descarga el mapa de OSM y dibuja con OffscreenCanvas la textura del suelo, la de las farolas y la máscara;
// con ella, la malla del terreno, el zócalo y los árboles. El hilo principal solo monta las geometrías.
// Con `plano`, solo la textura del suelo: es el mapa 2D de la versión ligera.

export type Pedido = { url: string; meta: Meta; alturas: ArrayBuffer; ancho: number; plano?: boolean }
export type Respuesta =
  | { tipo: 'bytes'; n: number }
  | { tipo: 'listo'; suelo: Suelo }
  | { tipo: 'plano'; imagen: ImageBitmap }
  | { tipo: 'error'; mensaje: string }

const responder = (r: Respuesta, transferir: Transferable[] = []) => postMessage(r, transferir)

/** Descarga contando los bytes, para la barra de carga del hilo principal. */
async function descargar(url: string) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  if (!r.body) return r.arrayBuffer()
  const trozos: Uint8Array[] = []
  const lector = r.body.getReader()
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    trozos.push(value)
    responder({ tipo: 'bytes', n: value.length })
  }
  return new Blob(trozos as BlobPart[]).arrayBuffer()
}

const crear = (ancho: number, alto: number) => new OffscreenCanvas(ancho, alto)

onmessage = async ({ data }: MessageEvent<Pedido>) => {
  try {
    const mapa = JSON.parse(new TextDecoder().decode(await descomprimir(await descargar(data.url)))) as Mapa
    const alturas = new Int16Array(data.alturas)
    if (data.plano) {
      const imagen = (pintarSuelo(crear, data.meta, alturas, mapa, data.ancho, true) as OffscreenCanvas).transferToImageBitmap()
      responder({ tipo: 'plano', imagen }, [imagen])
      return
    }
    const suelo = construirSuelo(crear, (l) => (l as OffscreenCanvas).transferToImageBitmap(), data.meta, alturas, mapa, data.ancho)
    responder({ tipo: 'listo', suelo }, transferibles(suelo))
  } catch (e) {
    responder({ tipo: 'error', mensaje: String(e) })
  }
}
