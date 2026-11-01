/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react'
import { CircleCheck, X } from 'lucide-react'
import Button from './Button'
import injecterStyles from './injecterStyles'

const STYLES = `
.toast-succes {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: min(380px, calc(100vw - 48px));
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--color-success) 35%, var(--color-border));
  border-radius: var(--radius-m);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
  color: var(--color-text);
  animation: toast-succes-entree 0.2s ease;
}
.toast-succes__icone {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
}
.toast-succes__texte {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.toast-succes__titre {
  font-size: 14px;
  font-weight: 600;
}
.toast-succes__message {
  font-size: 13px;
  color: var(--color-text-muted);
}
.toast-succes__titre + .toast-succes__message {
  margin-top: 2px;
}

@keyframes toast-succes-entree {
  from { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .toast-succes { animation: none; }
}
`

injecterStyles('hypnos-success-toast', STYLES)

/**
 * Notification de succès, en bas à droite.
 *  ouvert    affiche ou masque la notification
 *  message   texte principal (ex. « Réservation créée. »)
 *  titre     ligne en gras au-dessus du message (facultatif)
 *  duree     millisecondes avant fermeture automatique (défaut : 4000, 0 = reste affichée)
 *  onFermer  appelé à la fermeture (bouton ou délai écoulé) : mets `ouvert` à false
 */
export default function SuccessToast({ ouvert, message, titre, duree = 4000, onFermer }) {
  const refFermer = useRef(onFermer)

  useEffect(() => {
    refFermer.current = onFermer
  }, [onFermer])

  // Un nouveau message relance le délai
  useEffect(() => {
    if (!ouvert || !duree) return
    const minuteur = setTimeout(() => refFermer.current?.(), duree)
    return () => clearTimeout(minuteur)
  }, [ouvert, duree, message])

  if (!ouvert) return null

  return (
    <div className="toast-succes" role="status" aria-live="polite">
      <span className="toast-succes__icone" aria-hidden="true">
        <CircleCheck size={18} />
      </span>
      <div className="toast-succes__texte">
        {titre && <p className="toast-succes__titre">{titre}</p>}
        <p className="toast-succes__message">{message}</p>
      </div>
      <Button
        variante="fantome"
        taille="s"
        iconeSeule
        icone={X}
        aria-label="Fermer la notification"
        onClick={onFermer}
      />
    </div>
  )
}