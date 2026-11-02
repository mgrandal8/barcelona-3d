import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { fechaLarga, traducirLugar, useLugares, useT, useTours } from '../i18n'
import { CONSULTADO, porId } from '../data/monumentos'
import { ANALITICA } from '../analitica'
import { REGISTRO_REMOTO } from '../registro'
import { useEstado } from '../store'
import { SinConexion } from './AvisoRed'
import { Icono } from './Icono'
import { EMBEBIDO, reservar, toursPropios } from '../embebido'
import { ICONO_MOMENTO } from '../scene/momento'

const ENFOCABLES = 'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])'

/** Ventana modal con fondo; se cierra con Esc, con la ✕ o pulsando fuera. El foco no sale de ella y, al cerrar, vuelve adonde estaba. */
function Dialogo({ titulo, ancho, children }: { titulo: string; ancho?: number; children: ReactNode }) {
  const setDialogo = useEstado((s) => s.setDialogo)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialogo(null)
      if (e.key !== 'Tab' || !ref.current) return
      // Tab da la vuelta dentro del diálogo
      const lista = [...ref.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (!lista.length) return
      const [primero, ultimo] = [lista[0], lista[lista.length - 1]]
      const fuera = !ref.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === ref.current || fuera)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (document.activeElement === ultimo || fuera)) {
        e.preventDefault()
        primero.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      if (antes?.isConnected) antes.focus()
    }
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
  const reproducirTour = useEstado((s) => s.reproducirTour)
  const idioma = useEstado((s) => s.idioma)
  const tx = useT()
  const horas = { dia: tx.hora.tourDia, atardecer: tx.hora.tourAtardecer, noche: tx.hora.tourNoche }
  return (
    <Dialogo titulo={toursPropios ? tx.tours.tituloPropios : tx.tours.titulo} ancho={960}>
      <p className="dialogo-intro">{toursPropios ? tx.tours.introPropios : tx.tours.intro}</p>
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
                  {t.duracion} · <Icono nombre={ICONO_MOMENTO[t.momento]} /> {horas[t.momento]}
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
              <button className="tour-play" onClick={() => reproducirTour(t.id)} aria-label={tx.tours.reproducirEtiqueta(t.nombre)}>
                <Icono nombre="play" /> {tx.tours.reproducir}
              </button>
              <button className="primario" onClick={() => empezarTour(t.id)}>
                {tx.tours.empezar}
              </button>
              {EMBEBIDO && t.reserva && (
                <button className="tour-reservar" onClick={() => reservar(t.reserva!, null, t.id)} aria-label={tx.tours.reservarEtiqueta(t.nombre)}>
                  {tx.panel.reservar}
                </button>
              )}
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
      <p className="dialogo-pie">
        <button className="enlace" onClick={() => useEstado.getState().setDialogo('legal')}>
          {useT().legal.titulo}
        </button>
      </p>
    </Dialogo>
  )
}

// la imagen para redes y el enlace solo se cargan al abrir el diálogo
const Compartir = lazy(() => import('./Compartir').then((m) => ({ default: m.Compartir })))

function DialogoCompartir() {
  const t = useT().compartir
  return (
    <Dialogo titulo={t.titulo} ancho={620}>
      <Suspense fallback={null}>
        <Compartir />
      </Suspense>
    </Dialogo>
  )
}

/** Privacidad (sin cookies, ubicación local, analítica) y créditos: mapa, relieve, horarios, fotos y código. */
function Legal() {
  const tt = useT()
  const t = tt.legal
  const idioma = useEstado((s) => s.idioma)
  const lugares = useLugares()
  const fuera = { target: '_blank', rel: 'noopener' }
  return (
    <Dialogo titulo={t.titulo} ancho={620}>
      <div className="legal">
        <h3>{t.privacidad}</h3>
        <ul>
          {t.puntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
          <li>{ANALITICA ? t.analiticaSi(ANALITICA) : t.analiticaNo}</li>
          {REGISTRO_REMOTO && <li>{t.errores}</li>}
          <li>
            {t.alojamiento}{' '}
            <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" {...fuera}>
              {t.politicaGithub}
            </a>
            .
          </li>
        </ul>
        <h3>{t.creditos}</h3>
        <dl>
          <dt>{t.mapa}</dt>
          <dd>
            © <a href="https://www.openstreetmap.org/copyright" {...fuera}>OpenStreetMap contributors</a>, ODbL
          </dd>
          <dt>{t.relieve}</dt>
          <dd>
            <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" {...fuera}>
              Mapzen/AWS Terrain Tiles
            </a>{' '}
            (SRTM, GMTED, ETOPO1…)
          </dd>
          <dt>{t.horarios}</dt>
          <dd>{t.horariosTexto(fechaLarga(CONSULTADO, idioma))}</dd>
          <dt>{t.fotos}</dt>
          <dd>
            <ul className="legal-fotos">
              {lugares
                .filter((m) => m.foto)
                .map((m) => (
                  <li key={m.id}>
                    {m.nombre}:{' '}
                    <a href={m.foto!.pagina} {...fuera}>
                      {m.foto!.autor}
                    </a>
                    , {m.foto!.urlLicencia ? <a href={m.foto!.urlLicencia} target="_blank" rel="noopener license">{m.foto!.licencia}</a> : m.foto!.licencia}
                    {m.foto!.recortada && `, ${t.recortada}`} · Wikimedia Commons
                  </li>
                ))}
            </ul>
          </dd>
          <dt>{t.codigo}</dt>
          <dd>{t.codigoTexto}</dd>
          <dt>{t.ejemplo}</dt>
          <dd>{t.ejemploTexto}</dd>
        </dl>
      </div>
    </Dialogo>
  )
}

export function Dialogos() {
  const d = useEstado((s) => s.dialogo)
  if (d === 'tours') return <Tours />
  if (d === 'guia') return <Guia />
  if (d === 'ayuda') return <Ayuda />
  if (d === 'compartir') return <DialogoCompartir />
  if (d === 'legal') return <Legal />
  return null
}
