import { useT } from '../i18n'
import { useEstado } from '../store'
import type { Momento } from '../scene/momento'

const OPCIONES: { id: Momento; icono: string }[] = [
  { id: 'dia', icono: '☀️' },
  { id: 'atardecer', icono: '🌅' },
  { id: 'noche', icono: '🌙' },
]

/** Cambia la hora de la maqueta: luz, cielo y luces de la ciudad. */
export function SelectorHora() {
  const momento = useEstado((s) => s.momento)
  const setMomento = useEstado((s) => s.setMomento)
  const t = useT().hora
  return (
    <div className="hora" role="radiogroup" aria-label={t.etiqueta}>
      {OPCIONES.map((o) => (
        <button key={o.id} role="radio" aria-checked={momento === o.id} className={momento === o.id ? 'activo' : ''} onClick={() => setMomento(o.id)} title={t[o.id]}>
          <span aria-hidden>{o.icono}</span>
          <small>{t[o.id]}</small>
        </button>
      ))}
    </div>
  )
}
