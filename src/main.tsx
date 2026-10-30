import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cargarDatos } from './scene/datos'
import { ubicacionDeUrl } from './ubicacion'

// los datos empiezan a bajar a la vez que el código de la escena
cargarDatos()
ubicacionDeUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
