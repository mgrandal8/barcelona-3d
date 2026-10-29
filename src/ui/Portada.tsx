import { useEffect, useState } from 'react'
import { MONUMENTOS } from '../data/monumentos'
import { TOURS } from '../data/tours'
import { useEstado } from '../store'

/** Barra de progreso con el paso de carga en curso. */
function Progreso() {
  const { progreso, texto } = useEstado((s) => s.carga)
  return (
    <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)}>
      <div className="progreso-barra">
        <span style={{ width: `${Math.max(4, progreso * 100)}%` }} />
      </div>
      <small>
        {texto} {Math.round(progreso * 100)} %
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
        <p className="portada-antetitulo">Guía de ejemplo · maqueta 3D</p>
        <h1 id="portada-titulo">
          Descubre <span>Barcelona</span>
        </h1>
        <p className="portada-texto">
          Vuela sobre una maqueta de la ciudad hecha con datos reales: sus calles, su relieve y más de 140.000 edificios. Elige un
          lugar, sigue un tour o cambia la hora para verla de noche.
        </p>
        <ul className="portada-cifras">
          <li>
            <strong>{MONUMENTOS.length}</strong> lugares
          </li>
          <li>
            <strong>{TOURS.length}</strong> tours
          </li>
          <li>
            <strong>3</strong> momentos del día
          </li>
        </ul>
        {listo ? (
          <div className="portada-botones">
            <button className="primario" onClick={cerrarPortada} autoFocus>
              Explorar el mapa
            </button>
            <button
              onClick={() => {
                cerrarPortada()
                setDialogo('tours')
              }}
            >
              Ver tours
            </button>
          </div>
        ) : (
          <Progreso />
        )}
        <p className="portada-pie">Contenido ficticio para una demo: sin reservas ni pagos reales.</p>
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
      {tactil ? 'Desliza para girar · pellizca para acercar · toca un pin' : 'Arrastra para girar · rueda para acercar · clic en un pin'}
    </p>
  )
}
