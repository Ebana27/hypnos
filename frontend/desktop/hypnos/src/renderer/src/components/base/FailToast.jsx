/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react'
import { CircleX, X } from 'lucide-react'
import Button from './Button'
import injecterStyles from './injecterStyles'

const STYLES = `
.toast-echec {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: min(380px, calc(100vw - 48px));
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  border-radius: var(--radius-m);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
  color: var(--color-text);
  animation: toast-echec-entree 0.2s ease;
}
.toast-echec__icone {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger);
}
.toast-echec__texte {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.toast-echec__titre {
  font-size: 14px;
  font-weight: 600;
}
.toast-echec__message {
  font-size: 13px;
  color: var(--color-text-muted);
}
.toast-echec__titre + .toast-echec__message {
  margin-top: 2px;
}

@keyframes toast-echec-entree {
  from { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .toast-echec { animation: none; }
}
`

injecterStyles('hypnos-fail-toast', STYLES)

/**
 * Notification d'erreur, en bas à droite. Les erreurs restent plus longtemps que les succès.
 *  ouvert    affiche ou masque la notification
 *  message   texte principal (ex. le message en français renvoyé par la base locale)
 *  titre     ligne en gras au-dessus du message (facultatif)
 *  duree     millisecondes avant fermeture automatique (défaut : 6000, 0 = reste affichée)
 *  onFermer  appelé à la fermeture (bouton ou délai écoulé) : mets `ouvert` à false
 */
export default function FailToast({ ouvert, message, titre, duree = 6000, onFermer }) {
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
    <div className="toast-echec" role="alert" aria-live="assertive">
      <span className="toast-echec__icone" aria-hidden="true">
        <CircleX size={18} />
      </span>
      <div className="toast-echec__texte">
        {titre && <p className="toast-echec__titre">{titre}</p>}
        <p className="toast-echec__message">{message}</p>
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