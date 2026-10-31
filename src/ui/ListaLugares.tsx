import { useState } from 'react'
import { useLugares, useT } from '../i18n'
import { useEstado } from '../store'
import { distanciaM, formatoDistancia } from '../ubicacion'

export function ListaLugares() {
  const seleccionado = useEstado((s) => s.seleccionado)
  const hover = useEstado((s) => s.hover)
  const { setSeleccionado, setHover } = useEstado.getState()
  const tt = useT()
  const t = tt.lista
  const idioma = useEstado((s) => s.idioma)
  const u = useEstado((s) => s.ubicacion)
  const conDistancia = u?.dentro ? u : null
  const [cerca, setCerca] = useState(false)
  // el número es el de la guía; «cerca de mí» solo cambia el orden
  const lugares = useLugares().map((m, i) => ({ m, n: i + 1, d: conDistancia ? distanciaM(conDistancia, m.pos) : null }))
  if (cerca && conDistancia) lugares.sort((a, b) => a.d! - b.d!)
  // en móvil empieza plegada y se pliega al elegir, para dejar ver el mapa
  const movil = () => innerWidth <= 720
  const [abierta, setAbierta] = useState(() => !movil())

  return (
    <nav id="lista" tabIndex={-1} className={`lista ${abierta ? 'abierta' : ''}`} aria-label={t.etiqueta}>
      <header className="lista-cabecera">
        <h1>
          Barcelona <span>3D</span>
        </h1>
        <button onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
          {abierta ? t.ocultar : t.lugares}
        </button>
      </header>
      {abierta && conDistancia && (
        <label className="lista-cerca">
          <input type="checkbox" checked={cerca} onChange={(e) => setCerca(e.target.checked)} /> {tt.ubicacion.cerca}
        </label>
      )}
      {abierta && (
        <ol>
          {lugares.map(({ m, n, d }) => (
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
                <span className="lista-num">{n}</span>
                <span>
                  <strong>{m.nombre}</strong>
                  <small>
                    {m.etiqueta}
                    {d !== null && ` · ${formatoDistancia(d, idioma)}`}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  )
}
