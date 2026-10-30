// Sin dependencias: lo usan el hilo principal y los workers.

/** gzip (1f 8b) → descomprime; si el servidor ya lo ha descomprimido, se usa tal cual. */
export async function descomprimir(buf: ArrayBuffer) {
  const b = new Uint8Array(buf, 0, 2)
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}
