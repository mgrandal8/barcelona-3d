import { useEffect } from 'react'
import { useT } from '../i18n'
import { useEstado, type Dialogo } from '../store'
import { SelectorIdioma } from './SelectorIdioma'

const OPCIONES: { id: Dialogo; icono: string }[] = [
  { id: 'tours', icono: '🧭' },
  { id: 'guia', icono: '👋' },
  { id: 'ayuda', icono: '?' },
]

/** Accesos a los tours, al guía y a la ayuda de controles. */
export function Menu() {
  const dialogo = useEstado((s) => s.dialogo)
  const setDialogo = useEstado((s) => s.setDialogo)
  const t = useT().menu

  // «?» abre la ayuda desde cualquier sitio
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === '?' && !useEstado.getState().portada) setDialogo('ayuda')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [setDialogo])

  return (
    <nav className="menu" aria-label={t.etiqueta}>
      {OPCIONES.map((o) => (
        <button key={o.id} className={dialogo === o.id ? 'activo' : ''} onClick={() => setDialogo(o.id)} title={t[o.id]}>
          <span aria-hidden className={o.id === 'ayuda' ? 'menu-ayuda' : ''}>
            {o.icono}
          </span>
          <small>{t[o.id]}</small>
        </button>
      ))}
      <SelectorIdioma />
    </nav>
  )
}
