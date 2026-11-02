import { useEffect, useRef } from 'react'
import { CONSULTADO, MONUMENTOS, type Foto } from '../data/monumentos'
import { fechaLarga, useLugar, useT, useTour } from '../i18n'
import { useEstado } from '../store'
import { distanciaM, formatoDistancia, minutosAPie } from '../ubicacion'
import { useTransporte } from '../transporte'
import { EstacionCercana } from './Lineas'
import { Icono } from './Icono'
import { EMBEBIDO, reservar } from '../embebido'

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
  const transporte = useTransporte()
  // en un tour, anterior y siguiente recorren sus paradas; si no, todos los lugares
  const lista = tour ? tour.paradas.map((p) => p.id) : MONUMENTOS.map((x) => x.id)
  const i = lista.indexOf(id ?? '')
  const ir = (paso: number) => setSeleccionado(lista[(i + paso + lista.length) % lista.length])
  const parada = tour?.paradas[i]
  const reproduciendo = useEstado((s) => s.reproduciendo)

  // al abrirse, el foco va al título de la ficha; al cerrarse, vuelve adonde estaba (el pin o la lista)
  const titulo = useRef<HTMLHeadingElement>(null)
  const origen = useRef<HTMLElement | null>(null)
  const abierta = !!m
  const primera = useRef(true)
  useEffect(() => {
    // si la ficha ya viene abierta en el enlace (?lugar=), el foco se queda al principio de la página
    const alCargar = primera.current
    primera.current = false
    if (abierta && !alCargar) {
      const activo = document.activeElement as HTMLElement | null
      origen.current = activo && activo !== document.body ? activo : null
      titulo.current?.focus({ preventScroll: true })
    } else if (origen.current) {
      if (origen.current.isConnected) origen.current.focus({ preventScroll: true })
      origen.current = null
    }
  }, [abierta])

  // al pausar el tour automático vuelve la ficha: el foco va a su título
  const reproducia = useRef(reproduciendo)
  useEffect(() => {
    if (reproducia.current && !reproduciendo && abierta) titulo.current?.focus({ preventScroll: true })
    reproducia.current = reproduciendo
  }, [reproduciendo, abierta])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // con un diálogo abierto, Esc cierra solo el diálogo
      // y en el tour automático, Esc lo pausa (vuelve la ficha)
      const s = useEstado.getState()
      if (e.key !== 'Escape' || s.dialogo) return
      if (s.reproduciendo) s.setReproduciendo(false)
      else setSeleccionado(null)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [setSeleccionado])

  return (
    <aside className={`panel ${m && !reproduciendo ? 'abierto' : ''}`} aria-hidden={!m || reproduciendo}>
      {m && (
        <>
          <button className="panel-cerrar" onClick={() => setSeleccionado(null)} aria-label={t.volverMapa}>
            <Icono nombre="cerrar" />
          </button>
          <button className="panel-cerrar panel-compartir" onClick={() => useEstado.getState().setDialogo('compartir')} aria-label={tt.compartir.titulo} title={tt.compartir.titulo}>
            <Icono nombre="compartir" />
          </button>
          {tour && parada && (
            <div className="panel-tour" style={{ ['--color' as string]: tour.color }}>
              <p>
                <Icono nombre={tour.icono} /> {tour.nombre} · {t.parada(i + 1, tour.paradas.length)}
              </p>
              <div className="panel-tour-pasos" aria-hidden>
                {tour.paradas.map((p, k) => (
                  <span key={p.id} className={k <= i ? 'hecho' : ''} />
                ))}
              </div>
              <p className="panel-tour-nota">{parada.nota}</p>
              <button className="panel-tour-play" onClick={() => useEstado.getState().reproducirTour()}>
                <Icono nombre="play" /> {tt.reproductor.reproducir}
              </button>
            </div>
          )}
          {m.foto && <FotoLugar foto={m.foto} alt={m.nombre} />}
          <p className="panel-etiqueta">
            {m.etiqueta} · {m.barrio}
          </p>
          <h2 ref={titulo} tabIndex={-1}>
            {m.nombre}
          </h2>
          {dist !== null && (
            <p className="panel-distancia">
              <Icono nombre="pin" /> {tt.ubicacion.deTi(formatoDistancia(dist, idioma), minutosAPie(dist))}
            </p>
          )}
          {transporte && (
            <p className="panel-metro">
              <span>{tt.metro.ficha}</span>
              <EstacionCercana t={transporte} x={m.pos[0]} z={m.pos[1]} formato={(d) => formatoDistancia(d, idioma)} />
            </p>
          )}
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
          {EMBEBIDO && (tour?.reserva || m.reserva) && (
            <button className="panel-reservar" onClick={() => reservar((tour?.reserva ?? m.reserva)!, m.id, tour?.reserva ? tour.id : null)}>
              <Icono nombre="check" /> {tour?.reserva ? t.reservarTour : t.reservar}
            </button>
          )}
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
                  {t.terminarTour} <Icono nombre="check" />
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
          <p className="panel-aviso panel-fuente">
            {m.web ? (
              <>
                <a href={m.web} target="_blank" rel="noopener">
                  {t.fuente}
                </a>
                , {t.consultado(fechaLarga(CONSULTADO, idioma))}
              </>
            ) : m.fuenteDatos ? (
              t.datosDe(m.fuenteDatos)
            ) : (
              t.calle
            )}
          </p>
        </>
      )}
    </aside>
  )
}

/** Foto de Wikimedia Commons con su crédito (autor, licencia y enlace a la página del fichero). */
function FotoLugar({ foto, alt }: { foto: Foto; alt: string }) {
  const t = useT()
  return (
    <figure className="panel-foto">
      <img src={import.meta.env.BASE_URL + foto.archivo} width={foto.ancho} height={foto.alto} alt={alt} loading="lazy" decoding="async" />
      <figcaption>
        <a href={foto.pagina} target="_blank" rel="noopener">
          {t.panel.foto}: {foto.autor}
        </a>{' '}
        · {foto.urlLicencia ? (
          <a href={foto.urlLicencia} target="_blank" rel="noopener license">
            {foto.licencia}
          </a>
        ) : (
          foto.licencia
        )}
        {foto.recortada && ` · ${t.legal.recortada}`}
      </figcaption>
    </figure>
  )
}
