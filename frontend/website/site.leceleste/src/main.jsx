import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Alpine from 'alpinejs'

import App from './App.jsx'
import './index.css'

// La classe `js` autorise le CSS a cacher les elements avant leur
// animation. Sans elle -- donc sans JavaScript -- tout reste visible.
document.documentElement.classList.add('js')

// Alpine demarre avant React : les noeuds qu'il doit initialiser
// (le formulaire de reservation) sont inseres apres, et Alpine les
// reprend via son MutationObserver.
window.Alpine = Alpine
Alpine.start()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)