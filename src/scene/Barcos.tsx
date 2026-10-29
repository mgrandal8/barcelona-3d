import { use, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cargarDatos, type DatosCiudad } from './datos'
import { vivo } from './hora'
import { esAgua } from './mallas'
import { azar, mat } from './monumentos/comun'

// Barcos que navegan en rutas elípticas por el mar real (se comprueba que toda la ruta sea agua).
// A esta escala un velero real mediría 0,1 u: se exageran un poco para que se vean.

const NIVEL = -0.03

type Tipo = 'velero' | 'yate' | 'ferri'
type Ruta = { tipo: Tipo; cx: number; cz: number; rx: number; rz: number; giro: number; fase: number; vel: number; sentido: 1 | -1 }

/** Material de las luces de a bordo: apagado de día, encendido de noche. */
const luz = new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#ffd08a', emissiveIntensity: 0, roughness: 0.6 })

function puntoRuta(r: Ruta, a: number): [number, number] {
  const x = Math.cos(a) * r.rx
  const z = Math.sin(a) * r.rz
  const c = Math.cos(r.giro)
  const s = Math.sin(r.giro)
  return [r.cx + x * c - z * s, r.cz + x * s + z * c]
}

/** Busca una elipse que quede entera sobre el agua, con margen por si la costa es irregular. */
function buscarRuta(d: DatosCiudad, semilla: number, tipo: Tipo, tam: [number, number]): Ruta | null {
  const { xMin, xMax, zMax } = d.limites
  for (let k = 0; k < 300; k++) {
    const q = (i: number) => azar(semilla * 1009 + k * 31 + i)
    const r: Ruta = {
      tipo,
      cx: xMin + 4 + q(1) * (xMax - xMin - 8),
      cz: 24 + q(2) * (zMax - 26),
      rx: tam[0] * (0.6 + q(3) * 0.8),
      rz: tam[1] * (0.6 + q(4) * 0.8),
      giro: (q(5) - 0.5) * 0.6,
      fase: q(6) * Math.PI * 2,
      vel: 0,
      sentido: q(7) < 0.5 ? 1 : -1,
    }
    const margen = tipo === 'ferri' ? 1.2 : 0.5
    let ok = true
    for (let i = 0; i < 40 && ok; i++) {
      const [x, z] = puntoRuta(r, (i / 40) * Math.PI * 2)
      ok = x > xMin + 1 && x < xMax - 1 && z < zMax - 0.6 && [[0, 0], [margen, 0], [-margen, 0], [0, margen], [0, -margen]].every(([dx, dz]) => esAgua(d, x + dx, z + dz))
    }
    if (ok) return r
  }
  return null
}

function useGeometrias() {
  return useMemo(() => {
    // casco: planta en punta extruida hacia arriba (proa en +x)
    const casco = (largo: number, ancho: number, alto: number) => {
      const s = new THREE.Shape()
      s.moveTo(-largo / 2, -ancho / 2)
      s.lineTo(largo * 0.22, -ancho / 2)
      s.quadraticCurveTo(largo * 0.42, -ancho * 0.35, largo / 2, 0)
      s.quadraticCurveTo(largo * 0.42, ancho * 0.35, largo * 0.22, ancho / 2)
      s.lineTo(-largo / 2, ancho / 2)
      s.closePath()
      const g = new THREE.ExtrudeGeometry(s, { depth: alto, bevelEnabled: false, curveSegments: 3 })
      g.rotateX(-Math.PI / 2)
      g.translate(0, -alto * 0.35, 0)
      return g
    }
    const triangulo = (a: number[], b: number[], c: number[]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3))
      g.computeVertexNormals()
      return g
    }
    // estela en V: opaca junto a la popa y transparente al final (alfa por vértice)
    const estela = (x0: number, x1: number, ancho: number) => {
      const g = triangulo([x0, 0, 0], [x1, 0, ancho], [x1, 0, -ancho])
      g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.6, 1, 1, 1, 0, 1, 1, 1, 0], 4))
      return g
    }
    return {
      cascoVelero: casco(0.3, 0.1, 0.04),
      cascoYate: casco(0.38, 0.12, 0.05),
      cascoFerri: casco(1.9, 0.32, 0.12),
      mayor: triangulo([0.02, 0.045, 0], [0.02, 0.36, 0], [-0.13, 0.05, 0]),
      foque: triangulo([0.03, 0.05, 0], [0.03, 0.3, 0], [0.15, 0.04, 0]),
      estela: estela(-0.12, -0.7, 0.13),
      estelaFerri: estela(-0.9, -2.6, 0.38),
    }
  }, [])
}

type Geos = ReturnType<typeof useGeometrias>

function Velero({ g, vela }: { g: Geos; vela: string }) {
  return (
    <>
      <mesh geometry={g.cascoVelero} material={mat('#f4f1ea')} castShadow />
      <mesh position={[0.02, 0.2, 0]} material={mat('#8a7a68')}>
        <cylinderGeometry args={[0.004, 0.005, 0.34, 4]} />
      </mesh>
      <mesh geometry={g.mayor} material={mat(vela, { side: THREE.DoubleSide })} castShadow />
      <mesh geometry={g.foque} material={mat('#f7f3ea', { side: THREE.DoubleSide })} />
      <mesh position={[0.02, 0.37, 0]} material={luz}>
        <sphereGeometry args={[0.012, 5, 4]} />
      </mesh>
    </>
  )
}

function Yate({ g }: { g: Geos }) {
  return (
    <>
      <mesh geometry={g.cascoYate} material={mat('#fbfbf8')} castShadow />
      <mesh position={[-0.03, 0.05, 0]} material={mat('#ffffff')} castShadow>
        <boxGeometry args={[0.17, 0.045, 0.09]} />
      </mesh>
      <mesh position={[-0.03, 0.05, 0]} material={luz}>
        <boxGeometry args={[0.172, 0.014, 0.092]} />
      </mesh>
      <mesh position={[-0.05, 0.085, 0]} material={mat('#e9edf0')}>
        <boxGeometry args={[0.09, 0.03, 0.07]} />
      </mesh>
    </>
  )
}

/** Ferri de Baleares: casco azul, superestructura blanca de tres cubiertas y chimenea. */
function Ferri({ g }: { g: Geos }) {
  return (
    <>
      <mesh geometry={g.cascoFerri} material={mat('#1f4f86')} castShadow />
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <mesh position={[-0.18 - i * 0.05, 0.11 + i * 0.065, 0]} material={mat('#f6f6f2')} castShadow>
            <boxGeometry args={[1.25 - i * 0.28, 0.065, 0.28 - i * 0.02]} />
          </mesh>
          <mesh position={[-0.18 - i * 0.05, 0.115 + i * 0.065, 0]} material={luz}>
            <boxGeometry args={[1.25 - i * 0.28 + 0.004, 0.018, 0.284 - i * 0.02]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.5, 0.36, 0]} material={mat('#c8553a')} castShadow>
        <boxGeometry args={[0.16, 0.12, 0.1]} />
      </mesh>
    </>
  )
}

const VELAS = ['#ffffff', '#f7f1e3', '#f0b84a', '#c8553a', '#ffffff', '#5e86b4']

export function Barcos() {
  const d = use(cargarDatos())
  const g = useGeometrias()
  const rutas = useMemo(() => {
    const out: Ruta[] = []
    const añadir = (tipo: Tipo, n: number, tam: [number, number], vel: number) => {
      for (let i = 0; i < n; i++) {
        const r = buscarRuta(d, out.length + 1, tipo, tam)
        if (r) out.push({ ...r, vel: vel * (0.8 + azar(out.length * 7) * 0.4) })
      }
    }
    añadir('velero', 10, [3, 1.2], 0.35)
    añadir('yate', 4, [5, 1.6], 0.7)
    añadir('ferri', 1, [16, 3.5], 0.55)
    return out
  }, [d])
  const grupo = useRef<THREE.Group>(null)
  const estela = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    luz.emissiveIntensity = vivo.noche * 3
    grupo.current!.children.forEach((b, i) => {
      const r = rutas[i]
      // velocidad lineal constante: ángulo según el radio medio
      const a = r.fase + (r.sentido * t * r.vel) / ((r.rx + r.rz) / 2)
      const [x, z] = puntoRuta(r, a)
      const [x2, z2] = puntoRuta(r, a + r.sentido * 0.01)
      b.position.set(x, NIVEL + Math.sin(t * 1.7 + i) * 0.006, z)
      b.rotation.set(Math.sin(t * 1.3 + i) * 0.05, Math.atan2(-(z2 - z), x2 - x), 0, 'YXZ')
    })
  })

  return (
    <group ref={grupo}>
      {rutas.map((r, i) => (
        <group key={i}>
          {r.tipo === 'velero' && <Velero g={g} vela={VELAS[i % VELAS.length]} />}
          {r.tipo === 'yate' && <Yate g={g} />}
          {r.tipo === 'ferri' && <Ferri g={g} />}
          <mesh geometry={r.tipo === 'ferri' ? g.estelaFerri : g.estela} material={estela} position-y={0.012} scale={r.tipo === 'yate' ? 1.4 : 1} />
        </group>
      ))}
    </group>
  )
}
