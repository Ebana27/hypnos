/* eslint-disable react/prop-types */
import { forwardRef } from 'react'
import injecterStyles from './injecterStyles'

// Variantes disponibles :
//  principal      action principale (« Nouvelle réservation »)
//  secondaire     action courante sur fond neutre (« Importer Excel »)
//  contour        bordure d'accent, fond transparent (« Paramètres »)
//  fantome        sans fond ni bordure, pour les actions discrètes
//  lien           simple texte d'accent (« Voir tout »)
//  danger         action destructive (« Supprimer »)
//  danger-doux    action destructive secondaire (« Annuler la réservation »)
//  succes         validation (« Marquer comme payée »)
export const VARIANTES_BOUTON = [
  'principal',
  'secondaire',
  'contour',
  'fantome',
  'lien',
  'danger',
  'danger-doux',
  'succes'
]

const STYLES = `
.btn {
  --btn-hauteur: 40px;
  --btn-padding: 0 18px;
  --btn-taille: 14px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: var(--btn-hauteur);
  padding: var(--btn-padding);
  border: 1px solid transparent;
  border-radius: 12px;
  font-family: var(--font-display);
  font-size: var(--btn-taille);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn svg {
  flex-shrink: 0;
}

/* ---------- Tailles ---------- */
.btn--s { --btn-hauteur: 32px; --btn-padding: 0 12px; --btn-taille: 12px; }
.btn--l { --btn-hauteur: 48px; --btn-padding: 0 24px; --btn-taille: 15px; }

/* ---------- Formes ---------- */
.btn--pastille { border-radius: var(--radius-pill); }
.btn--icone { width: var(--btn-hauteur); padding: 0; }
.btn--pleine { width: 100%; }

/* ---------- Variantes ---------- */
.btn--principal {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-contrast);
}
.btn--principal:hover:not(:disabled) {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}
.btn--principal:active:not(:disabled) {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.btn--secondaire {
  background: var(--color-background-soft);
  color: var(--color-text);
}
.btn--secondaire:hover:not(:disabled) {
  background: var(--color-accent-wash);
  color: var(--color-accent);
}

.btn--contour {
  background: transparent;
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.btn--contour:hover:not(:disabled) {
  background: var(--color-accent-wash);
}

.btn--fantome {
  background: transparent;
  color: var(--color-text-muted);
}
.btn--fantome:hover:not(:disabled) {
  background: var(--color-accent-wash);
  color: var(--color-accent);
}

.btn--lien {
  height: auto;
  padding: 0;
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--color-accent);
}
.btn--lien:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.btn--danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--white);
}
.btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 85%, var(--hypnos-black));
  border-color: color-mix(in srgb, var(--color-danger) 85%, var(--hypnos-black));
}

.btn--danger-doux {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}
.btn--danger-doux:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 20%, transparent);
}

.btn--succes {
  background: var(--color-success);
  border-color: var(--color-success);
  color: var(--white);
}
.btn--succes:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-success) 85%, var(--hypnos-black));
  border-color: color-mix(in srgb, var(--color-success) 85%, var(--hypnos-black));
}

/* ---------- Chargement ---------- */
.btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: btn-rotation 0.7s linear infinite;
}
@keyframes btn-rotation {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .btn__spinner { animation-duration: 2s; }
}
`

injecterStyles('hypnos-button', STYLES)

const TAILLES_ICONE = { s: 14, m: 16, l: 18 }

/**
 * Props :
 *  variante      voir VARIANTES_BOUTON (défaut : 'principal')
 *  taille        's' | 'm' | 'l' (défaut : 'm')
 *  forme         'pastille' | 'arrondi' (défaut : 'pastille')
 *  icone         composant lucide affiché à gauche
 *  iconeDroite   composant lucide affiché à droite
 *  iconeSeule    bouton carré/rond avec l'icône seule (aria-label obligatoire)
 *  chargement    affiche un indicateur et désactive le bouton
 *  pleineLargeur occupe toute la largeur disponible
 */
const Button = forwardRef(function Button(
  {
    variante = 'principal',
    taille = 'm',
    forme = 'pastille',
    icone: Icone,
    iconeDroite: IconeDroite,
    iconeSeule = false,
    chargement = false,
    pleineLargeur = false,
    type = 'button',
    disabled = false,
    className = '',
    children,
    ...reste
  },
  ref
) {
  const classes = [
    'btn',
    `btn--${variante}`,
    `btn--${taille}`,
    forme === 'pastille' && 'btn--pastille',
    iconeSeule && 'btn--icone',
    pleineLargeur && 'btn--pleine',
    className
  ]
    .filter(Boolean)
    .join(' ')

  const tailleIcone = TAILLES_ICONE[taille] ?? 16

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      {...reste}
    >
      {chargement ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        Icone && <Icone size={tailleIcone} strokeWidth={1.8} aria-hidden="true" />
      )}
      {!iconeSeule && children}
      {!chargement && !iconeSeule && IconeDroite && (
        <IconeDroite size={tailleIcone} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  )
})

export default Button