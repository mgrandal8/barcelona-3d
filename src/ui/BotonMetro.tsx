import { useT } from '../i18n'
import { useEstado } from '../store'

/** Enciende y apaga la capa de metro. */
export function BotonMetro() {
  const metro = useEstado((s) => s.metro)
  const setMetro = useEstado((s) => s.setMetro)
  const t = useT().metro
  return (
    <button
      className={`metro-boton ${metro ? 'activo' : ''}`}
      onClick={() => setMetro(!metro)}
      aria-pressed={metro}
      title={metro ? t.ocultar : t.mostrar}
      aria-label={metro ? t.ocultar : t.mostrar}
    >
      <span aria-hidden>M</span>
    </button>
  )
}
