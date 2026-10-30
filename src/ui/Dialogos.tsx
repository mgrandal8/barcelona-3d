import { useEffect, useRef, type ReactNode } from 'react'
import { traducirLugar, useT, useTours } from '../i18n'
import { porId } from '../data/monumentos'
import { useEstado } from '../store'
import { SinConexion } from './AvisoRed'
import { Icono } from './Icono'
import { ICONO_HORA } from './SelectorHora'

/** Ventana modal con fondo; se cierra con Esc, con la ✕ o pulsando fuera. */
function Dialogo({ titulo, ancho, children }: { titulo: string; ancho?: number; children: ReactNode }) {
  const setDialogo = useEstado((s) => s.setDialogo)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  useEffect(() => {
    ref.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialogo(null)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [setDialogo])
  return (
    <div className="dialogo-fondo" onClick={(e) => e.target === e.currentTarget && setDialogo(null)}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref} style={{ maxWidth: ancho }}>
        <header className="dialogo-cabecera">
          <h2>{titulo}</h2>
          <button className="panel-cerrar" onClick={() => setDialogo(null)} aria-label={t.cerrar}>
            <Icono nombre="cerrar" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

function Tours() {
  const empezarTour = useEstado((s) => s.empezarTour)
  const idioma = useEstado((s) => s.idioma)
  const tx = useT()
  const horas = { dia: tx.hora.tourDia, atardecer: tx.hora.tourAtardecer, noche: tx.hora.tourNoche }
  return (
    <Dialogo titulo={tx.tours.titulo} ancho={960}>
      <p className="dialogo-intro">{tx.tours.intro}</p>
      <div className="tours">
        {useTours().map((t) => (
          <article key={t.id} className="tour" style={{ ['--color' as string]: t.color }}>
            <div className="tour-cabecera">
              <span className="tour-icono">
                <Icono nombre={t.icono} />
              </span>
              <div>
                <h3>{t.nombre}</h3>
                <small>
                  {t.duracion} · <Icono nombre={ICONO_HORA[t.momento]} /> {horas[t.momento]}
                </small>
              </div>
            </div>
            <p>{t.resumen}</p>
            <ol className="tour-paradas">
              {t.paradas.map((p) => (
                <li key={p.id}>{traducirLugar(porId(p.id)!, idioma).nombre}</li>
              ))}
            </ol>
            <footer>
              <strong>{t.precio}</strong>
              <button className="primario" onClick={() => empezarTour(t.id)}>
                {tx.tours.empezar}
              </button>
            </footer>
          </article>
        ))}
      </div>
    </Dialogo>
  )
}

function Guia() {
  const t = useT().guia
  return (
    <Dialogo titulo={t.titulo} ancho={560}>
      <div className="guia">
        <div className="guia-avatar" aria-hidden>
          LP
        </div>
        <div>
          <h3>Laia Puig</h3>
          <p className="guia-sub">{t.sub}</p>
        </div>
      </div>
      <p>{t.bio}</p>
      <ul className="guia-datos">
        <li>
          <strong>{t.idiomasEt}</strong> {t.idiomas}
        </li>
        <li>
          <strong>{t.gruposEt}</strong> {t.grupos}
        </li>
        <li>
          <strong>{t.valoracionEt}</strong>{' '}
          <span className="estrellas">
            {[0, 1, 2, 3, 4].map((i) => (
              <Icono key={i} nombre="estrella" />
            ))}
          </span>{' '}
          {t.valoracion}
        </li>
      </ul>
      <blockquote>{t.cita}</blockquote>
      <p className="panel-aviso">{t.aviso}</p>
    </Dialogo>
  )
}

function Ayuda() {
  const t = useT().ayuda
  const tactil = matchMedia('(pointer: coarse)').matches
  const filas = tactil ? t.tactil : t.raton
  return (
    <Dialogo titulo={t.titulo} ancho={480}>
      <dl className="ayuda">
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="dialogo-intro">{t.intro}</p>
      <SinConexion />
    </Dialogo>
  )
}

export function Dialogos() {
  const d = useEstado((s) => s.dialogo)
  if (d === 'tours') return <Tours />
  if (d === 'guia') return <Guia />
  if (d === 'ayuda') return <Ayuda />
  return null
}
