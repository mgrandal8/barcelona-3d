import * as THREE from 'three'
import type { Suelo } from './suelo'

// El suelo se calcula en terreno.worker.ts: aquí solo se montan las geometrías y las texturas.

export function geometriaTerreno({ terreno: t }: Suelo) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(t.pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(t.nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(t.uv, 2))
  g.setIndex(new THREE.BufferAttribute(t.idx, 1))
  return g
}

/** Paredes laterales de la maqueta, siguiendo el borde del relieve. */
export function geometriaZocalo({ zocalo: z }: Suelo) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(z.pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(z.col, 3))
  g.computeVertexNormals()
  return g
}

/** ImageBitmap del worker (o canvas, en el plan B) → textura; flipY a false, como estaba dibujada. */
export function textura(imagen: Suelo['texSuelo'], gl: THREE.WebGLRenderer, anisotropia: number) {
  const tex = new THREE.Texture(imagen)
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(anisotropia, gl.capabilities.getMaxAnisotropy())
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.needsUpdate = true
  return tex
}
