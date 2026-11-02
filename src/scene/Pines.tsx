import { use, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MONUMENTOS } from '../data/monumentos'
import { tourPorId } from '../data/tours'
import { useEstado } from '../store'
import { avisarFotograma, pantalla, ponerGrupos } from '../pines'
import { cargarDatos } from './datos'
import { tapado, type Rejilla } from './relieve'

// Proyecta los lugares para los pines HTML (ui/CapaPines.tsx): posición en pantalla en cada fotograma y,
// cada CADA segundos, si un edificio los tapa (rejilla de tejados del worker) y qué pines se solapan.

/** Dos pines a menos de esto (px) se juntan en un grupo. */
const UMBRAL = 44
const CADA = 0.2

const v = new THREE.Vector3()

export function Pines() {
  const d = use(cargarDatos())
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const rejilla = useRef<Rejilla | null>(null)
  const ultimo = useRef(-1)

  // la rejilla llega con los edificios: hasta entonces no se tapa nada
  useEffect(() => {
    let vigente = true
    d.tejados.then((r) => vigente && (rejilla.current = r)).catch(() => {})
    return () => {
      vigente = false
      // sin escena, no hay pines
      pantalla.ver = []
      pantalla.fuera = []
      ponerGrupos([])
      avisarFotograma()
    }
  }, [d])

  const bases = useMemo(() => MONUMENTOS.map(({ pos: [x, z] }) => new THREE.Vector3(x, d.alturaY(x, z) + 0.1, z)), [d])
  const anclas = useMemo(
    () =>
      MONUMENTOS.map((m) => {
        const [x, z] = m.pos
        return new THREE.Vector3(x, d.alturaY(x, z) + m.alturaMarcador + 0.2, z)
      }),
    [d],
  )

  useFrame(({ clock }) => {
    const delante: boolean[] = []
    anclas.forEach((a, i) => {
      v.copy(a).project(camera)
      pantalla.x[i] = ((v.x + 1) / 2) * size.width
      pantalla.y[i] = ((1 - v.y) / 2) * size.height
      delante[i] = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      pantalla.detras[i] = v.z > 1
      v.copy(bases[i]).project(camera)
      pantalla.baseX[i] = ((v.x + 1) / 2) * size.width
      pantalla.baseY[i] = ((1 - v.y) / 2) * size.height
    })

    if (clock.elapsedTime - ultimo.current > CADA || ultimo.current < 0) {
      ultimo.current = clock.elapsedTime
      const { seleccionado, tour } = useEstado.getState()
      const paradas = tourPorId(tour)?.paradas.map((p) => p.id) ?? []
      const r = rejilla.current
      const c = camera.position
      // las flechas del borde solo en vistas altas (de cerca serían ruido) y sin ficha abierta
      const alta = c.y - d.alturaY(c.x, c.z) > 18 && !seleccionado
      MONUMENTOS.forEach((m, i) => {
        const a = anclas[i]
        // fuera de un tour, el lugar elegido no lleva pin: ya tiene el anillo y la ficha
        const oculto = m.id === seleccionado && !paradas.includes(m.id)
        pantalla.ver[i] = delante[i] && !oculto && !(r && tapado(r, a.x, a.y, a.z, c.x, c.y, c.z))
        pantalla.fuera[i] = alta && !delante[i] && (!paradas.length || paradas.includes(m.id))
      })
      // agrupación voraz en el orden de la guía
      const libres = MONUMENTOS.map((_, i) => i).filter((i) => pantalla.ver[i])
      const usados = new Set<number>()
      const grupos: string[][] = []
      for (const i of libres) {
        if (usados.has(i)) continue
        const g = libres.filter((j) => j !== i && !usados.has(j) && Math.hypot(pantalla.x[i] - pantalla.x[j], pantalla.y[i] - pantalla.y[j]) < UMBRAL)
        if (!g.length) continue
        ;[i, ...g].forEach((j) => usados.add(j))
        grupos.push([i, ...g].map((j) => MONUMENTOS[j].id))
      }
      const clave = (gs: string[][]) => gs.map((g) => g.join('+')).join('|')
      if (clave(grupos) !== clave(pantalla.grupos)) ponerGrupos(grupos)
    }
    avisarFotograma()
  })

  return null
}
