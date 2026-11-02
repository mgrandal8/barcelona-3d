import { use, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cargarDatos } from './datos'
import { geometriaTerreno, geometriaZocalo, textura } from './mallas'
import type { Malla } from './edificios'
import { vivo } from './hora'
import { usePerfil } from '../store'

const NIVEL_MAR = -0.03

function Terreno() {
  const suelo = use(use(cargarDatos()).suelo)
  const gl = useThree((s) => s.gl)
  const geo = useMemo(() => geometriaTerreno(suelo), [suelo])
  const zocalo = useMemo(() => geometriaZocalo(suelo), [suelo])
  const tex = useMemo(() => textura(suelo.texSuelo, gl, 16), [suelo, gl])
  const luces = useMemo(() => textura(suelo.texLuces, gl, 4), [suelo, gl])
  const material = useRef<THREE.MeshStandardMaterial>(null)
  // farolas: las calles brillan en ámbar al caer la noche
  useFrame(() => {
    material.current!.emissiveIntensity = Math.max(0, vivo.noche - 0.15) * 1.6
  })
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial ref={material} map={tex} emissiveMap={luces} emissive="#ffffff" emissiveIntensity={0} roughness={0.95} />
      </mesh>
      <mesh geometry={zocalo}>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/**
 * Ventanas sin geometría: en las paredes (normal casi horizontal) se dibuja una rejilla de plantas de 3,2 m y
 * huecos de 4,5 m. De día los huecos son cristal oscuro o persianas (verdes o de madera, como en Barcelona);
 * de noche se enciende una parte al azar. De lejos, cuando la celda ocupa menos de un píxel, se usa el valor
 * medio para que no parpadee.
 */
function conVentanas(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uNoche = vivo.uNoche
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNoche;
        varying vec3 vPosW;
        float azar2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float vHueco = 0.0;
        float vLejos = 1.0;
        vec2 vId = vec2(0.0);
        vec3 nW = normalize(cross(dFdx(vPosW), dFdy(vPosW)));
        bool pared = abs(nW.y) < 0.35;
        if (pared) {
          vec2 tg = normalize(vec2(-nW.z, nW.x));
          vec2 celda = vec2(dot(vPosW.xz, tg) / 0.045, vPosW.y / ${(3.2 * 1.6) / 100});
          vId = floor(celda);
          vec2 f = fract(celda);
          vHueco = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.82);
          vLejos = smoothstep(0.35, 1.0, max(fwidth(celda.x), fwidth(celda.y)));
          // de día: cristal que refleja el cielo, o persianas verdes o de madera
          float tipo = azar2(vId + 3.1);
          vec3 hueco = tipo < 0.16 ? diffuseColor.rgb * vec3(0.45, 0.62, 0.48) : tipo < 0.28 ? diffuseColor.rgb * vec3(0.72, 0.6, 0.48) : vec3(0.27, 0.32, 0.38);
          float dia = 1.0 - uNoche * 0.6;
          diffuseColor.rgb = mix(diffuseColor.rgb, hueco, vHueco * (1.0 - vLejos) * 0.62 * dia);
          // de lejos, la fachada se oscurece un poco en lugar de dibujar las ventanas
          diffuseColor.rgb *= 1.0 - vLejos * 0.08 * dia;
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uNoche > 0.001 && pared) {
          float h = azar2(vId);
          float prob = 0.42 * uNoche;
          float encendida = step(1.0 - prob, h);
          float v = mix(vHueco * encendida, 0.12 * prob, vLejos);
          vec3 tono = mix(vec3(1.0, 0.72, 0.38), vec3(0.75, 0.85, 1.0), step(0.86, azar2(vId + 7.3)));
          totalEmissiveRadiance += tono * v * 2.2;
        }`,
      )
  }
  return m
}

/** La esfera envolvente es la del trozo, que ya calcula el worker (recorrer las posiciones aquí costaba ~0,3 s). */
function geometria(m: Malla, esfera: THREE.Sphere) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(m.col, 3, true))
  g.setIndex(new THREE.BufferAttribute(m.idx, 1))
  g.boundingSphere = esfera
  return g
}

/** Los edificios llegan del worker después que el terreno: este componente va en su propio Suspense. */
export function Edificios() {
  const d = use(cargarDatos())
  const trozos = use(d.trozos)
  const mallas = useMemo(
    () =>
      trozos.map((t) => {
        const esfera = new THREE.Sphere(new THREE.Vector3(...t.centro), t.radio)
        return {
          grandes: t.grandes && geometria(t.grandes, esfera),
          detalle: t.detalle && geometria(t.detalle, esfera),
          techos: t.detalle?.techos ?? 0,
          centro: esfera.center,
          radio: t.radio,
        }
      }),
    [trozos],
  )
  const detalle = useRef<(THREE.Mesh | null)[]>([])
  // más allá de esta distancia (al borde del trozo), de los edificios bajos y pequeños solo se dibujan los tejados
  const { lejos } = usePerfil()
  const material = useMemo(() => conVentanas(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })), [])
  // LOD: de lejos, de las casas bajas solo se distinguen los tejados (las tejas rojas dan color a los barrios);
  // sus paredes y su sombra ya no aportan y suponen un tercio de los triángulos de la vista general
  useFrame(({ camera }) => {
    mallas.forEach((m, i) => {
      const malla = detalle.current[i]
      if (!malla || !m.detalle) return
      const cerca = camera.position.distanceTo(m.centro) - m.radio < lejos
      malla.castShadow = cerca
      m.detalle.setDrawRange(0, cerca ? Infinity : m.techos)
    })
  })
  return (
    <group>
      {mallas.map((m, i) => (
        <group key={i}>
          {m.grandes && <mesh geometry={m.grandes} material={material} castShadow receiveShadow />}
          {m.detalle && (
            <mesh
              ref={(r) => {
                detalle.current[i] = r
              }}
              geometry={m.detalle}
              material={material}
              castShadow
              receiveShadow
            />
          )}
        </group>
      ))}
    </group>
  )
}

const VERDES = ['#6f9e4f', '#5f8f45', '#7ba957', '#567f3f', '#86b15e', '#4f7a3a'].map((c) => new THREE.Color(c))
const tmp = new THREE.Object3D()

function Arboles() {
  // x, y, z, escala y azar de cada árbol, del worker del suelo
  const datos = use(use(cargarDatos()).suelo).arboles
  const ref = useRef<THREE.InstancedMesh>(null)
  // copa y tronco en una sola geometría: el tronco queda oscuro por el color de vértice
  const geo = useMemo(() => {
    const copa = new THREE.IcosahedronGeometry(1, 0).translate(0, 1.6, 0)
    const tronco = new THREE.CylinderGeometry(0.18, 0.24, 1, 5).translate(0, 0.5, 0).toNonIndexed()
    const g = new THREE.BufferGeometry()
    const a = copa.attributes.position.array
    const b = tronco.attributes.position.array
    const pos = new Float32Array(a.length + b.length)
    pos.set(a)
    pos.set(b, a.length)
    const col = new Float32Array(pos.length).fill(1)
    for (let i = a.length; i < pos.length; i += 3) col.set([0.45, 0.33, 0.25], i)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])
  useLayoutEffect(() => {
    const m = ref.current!
    for (let i = 0; i < datos.length / 5; i++) {
      const [x, y, z, s, c] = datos.subarray(i * 5, i * 5 + 5)
      tmp.position.set(x, y, z)
      tmp.rotation.set(0, c * 6.28, 0)
      tmp.scale.setScalar(s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      m.setColorAt(i, VERDES[Math.floor(c * 61) % VERDES.length])
    }
    m.instanceMatrix.needsUpdate = true
    m.instanceColor!.needsUpdate = true
    m.computeBoundingSphere()
  }, [datos])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, datos.length / 5]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.9} flatShading />
    </instancedMesh>
  )
}

const tiempoOlas = { value: 0 }

/** Olas en la GPU: la malla del mar está en coordenadas de mundo, así que basta con mover la y. */
function conOlas(s: THREE.WebGLProgramParametersWithUniforms) {
  s.uniforms.uTiempo = tiempoOlas
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTiempo;').replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    transformed.y += sin(position.x * 1.3 + uTiempo * 1.1) * 0.006 + cos(position.z * 1.7 - uTiempo * 0.8) * 0.005;`,
  )
}

function Mar() {
  const d = use(cargarDatos())
  const { xMin, xMax, zMin, zMax } = d.limites
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(xMax - xMin - 0.02, zMax - zMin - 0.02, 160, 140)
    g.rotateX(-Math.PI / 2)
    g.translate((xMin + xMax) / 2, NIVEL_MAR, (zMin + zMax) / 2)
    return g
  }, [xMin, xMax, zMin, zMax])
  const agua = useRef<THREE.MeshStandardMaterial>(null)
  const fondo = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    agua.current!.color.copy(vivo.mar)
    agua.current!.roughness = vivo.marRugosidad
    fondo.current!.color.copy(vivo.mar).multiplyScalar(0.8)
    tiempoOlas.value = clock.elapsedTime
  })
  const alto = 0.14
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial ref={agua} color="#3d9ac4" roughness={0.38} metalness={0.1} transparent opacity={0.78} flatShading onBeforeCompile={conOlas} />
      </mesh>
      <mesh position={[(xMin + xMax) / 2, NIVEL_MAR - alto / 2 - 0.01, (zMin + zMax) / 2]}>
        <boxGeometry args={[xMax - xMin - 0.04, alto, zMax - zMin - 0.04]} />
        <meshStandardMaterial ref={fondo} color="#2f7fae" transparent opacity={0.5} roughness={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function CiudadReal() {
  return (
    <group>
      <Terreno />
      <Arboles />
      <Mar />
    </group>
  )
}
