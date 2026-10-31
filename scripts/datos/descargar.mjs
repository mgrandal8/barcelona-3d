// Descarga los datos crudos (una sola vez): edificios y mapa de OpenStreetMap
// vía Overpass, y teselas de elevación Terrarium (AWS Open Data).
// Uso: node scripts/datos/descargar.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { CRUDOS, RECT, desproyectar, polyOverpass } from './comun.mjs'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const UA = 'bcn3d-demo/0.1'
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(CRUDOS, { recursive: true })

async function overpass(query, archivo) {
  if (existsSync(archivo)) return console.log('ya existe', archivo)
  for (let intento = 1; intento <= 6; intento++) {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    })
    if (res.ok) {
      const texto = await res.text()
      if (texto.startsWith('{')) {
        writeFileSync(archivo, texto)
        console.log('ok', archivo, (texto.length / 1e6).toFixed(1), 'MB')
        return
      }
    }
    console.log(`  intento ${intento} falló (${res.status}), reintento…`)
    await esperar(15000 * intento)
  }
  throw new Error('Overpass no responde: ' + archivo)
}

// Edificios, en teselas para no saturar Overpass
const NU = 4
const NV = 3
for (let i = 0; i < NU; i++) {
  for (let j = 0; j < NV; j++) {
    const r = {
      uMin: RECT.uMin + ((RECT.uMax - RECT.uMin) * i) / NU,
      uMax: RECT.uMin + ((RECT.uMax - RECT.uMin) * (i + 1)) / NU,
      vMin: RECT.vMin + ((RECT.vMax - RECT.vMin) * j) / NV,
      vMax: RECT.vMin + ((RECT.vMax - RECT.vMin) * (j + 1)) / NV,
    }
    const poly = polyOverpass(r)
    await overpass(
      `[out:json][timeout:300];(way["building"](poly:"${poly}");way["building:part"](poly:"${poly}"););out tags geom qt;`,
      `${CRUDOS}edificios_${i}_${j}.json`,
    )
    await esperar(3000)
  }
}

// Usos del suelo, agua, calles principales
const poly = polyOverpass(RECT)
await overpass(
  `[out:json][timeout:400];(
    nwr["leisure"~"^(park|garden|pitch|golf_course|nature_reserve)$"](poly:"${poly}");
    nwr["landuse"~"^(forest|grass|meadow|cemetery|recreation_ground|railway|port|industrial|vineyard|orchard|farmland)$"](poly:"${poly}");
    nwr["natural"~"^(wood|scrub|beach|water|sand|heath|grassland)$"](poly:"${poly}");
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary|pedestrian|motorway_link|trunk_link|primary_link)$"](poly:"${poly}");
    way["waterway"="river"](poly:"${poly}");
    way["man_made"~"^(pier|breakwater|groyne)$"](poly:"${poly}");
    way["railway"="rail"]["tunnel"!="yes"](poly:"${poly}");
  );out geom qt;`,
  `${CRUDOS}mapa.json`,
)

// Metro (TMB) y FGC urbano: líneas con su trazado y estaciones
await overpass(
  `[out:json][timeout:300];
  relation["route"~"^(subway|light_rail)$"](poly:"${poly}");
  out geom qt;
  node["railway"="station"]["station"~"^(subway|light_rail)$"](poly:"${poly}");
  out qt;`,
  `${CRUDOS}transporte.json`,
)

// Línea de costa real (la tierra queda a la izquierda de cada vía), en un marco algo mayor
// para que las cadenas salgan del rectángulo de la maqueta
const margen = 1500
const polyAmplio = polyOverpass({ uMin: RECT.uMin - margen, uMax: RECT.uMax + margen, vMin: RECT.vMin - margen, vMax: RECT.vMax + margen })
await overpass(`[out:json][timeout:300];way["natural"="coastline"](poly:"${polyAmplio}");out geom qt;`, `${CRUDOS}costa.json`)

// Municipios, distritos y barris (con su geometría) y, por si faltan, los nodos de lugar
await overpass(
  `[out:json][timeout:400];(
    relation["boundary"="administrative"]["admin_level"~"^(8|9|10)$"](poly:"${poly}");
    node["place"~"^(suburb|quarter|neighbourhood)$"](poly:"${poly}");
  );out geom qt;`,
  `${CRUDOS}limites.json`,
)

// Teselas de elevación (zoom 13 ≈ 14 m/px a esta latitud)
const Z = 13
const tx = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z)
const ty = (lat) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z)
}
const esquinas = [
  desproyectar(RECT.uMin, RECT.vMin),
  desproyectar(RECT.uMax, RECT.vMin),
  desproyectar(RECT.uMax, RECT.vMax),
  desproyectar(RECT.uMin, RECT.vMax),
]
const xs = esquinas.map(([, lon]) => tx(lon))
const ys = esquinas.map(([lat]) => ty(lat))
mkdirSync(`${CRUDOS}terrarium`, { recursive: true })
for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
    const archivo = `${CRUDOS}terrarium/${Z}_${x}_${y}.png`
    if (existsSync(archivo)) continue
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)
    if (!res.ok) throw new Error(`tesela ${x},${y}: ${res.status}`)
    writeFileSync(archivo, Buffer.from(await res.arrayBuffer()))
    console.log('tesela', x, y)
  }
}
console.log('Descarga completa')
