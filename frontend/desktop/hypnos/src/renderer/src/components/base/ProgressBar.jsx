/* eslint-disable react/prop-types */
import injecterStyles from './injecterStyles'

const STYLES = `
.progression {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.progression--accent {
  --progression-piste: color-mix(in srgb, var(--color-accent) 18%, transparent);
  --progression-barre: var(--color-accent);
}
/* Pour un fond coloré (écran de chargement bleu) */
.progression--clair {
  --progression-piste: color-mix(in srgb, var(--white) 30%, transparent);
  --progression-barre: var(--white);
}
.progression__piste {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--progression-piste);
}
.progression__barre {
  width: var(--progression-valeur, 0%);
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--progression-barre);
  transition: width 0.3s ease;
}
.progression--indeterminee .progression__barre {
  width: 40%;
  animation: progression-glisse 1.2s ease-in-out infinite;
}
.progression__valeur {
  min-width: 3ch;
  font-family: var(--font-display);
  font-size: 13px;
  text-align: right;
  color: var(--progression-barre);
}

@keyframes progression-glisse {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}
@media (prefers-reduced-motion: reduce) {
  .progression__barre { transition: none; }
  .progression--indeterminee .progression__barre { animation-duration: 3s; }
}
`

injecterStyles('hypnos-progress-bar', STYLES)

/**
 * Props :
 *  valeur          0 à 100. Sans valeur : barre indéterminée (animation continue).
 *  libelle         texte lu par les lecteurs d'écran (défaut : « Chargement »)
 *  afficherValeur  affiche le pourcentage à droite
 *  variante        'accent' | 'clair'
 */
export default function ProgressBar({
  valeur,
  libelle = 'Chargement',
  afficherValeur = false,
  variante = 'accent',
  className = ''
}) {
  const determinee = typeof valeur === 'number' && !Number.isNaN(valeur)
  const borne = determinee ? Math.min(100, Math.max(0, valeur)) : undefined

  const classes = [
    'progression',
    `progression--${variante}`,
    !determinee && 'progression--indeterminee',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <div
        className="progression__piste"
        role="progressbar"
        aria-label={libelle}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinee ? Math.round(borne) : undefined}
      >
        <div
          className="progression__barre"
          style={determinee ? { '--progression-valeur': `${borne}%` } : undefined}
        />
      </div>
      {afficherValeur && determinee && (
        <span className="progression__valeur">{Math.round(borne)} %</span>
      )}
    </div>
  )
}