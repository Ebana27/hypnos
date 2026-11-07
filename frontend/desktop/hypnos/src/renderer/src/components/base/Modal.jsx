import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from './Button'
import injecterStyles from './injecterStyles'

const STYLES = `
.modal-fond {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: clamp(10px, 2vw, 24px);
  overflow-y: auto;
  background: color-mix(in srgb, var(--hypnos-black) 55%, transparent);
  animation: modal-fondu 0.15s ease;
}
.modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  max-height: calc(100vh - 48px);
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
  color: var(--color-text);
  outline: none;
  animation: modal-entree 0.18s ease;
}
.modal--s { max-width: 360px; }
.modal--m { max-width: 440px; }
.modal--l { max-width: 600px; }
.modal--xl { max-width: min(1160px, calc(100vw - 48px)); }

.modal__form {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.modal__entete {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px 0;
}
.modal__titre {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}
.modal__description {
  margin: 4px 0 0;
  font-family: var(--font-ui, 'Inter', sans-serif);
  font-size: 13px;
  color: var(--color-text-muted);
}
.modal__corps {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 16px 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.modal--xl .modal__corps { padding: 14px 18px 18px; }
.modal__pied {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 8px 24px 20px;
}
.modal--xl .modal__pied { padding-right: 18px; padding-left: 18px; }

@keyframes modal-fondu {
  from { opacity: 0; }
}
@keyframes modal-entree {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
}
@media (max-width: 700px) {
  .modal-fond { place-items: end center; padding: 8px; }
  .modal { max-height: calc(100vh - 16px); border-radius: var(--radius-m); }
  .modal--xl { max-width: 100%; }
  .modal__entete { padding: 16px 16px 0; }
  .modal__corps { padding: 14px 16px; }
  .modal--xl .modal__corps { padding: 12px; }
  .modal__pied, .modal--xl .modal__pied { padding: 8px 16px 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .modal-fond, .modal { animation: none; }
}
`

injecterStyles('hypnos-modal', STYLES)

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function Modal({
  ouvert = false,
  onFermer,
  titre,
  description,
  taille = 'm',
  children,
  pied,
  libelleValider = 'Enregistrer',
  libelleAnnuler = 'Annuler',
  onValider,
  chargement = false,
  fermerAuClicFond = true,
  fermerAvecEchap = true
}) {
  const refBoite = useRef(null)
  const idTitre = useId()
  const idDescription = useId()

  // CORRECTIF : la page parente crée une nouvelle fonction `onFermer` à chaque frappe.
  // Avant, l'effet ci-dessous dépendait de `onFermer` : il se relançait donc à chaque lettre tapée
  // et remettait le focus sur la première chose focalisable, la croix. Désormais on garde la
  // dernière version dans une référence, et l'effet ne dépend plus que de `ouvert`.
  const refFermer = useRef(onFermer)
  const refEchap = useRef(fermerAvecEchap)
  useEffect(() => {
    refFermer.current = onFermer
    refEchap.current = fermerAvecEchap
  })

  useEffect(() => {
    if (!ouvert || typeof document === 'undefined') return undefined

    const actifPrecedent = document.activeElement
    const overflowPrecedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const boite = refBoite.current
    // Focus initial : le premier champ du contenu ; la croix seulement s'il n'y en a pas
    const premier =
      boite?.querySelector(`.modal__corps :is(${FOCUSABLE})`) || boite?.querySelector(FOCUSABLE)
    ;(premier || boite)?.focus()

    function gererClavier(event) {
      if (event.key === 'Escape' && refEchap.current) {
        event.stopPropagation()
        refFermer.current?.()
        return
      }
      if (event.key !== 'Tab' || !boite) return

      const elements = [...boite.querySelectorAll(FOCUSABLE)]
      if (!elements.length) {
        event.preventDefault()
        boite.focus()
        return
      }
      const premierElement = elements[0]
      const dernierElement = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === premierElement) {
        event.preventDefault()
        dernierElement.focus()
      } else if (!event.shiftKey && document.activeElement === dernierElement) {
        event.preventDefault()
        premierElement.focus()
      }
    }

    document.addEventListener('keydown', gererClavier)
    return () => {
      document.removeEventListener('keydown', gererClavier)
      document.body.style.overflow = overflowPrecedent
      if (actifPrecedent && typeof actifPrecedent.focus === 'function') actifPrecedent.focus()
    }
  }, [ouvert])

  if (!ouvert || typeof document === 'undefined') return null

  const contenu = (
    <div
      className="modal-fond"
      onMouseDown={(event) => {
        if (fermerAuClicFond && event.target === event.currentTarget) onFermer?.()
      }}
    >
      <div
        ref={refBoite}
        className={`modal modal--${['s', 'm', 'l', 'xl'].includes(taille) ? taille : 'm'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        aria-describedby={description ? idDescription : undefined}
        tabIndex={-1}
      >
        <div className="modal__entete">
          <div>
            <h2 className="modal__titre" id={idTitre}>{titre}</h2>
            {description && <p className="modal__description" id={idDescription}>{description}</p>}
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
            onSubmit={(event) => {
              event.preventDefault()
              if (!chargement) onValider()
            }}
          >
            <div className="modal__corps">{children}</div>
            {pied != null ? (
              <div className="modal__pied">{pied}</div>
            ) : (
              <div className="modal__pied">
                <Button variante="secondaire" type="button" disabled={chargement} onClick={onFermer}>
                  {libelleAnnuler}
                </Button>
                <Button type="submit" chargement={chargement} disabled={chargement}>
                  {libelleValider}
                </Button>
              </div>
            )}
          </form>
        ) : (
          <>
            <div className="modal__corps">{children}</div>
            {pied != null && <div className="modal__pied">{pied}</div>}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(contenu, document.body)
}