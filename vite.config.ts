import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
