import { useEffect, useState } from 'react'
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
  PanelLeftOpen
} from 'lucide-react'

const LIENS = [
  { vers: '/', libelle: 'Accueil', Icone: House },
  { vers: '/booking', libelle: 'Réservations', Icone: Calendar },
  { vers: '/rooms', libelle: 'Chambres', Icone: BedDouble },
  { vers: '/clients', libelle: 'Clients', Icone: User },
  { vers: '/communication', libelle: 'Communication', Icone: MessageSquare },
  { vers: '/services', libelle: 'Services', Icone: ConciergeBell },
  { vers: '/accounting', libelle: 'Comptabilité', Icone: Calculator },
  { vers: '/rapports', libelle: 'Rapports', Icone: TrendingUp }
]

const NOM_HOTEL = 'Hôtel Le Céleste'
const ETAT_SYSTEME = 'Système opérationnel'

// Clé de mémorisation de l'état réduit / déployé
const CLE_STOCKAGE = 'hypnos.sidebar.reduite'

function lireEtatInitial() {
  try {
    return localStorage.getItem(CLE_STOCKAGE) === '1'
  } catch {
    return false
  }
}

// ============================================================
//  STYLE (intégré au composant)
//  Couleurs : uniquement les jetons de base.css.
// ============================================================
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

/* ---------- Bouton de bascule ---------- */
.sidebar__bascule {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.sidebar--reduite .sidebar__bascule {
  justify-content: center;
}
.bascule {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.bascule:hover {
  background: var(--color-accent-wash);
  color: var(--color-accent);
}

/* ---------- Navigation ---------- */
.sidebar__nav {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
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

/* Textes : se replient en douceur quand la sidebar est réduite */
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

/* Initiale affichée à la place du texte quand la sidebar est réduite */
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
  justify-content: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-accent);
  border-radius: 12px;
  color: var(--color-accent);
  text-decoration: none;
  transition: gap var(--sidebar-duree) ease;
}
.parametres span {
  font-size: 12pt;
}
.parametres svg {
  flex-shrink: 0;
}

/* ---------- Bulle d'info (sidebar réduite uniquement) ---------- */
.sidebar--reduite [data-label] {
  position: relative;
}
.sidebar--reduite [data-label]:hover::after,
.sidebar--reduite [data-label]:focus-visible::after {
  content: attr(data-label);
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-s);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
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

  // Mémorise le choix d'un lancement à l'autre
  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, reduite ? '1' : '0')
    } catch {
      // Stockage indisponible : le choix ne sera simplement pas conservé.
    }
  }, [reduite])

  // Raccourci Ctrl+B (⌘+B sur Mac), ignoré pendant la saisie de texte
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
            {reduite ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <nav className="sidebar__nav">
          {LIENS.map(({ vers, libelle, Icone }) => (
            <NavLink
              key={vers}
              to={vers}
              end={vers === '/'}
              data-label={libelle}
              aria-label={libelle}
              className={({ isActive }) => `navlien${isActive ? ' navlien--actif' : ''}`}
            >
              <Icone strokeWidth={1.8} />
              <span>{libelle}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar__pied">
        <div className="hotel" data-label={`${NOM_HOTEL} · ${ETAT_SYSTEME}`}>
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

        <Link to="/param" className="parametres" data-label="Paramètres" aria-label="Paramètres">
          <Settings strokeWidth={1.6} />
          <span>Paramètres</span>
        </Link>
      </div>
    </aside>
  )
}