/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import logoHypnos from '../../assets/images/logotype.png'

// ============================================================
//  STYLE (intégré au composant)
//  Les styles en ligne ne gèrent pas :hover : le survol est dans CSS_SURVOL.
// ============================================================

const STYLES = {
  barre: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '52px',
    background: 'transparent',
    color: 'var(--color-text)',
    userSelect: 'none',
    WebkitAppRegion: 'drag'
  },
  logo: { display: 'block', paddingLeft: '28px', WebkitAppRegion: 'no-drag' },
  logoImage: { display: 'block', width: '120px' },
  droite: { display: 'flex', alignItems: 'center', gap: '12px' },
  controles: { display: 'flex', alignItems: 'center' },
  bouton: {
    display: 'grid',
    placeItems: 'center',
    width: '52px',
    height: '42px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag'
  },
  maj: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    borderRadius: '999px',
    border: 'none',
    background: 'var(--hypnos-medium-blue, #141cc5)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag'
  },
  piste: {
    width: '60px',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden'
  },
  annulerMaj: {
    display: 'grid',
    placeItems: 'center',
    width: '22px',
    height: '22px',
    padding: 0,
    border: 'none',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.16)',
    color: '#fff',
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag'
  },
  remplissage: { height: '100%', background: '#fff', transition: 'width 0.2s' }
}

const CSS_SURVOL = `
  .titlebar__bouton:hover { background: var(--color-accent-wash); }
  .titlebar__bouton--fermer:hover {
    background: var(--color-danger);
    color: var(--color-accent-contrast);
  }
`

// Le processus principal n'expose pas l'état « agrandie » : on le déduit de la taille de la fenêtre.
function estAgrandie() {
  return (
    window.outerWidth >= window.screen.availWidth &&
    window.outerHeight >= window.screen.availHeight
  )
}

function IndicateurMaj({ maj }) {
  if (maj.etat === 'disponible') {
    return (
      <button type="button" style={STYLES.maj} onClick={() => window.api.maj.telecharger()}>
        Mise à jour {maj.version} disponible : télécharger
      </button>
    )
  }
  if (maj.etat === 'telechargement') {
    return (
      <div style={STYLES.maj}>
        Téléchargement… {maj.pourcent}%
        <div style={STYLES.piste}>
          <div style={{ ...STYLES.remplissage, width: `${maj.pourcent}%` }} />
        </div>
        <button
          type="button"
          style={STYLES.annulerMaj}
          onClick={() => window.api.maj.annuler().catch(() => {})}
          aria-label="Annuler le téléchargement de la mise à jour"
          title="Annuler le téléchargement"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    )
  }
  if (maj.etat === 'prete') {
    return (
      <button type="button" style={STYLES.maj} onClick={() => window.api.maj.installer()}>
        Redémarrer pour installer la version {maj.version}
      </button>
    )
  }
  return null
}

export default function TiltleBar() {
  const [agrandie, setAgrandie] = useState(estAgrandie)
  const [maj, setMaj] = useState({ etat: 'aucune' })

  useEffect(() => {
    const surRedimensionnement = () => setAgrandie(estAgrandie())
    window.addEventListener('resize', surRedimensionnement)
    return () => window.removeEventListener('resize', surRedimensionnement)
  }, [])

  useEffect(() => {
    // État actuel (au cas où l'événement serait parti avant l'affichage), puis les changements
    window.api.maj.etat().then(setMaj).catch(() => {})
    return window.api.maj.surChangement(setMaj)
  }, [])

  const libelleAgrandir = agrandie ? 'Restaurer' : 'Agrandir'

  return (
    <header className="titlebar" style={STYLES.barre}>
      <style>{CSS_SURVOL}</style>

      <a
        className="titlebar__logo"
        style={STYLES.logo}
        href="https://www.hypnos.space/"
        target="_blank"
        rel="noreferrer"
      >
        <img src={logoHypnos} alt="Hypnos" style={STYLES.logoImage} />
      </a>

      <div style={STYLES.droite}>
        <IndicateurMaj maj={maj} />

        <div className="titlebar__controles" style={STYLES.controles}>
          <button
            type="button"
            className="titlebar__bouton"
            style={STYLES.bouton}
            onClick={() => window.api.minimize()}
            aria-label="Réduire"
            title="Réduire"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="titlebar__bouton"
            style={STYLES.bouton}
            onClick={() => window.api.maximize()}
            aria-label={libelleAgrandir}
            title={libelleAgrandir}
          >
            {agrandie ? <Copy size={14} /> : <Square size={14} />}
          </button>
          <button
            type="button"
            className="titlebar__bouton titlebar__bouton--fermer"
            style={STYLES.bouton}
            onClick={() => window.api.close()}
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
