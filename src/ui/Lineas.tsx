import { estacionCercana, textoSobre, type Transporte } from '../transporte'

/** Insignias de colores con las líneas de una estación: [L2][L5]. */
export function Lineas({ refs, t }: { refs: string[]; t: Transporte }) {
  return (
    <span className="lineas">
      {refs.map((r) => (
        <span key={r} className="linea" style={{ background: t.colores[r], color: textoSobre(t.colores[r] ?? '#888888') }}>
          {r}
        </span>
      ))}
    </span>
  )
}

/** «[L2][L5] Sagrada Família · 150 m» */
export function EstacionCercana({ t, x, z, formato }: { t: Transporte; x: number; z: number; formato: (m: number) => string }) {
  const c = estacionCercana(t, x, z)
  if (!c) return null
  return (
    <span className="estacion-cercana">
      <Lineas refs={c.estacion.l} t={t} /> <span className="estacion-nombre">{c.estacion.n}</span> · {formato(c.metros)}
    </span>
  )
}
