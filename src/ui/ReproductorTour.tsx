import { useEffect, useRef, useState } from 'react'
import { useLugar, useT, useTour } from '../i18n'
import { useEstado } from '../store'
import { escena } from '../captura'
import { Icono } from './Icono'

// «Reproducir tour»: la maqueta pasa sola de parada en parada. En cada una, la cámara vuela, gira despacio
// alrededor del lugar y un subtítulo enseña la nota del guía (y, si se pide, la lee en voz alta).
// La ficha se esconde mientras tanto; «Pausar» la vuelve a enseñar.

const CLAVE_VOZ = 'bcn3d-voz'
const hayVoz = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
/** Segundos de cada parada, desde que llega la cámara: el tiempo de leer la nota (~3 palabras por segundo) y una pausa para mirar. */
const tiempoParada = (nota: string) => Math.max(5, nota.split(/\s+/).length / 3) + 2.5

function vozGuardada() {
  try {
    return localStorage.getItem(CLAVE_VOZ) === '1'
  } catch {
    return false
  }
}

/** Lee el texto con una voz del idioma (si la hay); llama a `fin` al terminar, o enseguida si no se puede. */
function leer(texto: string, idioma: string, fin: () => void) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(texto)
  u.lang = idioma === 'en' ? 'en-GB' : 'es-ES'
  const voz = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(idioma))
  if (voz) u.voice = voz
  u.rate = 1.02
  u.onend = fin
  u.onerror = fin
  speechSynthesis.speak(u)
}

export function ReproductorTour() {
  const reproduciendo = useEstado((s) => s.reproduciendo)
  const id = useEstado((s) => s.seleccionado)
  const idioma = useEstado((s) => s.idioma)
  const tour = useTour(useEstado((s) => s.tour))
  const m = useLugar(id)
  const t = useT()
  const [voz, setVoz] = useState(vozGuardada)
  const i = tour?.paradas.findIndex((p) => p.id === id) ?? -1
  const parada = tour && i >= 0 ? tour.paradas[i] : null
  const activo = reproduciendo && !!parada
  const ultima = !!tour && i === tour.paradas.length - 1
  const [fin, setFin] = useState(false)
  const pausa = useRef<HTMLButtonElement>(null)

  // al empezar, el foco pasa al botón de pausa si estaba en la ficha (que se esconde) o en ningún sitio
  useEffect(() => {
    if (!activo) return
    const a = document.activeElement
    if (!a || a === document.body || a.closest('.panel')) pausa.current?.focus({ preventScroll: true })
  }, [activo])

  // el tiempo de la parada empieza cuando la cámara llega (en un equipo lento el vuelo tarda más); con voz,
  // además se espera a que termine de leer
  const [llegada, setLlegada] = useState<string | null>(null)
  useEffect(() => {
    if (!activo || !parada || !tour) return
    setFin(false)
    setLlegada(null)
    let vigente = true
    let tiempo = false
    let leido = !voz || !hayVoz
    let reloj: ReturnType<typeof setTimeout> | undefined
    const avanzar = () => {
      if (!vigente || !tiempo || !leido) return
      const s = useEstado.getState()
      if (ultima) {
        // al final se para y deja la ficha de la última parada abierta, con «Terminar tour»
        setFin(true)
        s.setReproduciendo(false)
      } else s.setSeleccionado(tour.paradas[i + 1].id)
    }
    const llegar = () => {
      setLlegada(parada.id)
      reloj = setTimeout(() => {
        tiempo = true
        avanzar()
      }, tiempoParada(parada.nota) * 1000)
      if (!leido)
        leer(parada.nota, idioma, () => {
          leido = true
          setTimeout(avanzar, 1500)
        })
    }
    // el vuelo empieza un poco después de cambiar de lugar: se espera a verlo empezar (o 1,5 s sin vuelo,
    // con «reducir movimiento») y luego a que termine, 15 s como mucho
    const t0 = performance.now()
    let visto = false
    const sondeo = setInterval(() => {
      const vuela = escena.enVuelo?.() ?? false
      visto ||= vuela
      const espera = performance.now() - t0
      if ((vuela || (!visto && espera < 1500)) && espera < 15000) return
      clearInterval(sondeo)
      llegar()
    }, 200)
    return () => {
      vigente = false
      clearInterval(sondeo)
      clearTimeout(reloj)
      if (hayVoz) speechSynthesis.cancel()
    }
    // la voz y el idioma se aplican a partir de la siguiente parada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, parada?.id, tour?.id])

  // el mensaje de fin dura unos segundos
  useEffect(() => {
    if (!fin) return
    const x = setTimeout(() => setFin(false), 6000)
    return () => clearTimeout(x)
  }, [fin])

  // un diálogo pausa el tour
  useEffect(
    () =>
      useEstado.subscribe((s, antes) => {
        if (s.dialogo && !antes.dialogo && s.reproduciendo) s.setReproduciendo(false)
      }),
    [],
  )

  const cambiarVoz = () => {
    const v = !voz
    setVoz(v)
    try {
      localStorage.setItem(CLAVE_VOZ, v ? '1' : '0')
    } catch {
      // sin almacenamiento, solo para esta visita
    }
    if (v && parada) leer(parada.nota, idioma, () => {})
    else if (hayVoz) speechSynthesis.cancel()
  }

  if (fin && !reproduciendo) {
    return (
      <div className="subtitulo fin" role="status">
        <p className="subtitulo-nota">{t.reproductor.fin}</p>
      </div>
    )
  }
  if (!activo || !tour || !parada || !m) return null

  return (
    <section className="subtitulo" aria-label={t.reproductor.etiqueta} style={{ ['--color' as string]: tour.color }}>
      <p className="subtitulo-cabecera">
        <Icono nombre={tour.icono} /> {tour.nombre} · {t.panel.parada(i + 1, tour.paradas.length)}
      </p>
      <h2 className="subtitulo-lugar">{m.nombre}</h2>
      <p className="subtitulo-nota">{parada.nota}</p>
      <div className="subtitulo-barra" aria-hidden>
        {tour.paradas.map((p, k) => (
          <span key={p.id} className={k < i ? 'hecho' : ''}>
            {k === i && llegada === parada.id && <i key={parada.id} style={{ animationDuration: `${tiempoParada(parada.nota)}s` }} />}
          </span>
        ))}
      </div>
      <div className="subtitulo-botones">
        <button ref={pausa} onClick={() => useEstado.getState().setReproduciendo(false)} aria-label={t.reproductor.pausar} title={t.reproductor.pausar}>
          <Icono nombre="pausa" />
        </button>
        {!ultima && (
          <button
            onClick={() => useEstado.getState().setSeleccionado(tour.paradas[i + 1].id)}
            aria-label={t.reproductor.siguiente}
            title={t.reproductor.siguiente}
          >
            <Icono nombre="saltar" />
          </button>
        )}
        {hayVoz && (
          <button onClick={cambiarVoz} aria-pressed={voz} aria-label={t.reproductor.vozSi} title={voz ? t.reproductor.vozNo : t.reproductor.vozSi}>
            <Icono nombre={voz ? 'voz' : 'sinVoz'} />
          </button>
        )}
      </div>
    </section>
  )
}
