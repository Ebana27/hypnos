/* eslint-disable react/prop-types */
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from './Button'
import injecterStyles from './injecterStyles'

const STYLES = `
.modal-fond {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--hypnos-black) 55%, transparent);
  animation: modal-fondu 0.15s ease;
}
.modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  max-height: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
  color: var(--color-text);
  outline: none;
  animation: modal-entree 0.18s ease;
}
.modal--s { max-width: 360px; }
.modal--l { max-width: 600px; }

.modal__form {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.modal__entete {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px 0;
}
.modal__titre {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}
.modal__description {
  margin-top: 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}
.modal__corps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 24px;
  overflow-y: auto;
}
.modal__pied {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 8px 24px 20px;
}

@keyframes modal-fondu {
  from { opacity: 0; }
}
@keyframes modal-entree {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
}
@media (prefers-reduced-motion: reduce) {
  .modal-fond, .modal { animation: none; }
}
`

injecterStyles('hypnos-modal', STYLES)

const FOCALISABLES =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Props :
 *  ouvert, onFermer
 *  titre, description
 *  taille              's' | 'm' | 'l' (défaut : 'm')
 *  children            contenu (champs de formulaire, texte…)
 *  onValider           si présent : formulaire + boutons « Annuler » / « Valider »
 *  libelleValider      défaut : « Valider »
 *  libelleAnnuler      défaut : « Annuler »
 *  chargement          désactive les boutons et affiche un indicateur sur « Valider »
 *  danger              bouton de validation rouge (suppression…)
 *  pied                remplace les boutons par défaut par ton propre contenu
 *  fermerAuClicFond    défaut : true
 */
export default function Modal({
  ouvert,
  onFermer,
  titre,
  description,
  taille = 'm',
  children,
  onValider,
  libelleValider = 'Valider',
  libelleAnnuler = 'Annuler',
  chargement = false,
  danger = false,
  pied,
  fermerAuClicFond = true
}) {
  const idTitre = useId()
  const refBoite = useRef(null)
  const refFermer = useRef(onFermer)

  useEffect(() => {
    refFermer.current = onFermer
  }, [onFermer])

  // Focus à l'ouverture, piège à focus, fermeture avec Échap
  useEffect(() => {
    if (!ouvert) return
    const boite = refBoite.current
    if (!boite) return

    const precedent = document.activeElement
    const corps = boite.querySelector('.modal__corps')
    ;(corps?.querySelector(FOCALISABLES) ?? boite).focus()

    const surTouche = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        refFermer.current?.()
        return
      }
      if (e.key !== 'Tab') return

      const liste = [...boite.querySelectorAll(FOCALISABLES)]
      if (liste.length === 0) {
        e.preventDefault()
        return
      }
      const premier = liste[0]
      const dernier = liste[liste.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }

    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
      precedent?.focus?.()
    }
  }, [ouvert])

  if (!ouvert) return null

  const piedParDefaut = onValider && (
    <>
      <Button variante="secondaire" onClick={onFermer} disabled={chargement}>
        {libelleAnnuler}
      </Button>
      <Button type="submit" variante={danger ? 'danger' : 'principal'} chargement={chargement}>
        {libelleValider}
      </Button>
    </>
  )
  const contenuPied = pied ?? piedParDefaut

  const corps = (
    <>
      <div className="modal__corps">{children}</div>
      {contenuPied && <div className="modal__pied">{contenuPied}</div>}
    </>
  )

  return createPortal(
    <div
      className="modal-fond"
      // mouseDown (et non click) : une sélection de texte qui finit hors de la boîte ne ferme pas la modale
      onMouseDown={(e) => {
        if (fermerAuClicFond && e.target === e.currentTarget) onFermer?.()
      }}
    >
      <div
        ref={refBoite}
        className={`modal modal--${taille}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
      >
        <div className="modal__entete">
          <div>
            <h2 className="modal__titre" id={idTitre}>
              {titre}
            </h2>
            {description && <p className="modal__description">{description}</p>}
          </div>
          <Button
            variante="fantome"
            taille="s"
            iconeSeule
            icone={X}
            aria-label="Fermer"
            onClick={onFermer}
          />
        </div>

        {onValider ? (
          <form
            className="modal__form"
            onSubmit={(e) => {
              e.preventDefault()
              onValider()
            }}
          >
            {corps}
          </form>
        ) : (
          corps
        )}
      </div>
    </div>,
    document.body
  )
}