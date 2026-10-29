// Sin three: lo usan la interfaz y el store, que se cargan antes que la escena.

export type Momento = 'dia' | 'atardecer' | 'noche'
export const MOMENTOS: Momento[] = ['dia', 'atardecer', 'noche']

export const momentoDeUrl = (): Momento => {
  const h = new URLSearchParams(location.search).get('hora')
  return MOMENTOS.includes(h as Momento) ? (h as Momento) : 'dia'
}
