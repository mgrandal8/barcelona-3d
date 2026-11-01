import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { addAfterEffect, Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { CiudadReal, Edificios } from './CiudadReal'
import { Monumentos } from './Monumentos'
import { Ambiente } from './Ambiente'
import { Ruta } from './Ruta'
import { Pines } from './Pines'
import { Nombres } from './Nombres'
import { useNombres } from '../nombres'
import { MiPosicion } from './MiPosicion'
import { Metro } from './Metro'
import { cargarDatos } from './datos'
import { porId } from '../data/monumentos'
import { useEstado, usePerfil } from '../store'
import { calidadFija } from '../calidad'
import { movimientoReducido } from '../movimiento'
import { useT } from '../i18n'
import { escena } from '../captura'
import { planVuelo, type Opciones, type Plan, type V3, type Vista } from './vuelo'

const params = new URLSearchParams(location.search)
const POSTPRO = params.get('postpro') !== '0'
const CAPTURA = params.has('captura')
// las entradas (portada, enlace a un lugar o a una vista) llegan volando; en capturas no, salvo con ?entrada=1 (pruebas)
const ENTRADA = !CAPTURA || params.has('entrada')
// el postproceso no retrasa la ciudad: se descarga cuando ya está dibujada
const Postpro = lazy(() => import('./Postpro'))

/**
 * Vista general. En escritorio se corre ~8 u al oeste: la lista de lugares ocupa la izquierda de la pantalla
 * y, si no, tapaba los pines del Camp Nou y de Montjuïc.
 */
const MOVIL = innerWidth <= 720
const SIN_FOCO: V3 = [0, 0, 0]
const VISTA_GENERAL: Vista = MOVIL
  ? { pos: [6, 62, 78], obj: [2, 0, -4], foco: SIN_FOCO }
  : { pos: [-2, 62, 78.4], obj: [-6, 0, -3.6], foco: SIN_FOCO }
/** Entrada de la portada: a ras del mar, delante de la Barceloneta, mirando hacia la Sagrada Família. */
const VISTA_MAR: Vista = { pos: [9, 2.2, 40], obj: [6, 3.5, 4], foco: SIN_FOCO }

/** ?cam= (capturas) o ?vista= (enlace compartido): px,py,pz,tx,ty,tz. */
function vistaDeUrl(): Vista | null {
  const v = (params.get('cam') ?? params.get('vista'))?.split(',').map(Number)
  return v?.length === 6 && v.every(Number.isFinite) ? { pos: [v[0], v[1], v[2]], obj: [v[3], v[4], v[5]], foco: SIN_FOCO } : null
}
const VISTA_URL = vistaDeUrl()

/**
 * Desplazamiento focal para que el lugar no quede detrás de la ficha: a la izquierda en escritorio, arriba en móvil.
 * En el tour automático la ficha se esconde y el subtítulo es bajo: en móvil se sube un poco, y en escritorio nada.
 */
const focoFicha = (dist: number, reproduciendo: boolean): V3 =>
  MOVIL ? [0, dist * (reproduciendo ? 0.12 : 0.3), 0] : [reproduciendo ? 0 : dist * 0.1, 0, 0]

/** Encuadre de un lugar: cámara en pos + camara, mirando a media altura del marcador, con la ficha a un lado. */
async function encuadre(id: string): Promise<Vista | null> {
  const m = porId(id)
  if (!m) return null
  const d = await cargarDatos()
  const [x, z] = m.pos
  const y = d.alturaY(x, z)
  // en pantallas estrechas la cámara se aleja un poco para que quepa el monumento
  const k = MOVIL ? 1.35 : 1
  const [cx, cy, cz] = m.camara.map((v) => v * k)
  const dist = Math.hypot(cx, cy - m.alturaMarcador * 0.4, cz)
  const foco = focoFicha(dist, useEstado.getState().reproduciendo)
  return { pos: [x + cx, y + cy, z + cz], obj: [x, y + m.alturaMarcador * 0.4, z], foco }
}

const va = new THREE.Vector3()
const vb = new THREE.Vector3()
const vc = new THREE.Vector3()

function Camara() {
  const controles = useRef<CameraControlsImpl>(null)
  const seleccionado = useEstado((s) => s.seleccionado)
  const portada = useEstado((s) => s.portada)
  const vuelo = useEstado((s) => s.vuelo)
  const listo = useEstado((s) => s.carga.listo)
  const reproduciendo = useEstado((s) => s.reproduciendo)
  const inicio = useRef(true)
  /** Destino que espera a que la ciudad esté dibujada (enlace a un lugar): se llega volando. */
  const pendiente = useRef<Vista | null>(null)
  const plan = useRef<{ p: Plan; t: number; fin?: () => void } | null>(null)
  const gl = useThree((s) => s.gl)

  /** Vuela a `destino` desde donde esté la cámara (sin animación con «reducir movimiento»). */
  const volar = useCallback((destino: Vista, op?: Opciones & { fin?: () => void }) => {
    const c = controles.current
    if (!c) return
    if (movimientoReducido()) {
      plan.current = null
      c.setLookAt(...destino.pos, ...destino.obj, false)
      c.setFocalOffset(...destino.foco, false)
      op?.fin?.()
      return
    }
    const desde: Vista = {
      pos: c.getPosition(va, false).toArray(),
      obj: c.getTarget(vb, false).toArray(),
      foco: c.getFocalOffset(vc, false).toArray(),
    }
    plan.current = { p: planVuelo(desde, destino, op), t: 0, fin: op?.fin }
  }, [])

  useFrame((_, dt) => {
    const c = controles.current
    if (!c) return
    const v = plan.current
    if (v) {
      // dt acotado: tras una pestaña oculta o un fotograma lento no se salta el vuelo entero
      v.t = Math.min(1, v.t + Math.min(dt, 0.2) / v.p.duracion)
      const { pos, obj, foco } = v.p.en(v.t)
      c.setLookAt(...pos, ...obj, false)
      c.setFocalOffset(...foco, false)
      if (v.t >= 1) {
        plan.current = null
        v.fin?.()
      }
      return
    }
    if (movimientoReducido()) return
    // con la portada delante, la maqueta gira despacio como en un escaparate; en el tour automático, alrededor de la parada
    if (portada && listo) c.rotate(dt * 0.045, 0, false)
    else if (reproduciendo && useEstado.getState().seleccionado) c.rotate(dt * 0.05, 0, false)
  })

  useEffect(() => {
    const c = controles.current
    if (!c) return
    // un enlace compartido con ?vista= se abre en la vista general y llega volando cuando la ciudad está dibujada
    if (VISTA_URL && params.has('vista') && ENTRADA && !movimientoReducido()) {
      c.setLookAt(...VISTA_GENERAL.pos, ...VISTA_GENERAL.obj, false)
      pendiente.current = VISTA_URL
    } else if (VISTA_URL) c.setLookAt(...VISTA_URL.pos, ...VISTA_URL.obj, false)
    else c.setLookAt(...VISTA_GENERAL.pos, ...VISTA_GENERAL.obj, false)
    // la vista ya está aplicada: si el usuario se mueve, el parámetro dejaría de ser cierto
    if (params.has('vista')) {
      const url = new URL(location.href)
      url.searchParams.delete('vista')
      history.replaceState(null, '', url)
    }
    // modo captura: scripts/capturas-lote.mjs mueve la cámara sin recargar (y __gl.info da los triángulos)
    if (CAPTURA) {
      Object.assign(window, { __controles: c, __estado: useEstado, __gl: gl, __enVuelo: () => !!plan.current })
      // altura del suelo, para poner cámaras relativas al terreno (capturas-lote con "suelo": true)
      cargarDatos().then((d) => Object.assign(window, { __alturaY: d.alturaY }))
    }
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-55, -1, -60), new THREE.Vector3(65, 12, 45)))
    // el enlace de compartir lleva la vista actual (redondeada: 0,1 u son 10 m)
    escena.enVuelo = () => !!plan.current
    escena.vista = () => [...c.getPosition(va, true).toArray(), ...c.getTarget(vb, true).toArray()].map((n) => Math.round(n * 10) / 10)
    // si el usuario mueve la maqueta, el vuelo en curso se cancela (la rueda no da «controlstart»)
    const parar = () => (plan.current = null)
    const el = gl.domElement
    el.addEventListener('pointerdown', parar)
    el.addEventListener('wheel', parar, { passive: true })
    return () => {
      escena.vista = null
      escena.enVuelo = null
      el.removeEventListener('pointerdown', parar)
      el.removeEventListener('wheel', parar)
    }
  }, [gl])

  useEffect(() => {
    const c = controles.current
    if (!c) return
    const primera = inicio.current
    inicio.current = false
    if (!seleccionado) {
      if (!primera) volar(VISTA_GENERAL)
      return
    }
    if (primera && VISTA_URL) return
    let vigente = true
    encuadre(seleccionado).then((v) => {
      if (!vigente || !v) return
      // con un enlace a un lugar (?lugar=id) se entra desde la vista general, cuando la ciudad ya está dibujada;
      // en capturas, o con «reducir movimiento», se coloca directamente
      if (primera && ENTRADA && !useEstado.getState().carga.listo) pendiente.current = v
      else if (primera && !ENTRADA) {
        c.setLookAt(...v.pos, ...v.obj, false)
        c.setFocalOffset(...v.foco, false)
      } else volar(v)
    })
    return () => {
      vigente = false
    }
  }, [seleccionado, volar])

  // al pausar o reanudar el tour automático aparece o se esconde la ficha: solo cambia el desplazamiento focal
  // (la cámara se queda en el ángulo al que haya girado)
  const reproducia = useRef(reproduciendo)
  useEffect(() => {
    const c = controles.current
    if (!c || reproducia.current === reproduciendo) return
    reproducia.current = reproduciendo
    if (!useEstado.getState().seleccionado || plan.current) return
    c.setFocalOffset(...focoFicha(c.distance, reproduciendo), !movimientoReducido())
  }, [reproduciendo])

  // entrada: con la portada, la cámara sale del mar y sube a la vista general; con un enlace, baja hasta el lugar
  useEffect(() => {
    if (!listo || !ENTRADA) return
    if (pendiente.current) {
      const v = pendiente.current
      pendiente.current = null
      volar(v, { lento: 1.5 })
    } else if (useEstado.getState().portada && !VISTA_URL && !movimientoReducido()) {
      controles.current?.setLookAt(...VISTA_MAR.pos, ...VISTA_MAR.obj, false)
      volar(VISTA_GENERAL, { lento: 2.4, subida: 0 })
    }
  }, [listo, volar])

  // al cerrar la portada, la cámara deja de girar y vuelve a la vista general (o adonde vaya el tour)
  const habiaPortada = useRef(portada)
  useEffect(() => {
    if (habiaPortada.current && !portada && listo && !useEstado.getState().seleccionado) volar(VISTA_GENERAL, { lento: 1.2 })
    habiaPortada.current = portada
  }, [portada, listo, volar])

  // «dónde estoy» y grupos de pines: vista cercana desde el sur, algo inclinada (va después del efecto de la ficha, que se cierra a la vez)
  useEffect(() => {
    if (!vuelo) return
    let vigente = true
    cargarDatos().then((d) => {
      if (!vigente) return
      const y = d.alturaY(vuelo.x, vuelo.z)
      // la vista cercana está a ~10 u; con `dist` se aleja o se acerca en la misma dirección
      const k = (vuelo.dist ?? 10) / 10
      volar({ pos: [vuelo.x + 1.5 * k, y + 7 * k, vuelo.z + 7 * k], obj: [vuelo.x, y, vuelo.z], foco: SIN_FOCO })
    })
    return () => {
      vigente = false
    }
  }, [vuelo, volar])

  // teclado, con el foco en la maqueta: flechas para desplazar, Mayús + flechas o Q/E para girar,
  // +/− para acercar e Inicio para volver a la vista general
  useEffect(() => {
    const maqueta = gl.domElement.closest<HTMLElement>('.maqueta')
    if (!maqueta) return
    const tecla = (e: KeyboardEvent) => {
      const c = controles.current
      if (!c || useEstado.getState().portada || e.ctrlKey || e.metaKey || e.altKey) return
      const animar = !movimientoReducido()
      const paso = c.distance * 0.12
      const giro = 0.18
      const acciones: Record<string, () => unknown> = e.shiftKey
        ? {
            ArrowLeft: () => c.rotate(giro, 0, animar),
            ArrowRight: () => c.rotate(-giro, 0, animar),
            ArrowUp: () => c.rotate(0, giro / 2, animar),
            ArrowDown: () => c.rotate(0, -giro / 2, animar),
          }
        : {
            ArrowLeft: () => c.truck(-paso, 0, animar),
            ArrowRight: () => c.truck(paso, 0, animar),
            ArrowUp: () => c.forward(paso, animar),
            ArrowDown: () => c.forward(-paso, animar),
          }
      Object.assign(acciones, {
        q: () => c.rotate(giro, 0, animar),
        e: () => c.rotate(-giro, 0, animar),
        '+': () => c.dolly(c.distance * 0.2, animar),
        '=': () => c.dolly(c.distance * 0.2, animar),
        '-': () => c.dolly(-c.distance * 0.25, animar),
        Home: () => {
          if (useEstado.getState().seleccionado) useEstado.getState().setSeleccionado(null)
          else volar(VISTA_GENERAL)
        },
      })
      const accion = acciones[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (!accion) return
      e.preventDefault()
      if (e.key !== 'Home') plan.current = null
      accion()
    }
    maqueta.addEventListener('keydown', tecla)
    return () => maqueta.removeEventListener('keydown', tecla)
  }, [gl, volar])

  return <CameraControls ref={controles} makeDefault enabled={!portada} minDistance={0.6} maxDistance={170} maxPolarAngle={1.32} smoothTime={0.7} />
}

/**
 * La GPU se reinicia o el navegador libera el contexto: se quita la escena y se ofrece reintentar.
 * Va en un efecto para quitar el listener al desmontar: R3F fuerza la pérdida del contexto al cerrar el Canvas.
 */
function VigiaContexto() {
  const canvas = useThree((s) => s.gl.domElement)
  useEffect(() => {
    const perdido = (e: Event) => {
      e.preventDefault()
      useEstado.getState().perderContexto()
    }
    canvas.addEventListener('webglcontextlost', perdido)
    return () => canvas.removeEventListener('webglcontextlost', perdido)
  }, [canvas])
  return null
}

/**
 * Foto para compartir: se copia el canvas justo después de dibujar el fotograma (con el postproceso), antes de
 * que el navegador lo presente y lo borre; así no hace falta `preserveDrawingBuffer`.
 */
function Fotografo() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    escena.foto = () =>
      new Promise((resolver) => {
        // si la cámara va de camino (p. ej. se pulsa «Compartir» nada más elegir un lugar), se espera a que llegue
        const t0 = performance.now()
        const quitar = addAfterEffect(() => {
          if (escena.enVuelo?.() && performance.now() - t0 < 8000) return
          quitar()
          const src = gl.domElement
          const c = document.createElement('canvas')
          c.width = src.width
          c.height = src.height
          const ctx = c.getContext('2d')
          if (!ctx) return resolver(null)
          ctx.drawImage(src, 0, 0)
          resolver(c)
        })
        invalidate()
      })
    return () => {
      escena.foto = null
    }
  }, [gl, invalidate])
  return null
}

/** Avisa de que la ciudad ya se ha dibujado (unos fotogramas, para que compilen los shaders). */
function AvisoListo() {
  const n = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  // mientras carga el bucle va bajo demanda: hay que pedir los fotogramas
  useEffect(() => invalidate(), [invalidate])
  useFrame(() => {
    if (n.current < 3) invalidate()
    if (++n.current === 3) useEstado.getState().setCarga({ progreso: 1, texto: 'listo', listo: true })
  })
  return null
}

// en pruebas y capturas la calidad no cambia sola
const CALIDAD_AUTO = !calidadFija && !params.has('captura')

export function Experience() {
  const perfil = usePerfil()
  const dpr = Math.min(perfil.dprMax, window.devicePixelRatio || 1)
  // mientras carga no se ve nada detrás de la portada: sin bucle de render, React y el worker van más rápido
  const listo = useEstado((s) => s.carga.listo)
  const metro = useEstado((s) => s.metro)
  const nombres = useNombres()
  const t = useT().maqueta

  return (
    <Canvas
      // la maqueta se puede enfocar y mover con el teclado; para el lector de pantalla, la alternativa son la lista y las fichas
      className="maqueta"
      tabIndex={0}
      role="application"
      aria-label={t.etiqueta}
      aria-describedby="maqueta-ayuda"
      shadows={perfil.sombras > 0}
      frameloop={listo ? 'always' : 'demand'}
      dpr={dpr}
      gl={{ antialias: false, alpha: true, preserveDrawingBuffer: params.has('captura') }}
      camera={{ position: [...VISTA_GENERAL.pos], fov: 35, near: 0.2, far: 600 }}
      onPointerMissed={() => useEstado.getState().setHover(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
      }}
    >
      {/* si va a tirones se baja un nivel (no se vuelve a subir: así no oscila); mientras carga no se mide */}
      {CALIDAD_AUTO && listo && (
        <PerformanceMonitor onDecline={() => useEstado.getState().bajarCalidad()} onFallback={() => useEstado.getState().bajarCalidad(true)} />
      )}
      <VigiaContexto />
      <Fotografo />
      <Ambiente />
      <Suspense fallback={null}>
        <CiudadReal />
        <Monumentos />
        <Ruta />
        <Pines />
        {nombres && <Nombres nombres={nombres} />}
        <MiPosicion />
        {/* el metro no espera a los edificios, pero tampoco los retrasa: va en su propio Suspense */}
        <Suspense fallback={null}>{metro && <Metro />}</Suspense>
        {/* los edificios llegan del worker: el resto de la ciudad no los espera */}
        <Suspense fallback={null}>
          <Edificios />
          <AvisoListo />
        </Suspense>
      </Suspense>
      <Camara />
      {POSTPRO && listo && perfil.postpro !== 'no' && (
        <Suspense fallback={null}>
          <Postpro />
        </Suspense>
      )}
    </Canvas>
  )
}
