import { useT } from '../i18n'
import { actualizar, esIos, instalar } from '../pwa'
import { useEstado } from '../store'

/** Aviso arriba: sin conexión, o hay una versión nueva. */
export function AvisoRed() {
  const red = useEstado((s) => s.red)
  const t = useT().red
  if (red.nueva)
    return (
      <p className="aviso-red" role="status">
        {t.nueva}{' '}
        <button className="primario" onClick={actualizar}>
          {t.recargar}
        </button>
      </p>
    )
  if (!red.enLinea)
    return (
      <p className="aviso-red sin-red" role="status">
        {red.copia === 'lista' ? t.sinConexion : t.sinConexionSinCopia}
      </p>
    )
  return null
}

/** Sección de la ayuda: si la guía ya está guardada para usarla sin conexión, y cómo instalarla. */
export function SinConexion() {
  const red = useEstado((s) => s.red)
  const t = useT().red
  return (
    <section className="sin-conexion">
      <h3>{t.titulo}</h3>
      <p>{red.copia === 'lista' ? t.lista : red.copia === 'guardando' ? t.guardando : t.noDisponible}</p>
      {red.instalable && (
        <button className="primario" onClick={instalar}>
          {t.instalar}
        </button>
      )}
      {!red.instalable && esIos() && <p className="sin-conexion-ios">{t.ios}</p>}
    </section>
  )
}
