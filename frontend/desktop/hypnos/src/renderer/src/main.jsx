// main.jsx
/*Point d'entrer de l'app Electron ?*/

// Style global de l'app
import './assets/styles/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
