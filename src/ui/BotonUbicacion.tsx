import { useState } from 'react'
import { useT } from '../i18n'
import { useEstado } from '../store'
import { activarUbicacion, formatoDistancia, PLAZA_CATALUNYA, simularPosicion } from '../ubicacion'
import { useTransporte } from '../transporte'
import { EstacionCercana } from './Lineas'

/** Botón 📍 «dónde estoy» y una tarjeta con el estado (buscando, sin permiso, fuera de la maqueta…). */
export function BotonUbicacion() {
  const u = useEstado((s) => s.ubicacion)
  const estado = useEstado((s) => s.estadoUbicacion)
  const t = useT().ubicacion
  const tc = useT()
  const [abierta, setAbierta] = useState(false)
  const transporte = useTransporte()
  const idioma = useEstado((s) => s.idioma)

  const mensaje =
    estado === 'buscando'
      ? t.buscando
      : estado === 'denegada'
        ? t.denegada
        : estado === 'error'
          ? t.error
          : estado === 'no-disponible'
            ? t.noDisponible
            : u && !u.dentro
              ? t.fuera
              : u
                ? u.simulada
                  ? t.simulada
                  : t.ok(u.precision)
                : null

  return (
    <div className="ubicacion">
      <button
        className={`ubicacion-boton ${estado === 'ok' && u?.dentro ? 'activo' : ''} ${estado === 'buscando' ? 'buscando' : ''}`}
        onClick={() => {
          activarUbicacion()
          setAbierta(true)
        }}
        title={t.boton}
        aria-label={t.boton}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {abierta && mensaje && (
        <div className="ubicacion-tarjeta" role="status">
          <button className="ubicacion-cerrar" onClick={() => setAbierta(false)} aria-label={tc.cerrar}>
            ✕
          </button>
          <p>{mensaje}</p>
          {estado === 'ok' && u?.dentro && transporte && (
            <p className="ubicacion-metro">
              <small>{tc.metro.cercano}</small>
              <EstacionCercana t={transporte} x={u.x} z={u.z} formato={(d) => formatoDistancia(d, idioma)} />
            </p>
          )}
          {(estado === 'denegada' || estado === 'error' || estado === 'no-disponible' || (u && !u.dentro)) && (
            <button className="primario" onClick={() => simularPosicion(...PLAZA_CATALUNYA)}>
              {t.simular}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
