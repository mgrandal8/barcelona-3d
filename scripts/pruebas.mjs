// Uso: node scripts/pruebas.mjs <url-base> [suites]
// Lanza las pruebas de Playwright contra un build servido (vite preview) y resume el resultado.
// suites: lista separada por comas; por defecto, todas las de SUITES. «rapidas» = las que no esperan a la maqueta 3D.
// Las que dependen de tiempos (vuelos, tour automático) se repiten una vez si fallan: por software y con la máquina
// cargada a veces no llegan; si pasan a la segunda, se marcan como «inestable» (no rompen la tirada).
// Fuera quedan prueba-pwa (hay que apagar el servidor a mitad) y prueba-analitica (necesita su propio build): van aparte.
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const url = process.argv[2]
if (!url) {
  console.log('Uso: node scripts/pruebas.mjs <url-base> [suites]')
  process.exit(2)
}
/** nombre → [script, bloques, ¿se repite?, ¿rápida?] */
const SUITES = {
  contenido: ['prueba-contenido.mjs', '', false, true],
  embebido: ['prueba-embebido.mjs', '', false, false],
  ui: ['prueba-ui.mjs', '', false, false],
  robustez: ['prueba-robustez.mjs', '', false, false],
  a11y: ['prueba-a11y.mjs', '', true, false],
  utilidad: ['prueba-utilidad.mjs', '', false, false],
  camara: ['prueba-camara.mjs', '', true, false],
}
const pedidas = process.argv[3]?.split(',') ?? Object.keys(SUITES)
const lista = pedidas.flatMap((p) => (p === 'rapidas' ? Object.keys(SUITES).filter((k) => SUITES[k][3]) : [p]))
const embebidoRapido = pedidas.includes('rapidas') && !pedidas.includes('embebido')
if (embebidoRapido) lista.push('embebido')

function correr(nombre) {
  const [script, bloquesDef] = SUITES[nombre]
  // en «rapidas», el embebido solo con sus bloques de la versión ligera
  const bloques = nombre === 'embebido' && embebidoRapido ? 'datos,mensajes,seguridad' : bloquesDef
  return new Promise((res) => {
    const t0 = Date.now()
    const args = [`scripts/${script}`, url, ...(bloques ? [bloques] : [])]
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let salida = ''
    const linea = (d) => {
      salida += d
      process.stdout.write(d.toString().replace(/^(?=.)/gm, `[${nombre}] `))
    }
    p.stdout.on('data', linea)
    p.stderr.on('data', linea)
    // ninguna suite debería pasar de 20 min ni con la máquina cargada
    const reloj = setTimeout(() => p.kill('SIGKILL'), 20 * 60 * 1000)
    p.on('close', (codigo) => {
      clearTimeout(reloj)
      const fallos = salida.split('\n').filter((l) => l.startsWith('FALLO'))
      res({ codigo, s: Math.round((Date.now() - t0) / 1000), fallos })
    })
  })
}

const resultados = []
for (const nombre of lista) {
  if (!SUITES[nombre]) {
    console.log(`suite desconocida: ${nombre}`)
    resultados.push({ nombre, estado: 'falla', s: 0, fallos: ['no existe'] })
    continue
  }
  let r = await correr(nombre)
  let estado = r.codigo === 0 ? 'bien' : 'falla'
  if (estado === 'falla' && SUITES[nombre][2]) {
    console.log(`[${nombre}] falla; se repite una vez`)
    const r2 = await correr(nombre)
    if (r2.codigo === 0) estado = 'inestable'
    r = { ...r2, s: r.s + r2.s, fallos: r2.codigo === 0 ? r.fallos : r2.fallos }
  }
  resultados.push({ nombre, estado, s: r.s, fallos: r.fallos })
}

const icono = { bien: '✅', inestable: '⚠️', falla: '❌' }
console.log('\nResumen:')
for (const r of resultados) console.log(`  ${r.estado.padEnd(9)} ${r.nombre.padEnd(10)} ${r.s} s${r.fallos.length ? '  · ' + r.fallos.join(' · ') : ''}`)
// en Actions, cada fallo como anotación: sale en la página del run sin abrir el log
if (process.env.GITHUB_ACTIONS)
  for (const r of resultados) for (const f of r.fallos.slice(0, 10)) console.log(`::${r.estado === 'falla' ? 'error' : 'warning'} title=Pruebas · ${r.nombre}::${f.replace(/\r?\n/g, ' ')}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ['### Pruebas', '', '| | Suite | Tiempo | Fallos |', '|---|---|---:|---|', ...resultados.map((r) => `| ${icono[r.estado]} | ${r.nombre} | ${r.s} s | ${r.fallos.join('<br>').replace(/\|/g, '\\|')} |`), '']
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n'))
}
process.exit(resultados.some((r) => r.estado === 'falla') ? 1 : 0)
