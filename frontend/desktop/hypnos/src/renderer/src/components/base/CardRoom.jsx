/* eslint-disable react/prop-types */
import { BedDouble } from 'lucide-react'
import injecterStyles from './injecterStyles'

// Statuts d'une chambre : libellé affiché et couleur de la pastille.
export const STATUTS_CHAMBRE = {
  occupee: { libelle: 'Occupée', pastille: 'var(--color-accent)' },
  disponible: { libelle: 'Disponible', pastille: 'var(--color-success)' },
  nettoyage: { libelle: 'Nettoyage', pastille: 'var(--color-accent-soft)' },
  maintenance: { libelle: 'Hors service', pastille: 'var(--color-text-faint)' }
}

const STYLES = `
.chambre {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 88px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-m);
  font-family: inherit;
  text-align: left;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}
.chambre--cliquable {
  cursor: pointer;
}
.chambre--cliquable:hover {
  transform: translateY(-2px);
  box-shadow: var(--color-shadow);
}

/* ---------- Statuts ---------- */
.chambre--occupee {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
.chambre--disponible {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}
.chambre--nettoyage {
  background: var(--color-accent-soft);
  color: var(--onyx);
}
.chambre--maintenance {
  background: var(--color-background-mute);
  color: var(--color-text-muted);
}

.chambre__haut {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.chambre__numero {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
}
.chambre__icone {
  opacity: 0.8;
}
.chambre__bas {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.chambre__statut {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}
.chambre--disponible .chambre__statut::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}
.chambre__detail {
  overflow: hidden;
  font-size: 12px;
  opacity: 0.85;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .chambre { transition: none; }
}
`

injecterStyles('hypnos-card-room', STYLES)

/**
 * Props :
 *  numero    numéro de la chambre (ex. « 01 »)
 *  statut    'occupee' | 'disponible' | 'nettoyage' | 'maintenance'
 *  detail    ligne facultative sous le statut (ex. nom du client)
 *  onClick   rend la carte cliquable (ex. ouvrir la modale de changement de statut)
 */
export default function CardRoom({ numero, statut = 'disponible', detail, onClick, className = '' }) {
  const connu = Boolean(STATUTS_CHAMBRE[statut])
  const cle = connu ? statut : 'maintenance'
  const libelle = connu ? STATUTS_CHAMBRE[statut].libelle : String(statut)

  const classes = `chambre chambre--${cle} ${className}`.trim()

  const contenu = (
    <>
      <div className="chambre__haut">
        <span className="chambre__numero">{numero}</span>
        <BedDouble className="chambre__icone" size={16} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="chambre__bas">
        <span className="chambre__statut">{libelle}</span>
        {detail && <span className="chambre__detail">{detail}</span>}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`${classes} chambre--cliquable`}
        onClick={onClick}
        aria-label={`Chambre ${numero}, ${libelle}`}
      >
        {contenu}
      </button>
    )
  }

  return (
    <div className={classes} role="group" aria-label={`Chambre ${numero}, ${libelle}`}>
      {contenu}
    </div>
  )
}