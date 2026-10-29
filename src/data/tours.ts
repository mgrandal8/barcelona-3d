import type { Momento } from '../scene/momento'

// Tours de ejemplo para la demo: ni el guía ni los precios son reales.

export type Tour = {
  id: string
  nombre: string
  icono: string
  /** Color de la ruta en el mapa y de la tarjeta. */
  color: string
  resumen: string
  duracion: string
  precio: string
  /** Hora a la que se pone la maqueta al empezar. */
  momento: Momento
  paradas: { id: string; nota: string }[]
}

export const TOURS: Tour[] = [
  {
    id: 'gaudi',
    nombre: 'Gaudí esencial',
    icono: '🦎',
    color: '#d8603f',
    resumen: 'Las tres obras imprescindibles del genio modernista, de la basílica al parque, pasando por el Passeig de Gràcia.',
    duracion: '5 h',
    precio: '65 € por persona',
    momento: 'dia',
    paradas: [
      { id: 'sagrada-familia', nota: 'Empezamos a las 9:00 frente a la fachada del Nacimiento, la única que Gaudí vio terminada.' },
      { id: 'casa-batllo', nota: 'Bajamos andando por el Eixample hasta la manzana de la discordia. Parada para el café.' },
      { id: 'park-guell', nota: 'Subimos en metro hasta Lesseps y terminamos en la plaza, con toda la ciudad a los pies.' },
    ],
  },
  {
    id: 'ciutat-vella',
    nombre: 'Del Gótico al mar',
    icono: '⛵',
    color: '#2f7fa8',
    resumen: 'Dos mil años de historia en un paseo tranquilo: calles medievales, el puerto y la puesta de sol en Montjuïc.',
    duracion: '4 h',
    precio: '45 € por persona',
    momento: 'atardecer',
    paradas: [
      { id: 'catedral', nota: 'Quedamos en la plaza Nova, junto a las torres romanas de Barcino.' },
      { id: 'barceloneta', nota: 'Cruzamos el Born hasta el barrio de pescadores. Tapa de bomba en una bodega de siempre.' },
      { id: 'montjuic', nota: 'Teleférico hasta la montaña y atardecer en las escalinatas del Palau Nacional.' },
    ],
  },
  {
    id: 'noche',
    nombre: 'Barcelona de noche',
    icono: '🌙',
    color: '#7a5bd6',
    resumen: 'La ciudad cuando se encienden las luces: la piel LED de la Glòries, la Font Màgica y la brisa del puerto.',
    duracion: '3 h',
    precio: '40 € por persona',
    momento: 'noche',
    paradas: [
      { id: 'torre-glories', nota: 'A las 21:00 la torre se ilumina; la vemos desde la plaza de las Glòries.' },
      { id: 'montjuic', nota: 'Espectáculo de agua, luz y música en la Font Màgica (de jueves a domingo).' },
      { id: 'barceloneta', nota: 'Cerramos con un paseo junto al mar hasta el Hotel W.' },
    ],
  },
]

export const tourPorId = (id: string | null) => TOURS.find((t) => t.id === id) ?? null
