// Vuelos de cámara con curva, sin three: se interpola el punto al que se mira y, alrededor de él, la cámara en
// esféricas (distancia, rumbo e inclinación). En los vuelos largos la cámara sube a media trayectoria y mira más
// hacia abajo, como en los mapas: así se ve de dónde sale y adónde llega. La duración crece con la distancia.

export type V3 = readonly [number, number, number]
/** Posición de la cámara, punto al que mira y desplazamiento focal (la ficha corre el encuadre). */
export type Vista = { pos: V3; obj: V3; foco: V3 }

type Esfericas = { r: number; rumbo: number; incl: number }

function esfericas(pos: V3, obj: V3): Esfericas {
  const dx = pos[0] - obj[0]
  const dy = pos[1] - obj[1]
  const dz = pos[2] - obj[2]
  const r = Math.hypot(dx, dy, dz) || 1e-6
  // inclinación medida desde la vertical (0 = cenital), como el ángulo polar de camera-controls
  return { r, rumbo: Math.atan2(dx, dz), incl: Math.acos(Math.min(1, Math.max(-1, dy / r))) }
}

const mezcla = (a: number, b: number, t: number) => a + (b - a) * t
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Diferencia de ángulos por el camino corto, en (−π, π]. */
function difAngulo(a: number, b: number) {
  let d = (b - a) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
}

export type Plan = {
  /** Segundos. */
  duracion: number
  /** Vista en el instante t ∈ [0, 1]. */
  en: (t: number) => Vista
}

export type Opciones = {
  /** Multiplica la duración (la entrada de la portada va más despacio). */
  lento?: number
  /** Subida extra a media trayectoria, en unidades (por defecto, según la distancia). */
  subida?: number
}

/** Plan de vuelo de `a` a `b`. */
export function planVuelo(a: Vista, b: Vista, op: Opciones = {}): Plan {
  const ea = esfericas(a.pos, a.obj)
  const eb = esfericas(b.pos, b.obj)
  const dRumbo = difAngulo(ea.rumbo, eb.rumbo)
  // distancia entre los puntos a los que se mira (en planta) y cambio de zoom
  const d = Math.hypot(b.obj[0] - a.obj[0], b.obj[2] - a.obj[2])
  const zoom = Math.abs(Math.log(eb.r / ea.r))
  // la subida es la que hace falta para ver los dos extremos a la vez, menos lo que ya se ve desde los extremos
  // (desde la vista general, lejos, ya se ve todo: se baja directamente)
  const [rMin, rMax] = [Math.min(ea.r, eb.r), Math.max(ea.r, eb.r)]
  const subida = op.subida ?? Math.max(0, Math.min(70, d * 0.9 - rMin * 0.6 - rMax * 0.3))
  // a más subida, más cenital a mitad de camino (sin pasar de 0,35 rad)
  const inclMedia = Math.min(mezcla(ea.incl, eb.incl, 0.5), Math.max(0.35, 0.95 - subida / 80))
  const duracion = Math.min(4.2, Math.max(0.9, 0.7 + 0.32 * Math.sqrt(d) + 0.35 * zoom + 0.25 * Math.abs(dRumbo))) * (op.lento ?? 1)

  const en = (t: number): Vista => {
    const s = suave(Math.min(1, Math.max(0, t)))
    const arco = Math.sin(Math.PI * s)
    // la distancia se interpola en escala logarítmica (acercarse mucho no es brusco al final) y sube en el arco
    const r = Math.exp(mezcla(Math.log(ea.r), Math.log(eb.r), s)) + subida * arco
    const rumbo = ea.rumbo + dRumbo * s
    const incl0 = mezcla(ea.incl, eb.incl, s)
    const incl = mezcla(incl0, Math.min(incl0, inclMedia), arco)
    const obj: V3 = [mezcla(a.obj[0], b.obj[0], s), mezcla(a.obj[1], b.obj[1], s), mezcla(a.obj[2], b.obj[2], s)]
    const pos: V3 = [
      obj[0] + r * Math.sin(incl) * Math.sin(rumbo),
      obj[1] + r * Math.cos(incl),
      obj[2] + r * Math.sin(incl) * Math.cos(rumbo),
    ]
    const foco: V3 = [mezcla(a.foco[0], b.foco[0], s), mezcla(a.foco[1], b.foco[1], s), mezcla(a.foco[2], b.foco[2], s)]
    return { pos, obj, foco }
  }
  return { duracion, en }
}
