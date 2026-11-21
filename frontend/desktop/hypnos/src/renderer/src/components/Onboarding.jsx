/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { BarreFenetre } from './base/PanneauMarque'
import injecterStyles from './base/injecterStyles'
import logotype from '../assets/images/logotype_white.png'

const DIAPOSITIVES = [
  {
    titre: ['Votre hôtel,', 'sous contrôle.'],
    texte: 'Réservations, chambres et clients réunis dans un seul logiciel pensé pour la réception.'
  },
  {
    titre: ['De l’arrivée', 'au départ.'],
    texte: 'Suivez chaque séjour et l’état de vos chambres en temps réel, sans papier.'
  },
  {
    titre: ['Reprenez vos', 'données Excel.'],
    texte: 'Importez vos réservations, chambres et clients existants en quelques secondes.'
  }
]
const DERNIERE = DIAPOSITIVES.length - 1

const DUREE_SORTIE = 320 // ms : le bloc de texte s'efface avant le changement de diapositive
const DUREE_FIN = 700 // ms : sortie générale quand on quitte la présentation

const clamp = (x, min, max) => Math.min(max, Math.max(min, x))
const mouvementReduit = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// ---------- Fond : formes et dégradés de la maquette (viewBox 1512 x 982) ----------
// Les trois formes existent en permanence. Celle de la diapositive active est en place ;
// les précédentes sont sorties vers le haut gauche, les suivantes attendent en bas à droite.
function Fond({ actif }) {
  const etat = (i) => (i === actif ? 'actif' : i < actif ? 'passe' : 'futur')

  return (
    <svg className="onb__fond" viewBox="0 0 1512 982" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="onb-g0" gradientUnits="userSpaceOnUse" x1="441.447" y1="525.061" x2="933.58" y2="-3.906">
          <stop offset="0" stopColor="#0727E6" />
          <stop offset="1" stopColor="#6038FF" />
        </linearGradient>
        <linearGradient id="onb-g1" gradientUnits="userSpaceOnUse" x1="0" y1="691.15" x2="1632.9" y2="691.15">
          <stop offset="0" stopColor="#0727E6" />
          <stop offset="0.98" stopColor="#6E38FF" />
        </linearGradient>
        <linearGradient id="onb-g2a" gradientUnits="userSpaceOnUse" x1="0" y1="382.98" x2="765.96" y2="382.98">
          <stop offset="0" stopColor="#5C6CFF" stopOpacity="0.898" />
          <stop offset="1" stopColor="#0727E6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="onb-g2b" gradientUnits="userSpaceOnUse" x1="0" y1="775.15" x2="1795.9" y2="775.15">
          <stop offset="0" stopColor="#0727E6" stopOpacity="0" />
          <stop offset="1" stopColor="#6229FF" />
        </linearGradient>
      </defs>

      <rect width="1512" height="982" fill="#0727E6" />

      <g className={`onb__forme onb__forme--${etat(0)}`}>
        <path
          d="M84.22998 685.9986C37.71106 307.13202 362.81274 -44.547791 810.36481 -99.500275C1257.9169 -154.45274 1658.4407 108.13147 1704.9596 486.99805C1751.4786 865.86469 1426.377 1217.5444 978.82483 1272.4968C531.27271 1327.4495 130.74902 1064.8652 84.22998 685.9986Z"
          fill="url(#onb-g0)"
          fillOpacity="0.65"
          transform="matrix(-0.993 -0.122 -0.122 0.993 1682.146 352.652)"
        />
      </g>

      <g className={`onb__forme onb__forme--${etat(1)}`}>
        <ellipse
          cx="816.45"
          cy="691.15"
          rx="816.45"
          ry="691.15"
          fill="url(#onb-g1)"
          fillOpacity="0.65"
          transform="translate(21.1 248)"
        />
      </g>

      <g className={`onb__forme onb__forme--decalee onb__forme--${etat(2)}`}>
        <circle
          cx="382.98"
          cy="382.98"
          r="382.98"
          fill="url(#onb-g2a)"
          transform="matrix(0.588 0.809 -0.809 0.588 1440.607 446.872)"
        />
        <ellipse
          cx="897.95"
          cy="775.15"
          rx="897.95"
          ry="775.15"
          fill="url(#onb-g2b)"
          transform="translate(-441.9 -821)"
        />
      </g>
    </svg>
  )
}

// Toutes les mesures viennent de la maquette (1512 x 982) et sont multipliées par --u.
const STYLES = `
.onb {
  --onb-bleu: #0727E6;
  --onb-piste: #D56BFF;
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--onb-bleu);
  color: #fff;
  container-type: size;
}
.onb__fond {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Formes : entrée et sortie */
.onb__forme {
  transform-box: view-box;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}
.onb__forme--actif {
  opacity: 1;
  transform: none;
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.25, 1), opacity 0.9s ease 0.15s;
}
.onb__forme--passe {
  opacity: 0;
  transform: translate(-260px, -140px) scale(1.12) rotate(-6deg);
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.25, 1), opacity 0.6s ease;
}
.onb__forme--futur {
  opacity: 0;
  transform: translate(260px, 160px) scale(0.88) rotate(6deg);
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.25, 1), opacity 0.6s ease;
}
.onb__forme--decalee.onb__forme--actif {
  transition-delay: 0.1s, 0.25s;
}

.onb__scene {
  --u: min(0.06614cqw, 0.10183cqh);
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(1512 * var(--u));
  height: calc(982 * var(--u));
  transform: translate(-50%, -50%);
  transition: opacity 0.55s ease;
}
.onb--fin .onb__scene {
  opacity: 0;
}
.onb__logo {
  position: absolute;
  left: calc(100 * var(--u));
  top: calc(66 * var(--u));
  height: calc(44 * var(--u));
  width: auto;
}
.onb__compteur {
  position: absolute;
  right: calc(163 * var(--u));
  top: calc(72 * var(--u));
  font-family: var(--font-display);
  font-size: calc(36 * var(--u));
  font-weight: 500;
  line-height: 1;
  opacity: 0.9;
}
.onb__bloc {
  position: absolute;
  inset: 0;
  opacity: 1;
  transform: none;
  transition: opacity 0.32s ease, transform 0.32s ease;
}
.onb__bloc--sortie {
  opacity: 0;
  transform: translateY(-10px);
}
.onb__titre {
  position: absolute;
  left: calc(100 * var(--u));
  top: calc(326 * var(--u));
  font-family: 'Clash Display', sans-serif;
  font-size: calc(80 * var(--u));
  font-weight: 700;
  line-height: calc(88 * var(--u));
  letter-spacing: -0.01em;
}
.onb__texte {
  position: absolute;
  left: calc(100 * var(--u));
  top: calc(533 * var(--u));
  max-width: calc(470 * var(--u));
  font-size: calc(24 * var(--u));
  line-height: calc(30 * var(--u));
  opacity: 0.9;
}

.onb__pied {
  position: absolute;
  left: calc(100 * var(--u));
  top: calc(796 * var(--u));
  height: calc(52 * var(--u));
  display: flex;
  align-items: center;
  gap: calc(48 * var(--u));
}
.onb__piste {
  width: calc(892 * var(--u));
  height: calc(12 * var(--u));
  margin-top: calc(8 * var(--u));
  background: var(--onb-piste);
}
.onb__remplissage {
  height: 100%;
  background: #fff;
  transition: width 0.6s cubic-bezier(0.65, 0, 0.25, 1);
}
.onb__passer {
  width: calc(92 * var(--u));
  padding: 0;
  border: 0;
  background: none;
  color: #fff;
  opacity: 0.8;
  text-align: left;
  font-family: inherit;
  font-size: calc(20 * var(--u));
  font-weight: 500;
  cursor: pointer;
}
.onb__passer:hover { opacity: 1; }
.onb__suivant {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: calc(184 * var(--u));
  height: calc(52 * var(--u));
  padding: 0 calc(28 * var(--u));
  border: 0;
  border-radius: calc(26 * var(--u));
  background: #fff;
  color: var(--onb-bleu);
  font-family: inherit;
  font-size: calc(20 * var(--u));
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, width 0.4s ease;
}
.onb__suivant--large { width: calc(212 * var(--u)); }
.onb__suivant:hover { filter: brightness(0.94); }
.onb__suivant svg {
  width: calc(24 * var(--u));
  height: calc(24 * var(--u));
}
.onb__passer:focus-visible,
.onb__suivant:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .onb__bloc { transition: none !important; }
  .onb__forme,
  .onb__scene,
  .onb__remplissage { transition: none !important; }
}
`

injecterStyles('hypnos-onboarding', STYLES)

const deuxChiffres = (n) => String(n).padStart(2, '0')

export default function Onboarding({ onFinish }) {
  const [index, setIndex] = useState(0) // diapositive dont le texte est affiché
  const [cible, setCible] = useState(0) // diapositive vers laquelle on va (fond, progression)
  const [sortie, setSortie] = useState(false) // le texte s’efface avant le changement
  const [fin, setFin] = useState(false) // on quitte la présentation
  const [pret, setPret] = useState(false) // déclenche l'entrée du fond au premier affichage

  const minuteur = useRef(null)
  const cibleRef = useRef(0)
  const finRef = useRef(false)

  const dernier = cible === DERNIERE
  const diapo = DIAPOSITIVES[index]

  // Le fond démarre « hors champ » puis entre dès la frame suivante
  useEffect(() => {
    let b
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setPret(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
      clearTimeout(minuteur.current)
    }
  }, [])

  // Le fond bouge tout de suite ; le texte s’efface, puis change sans remonter le DOM.
  const aller = useCallback((n) => {
    if (finRef.current) return
    const v = clamp(n, 0, DERNIERE)
    if (v === cibleRef.current) return
    cibleRef.current = v
    setCible(v)
    setSortie(true)
    clearTimeout(minuteur.current)
    minuteur.current = setTimeout(
      () => {
        setIndex(v)
        setSortie(false)
      },
      mouvementReduit() ? 0 : DUREE_SORTIE
    )
  }, [])

  // Tout sort (texte, formes, interface), puis on rend la main
  const terminer = useCallback(() => {
    if (finRef.current) return
    finRef.current = true
    setFin(true)
    setSortie(true)
    clearTimeout(minuteur.current)
    minuteur.current = setTimeout(onFinish, mouvementReduit() ? 0 : DUREE_FIN)
  }, [onFinish])

  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === 'ArrowRight') aller(cibleRef.current + 1)
      if (e.key === 'ArrowLeft') aller(cibleRef.current - 1)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [aller])

  const suivant = () => (dernier ? terminer() : aller(cible + 1))

  const fondActif = fin ? DIAPOSITIVES.length : pret ? cible : -1
  return (
    <div className={`onb${fin ? ' onb--fin' : ''}`}>
      <Fond actif={fondActif} />

      <div className="onb__scene">
        <img className="onb__logo" src={logotype} alt="Hypnos" />
        <span className="onb__compteur">
          {deuxChiffres(cible + 1)} / {deuxChiffres(DIAPOSITIVES.length)}
        </span>

        <div className={`onb__bloc${sortie ? ' onb__bloc--sortie' : ''}`}>
          <h1 className="onb__titre" aria-label={diapo.titre.join(' ')}>
            {diapo.titre[0]}
            <br />
            {diapo.titre[1]}
          </h1>
          <p className="onb__texte">
            {diapo.texte}
          </p>
        </div>

        <div className="onb__pied">
          <div
            className="onb__piste"
            role="progressbar"
            aria-label="Progression de la présentation"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(((cible + 1) / DIAPOSITIVES.length) * 100)}
          >
            <div
              className="onb__remplissage"
              style={{ width: `${((cible + 1) / DIAPOSITIVES.length) * 100}%` }}
            />
          </div>
          <button type="button" className="onb__passer" onClick={terminer}>
            Passer
          </button>
          <button
            type="button"
            className={`onb__suivant${dernier ? ' onb__suivant--large' : ''}`}
            onClick={suivant}
          >
            {dernier ? 'Commencer' : 'Suivant'}
            <ArrowRight strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <BarreFenetre clair />
    </div>
  )
}
