import { useEffect, useState } from 'react'
import { MONUMENTOS } from '../data/monumentos'
import { TOURS } from '../data/tours'
import { useT } from '../i18n'
import { useEstado } from '../store'
import { SelectorIdioma } from './SelectorIdioma'

/** Barra de progreso con el paso de carga en curso. */
function Progreso() {
  const { progreso, texto } = useEstado((s) => s.carga)
  const t = useT()
  return (
    <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)}>
      <div className="progreso-barra">
        <span style={{ width: `${Math.max(4, progreso * 100)}%` }} />
      </div>
      <small>
        {t.carga[texto]} {Math.round(progreso * 100)} %
      </small>
    </div>
  )
}

/**
 * Portada "Descubre Barcelona": hace de pantalla de carga y, cuando la maqueta está lista,
 * deja verla girando detrás. Si se entra con un enlace a un lugar, solo sale la carga.
 */
export function Portada() {
  const portada = useEstado((s) => s.portada)
  const listo = useEstado((s) => s.carga.listo)
  const { cerrarPortada, setDialogo } = useEstado.getState()
  const t = useT().portada

  if (!portada) {
    return (
      <div className={`carga ${listo ? 'oculta' : ''}`} aria-hidden={listo}>
        <div className="carga-tarjeta">
          <strong>
            Barcelona <span>3D</span>
          </strong>
          <Progreso />
        </div>
      </div>
    )
  }

  return (
    <section className={`portada ${listo ? 'lista-ya' : ''}`} aria-labelledby="portada-titulo">
      <div className="portada-tarjeta">
        <div className="portada-arriba">
          <p className="portada-antetitulo">{t.antetitulo}</p>
          <SelectorIdioma />
        </div>
        <h1 id="portada-titulo">
          {t.titulo} <span>Barcelona</span>
        </h1>
        <p className="portada-texto">{t.texto}</p>
        <ul className="portada-cifras">
          <li>
            <strong>{MONUMENTOS.length}</strong> {t.lugares}
          </li>
          <li>
            <strong>{TOURS.length}</strong> {t.tours}
          </li>
          <li>
            <strong>3</strong> {t.momentos}
          </li>
        </ul>
        {listo ? (
          <div className="portada-botones">
            <button className="primario" onClick={cerrarPortada} autoFocus>
              {t.explorar}
            </button>
            <button
              onClick={() => {
                cerrarPortada()
                setDialogo('tours')
              }}
            >
              {t.verTours}
            </button>
          </div>
        ) : (
          <Progreso />
        )}
        <p className="portada-pie">{t.pie}</p>
      </div>
    </section>
  )
}

const CLAVE_PISTA = 'bcn3d-pista-vista'

function pistaVista() {
  try {
    return localStorage.getItem(CLAVE_PISTA) === '1'
  } catch {
    return false
  }
}

/** Recordatorio de los controles la primera vez que se entra al mapa; se va solo. */
export function Pista() {
  const portada = useEstado((s) => s.portada)
  const listo = useEstado((s) => s.carga.listo)
  const t = useT().pista
  // se lee una vez al montar: así StrictMode (efecto doble) no la da por vista antes de tiempo
  const [yaVista] = useState(pistaVista)
  const [caducada, setCaducada] = useState(false)
  const activa = !portada && listo && !yaVista && !new URLSearchParams(location.search).has('captura')

  useEffect(() => {
    if (!activa) return
    try {
      localStorage.setItem(CLAVE_PISTA, '1')
    } catch {
      // sin almacenamiento la pista sale en cada visita
    }
    const t = setTimeout(() => setCaducada(true), 7000)
    return () => clearTimeout(t)
  }, [activa])
  const visible = activa && !caducada

  const tactil = matchMedia('(pointer: coarse)').matches
  return (
    <p className={`pista ${visible ? 'visible' : ''}`} role="status">
      {tactil ? t.tactil : t.raton}
    </p>
  )
}
