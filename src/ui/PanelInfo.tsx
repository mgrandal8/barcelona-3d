import { useEffect } from 'react'
import { MONUMENTOS } from '../data/monumentos'
import { useLugar, useT, useTour } from '../i18n'
import { useEstado } from '../store'
import { distanciaM, formatoDistancia, minutosAPie } from '../ubicacion'

export function PanelInfo() {
  const id = useEstado((s) => s.seleccionado)
  const setSeleccionado = useEstado((s) => s.setSeleccionado)
  const tour = useTour(useEstado((s) => s.tour))
  const m = useLugar(id)
  const tt = useT()
  const t = tt.panel
  const idioma = useEstado((s) => s.idioma)
  const u = useEstado((s) => s.ubicacion)
  const dist = m && u?.dentro ? distanciaM(u, m.pos) : null
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
          <button className="panel-cerrar" onClick={() => setSeleccionado(null)} aria-label={t.volverMapa}>
            ✕
          </button>
          {tour && parada && (
            <div className="panel-tour" style={{ ['--color' as string]: tour.color }}>
              <p>
                <span aria-hidden>{tour.icono}</span> {tour.nombre} · {t.parada(i + 1, tour.paradas.length)}
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
          {dist !== null && <p className="panel-distancia">📍 {tt.ubicacion.deTi(formatoDistancia(dist, idioma), minutosAPie(dist))}</p>}
          <p className="panel-texto">{m.descripcion}</p>
          <dl className="panel-datos">
            <div>
              <dt>{t.horario}</dt>
              <dd>{m.horario}</dd>
            </div>
            <div>
              <dt>{t.precio}</dt>
              <dd>{m.precio}</dd>
            </div>
            <div>
              <dt>{t.duracion}</dt>
              <dd>{m.duracion}</dd>
            </div>
          </dl>
          <div className="panel-consejo">
            <strong>{t.consejo}</strong>
            <p>{m.consejo}</p>
          </div>
          {tour ? (
            <div className="panel-nav">
              <button onClick={() => ir(-1)} disabled={i === 0}>
                {t.anterior}
              </button>
              {i < tour.paradas.length - 1 ? (
                <button className="primario" onClick={() => ir(1)}>
                  {t.siguienteParada}
                </button>
              ) : (
                <button className="primario" onClick={() => setSeleccionado(null)}>
                  {t.terminarTour}
                </button>
              )}
            </div>
          ) : (
            <div className="panel-nav">
              <button onClick={() => ir(-1)}>{t.anterior}</button>
              <button className="primario" onClick={() => setSeleccionado(null)}>
                {t.volverMapa}
              </button>
              <button onClick={() => ir(1)}>{t.siguiente}</button>
            </div>
          )}
          <p className="panel-aviso">{t.aviso}</p>
        </>
      )}
    </aside>
  )
}
