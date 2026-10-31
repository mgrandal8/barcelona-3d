import { use, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { avisarNombres, pantallaNombres as P, tamNombre, type Nombre } from '../nombres'
import { pantalla as pines } from '../pines'
import { cargarDatos } from './datos'
import { tapado, type Rejilla } from './relieve'

// Proyecta los nombres para ui/CapaNombres.tsx. Qué se ve depende de la altura de la cámara: de lejos los
// distritos y municipios; a media altura, los barrios; de cerca, las calles. Cada CADA segundos se quitan los
// tapados por un edificio y los que pisan a otro nombre de más prioridad o a un pin.

const CADA = 0.2

/** Altura de la cámara (u) entre la que se ve cada nivel, y distancia máxima a la cámara. */
const NIVELES = [
  { min: 24, max: Infinity, lejos: Infinity, sobre: 1.2 },
  { min: 7, max: 42, lejos: 70, sobre: 0.35 },
  { min: 0, max: 13, lejos: 22, sobre: 0.03 },
] as const

/** Interfaz que tapa la maqueta: ahí no se ponen nombres. */
const INTERFAZ = '#lista, .menu, .hora, .ubicacion, .metro-boton, .panel.abierto, .atribucion'
/** Si un nombre pisa algo, se prueba un poco más abajo o más arriba (px). */
const DESPLAZAMIENTOS = [0, 24, -24, 48, -48]

const v = new THREE.Vector3()
const w = new THREE.Vector3()

type Caja = [number, number, number, number]
const choca = (a: Caja, b: Caja) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

export function Nombres({ nombres }: { nombres: Nombre[] }) {
  const d = use(cargarDatos())
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const lienzo = useThree((s) => s.gl.domElement)
  const desp = useRef<number[]>([])
  const rejilla = useRef<Rejilla | null>(null)
  const ultimo = useRef(-1)

  useEffect(() => {
    let vigente = true
    d.tejados.then((r) => vigente && (rejilla.current = r)).catch(() => {})
    return () => {
      vigente = false
      P.ver = []
      avisarNombres()
    }
  }, [d])

  const anclas = useMemo(() => nombres.map((n) => new THREE.Vector3(n.x, d.alturaY(n.x, n.z) + NIVELES[n.l].sobre, n.z)), [nombres, d])

  useFrame(({ clock }) => {
    const delante: boolean[] = []
    nombres.forEach((n, i) => {
      const a = anclas[i]
      v.copy(a).project(camera)
      P.x[i] = ((v.x + 1) / 2) * size.width
      P.y[i] = ((1 - v.y) / 2) * size.height + (desp.current[i] ?? 0)
      delante[i] = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      if (n.a !== undefined) {
        // ángulo de la calle en pantalla, sin dejar el texto boca abajo
        w.set(a.x + Math.cos(n.a) * 0.5, a.y, a.z + Math.sin(n.a) * 0.5).project(camera)
        let ang = (Math.atan2(-(w.y - v.y) * size.height, (w.x - v.x) * size.width) * 180) / Math.PI
        if (ang > 90) ang -= 180
        if (ang < -90) ang += 180
        P.ang[i] = ang
      }
    })

    if (clock.elapsedTime - ultimo.current > CADA || ultimo.current < 0) {
      ultimo.current = clock.elapsedTime
      const r = rejilla.current
      const c = camera.position
      // los pines ganan siempre: su caja (botón de 30 px con colita) se reserva primero
      const ocupado: Caja[] = []
      pines.ver.forEach((ver, i) => ver && ocupado.push([pines.x[i] - 20, pines.y[i] - 42, pines.x[i] + 20, pines.y[i] + 2]))
      const base = lienzo.getBoundingClientRect()
      document.querySelectorAll(INTERFAZ).forEach((el) => {
        const b = el.getBoundingClientRect()
        if (b.width && b.height) ocupado.push([b.left - base.left - 6, b.top - base.top - 6, b.right - base.left + 6, b.bottom - base.top + 6])
      })
      // la misma calle no se repite a menos de 260 px
      const puestos = new Map<string, [number, number][]>()
      nombres.forEach((n, i) => {
        const nivel = NIVELES[n.l]
        const a = anclas[i]
        let ver = delante[i] && c.y >= nivel.min && c.y <= nivel.max && c.distanceTo(a) <= nivel.lejos
        // una calle se ve aunque las fachadas tapen la calzada: se mira desde la altura de una cornisa
        if (ver && n.l > 0 && r) ver = !tapado(r, a.x, a.y + (n.l === 2 ? 0.3 : 0), a.z, c.x, c.y, c.z)
        if (ver && puestos.get(n.n)?.some(([x, y]) => Math.hypot(x - P.x[i], y - P.y[i]) < 260)) ver = false
        if (ver) {
          // caja del texto girado, alineada con los ejes
          const [ancho, alto] = tamNombre(n)
          const g = ((P.ang[i] ?? 0) * Math.PI) / 180
          const hx = (Math.abs(Math.cos(g)) * ancho + Math.abs(Math.sin(g)) * alto) / 2
          const hy = (Math.abs(Math.sin(g)) * ancho + Math.abs(Math.cos(g)) * alto) / 2
          const y0 = P.y[i] - (desp.current[i] ?? 0)
          ver = false
          // las calles van sobre su calle: no se mueven
          for (const dy of n.l === 2 ? [0] : DESPLAZAMIENTOS) {
            const caja: Caja = [P.x[i] - hx, y0 + dy - hy, P.x[i] + hx, y0 + dy + hy]
            if (caja[0] > 0 && caja[2] < size.width && caja[1] > 0 && caja[3] < size.height && !ocupado.some((o) => choca(o, caja))) {
              ocupado.push(caja)
              puestos.set(n.n, [...(puestos.get(n.n) ?? []), [P.x[i], y0 + dy]])
              desp.current[i] = dy
              P.y[i] = y0 + dy
              ver = true
              break
            }
          }
        }
        P.ver[i] = ver
      })
    }
    avisarNombres()
  })

  return null
}
