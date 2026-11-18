import { useEffect, useRef, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  House,
  Calendar,
  BedDouble,
  User,
  MessageSquare,
  ConciergeBell,
  Calculator,
  TrendingUp,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight
} from 'lucide-react'

const LIENS = [
  {
    vers: '/',
    libelle: 'Accueil',
    description: 'Tableau de bord et indicateurs clés.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#accueil',
    Icone: House
  },
  {
    vers: '/booking',
    libelle: 'Réservations',
    description: 'Gestion des séjours et plannings.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#reservations',
    Icone: Calendar
  },
  {
    vers: '/rooms',
    libelle: 'Chambres',
    description: 'État des chambres et attributions.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#chambres',
    Icone: BedDouble
  },
  {
    vers: '/clients',
    libelle: 'Clients',
    description: 'Fichiers clients et historiques.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#clients',
    Icone: User
  },
  {
    vers: '/communication',
    libelle: 'Communication',
    description: 'Messages entrants et demandes de réservation.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#communication',
    Icone: MessageSquare
  },
  {
    vers: '/services',
    libelle: 'Services',
    description: 'Prestations et services additionnels.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#services',
    Icone: ConciergeBell
  },
  {
    vers: '/accounting',
    libelle: 'Comptabilité',
    description: 'Factures, paiements et encaissements.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#comptabilite',
    Icone: Calculator
  },
  {
    vers: '/rapports',
    libelle: 'Rapports',
    description: 'Statistiques et analyses de performance.',
    tuto: 'https://hypnos-hypnos.vercel.app/guide/#rapports',
    Icone: TrendingUp
  }
]

const NOM_HOTEL = 'Hôtel Le Céleste'
const ETAT_SYSTEME = 'Système opérationnel'

const CLE_STOCKAGE = 'hypnos.sidebar.reduite'
const DELAI_SURVOL_MS = 400 // Temps d'attente avant affichage du badge (400ms)

function lireEtatInitial() {
  try {
    return localStorage.getItem(CLE_STOCKAGE) === '1'
  } catch {
    return false
  }
}

const STYLES = `
.sidebar {
  --sidebar-largeur: 230px;
  --sidebar-duree: 0.2s;

  margin-top: 50px;
  width: var(--sidebar-largeur);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: calc(100vh - 82px);
  padding: 10px;
  transition: width var(--sidebar-duree) ease;
}
.sidebar--reduite {
  --sidebar-largeur: 76px;
}

/* ---------- Bouton de bascule discret ---------- */
.sidebar__bascule {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
  padding-right: 4px;
}
.sidebar--reduite .sidebar__bascule {
  justify-content: center;
  padding-right: 0;
}
.bascule {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-faint);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.bascule:hover {
  background: var(--color-background-soft);
  color: var(--color-text);
}

/* ---------- Navigation ---------- */
.sidebar__nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.sidebar__item-wrapper {
  position: relative;
  width: 100%;
}

.navlien {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: gap var(--sidebar-duree) ease;
}
.navlien svg {
  flex-shrink: 0;
}
.navlien--actif,
.navlien:hover {
  background-color: var(--color-accent-wash);
  border-radius: 50px;
  color: var(--color-accent);
}

.navlien span,
.parametres span,
.hotel__texte {
  max-width: 170px;
  overflow: hidden;
  white-space: nowrap;
  transition:
    max-width var(--sidebar-duree) ease,
    opacity 0.15s ease;
}
.sidebar--reduite .navlien span,
.sidebar--reduite .parametres span,
.sidebar--reduite .hotel__texte {
  max-width: 0;
  opacity: 0;
}
.sidebar--reduite .navlien,
.sidebar--reduite .parametres {
  gap: 0;
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}

/* ---------- Pied : hôtel + paramètres ---------- */
.hotel {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: var(--radius-s);
  background: var(--color-background-soft);
}
.hotel__texte {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hotel__nom {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  color: var(--color-text);
}
.hotel__etat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.hotel__point {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-success);
}

.hotel__initiale {
  display: none;
  position: relative;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent-wash);
  color: var(--color-accent);
  font-weight: 600;
}
.hotel__initiale::after {
  content: '';
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--color-background-soft);
  background: var(--color-success);
}
.sidebar--reduite .hotel {
  justify-content: center;
  gap: 0;
  padding: 10px 0;
}
.sidebar--reduite .hotel__initiale {
  display: grid;
}

.parametres {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--color-background-soft);
  color: var(--color-text);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
}
.parametres:hover {
  background-color: var(--color-accent-wash);
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.parametres svg {
  flex-shrink: 0;
}
.sidebar--reduite .parametres {
  padding: 10px 0;
  justify-content: center;
  border: none;
  background: transparent;
}
.sidebar--reduite .parametres:hover {
  background: var(--color-accent-wash);
  color: var(--color-accent);
}

/* ---------- Infobulle riche (Affichage après temporisation) ---------- */
.sidebar-infobulle {
  position: absolute;
  left: calc(100% + 14px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  width: 232px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--color-shadow);
  pointer-events: auto;
  animation: fadeInTooltip 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInTooltip {
  from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
  to { opacity: 1; transform: translateY(-50%) translateX(0); }
}

.sidebar-infobulle::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: transparent var(--color-surface) transparent transparent;
}

.infobulle__titre {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}

.infobulle__separateur {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 10px 0;
}

.infobulle__desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.infobulle__lien {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--color-accent-wash);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.infobulle__lien:hover {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .navlien,
  .parametres,
  .navlien span,
  .parametres span,
  .hotel__texte {
    transition: none;
  }
}
`

export default function Sidebar() {
  const [reduite, setReduite] = useState(lireEtatInitial)
  const [elementSurvole, setElementSurvole] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, reduite ? '1' : '0')
    } catch {
      // Stockage indisponible
    }
  }, [reduite])

  useEffect(() => {
    const surTouche = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b') return
      const cible = e.target
      const enSaisie =
        cible instanceof HTMLElement &&
        (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))
      if (enSaisie) return
      e.preventDefault()
      setReduite((etat) => !etat)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  // Gestion du survol avec délai
  const surEntreeSouris = (item) => {
    if (!reduite) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setElementSurvole(item)
    }, DELAI_SURVOL_MS)
  }

  const surSortieSouris = () => {
    clearTimeout(timerRef.current)
    setElementSurvole(null)
  }

  const libelleBascule = reduite ? 'Déployer le menu' : 'Réduire le menu'

  return (
    <aside className={`sidebar${reduite ? ' sidebar--reduite' : ''}`}>
      <style>{STYLES}</style>

      <div className="sidebar__haut">
        <div className="sidebar__bascule">
          <button
            type="button"
            className="bascule"
            onClick={() => setReduite((etat) => !etat)}
            aria-label={libelleBascule}
            aria-expanded={!reduite}
            title={`${libelleBascule} (Ctrl+B)`}
          >
            {reduite ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className="sidebar__nav">
          {LIENS.map((item) => {
            const { vers, libelle, description, tuto, Icone } = item
            return (
              <div
                key={vers}
                className="sidebar__item-wrapper"
                onMouseEnter={() => surEntreeSouris(item)}
                onMouseLeave={surSortieSouris}
              >
                <NavLink
                  to={vers}
                  end={vers === '/'}
                  aria-label={libelle}
                  className={({ isActive }) => `navlien${isActive ? ' navlien--actif' : ''}`}
                >
                  <Icone strokeWidth={1.8} />
                  <span>{libelle}</span>
                </NavLink>

                {reduite && elementSurvole?.vers === vers && (
                  <div className="sidebar-infobulle">
                    <div className="infobulle__titre">{libelle}</div>
                    <hr className="infobulle__separateur" />
                    <p className="infobulle__desc">{description}</p>
                    <a href={tuto} target="_blank" rel="noreferrer" className="infobulle__lien">
                      <span>Guide utilisateur</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <div className="sidebar__pied">
        <div className="hotel">
          <span className="hotel__initiale" aria-hidden="true">
            {NOM_HOTEL.charAt(0)}
          </span>
          <div className="hotel__texte">
            <p className="hotel__nom">{NOM_HOTEL}</p>
            <p className="hotel__etat">
              <span className="hotel__point" />
              {ETAT_SYSTEME}
            </p>
          </div>
        </div>

        <Link to="/param" className="parametres" aria-label="Paramètres">
          <Settings strokeWidth={1.6} />
          <span>Paramètres</span>
        </Link>
      </div>
    </aside>
  )
}
