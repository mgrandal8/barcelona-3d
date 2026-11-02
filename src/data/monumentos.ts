import { geoAEscena } from '../scene/geo'
import FOTOS from './fotos.json'

// Lugares de la guía. Horarios y precios reales, copiados de la web oficial de cada sitio (`web`) en la fecha CONSULTADO;
// descripciones y consejos, propios. Las fotos (autor y licencia) están en fotos.json: las baja scripts/datos/fotos.mjs.

/** Fecha en que se comprobaron horarios y precios. */
export const CONSULTADO = '2026-11-01'

export type Foto = { archivo: string; ancho: number; alto: number; autor: string; licencia: string; urlLicencia: string | null; pagina: string; titulo: string; recortada?: boolean }

/** Reserva de un lugar o un tour en el modo embebido: `id` vuelve a la página anfitriona; `url`, si la guía no está en un iframe. */
export type Reserva = { id?: string; url?: string }

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
  /** Página oficial donde se han comprobado horario y precio. */
  web?: string
  /** Foto de Wikimedia Commons, con sus créditos. */
  foto?: Foto
  duracion: string
  consejo: string
  /** Modo embebido: se puede reservar (botón «Reservar»). */
  reserva?: Reserva
  /** Modo embebido: quién da el horario y el precio si los cambia el JSON externo (sustituye a «web oficial»). */
  fuenteDatos?: string
}

const LUGARES: Omit<Monumento, 'pos' | 'foto'>[] = [
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
    horario: 'Nov–feb: lun–sáb 9:00–18:00, dom 10:30–18:00. Mar y oct hasta las 19:00; abr–sep hasta las 20:00 (sábados hasta las 18:00)',
    precio: '26 € (basílica con audioguía; torres aparte)',
    web: 'https://sagradafamilia.org/es/horarios-como-llegar',
    duracion: '1,5 – 2 h',
    consejo: 'Reserva la entrada con antelación y ve a primera hora de la tarde: la luz de poniente atraviesa las vidrieras de tonos cálidos.',
  },
  {
    id: 'casa-batllo',
    nombre: 'Casa Batlló',
    barrio: 'Passeig de Gràcia',
    etiqueta: 'Modernismo',
    coord: [41.39159, 2.16482],
    // 0,125 para quitar también la parte de OSM de la fachada; la Casa Amatller va en el modelo
    radio: 0.125,
    huecos: [{ coord: [41.39152, 2.16499], radio: 0.1 }],
    alturaMarcador: 1,
    camara: [1.3, 0.9, 1.1],
    descripcion:
      'Gaudí reformó este edificio en 1904 y lo convirtió en un sueño marino: balcones como máscaras, columnas como huesos y un tejado que recuerda el lomo de un dragón.',
    horario: 'Todos los días desde las 9:00; último acceso de día a las 19:45. Visita nocturna de 20:30 a 21:30',
    precio: 'desde 29 €',
    web: 'https://www.casabatllo.es/en/online-tickets/',
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
    // la puerta de Carrer d'Olot con sus dos pabellones, y la Casa-Museu Gaudí
    huecos: [
      { coord: [41.41349, 2.15308], radio: 0.2 },
      { coord: [41.41444, 2.15358], radio: 0.08 },
    ],
    alturaMarcador: 0.9,
    camara: [0.4, 1.4, 2.4],
    descripcion:
      'Un parque concebido como ciudad jardín, con el famoso banco ondulante de trencadís, el dragón de la escalinata y las casitas que parecen de cuento. Desde la plaza se ve toda la ciudad hasta el mar.',
    horario: 'Todos los días; entradas para visitantes de 9:30 a 17:30, en franjas de media hora',
    precio: '18 € (zona monumental)',
    web: 'https://parkguell.barcelona/en/planning-your-visit/prices-and-times',
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
    horario: 'Nov–mar: mié–lun 10:00–18:30 (martes cerrado). Abr–oct: todos los días 10:00–21:00',
    precio: '18 € (entrada general)',
    web: 'https://www.miradortorreglories.com/en/',
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
    horario: 'Museo y tour: 10:00–18:00 hasta el 19 de marzo; en verano 9:30–19:00. Último acceso 45 min antes del cierre',
    precio: 'desde 28 € (museo y mirador de las obras)',
    web: 'https://www.fcbarcelona.com/en/tickets/camp-nou-experience/timetable',
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
    horario: 'Visita turística: lun–vie 9:30–18:30, sáb 9:30–17:15, dom y festivos 14:00–17:00',
    precio: '16 € (claustro, cubierta, coro y sala capitular)',
    web: 'https://catedralbcn.org/en/tourist-visit/visiting-hours/',
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
    horario: 'MNAC: mar–sáb 10:00–18:00 (may–sep hasta las 20:00), dom y festivos 10:00–15:00; lunes cerrado',
    precio: '12 € (MNAC); gratis los sábados desde las 15:00 y el primer domingo de mes',
    web: 'https://www.museunacional.cat/en/opening-hours-and-prices',
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
    horario: 'Siempre abierta; socorristas solo en temporada de baño',
    precio: 'Gratis',
    web: 'https://barcelona.cat/es/que-hacer-en-bcn/banos-y-playas/playa-de-la-barceloneta',
    duracion: 'Lo que quieras',
    consejo: 'Para comer una paella auténtica, aléjate del paseo marítimo y entra en el barrio.',
  },
  {
    id: 'casa-mila',
    nombre: 'Casa Milà (La Pedrera)',
    barrio: 'Passeig de Gràcia',
    etiqueta: 'Gaudí',
    coord: [41.39542, 2.1619],
    radio: 0,
    // tres círculos y no uno: el vecino del norte (OSM) queda a 0,2 u del centro
    huecos: [
      { coord: [41.39529, 2.16178], radio: 0.1 },
      { coord: [41.39537, 2.16193], radio: 0.1 },
      { coord: [41.39546, 2.16211], radio: 0.1 },
    ],
    alturaMarcador: 1.1,
    camara: [-1.7, 1.3, 1.5],
    descripcion:
      'La última casa que Gaudí construyó en la ciudad (1906–1912): una fachada de piedra que ondula como una cantera, balcones de hierro como algas y una azotea custodiada por chimeneas que parecen guerreros.',
    horario: 'Nov–feb: todos los días 9:00–18:30. Mar–oct: 9:00–20:30. Visita nocturna aparte',
    precio: 'desde 29 € (visita de día)',
    web: 'https://www.lapedrera.com/en/practical-information/',
    duracion: '1 – 1,5 h',
    consejo: 'La visita nocturna recorre la azotea con luces y música; desde ahí se ve la Sagrada Família entre las chimeneas.',
  },
  {
    id: 'arc-de-triomf',
    nombre: 'Arc de Triomf',
    barrio: 'Passeig de Lluís Companys',
    etiqueta: 'Modernismo',
    coord: [41.39104, 2.18065],
    radio: 0.18,
    alturaMarcador: 0.9,
    camara: [-0.9, 0.9, -1.9],
    descripcion:
      'La puerta de entrada a la Exposición Universal de 1888, de ladrillo rojo y estilo neomudéjar. Su paseo de palmeras y farolas baja hasta el parque de la Ciutadella.',
    horario: 'Siempre abierto',
    precio: 'Gratis',
    duracion: '30 min',
    consejo: 'Sigue el paseo hasta la Ciutadella: la cascada monumental, con la cuadriga dorada en lo alto, está al fondo del parque.',
  },
  {
    id: 'colom',
    nombre: 'Mirador de Colom',
    barrio: 'Port Vell',
    etiqueta: 'Museos y vistas',
    coord: [41.3758, 2.17777],
    radio: 0.16,
    alturaMarcador: 1.5,
    camara: [1.6, 1.3, 2.1],
    descripcion:
      'Una columna de hierro de 60 m, levantada para la Exposición de 1888, al final de la Rambla. Un ascensor sube por dentro hasta el mirador, a los pies de la estatua de Colón.',
    horario: 'Todos los días 8:30–14:30 (última subida a las 13:30)',
    precio: '7,50 € (mirador)',
    web: 'https://thisisbarcelona.com/es/tickets/monumento-mirador-colon',
    duracion: '30 min',
    consejo: 'Sube a primera hora: el ascensor es pequeño y la cola crece a media mañana. Arriba se ve la Rambla entera y el puerto.',
  },
]

export const MONUMENTOS: Monumento[] = LUGARES.map((m) => ({
  ...m,
  pos: geoAEscena(...m.coord),
  foto: (FOTOS as Record<string, Foto>)[m.id],
}))

/** Círculos (x, z, r) de escena donde no se dibujan edificios de OSM. */
export const HUECOS = MONUMENTOS.flatMap((m) => [
  ...(m.radio > 0 ? [{ x: m.pos[0], z: m.pos[1], r: m.radio }] : []),
  ...(m.huecos ?? []).map((h) => {
    const [x, z] = geoAEscena(...h.coord)
    return { x, z, r: h.radio }
  }),
])

export const porId = (id: string | null) => MONUMENTOS.find((m) => m.id === id) ?? null
