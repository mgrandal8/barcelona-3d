import { useEffect } from 'react'
import { useEstado, type Dialogo } from '../store'

const OPCIONES: { id: Dialogo; icono: string; nombre: string }[] = [
  { id: 'tours', icono: '🧭', nombre: 'Tours' },
  { id: 'guia', icono: '👋', nombre: 'El guía' },
  { id: 'ayuda', icono: '?', nombre: 'Ayuda' },
]

/** Accesos a los tours, al guía y a la ayuda de controles. */
export function Menu() {
  const dialogo = useEstado((s) => s.dialogo)
  const setDialogo = useEstado((s) => s.setDialogo)

  // «?» abre la ayuda desde cualquier sitio
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === '?' && !useEstado.getState().portada) setDialogo('ayuda')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [setDialogo])

  return (
    <nav className="menu" aria-label="Menú">
      {OPCIONES.map((o) => (
        <button key={o.id} className={dialogo === o.id ? 'activo' : ''} onClick={() => setDialogo(o.id)} title={o.nombre}>
          <span aria-hidden className={o.id === 'ayuda' ? 'menu-ayuda' : ''}>
            {o.icono}
          </span>
          <small>{o.nombre}</small>
        </button>
      ))}
    </nav>
  )
}
