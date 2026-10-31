import * as THREE from 'three'

import type { Momento } from './momento'

export { MOMENTOS, momentoDeUrl, type Momento } from './momento'

/** Todo lo que cambia con la hora: luces, cielo, mar, nubes y cuánto se encienden las luces nocturnas. */
export type Preset = {
  cielo: [string, string, string] // arriba, medio, horizonte
  niebla: string
  sol: { pos: [number, number, number]; color: string; intensidad: number }
  hemi: { cielo: string; suelo: string; intensidad: number }
  mar: string
  /** Rugosidad del agua: más alta al atardecer, con el sol bajo, para que el reflejo no se queme. */
  marRugosidad: number
  nubes: string
  exposicion: number
  /** 0 de día, 1 de noche: ventanas, farolas, LED de la Glòries, Font Màgica, estrellas. */
  noche: number
}

export const PRESETS: Record<Momento, Preset> = {
  dia: {
    cielo: ['#8fbfe6', '#cfe2ee', '#f3e8d4'],
    niebla: '#efe4d0',
    sol: { pos: [-40, 55, 40], color: '#ffe2b8', intensidad: 3.4 },
    hemi: { cielo: '#fff4e0', suelo: '#a8957c', intensidad: 1.5 },
    mar: '#3d9ac4',
    marRugosidad: 0.38,
    nubes: '#ffffff',
    exposicion: 0.95,
    noche: 0,
  },
  // el sol se pone por el oeste (−x, −z en el marco girado), detrás de Collserola
  atardecer: {
    cielo: ['#56679f', '#e0968a', '#ffd49a'],
    niebla: '#f3c39c',
    sol: { pos: [-60, 26, -45], color: '#ffa866', intensidad: 3.6 },
    hemi: { cielo: '#ffe0c4', suelo: '#7d6a84', intensidad: 1.55 },
    mar: '#5b8fbf',
    marRugosidad: 0.68,
    nubes: '#ffe2cf',
    exposicion: 1.05,
    noche: 0.3,
  },
  // luz de luna fría y baja intensidad; el resto lo ponen las luces de la ciudad
  noche: {
    cielo: ['#060b1f', '#121c3d', '#2c3866'],
    niebla: '#1e2850',
    sol: { pos: [35, 60, 15], color: '#a9bcff', intensidad: 0.7 },
    hemi: { cielo: '#5468a8', suelo: '#1c1a2a', intensidad: 0.5 },
    mar: '#1a3452',
    marRugosidad: 0.32,
    nubes: '#4b5578',
    exposicion: 1.15,
    noche: 1,
  },
}

/**
 * Valores del ambiente en este fotograma (mezcla entre presets). Los escribe <Ambiente /> y los leen
 * en useFrame el mar, las nubes, los barcos y las luces de los monumentos.
 */
export const vivo = {
  noche: 0,
  mar: new THREE.Color(),
  marRugosidad: 0.38,
  nubes: new THREE.Color(),
  /** uniform compartido por los shaders de luces nocturnas (ventanas). */
  uNoche: { value: 0 },
}
