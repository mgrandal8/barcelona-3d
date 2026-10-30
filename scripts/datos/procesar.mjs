// Convierte los datos crudos en los ficheros que carga la web:
//   public/datos/terreno.bin   alturas en decímetros (Int16) en una rejilla regular
//   public/datos/edificios.bin.gz plantas y alturas de los edificios (gzip)
//   public/datos/mapa.json.gz  usos del suelo y líneas (calles, tren, muelles)
//   public/datos/meta.json     dimensiones
// Uso: node scripts/datos/procesar.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { PNG } from 'pngjs'
import { CRUDOS, RECT, SALIDA, desproyectar, proyectar, simplificar } from './comun.mjs'
import { escribirEdificios, escribirGz } from './formato.mjs'

mkdirSync(SALIDA, { recursive: true })

// ------------------------------------------------------------ utilidades

function areaFirmada(p) {
  let a = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1])
  return a / 2
}

/** Anillo cerrado de OSM → lista de puntos sin repetir el último. */
function anillo(geom) {
  const p = geom.map(({ lat, lon }) => proyectar(lat, lon))
  const f = p[0]
  const l = p[p.length - 1]
  if (p.length > 1 && f[0] === l[0] && f[1] === l[1]) p.pop()
  return p
}

function dentro(px, py, poly) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

const enRect = ([u, v]) => u >= RECT.uMin && u <= RECT.uMax && v >= RECT.vMin && v <= RECT.vMax

// ------------------------------------------------------------ terreno

const PASO = 40
const NU = Math.round((RECT.uMax - RECT.uMin) / PASO) + 1
const NV = Math.round((RECT.vMax - RECT.vMin) / PASO) + 1

const teselas = new Map()
for (const f of readdirSync(`${CRUDOS}terrarium`)) {
  const [z, x, y] = f.replace('.png', '').split('_').map(Number)
  teselas.set(`${x}_${y}`, { z, png: PNG.sync.read(readFileSync(`${CRUDOS}terrarium/${f}`)) })
}
const Z = 13

function elevPixel(gx, gy) {
  const x = Math.floor(gx / 256)
  const y = Math.floor(gy / 256)
  const t = teselas.get(`${x}_${y}`)
  if (!t) return 0
  const i = ((gy - y * 256) * 256 + (gx - x * 256)) * 4
  const d = t.png.data
  return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768
}

function elevacion(lat, lon) {
  const n = 2 ** Z * 256
  const fx = ((lon + 180) / 360) * n
  const r = (lat * Math.PI) / 180
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
  const x0 = Math.floor(fx - 0.5)
  const y0 = Math.floor(fy - 0.5)
  const tx = fx - 0.5 - x0
  const ty = fy - 0.5 - y0
  const a = elevPixel(x0, y0)
  const b = elevPixel(x0 + 1, y0)
  const c = elevPixel(x0, y0 + 1)
  const d = elevPixel(x0 + 1, y0 + 1)
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
}

const alturas = new Int16Array(NU * NV)
for (let j = 0; j < NV; j++) {
  for (let i = 0; i < NU; i++) {
    const [lat, lon] = desproyectar(RECT.uMin + i * PASO, RECT.vMin + j * PASO)
    alturas[j * NU + i] = Math.round(elevacion(lat, lon) * 10)
  }
}
writeFileSync(`${SALIDA}terreno.bin`, Buffer.from(alturas.buffer))
console.log('terreno', NU, 'x', NV)

// ------------------------------------------------------------ edificios

const vistos = new Set()
const edificios = []
const partes = []
for (const f of readdirSync(CRUDOS).filter((f) => f.startsWith('edificios_'))) {
  for (const e of JSON.parse(readFileSync(CRUDOS + f, 'utf8')).elements) {
    if (e.type !== 'way' || !e.geometry || vistos.has(e.id)) continue
    vistos.add(e.id)
    const t = e.tags ?? {}
    if (t.location === 'underground' || Number(t.layer) < 0 || t['building:part'] === 'no') continue
    let p = anillo(e.geometry)
    if (p.length < 3 || !p.some(enRect)) continue
    p = simplificar([...p, p[0]], 0.6).slice(0, -1)
    if (p.length < 3) continue
    const a = areaFirmada(p)
    if (Math.abs(a) < 10) continue
    if (a < 0) p.reverse()
    ;(t['building:part'] ? partes : edificios).push({ p, t })
  }
}

// Si un edificio tiene partes, se dibujan solo las partes
const CELDA = 50
const rejilla = new Map()
const clave = (u, v) => `${Math.floor(u / CELDA)},${Math.floor(v / CELDA)}`
for (const parte of partes) {
  let cu = 0
  let cv = 0
  for (const [u, v] of parte.p) {
    cu += u
    cv += v
  }
  parte.c = [cu / parte.p.length, cv / parte.p.length]
  const k = clave(...parte.c)
  if (!rejilla.has(k)) rejilla.set(k, [])
  rejilla.get(k).push(parte)
}
function tienePartes(b) {
  const us = b.p.map((q) => q[0])
  const vs = b.p.map((q) => q[1])
  for (let gu = Math.floor(Math.min(...us) / CELDA); gu <= Math.floor(Math.max(...us) / CELDA); gu++) {
    for (let gv = Math.floor(Math.min(...vs) / CELDA); gv <= Math.floor(Math.max(...vs) / CELDA); gv++) {
      for (const parte of rejilla.get(`${gu},${gv}`) ?? []) if (dentro(parte.c[0], parte.c[1], b.p)) return true
    }
  }
  return false
}

const num = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const PLANTA = 3.2

function tipo(t) {
  const b = t.building ?? t['building:part']
  if (['church', 'cathedral', 'chapel', 'basilica', 'monastery', 'temple'].includes(b) || t.amenity === 'place_of_worship') return 1
  if (['industrial', 'warehouse', 'hangar', 'service', 'storage_tank', 'transportation', 'train_station'].includes(b)) return 2
  if (['roof', 'canopy', 'carport'].includes(b)) return 3
  if (['school', 'university', 'hospital', 'public', 'civic', 'government', 'stadium', 'sports_hall', 'museum'].includes(b)) return 4
  if (['house', 'detached', 'semidetached_house', 'terrace', 'villa', 'bungalow'].includes(b)) return 5
  return 0
}

function altura(t, esParte) {
  const tp = tipo(t)
  let h = num(t.height)
  const niveles = num(t['building:levels'])
  if (h === null && niveles !== null) h = niveles * PLANTA + (num(t['roof:levels']) ?? 0) * 1.6 + (niveles > 0 ? 0.8 : 0)
  if (h === null) h = tp === 1 ? 16 : tp === 3 ? 4 : tp === 2 ? 9 : esParte ? 3.5 : 7
  let min = num(t.min_height)
  if (min === null && num(t['building:min_level']) !== null) min = num(t['building:min_level']) * PLANTA
  if (tp === 3 && min === null) min = Math.max(0, h - 1)
  min = Math.min(min ?? 0, h - 0.5)
  return [Math.max(1, h), Math.max(0, min)]
}

const salida = []
let omitidos = 0
for (const b of edificios) {
  if (tienePartes(b)) {
    omitidos++
    continue
  }
  salida.push({ ...b, alt: altura(b.t, false) })
}
for (const parte of partes) {
  const [h] = altura(parte.t, true)
  // las partes "de nivel 0" sin altura suelen ser patios o porches
  if (num(parte.t['building:levels']) === 0 && num(parte.t.height) === null) continue
  salida.push({ ...parte, alt: [h, altura(parte.t, true)[1]] })
}

// formato en scripts/datos/formato.mjs
const bytes = escribirEdificios(
  `${SALIDA}edificios.bin.gz`,
  salida.map((s) => ({
    p: s.p.map(([u, v]) => [Math.round(u * 2), Math.round(v * 2)]),
    alto: Math.round(s.alt[0] * 10),
    base: Math.round(s.alt[1] * 10),
    tipo: tipo(s.t),
  })),
)
console.log('edificios', salida.length, `(omitidos con partes: ${omitidos})`, (bytes / 1e6).toFixed(1), 'MB')

// ------------------------------------------------------------ mapa

function claseArea(t) {
  const { leisure: l, landuse: lu, natural: n } = t
  if (n === 'water' || lu === 'reservoir') return 'agua'
  if (n === 'beach' || n === 'sand') return 'playa'
  if (lu === 'forest' || n === 'wood' || l === 'nature_reserve') return 'bosque'
  if (l === 'park' || l === 'garden') return 'parque'
  if (l === 'pitch') return 'deporte'
  if (lu === 'cemetery') return 'cementerio'
  if (lu === 'railway') return 'ferrocarril'
  if (lu === 'port' || lu === 'industrial') return 'industrial'
  if (['vineyard', 'orchard', 'farmland'].includes(lu)) return 'campo'
  if (['scrub', 'heath', 'grassland'].includes(n) || ['grass', 'meadow', 'recreation_ground'].includes(lu) || l === 'golf_course') return 'hierba'
  if (t.man_made) return 'muelle'
  return null
}

const ANCHOS = {
  motorway: ['autopista', 24], trunk: ['autopista', 22], motorway_link: ['autopista', 10], trunk_link: ['autopista', 10],
  primary: ['principal', 18], primary_link: ['principal', 9], secondary: ['secundaria', 13], tertiary: ['secundaria', 9],
  pedestrian: ['peatonal', 7],
}

/** Une vías sueltas de una relación en anillos cerrados. */
function unirAnillos(vias) {
  const pendientes = vias.map((v) => v.map(({ lat, lon }) => proyectar(lat, lon)))
  const anillos = []
  const igual = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01
  while (pendientes.length) {
    let actual = pendientes.shift()
    let cambio = true
    while (!igual(actual[0], actual[actual.length - 1]) && cambio) {
      cambio = false
      for (let i = 0; i < pendientes.length; i++) {
        const w = pendientes[i]
        const fin = actual[actual.length - 1]
        if (igual(fin, w[0])) actual = actual.concat(w.slice(1))
        else if (igual(fin, w[w.length - 1])) actual = actual.concat(w.slice(0, -1).reverse())
        else continue
        pendientes.splice(i, 1)
        cambio = true
        break
      }
    }
    if (actual.length > 3) anillos.push(actual)
  }
  return anillos
}

const plano = (pts) => pts.flatMap(([u, v]) => [Math.round(u), Math.round(v)])
const areas = []
const lineas = []
for (const e of JSON.parse(readFileSync(`${CRUDOS}mapa.json`, 'utf8')).elements) {
  const t = e.tags ?? {}
  if (e.type === 'way' && e.geometry) {
    const pts = e.geometry.map(({ lat, lon }) => proyectar(lat, lon))
    const g0 = e.geometry[0]
    const g1 = e.geometry[e.geometry.length - 1]
    const cerrada = e.geometry.length > 3 && g0.lat === g1.lat && g0.lon === g1.lon
    const c = claseArea(t)
    if (t.highway && ANCHOS[t.highway] && !(t.area === 'yes')) {
      if (t.tunnel === 'yes') continue
      const [clase, ancho] = ANCHOS[t.highway]
      lineas.push({ t: clase, a: ancho, p: plano(simplificar(pts, 2)) })
    } else if (t.railway === 'rail') {
      lineas.push({ t: 'tren', a: 7, p: plano(simplificar(pts, 2)) })
    } else if (t.waterway === 'river') {
      lineas.push({ t: 'rio', a: 30, p: plano(simplificar(pts, 2)) })
    } else if (c && cerrada) {
      areas.push({ t: c, r: [plano(simplificar(pts, 1.5))] })
    } else if (t.man_made) {
      lineas.push({ t: 'muelle', a: 10, p: plano(simplificar(pts, 1.5)) })
    } else if (t.highway === 'pedestrian') {
      areas.push({ t: 'peatonal', r: [plano(simplificar(pts, 1.5))] })
    }
  } else if (e.type === 'relation' && e.members) {
    const c = claseArea(t)
    if (!c) continue
    const ext = unirAnillos(e.members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry))
    const int = unirAnillos(e.members.filter((m) => m.type === 'way' && m.role === 'inner' && m.geometry).map((m) => m.geometry))
    if (ext.length) areas.push({ t: c, r: [...ext, ...int].map((r) => plano(simplificar(r, 2))) })
  }
}
escribirGz(`${SALIDA}mapa.json.gz`, JSON.stringify({ areas, lineas }))
console.log('mapa', areas.length, 'áreas', lineas.length, 'líneas')

writeFileSync(`${SALIDA}meta.json`, JSON.stringify({ rect: RECT, paso: PASO, nu: NU, nv: NV }))
console.log('listo')
