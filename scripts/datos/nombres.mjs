// Límites administrativos (zonas de color de los edificios) y nombres de distritos, barrios y calles.

import { readFileSync } from 'node:fs'

/** Zonas: índice que va en los 4 bits altos del tipo de cada edificio (ver src/scene/edificios.ts). */
export const ZONAS = [
  'otros',
  'Ciutat Vella',
  "l'Eixample",
  'Sants-Montjuïc',
  'les Corts',
  'Sarrià - Sant Gervasi',
  'Gràcia',
  'Horta-Guinardó',
  'Nou Barris',
  'Sant Andreu',
  'Sant Martí',
  "l'Hospitalet de Llobregat",
]

const igual = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01

/** Une vías de una relación en anillos cerrados, sin importar el sentido de cada una. */
function anillos(vias) {
  const pend = vias.slice()
  const out = []
  while (pend.length) {
    let a = pend.shift()
    let cambio = true
    while (!igual(a[0], a[a.length - 1]) && cambio) {
      cambio = false
      for (let i = 0; i < pend.length; i++) {
        const w = pend[i]
        const fin = a[a.length - 1]
        if (igual(fin, w[0])) a = a.concat(w.slice(1))
        else if (igual(fin, w[w.length - 1])) a = a.concat(w.slice(0, -1).reverse())
        else continue
        pend.splice(i, 1)
        cambio = true
        break
      }
    }
    if (a.length > 3 && igual(a[0], a[a.length - 1])) out.push(a)
    else if (a.length > 3) abiertos++
  }
  return out
}
let abiertos = 0

function dentro(px, py, poly) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Polígono con su caja, para descartar rápido. */
function region(nombre, r) {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity
  for (const a of r) for (const [u, v] of a) {
    u0 = Math.min(u0, u)
    v0 = Math.min(v0, v)
    u1 = Math.max(u1, u)
    v1 = Math.max(v1, v)
  }
  return { nombre, r, caja: [u0, v0, u1, v1] }
}

const contiene = (g, u, v) =>
  u >= g.caja[0] && u <= g.caja[2] && v >= g.caja[1] && v <= g.caja[3] && g.r.filter((a) => dentro(u, v, a)).length % 2 === 1

export function leerLimites(ruta, proyectar) {
  const els = JSON.parse(readFileSync(ruta, 'utf8')).elements
  const rel = (nivel) =>
    els
      .filter((e) => e.type === 'relation' && e.tags?.admin_level === nivel && e.tags.name)
      .map((e) => {
        const vias = e.members.filter((m) => m.type === 'way' && m.geometry && m.role !== 'inner').map((m) => m.geometry.map(({ lat, lon }) => proyectar(lat, lon)))
        const huecos = e.members.filter((m) => m.type === 'way' && m.geometry && m.role === 'inner').map((m) => m.geometry.map(({ lat, lon }) => proyectar(lat, lon)))
        return region(e.tags.name, [...anillos(vias), ...anillos(huecos)])
      })
      .filter((g) => g.r.length)
  const municipios = rel('8')
  const barcelona = municipios.find((m) => m.nombre === 'Barcelona')
  // los distritos de Barcelona (otros municipios también tienen admin_level 9)
  const distritos = rel('9').filter((d) => ZONAS.includes(d.nombre))
  if (!barcelona) console.log('  límites: falta el municipio de Barcelona')
  if (abiertos) console.log('  límites:', abiertos, 'anillos sin cerrar (se ignoran)')
  console.log('  distritos:', distritos.map((d) => `${d.nombre} (${d.r.length})`).join(', '))
  const barrios = rel('10')
  const nodos = els.filter((e) => e.type === 'node' && e.tags?.name).map((e) => ({ nombre: e.tags.name, place: e.tags.place, p: proyectar(e.lat, e.lon) }))
  return { municipios, distritos, barrios, nodos }
}

function centro(g) {
  const a = g.r[0]
  let u = 0
  let v = 0
  for (const p of a) {
    u += p[0]
    v += p[1]
  }
  return [u / a.length, v / a.length]
}

/** Zona de un punto: distrito de Barcelona, l'Hospitalet u «otros». */
export function zonaDe(L, u, v) {
  const k = Math.floor(u / 100) + ',' + Math.floor(v / 100)
  const cache = (L.cache ??= new Map())
  if (cache.has(k)) return cache.get(k)
  let z = 0
  const cu = (Math.floor(u / 100) + 0.5) * 100
  const cv = (Math.floor(v / 100) + 0.5) * 100
  const d = L.distritos.find((g) => contiene(g, cu, cv))
  if (d) z = ZONAS.indexOf(d.nombre)
  else if (L.municipios.find((g) => g.nombre === ZONAS[11] && contiene(g, cu, cv))) z = 11
  cache.set(k, z)
  return z
}

/** Centro visual de la parte de una región dentro del rectángulo (media de celdas de 100 m) y su superficie. */
function centroEn(g, rect) {
  const paso = 100
  let n = 0
  let su = 0
  let sv = 0
  const [u0, v0, u1, v1] = g.caja
  for (let u = Math.max(u0, rect.uMin) + paso / 2; u < Math.min(u1, rect.uMax); u += paso)
    for (let v = Math.max(v0, rect.vMin) + paso / 2; v < Math.min(v1, rect.vMax); v += paso)
      if (contiene(g, u, v)) {
        n++
        su += u
        sv += v
      }
  if (!n) return null
  // si la media cae fuera (región cóncava), la celda más cercana a la media que sí esté dentro
  let p = [su / n, sv / n]
  if (!contiene(g, p[0], p[1])) {
    let mejor = null
    let dm = Infinity
    for (let u = Math.max(u0, rect.uMin) + paso / 2; u < Math.min(u1, rect.uMax); u += paso)
      for (let v = Math.max(v0, rect.vMin) + paso / 2; v < Math.min(v1, rect.vMax); v += paso) {
        const d = (u - p[0]) ** 2 + (v - p[1]) ** 2
        if (d < dm && contiene(g, u, v)) {
          dm = d
          mejor = [u, v]
        }
      }
    p = mejor
  }
  return { p, km2: (n * paso * paso) / 1e6 }
}

const CALLES = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'pedestrian'])
/** Calles que un visitante busca: salen antes que otras más largas. */
const FAMOSAS = /^(Passeig de Gràcia|La Rambla|Rambla de Catalunya|Avinguda Diagonal|Gran Via de les Corts Catalanes|Via Laietana|Avinguda del Paral·lel|Passeig de Colom|Avinguda del Portal de l'Àngel|Passeig de Joan de Borbó|Rambla del Poblenou|Passeig Marítim de la Barceloneta|Carrer de Sants)$/
const r2 = (x) => Math.round(x * 100) / 100
const enRect = (r, [u, v], m = 0) => u > r.uMin + m && u < r.uMax - m && v > r.vMin + m && v < r.vMax - m

/**
 * Nombres para la maqueta, en unidades de escena (1 u = 100 m):
 *   { n, x, z, l: 0 distrito o municipio | 1 barrio | 2 calle, a?: ángulo de la calle, p: prioridad }
 */
export function nombres(L, mapa, proyectar, rect) {
  const out = []
  // 0: distritos de Barcelona (en su nodo de lugar) y los demás municipios con al menos 2 km² dentro
  for (const d of L.distritos) {
    const nodo = L.nodos.find((n) => n.place === 'suburb' && n.nombre === d.nombre)
    const c = centroEn(d, rect)
    if (!c) continue
    const p = nodo && enRect(rect, nodo.p, 300) ? nodo.p : c.p
    out.push({ n: d.nombre, x: r2(p[0] / 100), z: r2(p[1] / 100), l: 0, p: c.km2 })
  }
  for (const m of L.municipios) {
    if (m.nombre === 'Barcelona') continue
    const c = centroEn(m, rect)
    if (!c || c.km2 < 2 || !enRect(rect, c.p, 400)) continue
    out.push({ n: m.nombre, x: r2(c.p[0] / 100), z: r2(c.p[1] / 100), l: 0, p: c.km2 })
  }
  // 1: barrios (en Barcelona, en su nodo de lugar si lo hay)
  for (const b of L.barrios) {
    const c = centroEn(b, rect)
    if (!c || c.km2 < 0.15) continue
    const nodo = L.nodos.find((n) => (n.place === 'quarter' || n.place === 'neighbourhood') && n.nombre === b.nombre)
    const p = nodo && contiene(b, ...nodo.p) ? nodo.p : c.p
    if (!enRect(rect, p, 200)) continue
    // si el barrio se llama como su distrito o municipio («les Corts», «Sants»…), sobra
    if (out.some((o) => o.l === 0 && o.n === b.nombre)) continue
    out.push({ n: b.nombre, x: r2(p[0] / 100), z: r2(p[1] / 100), l: 1, p: c.km2 })
  }
  // 2: calles principales, unidas por nombre; una etiqueta cada ~600 m, en tramos rectos
  const porNombre = new Map()
  for (const e of mapa) {
    const t = e.tags ?? {}
    if (e.type !== 'way' || !e.geometry || !t.name || !CALLES.has(t.highway) || t.tunnel === 'yes') continue
    if (!porNombre.has(t.name)) porNombre.set(t.name, [])
    porNombre.get(t.name).push(e.geometry.map(({ lat, lon }) => proyectar(lat, lon)))
  }
  for (const [n, vias] of porNombre) {
    const tramos = juntarTramos(vias)
    const total = tramos.reduce((s, t) => s + largo(t), 0)
    const famosa = FAMOSAS.test(n)
    if (total < (famosa ? 300 : 1000)) continue
    const principal = tramos.sort((a, b) => largo(b) - largo(a))[0]
    const L0 = largo(principal)
    const k = Math.max(1, Math.min(10, Math.round(L0 / 600)))
    for (let i = 0; i < k; i++) {
      const anc = puntoRecto(principal, ((i + 0.5) / k) * L0, Math.min(90, L0 / 4))
      if (!anc || !enRect(rect, anc.p, 100)) continue
      out.push({ n, x: r2(anc.p[0] / 100), z: r2(anc.p[1] / 100), l: 2, a: Math.round(anc.a * 1000) / 1000, p: r2(total / 1000 + (famosa ? 100 : 0)) })
    }
  }
  return out.sort((a, b) => a.l - b.l || b.p - a.p)
}

const largo = (t) => {
  let s = 0
  for (let i = 1; i < t.length; i++) s += Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1])
  return s
}

/** Une las vías de una calle por sus extremos (calzadas de ida y vuelta quedan como tramos aparte). */
function juntarTramos(vias) {
  return anillosAbiertos(vias)
}

function anillosAbiertos(vias) {
  const pend = vias.slice()
  const out = []
  const cerca = (a, b) => Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1
  while (pend.length) {
    let a = pend.shift()
    let cambio = true
    while (cambio) {
      cambio = false
      for (let i = 0; i < pend.length; i++) {
        const w = pend[i]
        if (cerca(a[a.length - 1], w[0])) a = a.concat(w.slice(1))
        else if (cerca(a[a.length - 1], w[w.length - 1])) a = a.concat(w.slice(0, -1).reverse())
        else if (cerca(a[0], w[w.length - 1])) a = w.concat(a.slice(1))
        else if (cerca(a[0], w[0])) a = w.slice().reverse().concat(a.slice(1))
        else continue
        pend.splice(i, 1)
        cambio = true
        break
      }
    }
    out.push(a)
  }
  return out
}

/** Punto a `d` metros del inicio y ángulo de la calle entre `d − r` y `d + r`; null si ahí la calle se dobla mucho. */
function puntoRecto(t, d, r) {
  const en = (dist) => {
    let s = 0
    for (let i = 1; i < t.length; i++) {
      const l = Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1])
      if (s + l >= dist) {
        const f = l ? (dist - s) / l : 0
        return [t[i - 1][0] + (t[i][0] - t[i - 1][0]) * f, t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f]
      }
      s += l
    }
    return t[t.length - 1]
  }
  const p = en(d)
  const a = en(Math.max(0, d - r))
  const b = en(d + r)
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  // recta si el punto medio queda cerca de la cuerda
  const cuerda = Math.hypot(b[0] - a[0], b[1] - a[1])
  const desvio = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / (cuerda || 1)
  if (cuerda < r || desvio > r * 0.25) return null
  return { p, a: ang }
}
