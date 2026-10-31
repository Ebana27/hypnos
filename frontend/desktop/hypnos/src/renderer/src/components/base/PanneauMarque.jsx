/* eslint-disable react/prop-types */
import { Feather, Minus, X } from 'lucide-react'
import injecterStyles from './injecterStyles'

const STYLES = `
/* ---------- Disposition commune des écrans d'accès ---------- */
.auth {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--color-surface);
  color: var(--color-text);
}
.auth__principal {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 40px;
  overflow-y: auto;
}
.auth__formulaire {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 420px;
}
.auth__titre {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 600;
  line-height: 1.2;
}
.auth__sous-titre {
  margin: 4px 0 28px;
  font-size: 16px;
  color: var(--color-text-muted);
}
/* Champs et boutons un peu plus grands que dans le reste de l'application */
.auth .champ__boite {
  height: 48px;
  border-radius: 14px;
}
.auth .champ__controle {
  font-size: 16px;
}
.auth .auth__bouton {
  --btn-hauteur: 52px;
  --btn-taille: 18px;
}

/* ---------- Boutons de fenêtre + zone de déplacement ---------- */
.barre-fenetre {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  justify-content: flex-end;
  height: 40px;
  -webkit-app-region: drag;
}
.barre-fenetre button {
  display: grid;
  place-items: center;
  width: 46px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  -webkit-app-region: no-drag;
}
.barre-fenetre button:hover {
  background: var(--color-accent-wash);
  color: var(--color-text);
}
.barre-fenetre--clair button {
  color: var(--color-brand-contrast, var(--white));
}
.barre-fenetre--clair button:hover {
  background: color-mix(in srgb, var(--white) 18%, transparent);
  color: var(--color-brand-contrast, var(--white));
}
.barre-fenetre button:last-child:hover {
  background: var(--color-danger);
  color: var(--white);
}

/* ---------- Panneau de marque ---------- */
.marque {
  position: relative;
  display: flex;
  flex: 0 0 46%;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
  padding: 48px 52px 56px;
  overflow: hidden;
  background: var(--color-brand, var(--medium-blue));
  color: var(--color-brand-contrast, var(--white));
}
.marque--plein {
  flex: 1;
  padding: 48px 64px 56px;
}
.marque--compact {
  padding: 36px 44px 40px;
}
.marque__cercle {
  position: absolute;
  aspect-ratio: 1;
  border-radius: 50%;
  pointer-events: none;
}
.marque__cercle--bas {
  left: -58%;
  top: 54%;
  width: 143%;
  background: color-mix(in srgb, var(--soft-periwinkle) 38%, transparent);
}
.marque__cercle--haut {
  left: 36%;
  top: -21%;
  width: 101%;
  background: color-mix(in srgb, var(--white) 10%, transparent);
}
.marque__haut,
.marque__centre,
.marque__texte,
.marque__pied {
  position: relative;
  z-index: 1;
}
.marque__haut {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.marque__logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.marque__icone {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--color-brand-contrast, var(--white));
  color: var(--color-brand, var(--medium-blue));
}
.marque__nom {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
  line-height: 1;
}
.marque__centre {
  display: grid;
  flex: 1;
  min-height: 0;
  place-items: center;
}
.marque__texte {
  animation: marque-entree 0.35s ease both;
}
.marque__texte h2 {
  margin-bottom: 16px;
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 600;
  line-height: 1.12;
}
.marque__texte p {
  max-width: 420px;
  font-size: 17px;
  line-height: 1.5;
  opacity: 0.9;
}
.marque--plein .marque__texte h2 {
  font-size: 56px;
}
.marque--plein .marque__texte p {
  max-width: 520px;
  font-size: 20px;
}
.marque--compact .marque__texte h2 {
  margin-bottom: 10px;
  font-size: 32px;
}
.marque--compact .marque__texte p {
  font-size: 15px;
}
.marque__pied {
  margin-top: 8px;
}

@keyframes marque-entree {
  from { opacity: 0; transform: translateY(10px); }
}
@media (prefers-reduced-motion: reduce) {
  .marque__texte { animation: none; }
}
`

injecterStyles('hypnos-panneau-marque', STYLES)

// Boutons réduire / fermer pour les fenêtres sans cadre (clair = sur fond bleu)
export function BarreFenetre({ clair = false }) {
  return (
    <div className={`barre-fenetre${clair ? ' barre-fenetre--clair' : ''}`}>
      <button
        type="button"
        aria-label="Réduire"
        title="Réduire"
        onClick={() => window.windowControls.minimize()}
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        aria-label="Fermer"
        title="Fermer"
        onClick={() => window.windowControls.close()}
      >
        <X size={16} />
      </button>
    </div>
  )
}

/**
 * Props :
 *  titre, texte   message affiché en bas du panneau
 *  children       contenu central (ex. aperçu du bâtiment)
 *  coin           contenu en haut à droite (ex. compteur de diapositive)
 *  pied           contenu sous le texte (ex. barre de progression et boutons)
 *  pleinEcran     le panneau occupe toute la fenêtre (présentation)
 *  compact        textes et marges réduits
 *  cleAnimation   change à chaque diapositive pour rejouer l'animation du texte
 */
export default function PanneauMarque({
  titre,
  texte,
  children,
  coin,
  pied,
  pleinEcran = false,
  compact = false,
  cleAnimation
}) {
  const classes = ['marque', pleinEcran && 'marque--plein', compact && 'marque--compact']
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={classes}>
      <span className="marque__cercle marque__cercle--bas" aria-hidden="true" />
      <span className="marque__cercle marque__cercle--haut" aria-hidden="true" />

      <div className="marque__haut">
        <div className="marque__logo">
          <span className="marque__icone">
            <Feather size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="marque__nom">Hypnos</span>
        </div>
        {coin}
      </div>

      {children && <div className="marque__centre">{children}</div>}

      <div className="marque__texte" key={cleAnimation}>
        <h2>{titre}</h2>
        {texte && <p>{texte}</p>}
      </div>

      {pied && <div className="marque__pied">{pied}</div>}
    </aside>
  )
}