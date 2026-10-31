import { useEffect, useState } from 'react'
import { Minus, Square, SquaresSubtract, X } from 'lucide-react'
import logoHypnos from '../../assets/images/logotype.png'

// ============================================================
//  STYLE (intégré au composant)
//  Les effets de survol sont dans le CSS : les styles en ligne
//  ne gèrent pas :hover (l'ancien « ':hover': red » était ignoré).
// ============================================================
const STYLES = `
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  background: transparent;
  color: var(--color-text);
  user-select: none;
  -webkit-app-region: drag; /* toute la barre déplace la fenêtre */
}

/* Les éléments cliquables doivent sortir de la zone de déplacement */
.titlebar__logo {
  display: block;
  padding-left: 28px;
  -webkit-app-region: no-drag;
}
.titlebar__logo img {
  display: block;
  width: 120px;
}

.titlebar__controles {
  display: flex;
  align-items: center;
}
.titlebar__bouton {
  display: grid;
  place-items: center;
  width: 52px;
  height: 42px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.titlebar__bouton:hover {
  background: var(--color-accent-wash);
}
.titlebar__bouton--fermer:hover {
  background: var(--color-danger);
  color: var(--color-accent-contrast);
}
`

// Le processus principal n'expose pas l'état « agrandie » : on le déduit de la
// taille de la fenêtre par rapport à l'écran (zone utile, hors barre des tâches).
function estAgrandie() {
  return (
    window.outerWidth >= window.screen.availWidth &&
    window.outerHeight >= window.screen.availHeight
  )
}

export default function TiltleBar() {
  const [agrandie, setAgrandie] = useState(estAgrandie)

  useEffect(() => {
    const miseAJour = () => setAgrandie(estAgrandie())
    window.addEventListener('resize', miseAJour)
    return () => window.removeEventListener('resize', miseAJour)
  }, [])

  const libelleAgrandir = agrandie ? 'Restaurer' : 'Agrandir'

  return (
    <header className="titlebar">
      <style>{STYLES}</style>

      {/* target="_blank" : le lien s'ouvre dans le navigateur, sans remplacer l'application */}
      <a
        className="titlebar__logo"
        href="https://www.hypnos.space/"
        target="_blank"
        rel="noreferrer"
      >
        <img src={logoHypnos} alt="Hypnos" />
      </a>

      <div className="titlebar__controles">
        <button
          type="button"
          className="titlebar__bouton"
          onClick={() => window.api.minimize()}
          aria-label="Réduire"
          title="Réduire"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className="titlebar__bouton"
          onClick={() => window.api.maximize()}
          aria-label={libelleAgrandir}
          title={libelleAgrandir}
        >
          {agrandie ? <SquaresSubtract size={14} /> : <Square size={14} />}
        </button>
        <button
          type="button"
          className="titlebar__bouton titlebar__bouton--fermer"
          onClick={() => window.api.close()}
          aria-label="Fermer"
          title="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}