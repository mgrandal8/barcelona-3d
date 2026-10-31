import { useEffect, useState } from 'react'
import { traducirLugar, useT } from '../i18n'
import { porId } from '../data/monumentos'
import { tourPorId } from '../data/tours'
import { useEstado } from '../store'

/** Región invisible que el lector de pantalla lee en voz alta: qué lugar se muestra, la hora y el metro. */
export function Anunciador() {
  const [texto, setTexto] = useState('')
  const t = useT()

  useEffect(
    () =>
      useEstado.subscribe((s, antes) => {
        if (s.seleccionado !== antes.seleccionado) {
          const m = porId(s.seleccionado)
          if (!m) return setTexto(t.maqueta.vistaGeneral)
          const nombre = traducirLugar(m, s.idioma).nombre
          const paradas = tourPorId(s.tour)?.paradas.map((p) => p.id) ?? []
          const i = paradas.indexOf(m.id)
          setTexto(t.maqueta.mostrando(i >= 0 ? `${nombre}, ${t.panel.parada(i + 1, paradas.length)}` : nombre))
        } else if (s.momento !== antes.momento) setTexto(t.maqueta.hora(t.hora[s.momento]))
        else if (s.metro !== antes.metro) setTexto(s.metro ? t.maqueta.metroSi : t.maqueta.metroNo)
      }),
    [t],
  )

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {texto}
    </p>
  )
}
