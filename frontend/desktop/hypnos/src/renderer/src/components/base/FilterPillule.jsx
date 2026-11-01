/* eslint-disable react/prop-types */
import injecterStyles from './injecterStyles'
import { STATUTS_CHAMBRE } from './CardRoom'

const STYLES = `
.pillule {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.pillule:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.pillule[aria-pressed='true'] {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-contrast);
}
.pillule__point {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pillule-point);
}
.pillule[aria-pressed='true'] .pillule__point {
  background: var(--color-accent-contrast);
}
.pillule__compteur {
  font-size: 12px;
  opacity: 0.8;
}
`

injecterStyles('hypnos-filter-pillule', STYLES)

/**
 * Props :
 *  libelle   texte de la pastille (facultatif si statut est donné)
 *  compteur  nombre affiché entre parenthèses (ex. 6 → « Occupée (6) »)
 *  actif     pastille sélectionnée
 *  statut    'occupee' | 'disponible' | 'nettoyage' | 'maintenance' : ajoute la pastille de couleur
 *  onClick   appelé au clic
 */
export default function FilterPillule({
  libelle,
  compteur,
  actif = false,
  statut,
  onClick,
  className = ''
}) {
  const infos = statut ? STATUTS_CHAMBRE[statut] : undefined
  const texte = libelle ?? infos?.libelle

  return (
    <button
      type="button"
      className={`pillule ${className}`.trim()}
      aria-pressed={actif}
      onClick={onClick}
      style={infos ? { '--pillule-point': infos.pastille } : undefined}
    >
      {infos && <span className="pillule__point" aria-hidden="true" />}
      {texte}
      {compteur !== undefined && <span className="pillule__compteur">({compteur})</span>}
    </button>
  )
}