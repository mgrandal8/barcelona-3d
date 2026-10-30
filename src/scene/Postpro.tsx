import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { useEstado, usePerfil } from '../store'

// Va en su propio chunk (159 kB con gzip, casi todo N8AO): Experience lo carga cuando la ciudad ya está dibujada.

export default function Postpro() {
  const { postpro } = usePerfil()
  // de noche el bloom recoge las ventanas, las farolas y los LED
  const noche = useEstado((s) => s.momento) === 'noche'
  return (
    <EffectComposer multisampling={0}>
      {postpro === 'completo' ? <N8AO aoRadius={0.6} intensity={2} distanceFalloff={0.5} halfRes /> : <></>}
      <Bloom luminanceThreshold={noche ? 0.55 : 0.9} intensity={noche ? 0.9 : 0.4} mipmapBlur />
      <Vignette darkness={0.35} offset={0.3} />
      <SMAA />
    </EffectComposer>
  )
}
