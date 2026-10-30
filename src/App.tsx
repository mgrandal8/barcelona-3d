import { lazy, Suspense, useEffect } from 'react'
import { useT } from './i18n'
import { useEstado } from './store'
import { Dialogos } from './ui/Dialogos'
import { ListaLugares } from './ui/ListaLugares'
import { Menu } from './ui/Menu'
import { PanelInfo } from './ui/PanelInfo'
import { Pista, Portada } from './ui/Portada'
import { SelectorHora } from './ui/SelectorHora'
import { BotonUbicacion } from './ui/BotonUbicacion'
import { BotonMetro } from './ui/BotonMetro'
import { AvisoRed } from './ui/AvisoRed'
import { ErrorMaqueta } from './ui/ErrorMaqueta'

// three y la escena van en otro chunk: la portada sale antes, mientras se descargan
const Experience = lazy(() => import('./scene/Experience').then((m) => ({ default: m.Experience })))

export default function App() {
  // con la portada delante, el resto de la interfaz se esconde
  const portada = useEstado((s) => s.portada)
  const idioma = useEstado((s) => s.idioma)
  const fallo = useEstado((s) => s.fallo)
  const reintentos = useEstado((s) => s.reintentos)
  const t = useT()
  useEffect(() => {
    document.documentElement.lang = idioma
    document.title = t.tituloPagina
  }, [idioma, t])
  return (
    <main className={`app ${portada ? 'con-portada' : ''}`}>
      {/* con un fallo, la escena se desmonta; «Reintentar» la vuelve a montar con otra key */}
      {!fallo && (
        <ErrorMaqueta key={reintentos}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </ErrorMaqueta>
      )}
      <ListaLugares />
      <SelectorHora />
      <BotonUbicacion />
      <BotonMetro />
      <Menu />
      <PanelInfo />
      <p className="atribucion">
        {t.atribucion.mapa}: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · {t.atribucion.relieve}: Mapzen/AWS
        Terrain Tiles · {t.atribucion.ejemplo}
      </p>
      <AvisoRed />
      <Dialogos />
      <Portada />
      <Pista />
    </main>
  )
}
