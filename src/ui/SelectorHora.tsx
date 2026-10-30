import { useT } from '../i18n'
import { useEstado } from '../store'
import type { Momento } from '../scene/momento'
import { Icono, type NombreIcono } from './Icono'

export const ICONO_HORA: Record<Momento, NombreIcono> = { dia: 'sol', atardecer: 'atardecer', noche: 'luna' }
const OPCIONES: Momento[] = ['dia', 'atardecer', 'noche']

/** Cambia la hora de la maqueta: luz, cielo y luces de la ciudad. */
export function SelectorHora() {
  const momento = useEstado((s) => s.momento)
  const setMomento = useEstado((s) => s.setMomento)
  const t = useT().hora
  return (
    <div className="hora" role="radiogroup" aria-label={t.etiqueta}>
      {OPCIONES.map((o) => (
        <button key={o} role="radio" aria-checked={momento === o} className={momento === o ? 'activo' : ''} onClick={() => setMomento(o)} title={t[o]}>
          <Icono nombre={ICONO_HORA[o]} />
          <small>{t[o]}</small>
        </button>
      ))}
    </div>
  )
}
