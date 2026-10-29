import type { ComponentType } from 'react'
import { MONUMENTOS } from '../data/monumentos'
import { Monumento } from './Monumento'
import { Barceloneta } from './monumentos/Barceloneta'
import { CampNou } from './monumentos/CampNou'
import { CasaBatllo } from './monumentos/CasaBatllo'
import { CatedralGotico } from './monumentos/CatedralGotico'
import { Montjuic } from './monumentos/Montjuic'
import { ParkGuell } from './monumentos/ParkGuell'
import { SagradaFamilia } from './monumentos/SagradaFamilia'
import { TorreGlories } from './monumentos/TorreGlories'

const MODELOS: Record<string, ComponentType> = {
  'sagrada-familia': SagradaFamilia,
  'casa-batllo': CasaBatllo,
  'park-guell': ParkGuell,
  'torre-glories': TorreGlories,
  'camp-nou': CampNou,
  catedral: CatedralGotico,
  montjuic: Montjuic,
  barceloneta: Barceloneta,
}

export function Monumentos() {
  return (
    <group>
      {MONUMENTOS.map((m) => {
        const Modelo = MODELOS[m.id]
        return <Monumento key={m.id} m={m}>{Modelo && <Modelo />}</Monumento>
      })}
    </group>
  )
}
