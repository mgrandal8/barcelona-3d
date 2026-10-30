import { useT } from '../i18n'
import { IDIOMAS } from '../i18n/idioma'
import { useEstado } from '../store'

/** Botones ES · EN. */
export function SelectorIdioma() {
  const idioma = useEstado((s) => s.idioma)
  const setIdioma = useEstado((s) => s.setIdioma)
  const t = useT()
  return (
    <div className="idioma" role="radiogroup" aria-label={t.menu.idioma}>
      {IDIOMAS.map((i) => (
        <button key={i} role="radio" aria-checked={idioma === i} className={idioma === i ? 'activo' : ''} onClick={() => setIdioma(i)} lang={i}>
          {i.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
