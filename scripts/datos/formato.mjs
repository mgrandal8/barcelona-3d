// Formato de edificios.bin.gz (v2), pensado para que gzip lo comprima bien:
//   cabecera   'BCN2', Uint32 n, Uint32 total de puntos
//   columnas   Uint16 nPts[n], Uint16 altura en dm[n], Uint16 base en dm[n],
//              Int16 (u, v)[total] en medios metros, Uint8 tipo[n] (tipo | zona << 4)
// Las coordenadas van en deltas: el primer punto de cada edificio respecto al primero del anterior,
// y los demás respecto al punto anterior. Los edificios vecinos van seguidos, así que casi todo son números pequeños.
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

/** edificios: [{ p: [[u, v] en medios metros, enteros], alto: dm, base: dm, tipo }] */
export function escribirEdificios(ruta, edificios) {
  const n = edificios.length
  const total = edificios.reduce((s, e) => s + e.p.length, 0)
  const buf = Buffer.alloc(12 + n * 6 + total * 4 + n)
  buf.write('BCN2', 0, 'ascii')
  buf.writeUInt32LE(n, 4)
  buf.writeUInt32LE(total, 8)
  let oN = 12
  let oA = oN + n * 2
  let oB = oA + n * 2
  let oC = oB + n * 2
  let oT = oC + total * 4
  let pu = 0
  let pv = 0
  for (const e of edificios) {
    oN = buf.writeUInt16LE(e.p.length, oN)
    oA = buf.writeUInt16LE(Math.min(65535, e.alto), oA)
    oB = buf.writeUInt16LE(e.base, oB)
    oT = buf.writeUInt8(e.tipo, oT)
    let [lu, lv] = [pu, pv]
    e.p.forEach(([u, v], k) => {
      oC = buf.writeInt16LE(u - lu, oC)
      oC = buf.writeInt16LE(v - lv, oC)
      if (k === 0) [pu, pv] = [u, v]
      ;[lu, lv] = [u, v]
    })
  }
  return escribirGz(ruta, buf)
}

/** Guarda precomprimido: el navegador lo descomprime con DecompressionStream, sirva como sirva el servidor. */
export function escribirGz(ruta, datos) {
  const gz = gzipSync(datos, { level: 9 })
  writeFileSync(ruta, gz)
  return gz.length
}
