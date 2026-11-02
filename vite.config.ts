import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { paginas, robots, sitemap } from './src/seo'

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
      // og/ son las imágenes para redes: solo las piden los buscadores y las redes, no hacen falta sin conexión
      const archivos = [...Object.keys(bundle), ...publicos()].filter((f) => !f.endsWith('.map') && !f.startsWith('og/')).sort()
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

/**
 * SEO: una página por ruta (vista general y cada ficha, en español, catalán e inglés) con sus metas y el texto de la
 * ficha, más sitemap.xml y robots.txt. Las URL absolutas usan SITIO (por defecto, la web publicada en GitHub Pages).
 * Va después de pwa(): las páginas de las fichas no entran en la copia sin conexión (sin red, cualquier ruta da index.html).
 */
function seo(): Plugin {
  const sitio = process.env.SITIO ?? 'https://mgrandal8.github.io/barcelona-3d/'
  return {
    name: 'bcn3d-seo',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const indice = bundle['index.html']
      if (!indice || indice.type !== 'asset') return this.error('seo: no está index.html en el bundle')
      for (const p of paginas({ plantilla: String(indice.source), sitio, base: process.env.BASE ?? '/', publicos: publicos() })) {
        if (p.ruta === '') indice.source = p.html
        else this.emitFile({ type: 'asset', fileName: p.ruta + 'index.html', source: p.html })
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(sitio) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(sitio) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // en GitHub Pages la web cuelga de /barcelona-3d/ (lo pone el workflow); en local, en la raíz, como esperan los scripts
  base: process.env.BASE ?? '/',
  plugins: [react(), pwa(), seo()],
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
