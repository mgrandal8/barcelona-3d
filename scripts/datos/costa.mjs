// Polígono del mar a partir de la línea de costa de OSM (natural=coastline: la tierra a la izquierda).
// Las cadenas se recortan con el rectángulo de la maqueta y se cierran recorriendo su borde.

const igual = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01

/** Une vías (listas de [u, v]) que se tocan por los extremos, respetando el sentido. */
export function unirCadenas(vias) {
  const pendientes = vias.map((v) => v.slice())
  const cadenas = []
  while (pendientes.length) {
    let c = pendientes.shift()
    let cambio = true
    while (cambio && !igual(c[0], c[c.length - 1])) {
      cambio = false
      for (let i = 0; i < pendientes.length; i++) {
        const w = pendientes[i]
        if (igual(c[c.length - 1], w[0])) c = c.concat(w.slice(1))
        else if (igual(w[w.length - 1], c[0])) c = w.concat(c.slice(1))
        else continue
        pendientes.splice(i, 1)
        cambio = true
        break
      }
    }
    cadenas.push(c)
  }
  return cadenas
}

/** Recorta un segmento con el rectángulo (Liang-Barsky). Devuelve [t0, t1] o null. */
function recorteSegmento(a, b, r) {
  let t0 = 0
  let t1 = 1
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  for (const [p, q] of [
    [-dx, a[0] - r.uMin],
    [dx, r.uMax - a[0]],
    [-dy, a[1] - r.vMin],
    [dy, r.vMax - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return null
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
    }
    if (t0 > t1) return null
  }
  return [t0, t1]
}

const en = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Trozos de una cadena dentro del rectángulo, cada uno de borde a borde (o la cadena entera si está dentro). */
function recortarCadena(c, r) {
  const trozos = []
  let actual = null
  for (let i = 0; i < c.length - 1; i++) {
    const s = recorteSegmento(c[i], c[i + 1], r)
    if (!s) {
      if (actual) trozos.push(actual)
      actual = null
      continue
    }
    const [t0, t1] = s
    if (!actual) actual = [en(c[i], c[i + 1], t0)]
    actual.push(en(c[i], c[i + 1], t1))
    if (t1 < 1) {
      trozos.push(actual)
      actual = null
    }
  }
  if (actual) trozos.push(actual)
  return trozos.filter((t) => t.length > 1)
}

/** Posición a lo largo del perímetro (sentido uMin,vMin → uMax,vMin → uMax,vMax → uMin,vMax). */
function perimetro(p, r) {
  const W = r.uMax - r.uMin
  const H = r.vMax - r.vMin
  const e = 0.5
  if (Math.abs(p[1] - r.vMin) < e) return p[0] - r.uMin
  if (Math.abs(p[0] - r.uMax) < e) return W + (p[1] - r.vMin)
  if (Math.abs(p[1] - r.vMax) < e) return W + H + (r.uMax - p[0])
  if (Math.abs(p[0] - r.uMin) < e) return 2 * W + H + (r.vMax - p[1])
  return null
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

/**
 * Anillos del mar dentro del rectángulo y las líneas de costa recortadas.
 * `puntoMar` es un punto que seguro es mar: con él se elige hacia qué lado se cierra por el borde.
 */
export function poligonoMar(vias, r, puntoMar) {
  const cadenas = unirCadenas(vias)
  const abiertas = []
  const islas = []
  for (const c of cadenas) {
    const cerrada = igual(c[0], c[c.length - 1])
    for (const t of recortarCadena(c, r)) {
      const a = perimetro(t[0], r)
      const b = perimetro(t[t.length - 1], r)
      if (a !== null && b !== null) abiertas.push({ t, a, b })
      else if (cerrada && t.length === c.length) islas.push(t)
      else console.log('  costa: trozo suelto de', t.length, 'puntos (se ignora)')
    }
  }
  const L = 2 * (r.uMax - r.uMin + r.vMax - r.vMin)
  const esquinas = [
    [0, [r.uMin, r.vMin]],
    [r.uMax - r.uMin, [r.uMax, r.vMin]],
    [r.uMax - r.uMin + r.vMax - r.vMin, [r.uMax, r.vMax]],
    [2 * (r.uMax - r.uMin) + r.vMax - r.vMin, [r.uMin, r.vMax]],
  ]
  /** Cierra los trozos recorriendo el borde en sentido `s` (+1 o −1). */
  function cerrar(s) {
    const usados = new Set()
    const anillos = []
    for (let k = 0; k < abiertas.length; k++) {
      if (usados.has(k)) continue
      const anillo = []
      let i = k
      while (!usados.has(i)) {
        usados.add(i)
        anillo.push(...abiertas[i].t)
        const desde = abiertas[i].b
        // siguiente entrada en el sentido del recorrido
        let mejor = -1
        let dMejor = Infinity
        abiertas.forEach((o, j) => {
          const d = (((o.a - desde) * s) % L + L) % L
          if (d < dMejor) {
            dMejor = d
            mejor = j
          }
        })
        for (const [pe, q] of esquinas
          .map(([pe, q]) => [(((pe - desde) * s) % L + L) % L, q])
          .sort((x, y) => x[0] - y[0]))
          if (pe > 0 && pe < dMejor) anillo.push(q)
        i = mejor
      }
      anillos.push(anillo)
    }
    return anillos
  }
  let anillos = cerrar(1)
  const contiene = (as) => as.filter((a) => dentro(puntoMar[0], puntoMar[1], a)).length % 2 === 1
  if (!contiene(anillos)) anillos = cerrar(-1)
  if (!contiene(anillos)) console.log('  costa: ¡el punto de mar no queda dentro!')
  return { anillos: [...anillos, ...islas], costa: [...abiertas.map((o) => o.t), ...islas] }
}
