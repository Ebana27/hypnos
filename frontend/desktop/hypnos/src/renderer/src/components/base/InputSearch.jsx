/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import injecterStyles from './injecterStyles'

const STYLES = `
.recherche {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
  transition: border-color 0.15s ease;
}
.recherche:focus-within {
  border-color: var(--color-accent);
}
.recherche svg {
  flex-shrink: 0;
}
.recherche input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--color-text);
}
.recherche input::placeholder {
  color: var(--color-text-faint);
}
/* Le bouton d'effacement natif du navigateur est remplacé par le nôtre */
.recherche input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  display: none;
}
.recherche__effacer {
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}
.recherche__effacer:hover {
  color: var(--color-accent);
}
`

injecterStyles('hypnos-input-search', STYLES)

/**
 * Props :
 *  value        texte de la recherche (contrôlé). Sans value, le composant gère son état.
 *  onChange     reçoit directement le texte (pas l'évènement)
 *  placeholder  défaut : « Rechercher… »
 *  largeurMax   largeur maximale en px ou en CSS (défaut : 460), null pour aucune limite
 */
export default function InputSearch({
  value,
  onChange,
  placeholder = 'Rechercher…',
  largeurMax = 460,
  className = '',
  ...reste
}) {
  const [interne, setInterne] = useState('')
  const controle = value !== undefined
  const courant = controle ? value : interne

  const changer = (texte) => {
    if (!controle) setInterne(texte)
    onChange?.(texte)
  }

  return (
    <label
      className={`recherche ${className}`.trim()}
      style={largeurMax ? { maxWidth: largeurMax } : undefined}
    >
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        value={courant}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => changer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && courant) {
            e.preventDefault()
            changer('')
          }
        }}
        {...reste}
      />
      {courant && (
        <button
          type="button"
          className="recherche__effacer"
          onClick={() => changer('')}
          aria-label="Effacer la recherche"
        >
          <X size={16} />
        </button>
      )}
    </label>
  )
}