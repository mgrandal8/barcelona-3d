import { MONUMENTOS } from '../data/monumentos'

// Colores de los pines: los usan el pin (maqueta y versión ligera), las flechas del borde y la imagen de compartir.

/** Color de cada categoría (la `etiqueta` de data/monumentos.ts), con contraste ≥ 4,5:1 frente al blanco. */
const COLOR_CATEGORIA: Record<string, string> = {
  Gaudí: '#b4472d',
  Modernismo: '#a2366a',
  'Arquitectura contemporánea': '#2f6596',
  Deporte: '#3b4f96',
  Gótico: '#6d4c35',
  'Museos y vistas': '#85570c',
  Mar: '#1c6a86',
}
export const colorDe = (id: string) => COLOR_CATEGORIA[MONUMENTOS.find((m) => m.id === id)?.etiqueta ?? ''] ?? '#b4472d'
