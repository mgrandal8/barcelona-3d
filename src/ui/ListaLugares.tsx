import { useState } from 'react'
import { useLugares, useT } from '../i18n'
import { useEstado } from '../store'

export function ListaLugares() {
  const seleccionado = useEstado((s) => s.seleccionado)
  const hover = useEstado((s) => s.hover)
  const { setSeleccionado, setHover } = useEstado.getState()
  const lugares = useLugares()
  const t = useT().lista
  // en móvil empieza plegada y se pliega al elegir, para dejar ver el mapa
  const movil = () => innerWidth <= 720
  const [abierta, setAbierta] = useState(() => !movil())

  return (
    <nav className={`lista ${abierta ? 'abierta' : ''}`} aria-label={t.etiqueta}>
      <header className="lista-cabecera">
        <h1>
          Barcelona <span>3D</span>
        </h1>
        <button onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
          {abierta ? t.ocultar : t.lugares}
        </button>
      </header>
      {abierta && (
        <ol>
          {lugares.map((m, i) => (
            <li key={m.id}>
              <button
                className={[m.id === seleccionado && 'activo', m.id === hover && 'hover'].filter(Boolean).join(' ')}
                onClick={() => {
                  setSeleccionado(m.id)
                  if (movil()) setAbierta(false)
                }}
                onMouseEnter={() => setHover(m.id)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="lista-num">{i + 1}</span>
                <span>
                  <strong>{m.nombre}</strong>
                  <small>{m.etiqueta}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  )
}
