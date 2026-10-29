import { useEstado } from '../store'
import type { Momento } from '../scene/momento'

const OPCIONES: { id: Momento; icono: string; nombre: string }[] = [
  { id: 'dia', icono: '☀️', nombre: 'Día' },
  { id: 'atardecer', icono: '🌅', nombre: 'Atardecer' },
  { id: 'noche', icono: '🌙', nombre: 'Noche' },
]

/** Cambia la hora de la maqueta: luz, cielo y luces de la ciudad. */
export function SelectorHora() {
  const momento = useEstado((s) => s.momento)
  const setMomento = useEstado((s) => s.setMomento)
  return (
    <div className="hora" role="radiogroup" aria-label="Hora del día">
      {OPCIONES.map((o) => (
        <button key={o.id} role="radio" aria-checked={momento === o.id} className={momento === o.id ? 'activo' : ''} onClick={() => setMomento(o.id)} title={o.nombre}>
          <span aria-hidden>{o.icono}</span>
          <small>{o.nombre}</small>
        </button>
      ))}
    </div>
  )
}
