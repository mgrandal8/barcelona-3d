import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { CiudadReal, Edificios } from './CiudadReal'
import { Monumentos } from './Monumentos'
import { Ambiente } from './Ambiente'
import { Ruta } from './Ruta'
import { MiPosicion } from './MiPosicion'
import { cargarDatos } from './datos'
import { porId } from '../data/monumentos'
import { useEstado } from '../store'

const params = new URLSearchParams(location.search)
const POSTPRO = params.get('postpro') !== '0'

export const VISTA_GENERAL = { pos: [6, 62, 78] as const, objetivo: [2, 0, -4] as const }

/** Encuadre de un lugar: cámara en pos + camara, mirando a media altura del marcador. */
async function encuadre(id: string) {
  const m = porId(id)
  if (!m) return null
  const d = await cargarDatos()
  const [x, z] = m.pos
  const y = d.alturaY(x, z)
  // en pantallas estrechas la cámara se aleja un poco para que quepa el monumento
  const k = innerWidth <= 720 ? 1.35 : 1
  const [cx, cy, cz] = m.camara.map((v) => v * k)
  return [x + cx, y + cy, z + cz, x, y + m.alturaMarcador * 0.4, z] as const
}

const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches

function Camara() {
  const controles = useRef<CameraControlsImpl>(null)
  const seleccionado = useEstado((s) => s.seleccionado)
  const portada = useEstado((s) => s.portada)
  const vuelo = useEstado((s) => s.vuelo)
  const inicio = useRef(true)
  const gl = useThree((s) => s.gl)

  // con la portada delante, la maqueta gira despacio como en un escaparate
  useFrame((_, dt) => {
    if (portada && !quieto) controles.current?.rotate(dt * 0.045, 0, false)
  })

  useEffect(() => {
    const c = controles.current
    if (!c) return
    // ?cam=px,py,pz,tx,ty,tz para fijar la cámara (capturas)
    const cam = params.get('cam')?.split(',').map(Number)
    if (cam?.length === 6) c.setLookAt(cam[0], cam[1], cam[2], cam[3], cam[4], cam[5], false)
    else c.setLookAt(...VISTA_GENERAL.pos, ...VISTA_GENERAL.objetivo, false)
    // modo captura: scripts/capturas-lote.mjs mueve la cámara sin recargar (y __gl.info da los triángulos)
    if (params.has('captura')) Object.assign(window, { __controles: c, __estado: useEstado, __gl: gl })
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-55, -1, -60), new THREE.Vector3(65, 12, 45)))
  }, [gl])

  useEffect(() => {
    const c = controles.current
    if (!c) return
    // la primera vez (?lugar=id) se coloca sin animación; después, vuelo
    const animar = !inicio.current
    inicio.current = false
    if (!seleccionado) {
      c.setFocalOffset(0, 0, 0, animar)
      if (animar) c.setLookAt(...VISTA_GENERAL.pos, ...VISTA_GENERAL.objetivo, true)
      return
    }
    if (!animar && params.has('cam')) return
    let vigente = true
    encuadre(seleccionado).then((v) => {
      if (!vigente || !v) return
      c.setLookAt(...v, animar)
      // que el monumento no quede detrás de la ficha: a la izquierda en escritorio, arriba en móvil
      const dist = Math.hypot(v[0] - v[3], v[1] - v[4], v[2] - v[5])
      const movil = innerWidth <= 720
      c.setFocalOffset(movil ? 0 : dist * 0.1, movil ? dist * 0.3 : 0, 0, animar)
    })
    return () => {
      vigente = false
    }
  }, [seleccionado])

  // «dónde estoy»: vista cercana desde el sur, algo inclinada (va después del efecto de la ficha, que se cierra a la vez)
  useEffect(() => {
    const c = controles.current
    if (!c || !vuelo) return
    let vigente = true
    cargarDatos().then((d) => {
      if (!vigente) return
      const y = d.alturaY(vuelo.x, vuelo.z)
      c.setFocalOffset(0, 0, 0, true)
      c.setLookAt(vuelo.x + 1.5, y + 7, vuelo.z + 7, vuelo.x, y, vuelo.z, !quieto)
    })
    return () => {
      vigente = false
    }
  }, [vuelo])

  return <CameraControls ref={controles} makeDefault enabled={!portada} minDistance={0.6} maxDistance={170} maxPolarAngle={1.32} smoothTime={0.7} />
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

export function Experience() {
  const [dpr, setDpr] = useState(1.5)
  const [calidadAlta, setCalidadAlta] = useState(true)
  // de noche el bloom recoge las ventanas, las farolas y los LED
  const noche = useEstado((s) => s.momento) === 'noche'
  // mientras carga no se ve nada detrás de la portada: sin bucle de render, React y el worker van más rápido
  const listo = useEstado((s) => s.carga.listo)

  return (
    <Canvas
      shadows
      frameloop={listo ? 'always' : 'demand'}
      dpr={dpr}
      gl={{ antialias: false, alpha: true, preserveDrawingBuffer: params.has('captura') }}
      camera={{ position: [...VISTA_GENERAL.pos], fov: 35, near: 0.2, far: 600 }}
      onPointerMissed={() => useEstado.getState().setHover(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1)
          setCalidadAlta(false)
        }}
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
      />
      <Ambiente />
      <Suspense fallback={null}>
        <CiudadReal />
        <Monumentos />
        <Ruta />
        <MiPosicion />
        {/* los edificios llegan del worker: el resto de la ciudad no los espera */}
        <Suspense fallback={null}>
          <Edificios />
          <AvisoListo />
        </Suspense>
      </Suspense>
      <Camara />
      {POSTPRO && (
        <EffectComposer multisampling={0}>
          {calidadAlta ? <N8AO aoRadius={0.6} intensity={2} distanceFalloff={0.5} halfRes /> : <></>}
          <Bloom luminanceThreshold={noche ? 0.55 : 0.9} intensity={noche ? 0.9 : 0.4} mipmapBlur />
          <Vignette darkness={0.35} offset={0.3} />
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
  )
}
