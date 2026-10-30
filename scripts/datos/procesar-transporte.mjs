// Metro y FGC urbano → public/datos/transporte.json.gz
//   { lineas: [{ ref, color, tramos: [[u, v, u, v, ...], ...] }], estaciones: [{ n, p: [u, v], l: [ref, ...] }] }
// Uso: node scripts/datos/procesar-transporte.mjs (después de descargar.mjs)
import { readFileSync } from 'node:fs'
import { CRUDOS, RECT, SALIDA, proyectar, simplificar } from './comun.mjs'
import { escribirGz } from './formato.mjs'

const { elements } = JSON.parse(readFileSync(`${CRUDOS}transporte.json`, 'utf8'))
const relaciones = elements.filter((e) => e.type === 'relation' && e.tags?.ref)
const nodos = elements.filter((e) => e.type === 'node' && e.tags?.name)

// L9N y L9S (o L10N y L10S) son ramales de la misma línea: en el mapa, una sola
const refVisible = (ref) => ref.replace(/^(L\d+)[NS]$/, '$1')
const enRect = ([u, v]) => u >= RECT.uMin && u <= RECT.uMax && v >= RECT.vMin && v <= RECT.vMax
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const longitud = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0)

/** Las vías de una relación, en orden, encadenadas en polilíneas (girando las que vienen al revés). */
function cadenas(rel) {
  const out = []
  let actual = null
  let unaVia = false
  for (const m of rel.members) {
    if (m.type !== 'way' || m.role !== '' || !m.geometry) continue
    const pts = m.geometry.map((g) => proyectar(g.lat, g.lon))
    if (actual) {
      // la primera vía de una cadena puede venir girada respecto a la segunda
      if (unaVia && Math.min(dist(actual[0], pts[0]), dist(actual[0], pts[pts.length - 1])) < 3) actual.reverse()
      unaVia = false
      if (dist(actual[actual.length - 1], pts[0]) < 3) {
        actual.push(...pts.slice(1))
        continue
      }
      if (dist(actual[actual.length - 1], pts[pts.length - 1]) < 3) {
        actual.push(...pts.reverse().slice(1))
        continue
      }
      out.push(actual)
    }
    actual = pts
    unaVia = true
  }
  if (actual) out.push(actual)
  return out
}

/** Corta las polilíneas por el borde de la maqueta: solo se quedan los trozos de dentro. */
function recortar(pts) {
  const trozos = []
  let t = []
  for (const p of pts) {
    if (enRect(p)) t.push(p)
    else if (t.length) {
      trozos.push(t)
      t = []
    }
  }
  if (t.length) trozos.push(t)
  return trozos.filter((x) => x.length > 1)
}

// de cada ramal (ref), un solo sentido: el de más recorrido
const porRef = new Map()
for (const r of relaciones) {
  const c = cadenas(r)
  const largo = c.reduce((s, x) => s + longitud(x), 0)
  const prev = porRef.get(r.tags.ref)
  if (!prev || largo > prev.largo) porRef.set(r.tags.ref, { rel: r, cadenas: c, largo })
}

const lineas = new Map()
for (const [ref, { rel, cadenas: c }] of porRef) {
  const vis = refVisible(ref)
  const l = lineas.get(vis) ?? { ref: vis, color: rel.tags.colour ?? '#888888', tramos: [] }
  for (const cad of c) for (const t of recortar(cad)) l.tramos.push(simplificar(t, 3).flatMap(([u, v]) => [Math.round(u), Math.round(v)]))
  lineas.set(vis, l)
}

// paradas (stop_position) de cada línea, para saber qué líneas pasan por cada estación
const paradas = []
for (const r of relaciones)
  for (const m of r.members) if (m.type === 'node' && m.role.startsWith('stop') && m.lat) paradas.push({ p: proyectar(m.lat, m.lon), ref: refVisible(r.tags.ref) })

const numero = (ref) => Number(ref.replace(/\D/g, ''))
// FGC pone el municipio delante: «Barcelona-Plaça Catalunya»
const nombre = (n) => n.replace(/^Barcelona-/, '')
const candidatas = nodos.map((n) => ({ n: nombre(n.tags.name), p: proyectar(n.lat, n.lon), l: new Set() })).filter((e) => enRect(e.p))

// cada parada cuenta solo para su estación más cercana (si no, en los intercambiadores se cruzan las líneas de TMB y FGC)
for (const s of paradas) {
  let mejor = null
  for (const e of candidatas) if (!mejor || dist(e.p, s.p) < dist(mejor.p, s.p)) mejor = e
  if (mejor && dist(mejor.p, s.p) < 250) mejor.l.add(s.ref)
}

// el mismo nombre a menos de 500 m es la misma estación (OSM pone un nodo por línea o por vestíbulo)
const estaciones = []
for (const c of candidatas) {
  if (!c.l.size) continue
  const igual = estaciones.find((e) => e.n === c.n && dist(e.p, c.p) < 500)
  if (!igual) {
    estaciones.push(c)
    continue
  }
  for (const x of c.l) igual.l.add(x)
}

const salida = {
  lineas: [...lineas.values()].filter((l) => l.tramos.length).sort((a, b) => numero(a.ref) - numero(b.ref)),
  estaciones: estaciones.map((e) => ({ n: e.n, p: e.p.map(Math.round), l: [...e.l].sort((a, b) => numero(a) - numero(b)) })),
}
const bytes = escribirGz(`${SALIDA}transporte.json.gz`, JSON.stringify(salida))
console.log(
  salida.lineas.map((l) => `${l.ref} (${l.tramos.length} tramos)`).join(', '),
  `\n${salida.estaciones.length} estaciones, ${(bytes / 1024).toFixed(0)} kB`,
)
