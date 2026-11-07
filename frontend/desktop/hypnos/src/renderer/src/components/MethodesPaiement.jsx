/* eslint-disable react/prop-types */
// Sélecteur de moyen de paiement. Les logos sont des SVG intégrés : aucun appel réseau,
// l'application reste utilisable hors connexion. Pour de vrais logos officiels, remplacez
// les SVG ci-dessous par des fichiers importés depuis assets/.
import { Banknote } from 'lucide-react'
import injecterStyles from './base/injecterStyles'

const STYLES = `
.methodes { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
.methode { display:flex; align-items:center; gap:8px; min-width:0; padding:7px 9px; border:1px solid var(--color-border); border-radius:var(--radius-s); background:var(--color-surface); color:var(--color-text); font:inherit; font-size:12px; text-align:left; cursor:pointer; }
.methode:hover { border-color:var(--marque); }
.methode[aria-checked='true'] { border-color:var(--marque); box-shadow:0 0 0 2px color-mix(in srgb,var(--marque) 28%,transparent); font-weight:600; }
.methode__logo { display:inline-grid; place-items:center; flex:none; width:42px; height:24px; overflow:hidden; border:1px solid rgba(0,0,0,.1); border-radius:6px; }
.methode__logo svg { display:block; width:100%; height:100%; }
.methode__libelle { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
`
injecterStyles('hypnos-methodes-paiement', STYLES)

const Logo = ({ children, fond }) => (
  <svg viewBox="0 0 42 24" aria-hidden="true" focusable="false">
    <rect width="42" height="24" fill={fond} />
    {children}
  </svg>
)

export const MODES_PAIEMENT = [
  {
    valeur: 'especes',
    libelle: 'Espèces',
    couleur: '#157347',
    logo: (
      <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', background: '#E7F6EC', color: '#157347' }}>
        <Banknote size={15} aria-hidden="true" />
      </span>
    )
  },
  {
    valeur: 'carte',
    libelle: 'Carte',
    couleur: '#1A1F71',
    logo: (
      <Logo fond="#FFFFFF">
        <text x="21" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="900" fontStyle="italic" fill="#1A1F71">VISA</text>
      </Logo>
    )
  },
  {
    valeur: 'mtn_money',
    libelle: 'MTN Money',
    couleur: '#FFCC00',
    logo: (
      <Logo fond="#FFCC00">
        <ellipse cx="21" cy="12" rx="17" ry="9" fill="none" stroke="#000" strokeWidth="1.4" />
        <text x="21" y="15.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="900" fill="#000">MTN</text>
      </Logo>
    )
  },
  {
    valeur: 'airtel_money',
    libelle: 'Airtel Money',
    couleur: '#E40000',
    logo: (
      <Logo fond="#E40000">
        <text x="21" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="800" fill="#FFFFFF">airtel</text>
      </Logo>
    )
  }
]

export default function MethodesPaiement({ valeur, onChange }) {
  return (
    <div className="methodes" role="radiogroup" aria-label="Moyen de paiement">
      {MODES_PAIEMENT.map((m) => (
        <button
          key={m.valeur}
          type="button"
          role="radio"
          aria-checked={valeur === m.valeur}
          className="methode"
          style={{ '--marque': m.couleur }}
          onClick={() => onChange(m.valeur)}
        >
          <span className="methode__logo">{m.logo}</span>
          <span className="methode__libelle">{m.libelle}</span>
        </button>
      ))}
    </div>
  )
}