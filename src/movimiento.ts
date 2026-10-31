// «Reducir movimiento» del sistema, sin three: lo leen la cámara (vuelos), el anillo, la ruta y la portada.
// Se escucha el cambio, por si se activa con la página abierta.

const consulta = matchMedia('(prefers-reduced-motion: reduce)')
let reducido = consulta.matches
consulta.addEventListener?.('change', (e) => (reducido = e.matches))

export const movimientoReducido = () => reducido
