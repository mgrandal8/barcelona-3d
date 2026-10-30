import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cargarDatos } from './scene/datos'
import { ubicacionDeUrl } from './ubicacion'
import { cargarTransporte } from './transporte'
import { iniciarPwa } from './pwa'
import { useEstado } from './store'

// los datos empiezan a bajar a la vez que el código de la escena (la versión ligera no los usa);
// si fallan, el error llega a la escena por use()
if (useEstado.getState().modo === '3d') cargarDatos().catch(() => {})
ubicacionDeUrl()
cargarTransporte().catch(() => {})
iniciarPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
