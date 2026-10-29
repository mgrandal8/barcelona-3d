import { geoAEscena } from '../scene/geo'

// Contenido de ejemplo para la demo. Precios y horarios orientativos.

export type Monumento = {
  id: string
  nombre: string
  barrio: string
  etiqueta: string
  /** Latitud y longitud reales. */
  coord: [number, number]
  /** Posición en la escena (x, z), calculada a partir de coord. */
  pos: [number, number]
  /** Radio que se deja libre de edificios genéricos. */
  radio: number
  /** Zonas extra (lat, lon, radio en unidades) donde se quitan edificios de OSM. */
  huecos?: { coord: [number, number]; radio: number }[]
  /** Altura a la que se dibuja el marcador. */
  alturaMarcador: number
  /** Desplazamiento de la cámara respecto al monumento al seleccionarlo. */
  camara: [number, number, number]
  descripcion: string
  horario: string
  precio: string
  duracion: string
  consejo: string
}

const LUGARES: Omit<Monumento, 'pos'>[] = [
  {
    id: 'sagrada-familia',
    nombre: 'Sagrada Família',
    barrio: 'Eixample',
    etiqueta: 'Gaudí',
    coord: [41.40359, 2.17435],
    radio: 0.72,
    alturaMarcador: 3.2,
    camara: [3.2, 2.6, 4.2],
    descripcion:
      'La obra maestra inacabada de Antoni Gaudí, en construcción desde 1882. Sus fachadas del Nacimiento y de la Pasión cuentan la vida de Jesús en piedra, y el interior es un bosque de columnas bañado por la luz de las vidrieras.',
    horario: '9:00 – 18:00 (hasta 20:00 en verano)',
    precio: 'desde 26 €',
    duracion: '1,5 – 2 h',
    consejo: 'Reserva la entrada con antelación y ve a primera hora de la tarde: la luz de poniente atraviesa las vidrieras de tonos cálidos.',
  },
  {
    id: 'casa-batllo',
    nombre: 'Casa Batlló',
    barrio: 'Passeig de Gràcia',
    etiqueta: 'Modernismo',
    coord: [41.39159, 2.16482],
    radio: 0.1,
    alturaMarcador: 1,
    camara: [1.3, 0.9, 1.1],
    descripcion:
      'Gaudí reformó este edificio en 1904 y lo convirtió en un sueño marino: balcones como máscaras, columnas como huesos y un tejado que recuerda el lomo de un dragón.',
    horario: '9:00 – 20:00',
    precio: 'desde 35 €',
    duracion: '1 – 1,5 h',
    consejo: 'Justo al lado está la Casa Amatller, de Puig i Cadafalch. Desde la acera de enfrente se ven las dos fachadas juntas.',
  },
  {
    id: 'park-guell',
    nombre: 'Park Güell',
    barrio: 'Gràcia',
    etiqueta: 'Gaudí',
    coord: [41.41393, 2.15252],
    radio: 0.5,
    huecos: [{ coord: [41.4131, 2.153], radio: 0.3 }],
    alturaMarcador: 0.9,
    camara: [0.4, 1.4, 2.4],
    descripcion:
      'Un parque concebido como ciudad jardín, con el famoso banco ondulante de trencadís, el dragón de la escalinata y las casitas que parecen de cuento. Desde la plaza se ve toda la ciudad hasta el mar.',
    horario: '9:30 – 19:30',
    precio: '18 € (zona monumental)',
    duracion: '1,5 h',
    consejo: 'Sube por la calle Larrard con la L3 (parada Lesseps) y llega al atardecer para ver la ciudad dorada.',
  },
  {
    id: 'torre-glories',
    nombre: 'Torre Glòries',
    barrio: 'Poblenou',
    etiqueta: 'Arquitectura contemporánea',
    coord: [41.40351, 2.18953],
    radio: 0.3,
    alturaMarcador: 2.8,
    camara: [2.6, 2.4, 3.6],
    descripcion:
      'El rascacielos de Jean Nouvel, inspirado en Montserrat y en los géiseres. De noche, miles de luces LED tiñen su piel de colores. En la cúpula hay un mirador con una instalación inmersiva.',
    horario: '10:00 – 21:00 (mirador)',
    precio: 'desde 15 €',
    duracion: '1 h',
    consejo: 'Combínalo con el Museu del Disseny y los Encants, el mercado de pulgas que hay justo al lado.',
  },
  {
    id: 'camp-nou',
    nombre: 'Spotify Camp Nou',
    barrio: 'Les Corts',
    etiqueta: 'Deporte',
    coord: [41.3809, 2.12282],
    radio: 1.5,
    alturaMarcador: 1.4,
    camara: [1.4, 3.4, 3.2],
    descripcion:
      'El estadio del FC Barcelona, uno de los más grandes del mundo y ahora en plena renovación. El museo recorre más de un siglo de historia blaugrana.',
    horario: '10:00 – 18:00',
    precio: 'desde 28 € (museo y tour)',
    duracion: '1,5 h',
    consejo: 'Antes de ir, consulta el calendario de partidos: los días de partido el tour cambia de horario.',
  },
  {
    id: 'catedral',
    nombre: 'Catedral y Barri Gòtic',
    barrio: 'Ciutat Vella',
    etiqueta: 'Gótico',
    coord: [41.38397, 2.17652],
    radio: 0.33,
    huecos: [{ coord: [41.38371, 2.17636], radio: 0.17 }],
    alturaMarcador: 1.5,
    camara: [-1.6, 1.5, -2.2],
    descripcion:
      'La catedral gótica de la Santa Creu i Santa Eulàlia preside un laberinto de calles medievales y plazas escondidas sobre los restos de la Barcino romana.',
    horario: '9:30 – 18:30',
    precio: '9 € (con terrazas)',
    duracion: '1 h + paseo',
    consejo: 'Busca el claustro con sus 13 ocas blancas y sube a las terrazas del tejado.',
  },
  {
    id: 'montjuic',
    nombre: 'Montjuïc y el MNAC',
    barrio: 'Sants-Montjuïc',
    etiqueta: 'Museos y vistas',
    coord: [41.3686, 2.1534],
    radio: 0.85,
    huecos: [{ coord: [41.3633, 2.1661], radio: 0.75 }],
    alturaMarcador: 1.5,
    camara: [2.4, 2.6, -5],
    descripcion:
      'La montaña de la Exposición de 1929: el Palau Nacional con el Museu Nacional d’Art de Catalunya, la Font Màgica a sus pies y el castillo en lo alto, mirando al puerto.',
    horario: '10:00 – 18:00 (MNAC)',
    precio: '12 € (MNAC)',
    duracion: 'Medio día',
    consejo: 'Sube en el teleférico desde el puerto y baja andando por los jardines hasta la Font Màgica.',
  },
  {
    id: 'barceloneta',
    nombre: 'Barceloneta y la playa',
    barrio: 'Ciutat Vella',
    etiqueta: 'Mar',
    coord: [41.37839, 2.19254],
    radio: 0,
    huecos: [{ coord: [41.36849, 2.19006], radio: 0.42 }],
    alturaMarcador: 0.8,
    camara: [3.8, 1.5, -2.3],
    descripcion:
      'El antiguo barrio de pescadores, con sus calles estrechas y la ropa tendida en los balcones, da paso a la playa urbana más famosa de la ciudad, con el Hotel W al fondo.',
    horario: 'Siempre abierto',
    precio: 'Gratis',
    duracion: 'Lo que quieras',
    consejo: 'Para comer una paella auténtica, aléjate del paseo marítimo y entra en el barrio.',
  },
]

export const MONUMENTOS: Monumento[] = LUGARES.map((m) => ({ ...m, pos: geoAEscena(...m.coord) }))

/** Círculos (x, z, r) de escena donde no se dibujan edificios de OSM. */
export const HUECOS = MONUMENTOS.flatMap((m) => [
  ...(m.radio > 0 ? [{ x: m.pos[0], z: m.pos[1], r: m.radio }] : []),
  ...(m.huecos ?? []).map((h) => {
    const [x, z] = geoAEscena(...h.coord)
    return { x, z, r: h.radio }
  }),
])

export const porId = (id: string | null) => MONUMENTOS.find((m) => m.id === id) ?? null
