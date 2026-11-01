/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import Button from './base/Button'
import PanneauMarque, { BarreFenetre } from './base/PanneauMarque'
import ProgressBar from './base/ProgressBar'
import injecterStyles from './base/injecterStyles'

const DIAPOSITIVES = [
  {
    titre: ['Votre hôtel,', 'sous contrôle.'],
    texte: 'Réservations, chambres et clients réunis dans un seul logiciel pensé pour la réception.'
  },
  {
    titre: ['De l’arrivée', 'au départ.'],
    texte: 'Suivez chaque séjour et l’état de vos chambres en temps réel, sans papier.'
  },
  {
    titre: ['Reprenez vos', 'données Excel.'],
    texte: 'Importez vos réservations, chambres et clients existants en quelques secondes.'
  }
]

const STYLES = `
.onb__compteur {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 500;
  opacity: 0.9;
}
.onb__pied {
  display: flex;
  align-items: center;
  gap: 20px;
}
.onb__pied .progression {
  flex: 1;
}
/* Boutons lisibles sur fond bleu */
.onb .onb__passer {
  color: var(--color-brand-contrast, var(--white));
}
.onb .onb__passer:hover:not(:disabled) {
  background: color-mix(in srgb, var(--white) 16%, transparent);
  color: var(--color-brand-contrast, var(--white));
}
.onb .onb__suivant,
.onb .onb__suivant:hover:not(:disabled) {
  background: var(--color-brand-contrast, var(--white));
  border-color: var(--color-brand-contrast, var(--white));
  color: var(--color-brand, var(--medium-blue));
}
.onb .onb__suivant:hover:not(:disabled) {
  filter: brightness(0.94);
}
`

injecterStyles('hypnos-onboarding', STYLES)

const deuxChiffres = (n) => String(n).padStart(2, '0')

export default function Onboarding({ onFinish }) {
  const [index, setIndex] = useState(0)
  const dernier = index === DIAPOSITIVES.length - 1
  const diapo = DIAPOSITIVES[index]

  const suivant = () => (dernier ? onFinish() : setIndex((i) => i + 1))

  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, DIAPOSITIVES.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  return (
    <div className="auth onb">
      <PanneauMarque
        pleinEcran
        cleAnimation={index}
        coin={
          <span className="onb__compteur">
            {deuxChiffres(index + 1)} / {deuxChiffres(DIAPOSITIVES.length)}
          </span>
        }
        titre={
          <>
            {diapo.titre[0]}
            <br />
            {diapo.titre[1]}
          </>
        }
        texte={diapo.texte}
        pied={
          <div className="onb__pied">
            <ProgressBar
              valeur={((index + 1) / DIAPOSITIVES.length) * 100}
              variante="clair"
              libelle="Progression de la présentation"
            />
            <Button variante="fantome" className="onb__passer" onClick={onFinish}>
              Passer
            </Button>
            <Button taille="l" className="onb__suivant" onClick={suivant}>
              {dernier ? 'Commencer' : 'Suivant'}
            </Button>
          </div>
        }
      />
      <BarreFenetre clair />
    </div>
  )
}