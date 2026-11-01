// Puente sin three entre la escena y la interfaz de compartir: la escena registra cómo leer la vista de la
// cámara (para el enlace) y cómo sacar una foto del canvas (para la imagen). Sin escena (versión ligera) son null.

export const escena = {
  /** Cámara y punto al que mira: px, py, pz, tx, ty, tz. */
  vista: null as null | (() => number[]),
  /** Si la cámara está volando (la foto espera a que llegue). */
  enVuelo: null as null | (() => boolean),
  /** Copia del último fotograma, ya con el postproceso. */
  foto: null as null | (() => Promise<HTMLCanvasElement | null>),
}
