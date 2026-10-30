import { Component, useEffect, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { useEstado, type Fallo } from '../store'
import { reiniciarDatos } from '../scene/datos'
import { sondeo } from '../calidad'

/** Qué ha fallado, por el mensaje: un chunk que no llega, el contexto WebGL o, si no, los datos. */
function tipoDeFallo(e: unknown): Fallo {
  const m = String((e as Error)?.message ?? e)
  if (/dynamically imported module|module script failed|Loading chunk/i.test(m)) return 'codigo'
  if (/webgl|context/i.test(m)) return 'webgl'
  return 'datos'
}

/**
 * Recoge cualquier error de la escena: el chunk de Experience, los datos (llegan por use()), los workers
 * y el contexto WebGL (R3F los reenvía fuera del Canvas). La tarjeta del fallo la pinta la portada o la carga.
 */
export class ErrorMaqueta extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch(e: unknown) {
    console.error(e)
    useEstado.getState().setFallo(tipoDeFallo(e))
  }
  render() {
    return this.state.error ? null : this.props.children
  }
}

let perdidas = 0

/** Contexto WebGL perdido (GPU reiniciada, demasiadas pestañas…): se quita la escena y se ofrece reintentar. */
export function contextoPerdido() {
  perdidas++
  useEstado.getState().setFallo('contexto')
}

/** Mensaje del fallo con «Reintentar» y «Ver versión ligera». */
export function TarjetaFallo() {
  const fallo = useEstado((s) => s.fallo)
  const t = useT().fallo
  if (!fallo) return null
  const otraVez = fallo === 'contexto' && perdidas > 1
  // sin WebGL o si la GPU se cae una y otra vez, lo primero que se ofrece es la versión ligera
  const ligeraPrimero = fallo === 'webgl' || otraVez || !sondeo.webgl
  const reintentar = () => {
    if (fallo === 'codigo') return location.reload()
    if (fallo === 'datos') reiniciarDatos()
    useEstado.getState().reintentar()
  }
  const ligera = () => useEstado.getState().setModo('ligero')
  return (
    <div className="fallo" role="alert">
      <p>{otraVez ? t.contextoOtraVez : t[fallo]}</p>
      <div className="fallo-botones">
        <button className={ligeraPrimero ? '' : 'primario'} onClick={reintentar} autoFocus={!ligeraPrimero}>
          {t.reintentar}
        </button>
        <button className={ligeraPrimero ? 'primario' : ''} onClick={ligera} autoFocus={ligeraPrimero}>
          {t.verLigera}
        </button>
      </div>
    </div>
  )
}

/** Si la carga pasa de 45 s, se ofrece la versión ligera sin dejar de esperar. */
export function AvisoLento() {
  const [lento, setLento] = useState(false)
  const t = useT().fallo
  useEffect(() => {
    const id = setTimeout(() => setLento(true), 45000)
    return () => clearTimeout(id)
  }, [])
  if (!lento) return null
  return (
    <p className="lento">
      {t.lento}{' '}
      <button className="enlace" onClick={() => useEstado.getState().setModo('ligero')}>
        {t.verLigera}
      </button>
    </p>
  )
}
