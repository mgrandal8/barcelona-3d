import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Ficheros de public/ (rutas relativas, con / aunque se construya en Windows). */
const publicos = (dir = 'public'): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? publicos(`${dir}/${e.name}`) : [`${dir}/${e.name}`.slice('public/'.length)],
  )

/**
 * PWA: genera dist/sw.js a partir de scripts/sw.js con la lista de todo lo que hay que guardar para usar la guía
 * sin conexión (chunks, worker, CSS, index.html, datos e iconos) y una versión que cambia con su contenido.
 */
function pwa(): Plugin {
  return {
    name: 'bcn3d-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const archivos = [...Object.keys(bundle), ...publicos()].filter((f) => !f.endsWith('.map')).sort()
      const hash = createHash('sha256')
      for (const f of archivos) {
        const b = bundle[f]
        hash.update(f).update(b ? (b.type === 'chunk' ? b.code : b.source) : readFileSync(`public/${f}`))
      }
      const sw = readFileSync('scripts/sw.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__ARCHIVOS__', JSON.stringify(['./', ...archivos]))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // en GitHub Pages la web cuelga de /barcelona-3d/ (lo pone el workflow); en local, en la raíz, como esperan los scripts
  base: process.env.BASE ?? '/',
  plugins: [react(), pwa()],
  build: {
    // three solo ya ocupa ~700 kB minificado
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // librerías en chunks propios: cambian poco y el navegador las guarda en caché entre versiones de la demo
        codeSplitting: {
          // sin esto, cada grupo arrastra también sus dependencias (React incluido) y la portada esperaría a three
          includeDependenciesRecursively: false,
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 3 },
            { name: 'postpro', test: /node_modules[\\/](postprocessing|n8ao|@react-three[\\/]postprocessing)[\\/]/, priority: 2 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|three-stdlib|camera-controls|troika-|its-fine|suspend-react|@monogrid|maath|stats|meshline)/, priority: 1 },
          ],
        },
      },
    },
  },
})
