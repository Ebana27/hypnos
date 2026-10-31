import { useEffect, useRef, useState } from 'react'
import { Search, Bell, X } from 'lucide-react'

// À remplacer par les données réelles quand les notifications seront branchées.
const UTILISATEUR = { notifications: 0, nom: 'Ebana Plamedi', role: 'Administrateur' }

function libelleNotifications(nombre) {
  if (nombre === 0) return 'Aucune notification'
  return `${nombre} notification${nombre > 1 ? 's' : ''}`
}

// ============================================================
//  STYLE (design d'origine + panneau de notifications)
// ============================================================
const STYLES = `
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  width: 100%;
  margin-top: 24px;
  padding: 10px 20px 16px 0;
}

/* ---------- Recherche ---------- */
.topbar__search {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;
  max-width: 460px;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
}
.topbar__search:focus-within { border-color: var(--color-accent); }
.topbar__search input {
  width: 100%;
  border: none;
  outline: none;
  background: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--color-text);
}
.topbar__search input::placeholder { color: var(--color-text-faint); }

/* ---------- Zone de droite ---------- */
.topbar__droite {
  display: flex;
  align-items: center;
  gap: 14px;
}
.topbar__notif-conteneur { position: relative; }
.topbar__notif {
  position: relative;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.topbar__notif:hover,
.topbar__notif[aria-expanded='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-wash);
  color: var(--color-accent);
}
.topbar__pastille {
  position: absolute;
  top: -4px;
  right: -4px;
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: 10px;
  font-weight: 700;
}

/* ---------- Panneau flottant ---------- */
.topbar__notifications {
  position: absolute;
  top: calc(100% + 12px);
  right: -8px;
  z-index: 4000;
  width: min(360px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--color-shadow);
  animation: topbar-notifications-entree 0.16s ease-out;
}
.topbar__notifications-entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 16px;
  border-bottom: 1px solid var(--color-border);
}
.topbar__notifications-titre {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
}
.topbar__notifications-fermer {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.topbar__notifications-fermer:hover {
  background: var(--color-background-soft);
  color: var(--color-text);
}
.topbar__notifications-vide {
  padding: 24px 20px 26px;
  text-align: center;
}
.topbar__notifications-icone {
  display: grid;
  width: 40px;
  height: 40px;
  margin: 0 auto 10px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-accent-wash);
  color: var(--color-accent);
}
.topbar__notifications-vide strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.topbar__notifications-vide p {
  margin-top: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}
@keyframes topbar-notifications-entree {
  from { opacity: 0; transform: translateY(-4px); }
}

/* ---------- Profil ---------- */
.topbar__profil {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}
.topbar__avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-background-mute);
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 700;
}
.topbar__infos { display: flex; flex-direction: column; line-height: 1.1; }
.topbar__nom { font-size: 13px; font-weight: 600; color: var(--color-text); }
.topbar__role { font-size: 11px; color: var(--color-text-muted); }

@media (max-width: 600px) {
  .topbar { gap: 10px; }
  .topbar__profil { gap: 6px; padding-right: 7px; }
  .topbar__nom { max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
@media (prefers-reduced-motion: reduce) {
  .topbar__notif, .topbar__notifications { transition: none; animation: none; }
}
`

export default function Topbar() {
  const { notifications, nom, role } = UTILISATEUR
  const [ouvert, setOuvert] = useState(false)
  const conteneurRef = useRef(null)

  useEffect(() => {
    if (!ouvert) return undefined
    const fermerExterieur = (event) => {
      if (!conteneurRef.current?.contains(event.target)) setOuvert(false)
    }
    const fermerEchap = (event) => {
      if (event.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('pointerdown', fermerExterieur)
    document.addEventListener('keydown', fermerEchap)
    return () => {
      document.removeEventListener('pointerdown', fermerExterieur)
      document.removeEventListener('keydown', fermerEchap)
    }
  }, [ouvert])

  return (
    <div className="topbar">
      <style>{STYLES}</style>

      <label className="topbar__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder="Rechercher un client, une chambre, une réservation…"
          aria-label="Rechercher un client, une chambre, une réservation"
        />
      </label>

      <div className="topbar__droite">
        <div className="topbar__notif-conteneur" ref={conteneurRef}>
          <button
            type="button"
            className="topbar__notif"
            aria-label={libelleNotifications(notifications)}
            aria-expanded={ouvert}
            aria-controls="panneau-notifications"
            aria-haspopup="dialog"
            onClick={() => setOuvert((valeur) => !valeur)}
          >
            <Bell size={18} strokeWidth={1.8} />
            {notifications > 0 && (
              <span className="topbar__pastille">{notifications > 99 ? '99+' : notifications}</span>
            )}
          </button>

          {ouvert && (
            <section
              className="topbar__notifications"
              id="panneau-notifications"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="topbar__notifications-entete">
                <h2 className="topbar__notifications-titre">Notifications</h2>
                <button
                  type="button"
                  className="topbar__notifications-fermer"
                  aria-label="Fermer les notifications"
                  onClick={() => setOuvert(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="topbar__notifications-vide">
                <span className="topbar__notifications-icone" aria-hidden="true"><Bell size={18} /></span>
                <strong>Aucune notification pour le moment</strong>
                <p>Les alertes de réservation et de séjour apparaîtront ici lorsqu’elles seront activées.</p>
              </div>
            </section>
          )}
        </div>

        <div className="topbar__profil">
          <span className="topbar__avatar" aria-hidden="true">{nom.charAt(0)}</span>
          <div className="topbar__infos">
            <span className="topbar__nom">{nom}</span>
            <span className="topbar__role">{role}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
