import { useEffect, useRef, type ReactNode } from 'react'
import { porId } from '../data/monumentos'
import { TOURS } from '../data/tours'
import { useEstado } from '../store'

const HORAS = { dia: '☀️ De día', atardecer: '🌅 Al atardecer', noche: '🌙 De noche' }

/** Ventana modal con fondo; se cierra con Esc, con la ✕ o pulsando fuera. */
function Dialogo({ titulo, ancho, children }: { titulo: string; ancho?: number; children: ReactNode }) {
  const setDialogo = useEstado((s) => s.setDialogo)
  const ref = useRef<HTMLDivElement>(null)
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
          <button className="panel-cerrar" onClick={() => setDialogo(null)} aria-label="Cerrar">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

function Tours() {
  const empezarTour = useEstado((s) => s.empezarTour)
  return (
    <Dialogo titulo="Tours de ejemplo" ancho={960}>
      <p className="dialogo-intro">Tres rutas a pie con guía. Al empezar una, la maqueta te lleva de parada en parada.</p>
      <div className="tours">
        {TOURS.map((t) => (
          <article key={t.id} className="tour" style={{ ['--color' as string]: t.color }}>
            <div className="tour-cabecera">
              <span className="tour-icono" aria-hidden>
                {t.icono}
              </span>
              <div>
                <h3>{t.nombre}</h3>
                <small>
                  {t.duracion} · {HORAS[t.momento]}
                </small>
              </div>
            </div>
            <p>{t.resumen}</p>
            <ol className="tour-paradas">
              {t.paradas.map((p) => (
                <li key={p.id}>{porId(p.id)?.nombre}</li>
              ))}
            </ol>
            <footer>
              <strong>{t.precio}</strong>
              <button className="primario" onClick={() => empezarTour(t.id)}>
                Empezar tour
              </button>
            </footer>
          </article>
        ))}
      </div>
    </Dialogo>
  )
}

function Guia() {
  return (
    <Dialogo titulo="Sobre el guía" ancho={560}>
      <div className="guia">
        <div className="guia-avatar" aria-hidden>
          LP
        </div>
        <div>
          <h3>Laia Puig</h3>
          <p className="guia-sub">Guía oficial de Catalunya · 12 años enseñando la ciudad</p>
        </div>
      </div>
      <p>
        Nací en Gràcia y estudié Historia del Arte en la Universitat de Barcelona. Me encanta contar la ciudad a pie, sin prisas: el
        detalle que se esconde en una fachada modernista, la plaza donde se toma el vermut o el mejor sitio para ver el atardecer.
      </p>
      <ul className="guia-datos">
        <li>
          <strong>Idiomas</strong> español, catalán, inglés e italiano
        </li>
        <li>
          <strong>Grupos</strong> de 2 a 12 personas
        </li>
        <li>
          <strong>Valoración</strong> ★★★★★ 4,9 (ejemplo)
        </li>
      </ul>
      <blockquote>«Barcelona se entiende mejor desde arriba… y luego se disfruta perdiéndose por sus calles.»</blockquote>
      <p className="panel-aviso">Personaje ficticio creado para esta demo.</p>
    </Dialogo>
  )
}

function Ayuda() {
  const tactil = matchMedia('(pointer: coarse)').matches
  const filas: [string, string][] = tactil
    ? [
        ['Un dedo', 'Girar la maqueta'],
        ['Pellizcar', 'Acercar y alejar'],
        ['Dos dedos', 'Desplazar el mapa'],
        ['Tocar un pin', 'Ir al lugar y abrir su ficha'],
      ]
    : [
        ['Arrastrar', 'Girar la maqueta'],
        ['Rueda', 'Acercar y alejar'],
        ['Clic derecho + arrastrar', 'Desplazar el mapa'],
        ['Clic en un pin', 'Ir al lugar y abrir su ficha'],
        ['Esc', 'Cerrar la ficha y volver al mapa'],
        ['?', 'Abrir esta ayuda'],
      ]
  return (
    <Dialogo titulo="Cómo moverse" ancho={480}>
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
      <p className="dialogo-intro">
        La lista de la izquierda lleva a cada lugar, y los botones de abajo cambian la hora: de noche se encienden las ventanas, las
        farolas y la Font Màgica.
      </p>
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
