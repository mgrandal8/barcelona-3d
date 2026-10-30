/// <reference lib="webworker" />
import { crearEdificios, leerEdificios, type Trozo } from './edificios'
import { metrosAY } from './geo'
import { crearAlturaM, crearRejilla, type Meta, type Rejilla } from './relieve'
import { descomprimir } from './gzip'

// Descomprime y extruye los 140.000 edificios fuera del hilo principal, que mientras tanto
// prepara el terreno y mantiene viva la pantalla de carga.

export type Pedido = { edificios: ArrayBuffer; alturas: ArrayBuffer; meta: Meta; huecos: { x: number; z: number; r: number }[] }
export type Respuesta = { tipo: 'progreso'; f: number } | { tipo: 'listo'; trozos: Trozo[]; rejilla: Rejilla } | { tipo: 'error'; mensaje: string }

const responder = (r: Respuesta, transferir: Transferable[] = []) => postMessage(r, transferir)

onmessage = async ({ data }: MessageEvent<Pedido>) => {
  try {
    const alturaM = crearAlturaM(data.meta, new Int16Array(data.alturas))
    const edificios = leerEdificios(await descomprimir(data.edificios))
    let ultimo = 0
    const rejilla = crearRejilla(data.meta)
    const trozos = crearEdificios(edificios, (x, z) => metrosAY(Math.max(alturaM(x, z), 0)), data.huecos, 15, (f) => {
      if (f - ultimo < 0.05 && f < 1) return
      ultimo = f
      responder({ tipo: 'progreso', f })
    }, rejilla)
    const transferir = trozos.flatMap((t) => [t.grandes, t.detalle].flatMap((m) => (m ? [m.pos.buffer, m.col.buffer, m.idx.buffer] : [])))
    responder({ tipo: 'listo', trozos, rejilla }, [...transferir, rejilla.y.buffer])
  } catch (e) {
    responder({ tipo: 'error', mensaje: String(e) })
  }
}
