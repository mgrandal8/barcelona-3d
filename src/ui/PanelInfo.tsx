import { useEffect } from 'react'
import { MONUMENTOS, porId } from '../data/monumentos'
import { tourPorId } from '../data/tours'
import { useEstado } from '../store'

export function PanelInfo() {
  const id = useEstado((s) => s.seleccionado)
  const setSeleccionado = useEstado((s) => s.setSeleccionado)
  const tour = tourPorId(useEstado((s) => s.tour))
  const m = porId(id)
  // en un tour, anterior y siguiente recorren sus paradas; si no, todos los lugares
  const lista = tour ? tour.paradas.map((p) => p.id) : MONUMENTOS.map((x) => x.id)
  const i = lista.indexOf(id ?? '')
  const ir = (paso: number) => setSeleccionado(lista[(i + paso + lista.length) % lista.length])
  const parada = tour?.paradas[i]

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // con un diálogo abierto, Esc cierra solo el diálogo
      if (e.key === 'Escape' && !useEstado.getState().dialogo) setSeleccionado(null)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [setSeleccionado])

  return (
    <aside className={`panel ${m ? 'abierto' : ''}`} aria-hidden={!m}>
      {m && (
        <>
          <button className="panel-cerrar" onClick={() => setSeleccionado(null)} aria-label="Volver al mapa">
            ✕
          </button>
          {tour && parada && (
            <div className="panel-tour" style={{ ['--color' as string]: tour.color }}>
              <p>
                <span aria-hidden>{tour.icono}</span> {tour.nombre} · parada {i + 1} de {tour.paradas.length}
              </p>
              <div className="panel-tour-pasos" aria-hidden>
                {tour.paradas.map((p, k) => (
                  <span key={p.id} className={k <= i ? 'hecho' : ''} />
                ))}
              </div>
              <p className="panel-tour-nota">{parada.nota}</p>
            </div>
          )}
          <p className="panel-etiqueta">
            {m.etiqueta} · {m.barrio}
          </p>
          <h2>{m.nombre}</h2>
          <p className="panel-texto">{m.descripcion}</p>
          <dl className="panel-datos">
            <div>
              <dt>Horario</dt>
              <dd>{m.horario}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{m.precio}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{m.duracion}</dd>
            </div>
          </dl>
          <div className="panel-consejo">
            <strong>Consejo del guía</strong>
            <p>{m.consejo}</p>
          </div>
          {tour ? (
            <div className="panel-nav">
              <button onClick={() => ir(-1)} disabled={i === 0}>
                ← Anterior
              </button>
              {i < tour.paradas.length - 1 ? (
                <button className="primario" onClick={() => ir(1)}>
                  Siguiente parada →
                </button>
              ) : (
                <button className="primario" onClick={() => setSeleccionado(null)}>
                  Terminar tour ✓
                </button>
              )}
            </div>
          ) : (
            <div className="panel-nav">
              <button onClick={() => ir(-1)}>← Anterior</button>
              <button className="primario" onClick={() => setSeleccionado(null)}>
                Volver al mapa
              </button>
              <button onClick={() => ir(1)}>Siguiente →</button>
            </div>
          )}
          <p className="panel-aviso">Datos orientativos de ejemplo.</p>
        </>
      )}
    </aside>
  )
}
