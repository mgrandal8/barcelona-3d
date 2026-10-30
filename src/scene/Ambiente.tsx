import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEstado, usePerfil } from '../store'
import { PRESETS, vivo, type Preset } from './hora'
import { Barcos } from './Barcos'
import { Gaviotas } from './Gaviotas'
import { Nubes } from './Nubes'
import { azar } from './monumentos/comun'

const DURACION = 2.5 // s de transición entre momentos

/** Preset con los colores ya convertidos, para mezclar sin crear objetos en cada fotograma. */
type Mezclable = {
  cielo: THREE.Color[]
  niebla: THREE.Color
  solPos: THREE.Vector3
  solColor: THREE.Color
  solI: number
  hemiCielo: THREE.Color
  hemiSuelo: THREE.Color
  hemiI: number
  mar: THREE.Color
  nubes: THREE.Color
  exposicion: number
  noche: number
}

const aMezclable = (p: Preset): Mezclable => ({
  cielo: p.cielo.map((c) => new THREE.Color(c)),
  niebla: new THREE.Color(p.niebla),
  solPos: new THREE.Vector3(...p.sol.pos),
  solColor: new THREE.Color(p.sol.color),
  solI: p.sol.intensidad,
  hemiCielo: new THREE.Color(p.hemi.cielo),
  hemiSuelo: new THREE.Color(p.hemi.suelo),
  hemiI: p.hemi.intensidad,
  mar: new THREE.Color(p.mar),
  nubes: new THREE.Color(p.nubes),
  exposicion: p.exposicion,
  noche: p.noche,
})

const copiar = (a: Mezclable): Mezclable => ({
  ...a,
  cielo: a.cielo.map((c) => c.clone()),
  niebla: a.niebla.clone(),
  solPos: a.solPos.clone(),
  solColor: a.solColor.clone(),
  hemiCielo: a.hemiCielo.clone(),
  hemiSuelo: a.hemiSuelo.clone(),
  mar: a.mar.clone(),
  nubes: a.nubes.clone(),
})

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function mezclar(out: Mezclable, a: Mezclable, b: Mezclable, t: number) {
  out.cielo.forEach((c, i) => c.lerpColors(a.cielo[i], b.cielo[i], t))
  out.niebla.lerpColors(a.niebla, b.niebla, t)
  out.solPos.lerpVectors(a.solPos, b.solPos, t)
  out.solColor.lerpColors(a.solColor, b.solColor, t)
  out.solI = lerp(a.solI, b.solI, t)
  out.hemiCielo.lerpColors(a.hemiCielo, b.hemiCielo, t)
  out.hemiSuelo.lerpColors(a.hemiSuelo, b.hemiSuelo, t)
  out.hemiI = lerp(a.hemiI, b.hemiI, t)
  out.mar.lerpColors(a.mar, b.mar, t)
  out.nubes.lerpColors(a.nubes, b.nubes, t)
  out.exposicion = lerp(a.exposicion, b.exposicion, t)
  out.noche = lerp(a.noche, b.noche, t)
}

/** Degradado vertical del cielo en una textura de 1×128 que se usa como fondo de la escena. */
function useCielo() {
  return useMemo(() => {
    const lienzo = document.createElement('canvas')
    lienzo.width = 1
    lienzo.height = 128
    const tex = new THREE.CanvasTexture(lienzo)
    tex.colorSpace = THREE.SRGBColorSpace
    const pintar = (c: THREE.Color[]) => {
      const ctx = lienzo.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, 0, 128)
      g.addColorStop(0, '#' + c[0].getHexString())
      g.addColorStop(0.55, '#' + c[1].getHexString())
      g.addColorStop(1, '#' + c[2].getHexString())
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 1, 128)
      tex.needsUpdate = true
    }
    return { tex, pintar }
  }, [])
}

function Estrellas() {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const n = 900
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      // casquete superior de una esfera grande, más densa cerca del horizonte
      const a = azar(i * 2 + 1) * Math.PI * 2
      const h = Math.pow(azar(i * 2 + 2), 0.7) * 0.95 + 0.04
      const r = Math.sqrt(1 - h * h)
      pos.set([Math.cos(a) * r * 380, h * 380, Math.sin(a) * r * 380], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  useFrame(() => {
    const p = ref.current!
    const o = Math.max(0, vivo.noche - 0.4) / 0.6
    p.visible = o > 0.01
    ;(p.material as THREE.PointsMaterial).opacity = o
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#e8eeff" size={1.6} sizeAttenuation={false} transparent fog={false} depthWrite={false} />
    </points>
  )
}

function Luces() {
  const momento = useEstado((s) => s.momento)
  const { scene, gl } = useThree()
  const sol = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const cielo = useCielo()
  const estado = useMemo(() => {
    const inicio = aMezclable(PRESETS[momento])
    return { desde: inicio, hasta: inicio, actual: copiar(inicio), t: 0, pintado: false }
    // solo el preset inicial: los cambios posteriores se animan en el efecto de abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const e = estado
    e.desde = copiar(e.actual)
    e.hasta = aMezclable(PRESETS[momento])
    e.t = e.pintado ? 0 : 1
  }, [momento, estado])

  // sombras según la calidad: al cambiar el tamaño hay que tirar el mapa para que three cree otro
  const { sombras } = usePerfil()
  useEffect(() => {
    const s = sol.current!
    s.castShadow = sombras > 0
    if (!sombras) return
    s.shadow.map?.dispose()
    s.shadow.map = null
    s.shadow.mapSize.set(sombras, sombras)
  }, [sombras])

  useEffect(() => {
    scene.background = cielo.tex
    scene.fog = new THREE.Fog(PRESETS[momento].niebla, 130, 420)
    return () => {
      scene.background = null
      scene.fog = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, cielo])

  useFrame((_, dt) => {
    const e = estado
    if (e.pintado && e.t >= 1) return
    e.t = Math.min(1, e.t + dt / DURACION)
    const k = e.t * e.t * (3 - 2 * e.t)
    const a = e.actual
    mezclar(a, e.desde, e.hasta, k)
    e.pintado = true
    cielo.pintar(a.cielo)
    ;(scene.fog as THREE.Fog | null)?.color.copy(a.niebla)
    sol.current!.position.copy(a.solPos)
    sol.current!.color.copy(a.solColor)
    sol.current!.intensity = a.solI
    hemi.current!.color.copy(a.hemiCielo)
    hemi.current!.groundColor.copy(a.hemiSuelo)
    hemi.current!.intensity = a.hemiI
    gl.toneMappingExposure = a.exposicion
    vivo.noche = a.noche
    vivo.uNoche.value = a.noche
    vivo.mar.copy(a.mar)
    vivo.nubes.copy(a.nubes)
  }, -1)

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sol}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-85}
        shadow-camera-right={85}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={260}
      />
    </>
  )
}

/** Luz, cielo y vida de la maqueta: nubes, barcos y gaviotas. */
export function Ambiente() {
  return (
    <>
      <Luces />
      <Estrellas />
      <Nubes />
      <Suspense fallback={null}>
        <Barcos />
      </Suspense>
      <Gaviotas />
    </>
  )
}
