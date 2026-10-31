import { useEffect } from 'react'
import { useT } from '../i18n'
import { useEstado, type Dialogo } from '../store'
import { SelectorIdioma } from './SelectorIdioma'
import { Icono, type NombreIcono } from './Icono'

const OPCIONES: { id: Dialogo; icono: NombreIcono }[] = [
  { id: 'tours', icono: 'brujula' },
  { id: 'guia', icono: 'guia' },
  { id: 'ayuda', icono: 'ayuda' },
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
          <Icono nombre={o.icono} />
          <small>{t[o.id]}</small>
        </button>
      ))}
      <SelectorIdioma />
    </nav>
  )
}
