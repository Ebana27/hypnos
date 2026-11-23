/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import Button from './base/Button'
import Input from './base/Input'
import { BarreFenetre } from './base/PanneauMarque'
import ProgressBar from './base/ProgressBar'
import injecterStyles from './base/injecterStyles'
import { DEVISE, formatArgent } from '../lib/reservations'
import logotypeWhite from '../assets/images/logotype_white.png'

const ETAPES = [
  { titre: 'Votre établissement', aide: 'Comment s’appelle votre hôtel, et où se trouve-t-il ?' },
  { titre: 'Le bâtiment', aide: 'Indiquez les étages et les chambres : nous les créons pour vous.' },
  { titre: 'Tarifs et horaires', aide: 'Des valeurs de départ, modifiables à tout moment.' },
  { titre: 'Votre compte', aide: 'Vous serez l’administrateur de cet hôtel.' },
  { titre: 'Vérification', aide: 'Relisez avant de créer votre hôtel.' }
]
const DERNIERE = ETAPES.length - 1
const ETAPE_BATIMENT = 1 // le bâtiment n'apparaît à gauche que sur cette étape
const FORME_PAR_ETAPE = [0, 1, 2, 0, 1] // quelle forme du fond est en place à chaque étape
const ETAGES_MAX = 30 // au-dessus du rez-de-chaussée
const CHAMBRES_MAX = 60 // par étage

const FORMULAIRE_VIDE = {
  nom: '',
  ville: '',
  adresse: '',
  tel: '',
  etagesHauts: 2,
  chambresParEtage: 5,
  chambresRez: 0, // rare : le rez-de-chaussée accueille la réception et les espaces communs
  tarif: '30000',
  arrivee: '15:00',
  depart: '11:00',
  prenom: '',
  nomFamille: '',
  username: '',
  email: '',
  motDePasse: '',
  confirmation: ''
}

const pluriel = (n, singulier, plur = `${singulier}s`) => `${n} ${n > 1 ? plur : singulier}`

// Les chambres sont numérotées de 1 à N sans interruption, en partant du niveau le plus bas.
const totalChambres = (f) => f.chambresRez + f.etagesHauts * f.chambresParEtage

const clamp = (x, min, max) => Math.min(max, Math.max(min, x))
const mouvementReduit = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// ============================================================
//  FOND : formes de la maquette (même univers que la présentation)
//  Les trois formes existent en permanence. Celle de l'étape active est en place ;
//  les précédentes sont sorties en haut à gauche, les suivantes attendent en bas à droite.
// ============================================================
function FondVolet({ actif }) {
  const etat = (i) => (i === actif ? 'actif' : i < actif ? 'passe' : 'futur')

  return (
    <svg
      className="volet__fond"
      viewBox="380 0 760 982"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="reg-g0" gradientUnits="userSpaceOnUse" x1="441.447" y1="525.061" x2="933.58" y2="-3.906">
          <stop offset="0" stopColor="#0727E6" />
          <stop offset="1" stopColor="#6038FF" />
        </linearGradient>
        <linearGradient id="reg-g1" gradientUnits="userSpaceOnUse" x1="0" y1="691.15" x2="1632.9" y2="691.15">
          <stop offset="0" stopColor="#0727E6" />
          <stop offset="0.98" stopColor="#6E38FF" />
        </linearGradient>
        <linearGradient id="reg-g2a" gradientUnits="userSpaceOnUse" x1="0" y1="382.98" x2="765.96" y2="382.98">
          <stop offset="0" stopColor="#5C6CFF" stopOpacity="0.898" />
          <stop offset="1" stopColor="#0727E6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="reg-g2b" gradientUnits="userSpaceOnUse" x1="0" y1="775.15" x2="1795.9" y2="775.15">
          <stop offset="0" stopColor="#0727E6" stopOpacity="0" />
          <stop offset="1" stopColor="#6229FF" />
        </linearGradient>
      </defs>

      <rect width="1512" height="982" fill="#0727E6" />

      <g className={`volet__forme volet__forme--${etat(0)}`}>
        <path
          d="M84.22998 685.9986C37.71106 307.13202 362.81274 -44.547791 810.36481 -99.500275C1257.9169 -154.45274 1658.4407 108.13147 1704.9596 486.99805C1751.4786 865.86469 1426.377 1217.5444 978.82483 1272.4968C531.27271 1327.4495 130.74902 1064.8652 84.22998 685.9986Z"
          fill="url(#reg-g0)"
          fillOpacity="0.65"
          transform="matrix(-0.993 -0.122 -0.122 0.993 1682.146 352.652)"
        />
      </g>

      <g className={`volet__forme volet__forme--${etat(1)}`}>
        <ellipse
          cx="816.45"
          cy="691.15"
          rx="816.45"
          ry="691.15"
          fill="url(#reg-g1)"
          fillOpacity="0.65"
          transform="translate(21.1 248)"
        />
      </g>

      <g className={`volet__forme volet__forme--decalee volet__forme--${etat(2)}`}>
        <circle
          cx="382.98"
          cy="382.98"
          r="382.98"
          fill="url(#reg-g2a)"
          transform="matrix(0.588 0.809 -0.809 0.588 1440.607 446.872)"
        />
        <ellipse
          cx="897.95"
          cy="775.15"
          rx="897.95"
          ry="775.15"
          fill="url(#reg-g2b)"
          transform="translate(-441.9 -821)"
        />
      </g>
    </svg>
  )
}

// ============================================================
//  BÂTIMENT EN PERSPECTIVE 3/4 (SVG)
//  Deux façades visibles : la grande à gauche (les chambres),
//  la petite à droite. Le dessin est calculé par une vraie
//  projection en perspective, puis mis à l'échelle du cadre.
//  À chaque modification, le bâtiment pivote et zoome.
// ============================================================
const CW = 2.4 // largeur d'une travée (unités du dessin)
const FH = 3.2 // hauteur d'un niveau
const PROFONDEUR = 3 * CW
const ANGLE_BASE = (32 * Math.PI) / 180
const COLONNES_MAX = 10 // au-delà, les fenêtres rétrécissent au lieu d'élargir le bâtiment
const NIVEAUX_MAX = 12 // idem pour la hauteur
const VUE = { l: 400, h: 560, sol: 430 }

function Batiment({ actif, niveaux, total, etagesHauts, chambresParEtage, chambresRez }) {
  // --- animation : rotation + zoom à chaque changement -------------------
  const [anim, setAnim] = useState({ angle: ANGLE_BASE, zoom: 1 })
  const courant = useRef({ angle: ANGLE_BASE, zoom: 1 })
  const memoire = useRef(null)

  useEffect(() => {
    const avant = memoire.current
    memoire.current = { total, actif }
    if (!actif) return undefined

    if (mouvementReduit()) {
      courant.current = { angle: ANGLE_BASE, zoom: 1 }
      setAnim(courant.current)
      return undefined
    }

    const intro = !avant || !avant.actif // le bâtiment vient d'apparaître
    const sens = avant && total < avant.total ? -1 : 1 // ajout ou retrait
    const depart = intro ? 0.7 : clamp(courant.current.angle - ANGLE_BASE + 0.3 * sens, -0.5, 0.8)
    const zoomDepart = intro ? 0.82 : clamp(courant.current.zoom * (sens > 0 ? 0.92 : 1.08), 0.8, 1.2)
    const duree = intro ? 1000 : 750
    const t0 = performance.now()
    let raf

    const tick = (maintenant) => {
      const t = Math.min(1, (maintenant - t0) / duree)
      const e = 1 - (1 - t) ** 3
      const suivant = {
        angle: ANGLE_BASE + depart * (1 - e),
        zoom: 1 + (zoomDepart - 1) * (1 - e)
      }
      courant.current = suivant
      setAnim(suivant)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [total, etagesHauts, chambresParEtage, chambresRez, actif])

  // --- dimensions ----------------------------------------------------------
  // Rez-de-chaussée avec chambres : une travée de plus pour la porte
  const parEtage = etagesHauts > 0 ? chambresParEtage : 0
  const travees = Math.max(parEtage, chambresRez > 0 ? chambresRez + 1 : 0, 3)
  const W = Math.min(travees, COLONNES_MAX) * CW
  const cw = W / travees
  const D = PROFONDEUR
  const H = Math.min(niveaux, NIVEAUX_MAX) * FH
  const fh = H / niveaux

  const saillie = fh * 0.3 // balcons
  const garde = fh * 0.3 // hauteur des garde-corps
  const debord = 0.35 // débord du toit
  const epToit = Math.min(0.6, fh * 0.2)
  const hTour = Math.min(2.4, fh * 0.8)
  const zToit = H + epToit
  const haut = zToit + hTour
  const tour = { u0: W * 0.3, u1: W * 0.62, v0: D * 0.2, v1: D * 0.7 }

  // --- projection en perspective -----------------------------------------
  const dirG = [-Math.cos(anim.angle), Math.sin(anim.angle)] // grande façade (x, z)
  const dirD = [Math.sin(anim.angle), Math.cos(anim.angle)] // petite façade (x, z)
  const dist = 2.2 * Math.max(W, D, haut)
  const cam = Math.max(1.7, H * 0.3)
  const brut = (u, v, h) => {
    const x = u * dirG[0] + v * dirD[0]
    const z = u * dirG[1] + v * dirD[1] + dist
    return [x / z, (cam - h) / z]
  }

  const repere = [
    brut(0, 0, 0),
    brut(0, D, 0),
    brut(W, 0, 0),
    brut(W, -saillie, H),
    brut(-debord, -debord, zToit),
    brut(W + debord, -debord, zToit),
    brut(-debord, D + debord, zToit),
    brut(tour.u0, tour.v0, haut),
    brut(tour.u1, tour.v0, haut),
    brut(tour.u0, tour.v1, haut)
  ]
  const xs = repere.map((p) => p[0])
  const ys = repere.map((p) => p[1])
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  const echelle = Math.min(330 / (maxX - minX), (VUE.sol - 40) / (maxY - minY), 22 * dist)
  const ox = VUE.l / 2 - ((minX + maxX) / 2) * echelle
  const oy = VUE.sol - maxY * echelle

  const P = (u, v, h) => {
    const [x, y] = brut(u, v, h)
    return [ox + x * echelle, oy + y * echelle]
  }
  const poly = (...pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  // Rectangle posé sur la grande façade (u = position, h = hauteur)
  const surG = (u0, u1, h0, h1) => poly(P(u0, 0, h0), P(u1, 0, h0), P(u1, 0, h1), P(u0, 0, h1))
  // Rectangle posé sur la petite façade (v = position, h = hauteur)
  const surD = (v0, v1, h0, h1) => poly(P(0, v0, h0), P(0, v1, h0), P(0, v1, h1), P(0, v0, h1))

  // --- éléments ------------------------------------------------------------
  const fenG = []
  const fenD = []
  const vitrines = []
  const balcons = []

  const fentesD = (n, h0, h1) =>
    [0.22, 0.6].forEach((p, i) => {
      const v0 = D * p
      fenD.push(
        <polygon key={`d${n}-${i}`} className="apercu__fenetre" points={surD(v0, v0 + D * 0.16, h0, h1)} />
      )
    })

  // Étages
  const decal = (travees - chambresParEtage) / 2
  for (let n = 1; n <= etagesHauts; n++) {
    const base = n * fh
    for (let j = 0; j < chambresParEtage; j++) {
      const u0 = (decal + j) * cw + cw * 0.2
      fenG.push(
        <polygon
          key={`g${n}-${j}`}
          className="apercu__fenetre"
          points={surG(u0, u0 + cw * 0.6, base + fh * 0.14, base + fh * 0.8)}
        />
      )
    }
    fentesD(n, base + fh * 0.14, base + fh * 0.8)
    balcons.push(
      <g key={`b${n}`} className="apercu__balcon">
        <polygon
          className="apercu__dalle"
          points={poly(P(0, 0, base), P(W, 0, base), P(W, -saillie, base), P(0, -saillie, base))}
        />
        <polygon
          className="apercu__garde"
          points={poly(
            P(0, -saillie, base),
            P(W, -saillie, base),
            P(W, -saillie, base + garde),
            P(0, -saillie, base + garde)
          )}
        />
      </g>
    )
  }

  // Rez-de-chaussée
  const largPorte = Math.min(1.8, cw * 0.7)
  const hPorte = fh * 0.78
  let uPorte
  if (chambresRez === 0) {
    // Réception : deux vitrines de part et d'autre de la porte
    uPorte = W / 2 - largPorte / 2
    const marge = cw * 0.25
    const jeu = 0.3
    ;[
      [marge, uPorte - jeu],
      [uPorte + largPorte + jeu, W - marge]
    ].forEach(([a, b], i) =>
      vitrines.push(
        <polygon key={`v${i}`} className="apercu__vitrine" points={surG(a, b, fh * 0.1, fh * 0.82)} />
      )
    )
    vitrines.push(
      <polygon key="vd" className="apercu__vitrine" points={surD(0.8, D - 0.8, fh * 0.1, fh * 0.82)} />
    )
  } else {
    const places = chambresRez + 1 // les chambres + la porte, au milieu
    const decalRez = (travees - places) / 2
    const kPorte = Math.floor(places / 2)
    for (let j = 0; j < places; j++) {
      if (j === kPorte) continue
      const u0 = (decalRez + j) * cw + cw * 0.2
      fenG.push(
        <polygon
          key={`r${j}`}
          className="apercu__fenetre"
          points={surG(u0, u0 + cw * 0.6, fh * 0.2, fh * 0.8)}
        />
      )
    }
    uPorte = (decalRez + kPorte) * cw + cw / 2 - largPorte / 2
    fentesD(0, fh * 0.2, fh * 0.8)
  }

  const yPied = P(0, 0, 0)[1]
  const cx = VUE.l / 2

  return (
    <svg
      className="apercu__svg"
      viewBox={`0 0 ${VUE.l} ${VUE.h}`}
      role="img"
      aria-label={`Aperçu du bâtiment : ${pluriel(niveaux, 'niveau', 'niveaux')}, ${pluriel(total, 'chambre')}`}
    >
      <g transform={`translate(${cx} ${VUE.sol}) scale(${anim.zoom.toFixed(3)}) translate(${-cx} ${-VUE.sol})`}>
        <line className="apercu__sol" x1="30" x2="370" y1={yPied} y2={yPied} />

        <polygon className="apercu__face-d" points={poly(P(0, 0, 0), P(0, D, 0), P(0, D, H), P(0, 0, H))} />
        <polygon className="apercu__face-g" points={poly(P(0, 0, 0), P(W, 0, 0), P(W, 0, H), P(0, 0, H))} />

        {fenD}
        {fenG}
        {vitrines}
        <polygon className="apercu__porte" points={surG(uPorte, uPorte + largPorte, 0, hPorte)} />
        {balcons}

        {/* Toit : acrotère et petit volume technique */}
        <polygon
          className="apercu__toit"
          points={poly(P(-debord, -debord, H), P(W + debord, -debord, H), P(W + debord, -debord, zToit), P(-debord, -debord, zToit))}
        />
        <polygon
          className="apercu__toit"
          points={poly(P(-debord, -debord, H), P(-debord, D + debord, H), P(-debord, D + debord, zToit), P(-debord, -debord, zToit))}
        />
        <polygon
          className="apercu__face-g"
          points={poly(P(tour.u0, tour.v0, zToit), P(tour.u1, tour.v0, zToit), P(tour.u1, tour.v0, haut), P(tour.u0, tour.v0, haut))}
        />
        <polygon
          className="apercu__face-d"
          points={poly(P(tour.u0, tour.v0, zToit), P(tour.u0, tour.v1, zToit), P(tour.u0, tour.v1, haut), P(tour.u0, tour.v0, haut))}
        />
      </g>
    </svg>
  )
}

// ============================================================
//  PANNEAU GAUCHE
//  Étapes ordinaires : logo + grand titre écrit lettre par lettre.
//  Étape « Bâtiment » : les lettres s'envolent, le bâtiment prend la place.
//  Le fond change de forme à chaque étape, avec entrée et sortie.
// ============================================================
function PanneauGauche({ etape, niveaux, total, etagesHauts, chambresParEtage, chambresRez }) {
  const batiment = etape === ETAPE_BATIMENT

  // Le fond démarre « hors champ » puis entre dès la frame suivante
  const [pret, setPret] = useState(false)
  useEffect(() => {
    let b
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setPret(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [])

  return (
    <aside className={`volet${batiment ? ' volet--batiment' : ''}`}>
      <FondVolet actif={pret ? FORME_PAR_ETAPE[etape] : -1} />

      <img className="volet__logo" src={logotypeWhite} alt="Hypnos" />

      <div className="volet__scene">
        <Batiment
          actif={batiment}
          niveaux={niveaux}
          total={total}
          etagesHauts={etagesHauts}
          chambresParEtage={chambresParEtage}
          chambresRez={chambresRez}
        />
      </div>

      <div className={`volet__texte${batiment ? ' volet__texte--sortie' : ''}`} aria-hidden={batiment}>
        <p className="volet__titre" aria-label="Créez votre hôtel en 2 minutes.">
          Créez votre hôtel en 2 minutes.
        </p>
        <p className="volet__sous">
          Renseignez votre établissement et votre compte administrateur : vos chambres sont générées pour vous.
        </p>
      </div>
    </aside>
  )
}

// ============================================================
//  COMPTEUR − / +
// ============================================================
function Compteur({ label, valeur, min, max, onChange, aide, alerte }) {
  return (
    <div className="compteur">
      <span className="compteur__label">{label}</span>
      <div className="compteur__controles" role="group" aria-label={label}>
        <Button
          variante="secondaire"
          iconeSeule
          icone={Minus}
          aria-label={`Diminuer : ${label}`}
          disabled={valeur <= min}
          onClick={() => onChange(valeur - 1)}
        />
        <output className="compteur__valeur" aria-live="polite">
          {valeur}
        </output>
        <Button
          variante="secondaire"
          iconeSeule
          icone={Plus}
          aria-label={`Augmenter : ${label}`}
          disabled={valeur >= max}
          onClick={() => onChange(valeur + 1)}
        />
      </div>
      {alerte ? (
        <p className="compteur__alerte">{alerte}</p>
      ) : (
        aide && <p className="compteur__aide">{aide}</p>
      )}
    </div>
  )
}

// ============================================================
//  STYLE
// ============================================================
const STYLES = `
/* ---------- Panneau gauche ---------- */
.volet {
  position: relative;
  display: flex;
  flex: 0 0 44%;
  flex-direction: column;
  justify-content: flex-end;
  min-width: 0;
  min-height: 0;
  padding: 40px;
  overflow: hidden;
  color: #fff;
  background: #0727E6;
}
.volet__fond {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.volet__logo {
  position: absolute;
  top: 32px;
  left: 40px;
  z-index: 2;
  height: 34px;
  width: auto;
}

/* Formes : entrée et sortie */
.volet__forme {
  transform-box: view-box;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}
.volet__forme--actif {
  opacity: 1;
  transform: none;
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.25, 1), opacity 0.9s ease 0.15s;
}
.volet__forme--passe {
  opacity: 0;
  transform: translate(-260px, -140px) scale(1.12) rotate(-6deg);
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.25, 1), opacity 0.6s ease;
}
.volet__forme--futur {
  opacity: 0;
  transform: translate(260px, 160px) scale(0.88) rotate(6deg);
  transition: transform 1.1s cubic-bezier(0.65, 0, 0.25, 1), opacity 0.6s ease;
}
.volet__forme--decalee.volet__forme--actif {
  transition-delay: 0.1s, 0.25s;
}
/* Sur l'étape « Bâtiment », le fond s'adoucit pour laisser la place au dessin */
.volet--batiment .volet__forme--actif {
  opacity: 0.5;
}

.volet__texte {
  position: relative;
  z-index: 1;
  transition: opacity 0.3s ease;
}
.volet__titre {
  margin-bottom: 14px;
  font-family: 'Clash Display', sans-serif;
  font-size: clamp(28px, 3.1vw, 40px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.volet__sous {
  max-width: 34ch;
  font-size: 14px;
  line-height: 1.55;
  opacity: 0.85;
}
/* Étape « Bâtiment » : le texte s’efface sans rejouer son animation au retour. */
.volet__texte--sortie {
  pointer-events: none;
  opacity: 0;
}

.volet__scene {
  position: absolute;
  inset: 76px 24px 24px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
  transform: scale(0.94);
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.4s ease, visibility 0s 0.4s;
}
.volet--batiment .volet__scene {
  visibility: visible;
  opacity: 1;
  transform: none;
  transition: opacity 0.5s ease 0.2s, transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s, visibility 0s;
}

/* ---------- Bâtiment ---------- */
.apercu__svg {
  width: 100%;
  height: 100%;
  max-width: 460px;
}
.apercu__svg polygon,
.apercu__svg line {
  vector-effect: non-scaling-stroke;
  stroke: #0727E6;
  stroke-width: 1;
  stroke-linejoin: round;
}
.apercu__sol {
  stroke: rgba(255, 255, 255, 0.45) !important;
  stroke-width: 2 !important;
  stroke-linecap: round;
}
.apercu__face-g {
  fill: rgba(255, 255, 255, 0.96);
}
.apercu__face-d {
  fill: color-mix(in srgb, var(--soft-periwinkle, #b9c0ff) 70%, #fff);
}
.apercu__toit {
  fill: #fff;
}
.apercu__fenetre {
  fill: color-mix(in srgb, #0727E6 24%, #fff);
  animation: apercu-apparition 0.4s ease both;
}
.apercu__vitrine {
  fill: color-mix(in srgb, #0727E6 14%, #fff);
  animation: apercu-apparition 0.4s ease both;
}
.apercu__porte {
  fill: #0727E6;
}
.apercu__balcon {
  animation: apercu-apparition 0.4s ease both;
}
.apercu__dalle {
  fill: #fff;
}
.apercu__garde {
  fill: color-mix(in srgb, #0727E6 10%, transparent);
}
@keyframes apercu-apparition {
  from { opacity: 0; }
}

/* ---------- Assistant ---------- */
.wiz__etape {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
}
.wiz .progression {
  margin-bottom: 22px;
}
.wiz__titre {
  font-family: 'Clash Display', sans-serif;
  font-size: 30px;
}
.wiz__corps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: wiz-entree 0.25s ease both;
}
.wiz__duo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wiz__note {
  font-size: 13px;
  color: var(--color-text-muted);
}
.wiz__code-secours { display:block; padding:18px 14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); font-family:monospace; font-size:clamp(18px,2.5vw,24px); font-weight:700; letter-spacing:.08em; line-height:1.5; text-align:center; user-select:all; overflow-wrap:anywhere; }
.wiz__plus {
  display: flex;
}
.wiz__erreur {
  min-height: 20px;
  margin: 12px 0 4px;
  font-size: 14px;
  color: var(--color-danger);
}
.wiz__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}
@keyframes wiz-entree {
  from { opacity: 0; transform: translateX(12px); }
}

/* ---------- Compteurs ---------- */
.compteur {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
}
.compteur__label {
  font-size: 13px;
  font-weight: 500;
}
.compteur__controles {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.compteur__valeur {
  min-width: 3ch;
  text-align: center;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.compteur__aide,
.compteur__alerte {
  font-size: 12px;
}
.compteur__aide {
  color: var(--color-text-muted);
}
.compteur__alerte {
  color: var(--color-warning);
}

/* ---------- Vérification ---------- */
.recap {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 14px;
}
.recap__ligne {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}
.recap__ligne:last-child {
  border-bottom: none;
}
.recap__titre {
  font-size: 12px;
  color: var(--color-text-muted);
}
.recap__valeur {
  font-size: 14px;
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .volet__forme,
  .volet__scene { transition: none !important; }
  .apercu__fenetre, .apercu__vitrine, .apercu__balcon, .wiz__corps { animation: none; }
}
`

injecterStyles('hypnos-register', STYLES)

// ============================================================
//  VALIDATION PAR ÉTAPE
// ============================================================
function valider(etape, f) {
  const e = {}
  if (etape === 0) {
    if (!f.nom.trim()) e.nom = "Indiquez le nom de l'hôtel."
    if (!f.ville.trim()) e.ville = 'Indiquez la ville.'
  }
  if (etape === 1) {
    if (totalChambres(f) < 1) e.batiment = 'Prévoyez au moins une chambre.'
  }
  if (etape === 2) {
    if (!(Number(f.tarif) > 0)) e.tarif = 'Indiquez un tarif supérieur à 0.'
    if (!f.arrivee) e.arrivee = 'Indiquez une heure.'
    if (!f.depart) e.depart = 'Indiquez une heure.'
  }
  if (etape === 3) {
    if (!f.prenom.trim()) e.prenom = 'Indiquez votre prénom.'
    if (!f.nomFamille.trim()) e.nomFamille = 'Indiquez votre nom.'
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(f.username.trim())) {
      e.username = '3 à 30 caractères : lettres, chiffres, point, tiret ou tiret bas.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Adresse e-mail invalide.'
    if (f.motDePasse.length < 8) e.motDePasse = '8 caractères minimum.'
    if (f.confirmation !== f.motDePasse) e.confirmation = 'Les mots de passe ne correspondent pas.'
  }
  return e
}

// ============================================================
//  ASSISTANT DE CRÉATION
// ============================================================
export default function Register({ onTermine }) {
  const [etape, setEtape] = useState(0)
  const [form, setForm] = useState(FORMULAIRE_VIDE)
  const [erreurs, setErreurs] = useState({})
  const [erreurGlobale, setErreurGlobale] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [codeSecours, setCodeSecours] = useState('')
  const [codeEnregistre, setCodeEnregistre] = useState(false)
  // Champs rarement utiles : repliés tant qu'on n'en a pas besoin
  const [adresseOuverte, setAdresseOuverte] = useState(false)
  const [rezOuvert, setRezOuvert] = useState(false)

  const maj = (champ) => (e) => {
    const valeur = e.target.value
    setForm((f) => ({ ...f, [champ]: valeur }))
    setErreurs((x) => ({ ...x, [champ]: undefined }))
  }
  const regler = (champ, valeur) => setForm((f) => ({ ...f, [champ]: valeur }))

  const niveaux = form.etagesHauts + 1
  const total = totalChambres(form)

  function continuer() {
    const e = valider(etape, form)
    setErreurs(e)
    if (Object.keys(e).length === 0) setEtape((n) => n + 1)
  }

  function retour() {
    setErreurs({})
    setErreurGlobale('')
    setEtape((n) => Math.max(0, n - 1))
  }

  async function creer() {
    for (const i of [0, 1, 2, 3]) {
      const e = valider(i, form)
      if (Object.keys(e).length > 0) {
        setErreurs(e)
        setEtape(i)
        return
      }
    }
    setEnvoi(true)
    setErreurGlobale('')
    try {
      const resultat = await window.electronAPI.creerHotel({
        nom: form.nom,
        ville: form.ville,
        adresse: form.adresse,
        tel: form.tel,
        etagesHauts: form.etagesHauts,
        chambresParEtage: form.chambresParEtage,
        chambresRez: form.chambresRez,
        tarif: Number(form.tarif),
        arrivee: form.arrivee,
        depart: form.depart,
        prenom: form.prenom,
        nomFamille: form.nomFamille,
        username: form.username,
        email: form.email,
        motDePasse: form.motDePasse
      })
      setCodeSecours(resultat.recoveryCode)
    } catch (err) {
      setErreurGlobale(err.message)
      setEnvoi(false)
    }
  }

  function soumettre(e) {
    e.preventDefault()
    if (envoi) return
    if (etape === DERNIERE) creer()
    else continuer()
  }

  const alerteEtages = form.etagesHauts > 10 ? 'Plus de 10 étages : vérifiez ce nombre.' : ''
  const alerteChambres =
    form.chambresParEtage > 30 ? 'Plus de 30 chambres par étage : vérifiez ce nombre.' : ''

  const recap = [
    {
      etape: 0,
      titre: 'Établissement',
      valeur: [form.nom.trim(), form.ville.trim(), form.adresse.trim()].filter(Boolean).join(' · ')
    },
    {
      etape: 1,
      titre: 'Bâtiment',
      valeur: `${pluriel(niveaux, 'niveau', 'niveaux')} · ${pluriel(total, 'chambre')} (n° 1 à ${total})${
        form.chambresRez > 0 ? ` · dont ${form.chambresRez} au rez-de-chaussée` : ''
      }`
    },
    {
      etape: 2,
      titre: 'Tarifs et horaires',
      valeur: `${formatArgent(Number(form.tarif) || 0)} ${DEVISE} par nuit · arrivée ${form.arrivee} · départ ${form.depart}`
    },
    {
      etape: 3,
      titre: 'Compte',
      valeur: `${form.prenom.trim()} ${form.nomFamille.trim()} · ${form.username.trim()} · ${form.email.trim()}`
    }
  ]

  if (codeSecours) {
    return (
      <div className="auth">
        <PanneauGauche etape={DERNIERE} niveaux={niveaux} total={total} etagesHauts={form.etagesHauts} chambresParEtage={form.chambresParEtage} chambresRez={form.chambresRez} />
        <main className="auth__principal">
          <section className="auth__formulaire wiz" aria-labelledby="code-secours-titre">
            <h1 className="auth__titre wiz__titre" id="code-secours-titre">Gardez votre code de secours</h1>
            <p className="auth__sous-titre">Il permet de retrouver l’accès si le nom d’utilisateur ou le mot de passe est oublié. Enregistrez-le hors de cet ordinateur; Hypnos ne pourra pas l’afficher une seconde fois.</p>
            <output className="wiz__code-secours" aria-label="Code de secours">{codeSecours}</output>
            <div className="wiz__actions">
              <Button variante="secondaire" onClick={async () => {
                try { await navigator.clipboard.writeText(codeSecours) } catch { /* le code reste sélectionnable */ }
              }}>Copier le code</Button>
              <Button disabled={!codeEnregistre} onClick={onTermine}>J’ai enregistré le code</Button>
            </div>
            <label className="wiz__note"><input type="checkbox" checked={codeEnregistre} onChange={(e) => setCodeEnregistre(e.target.checked)} /> J’ai conservé ce code dans un endroit sûr.</label>
          </section>
        </main>
        <BarreFenetre />
      </div>
    )
  }

  function corps() {
    if (etape === 0) {
      return (
        <>
          <Input
            label="Nom de l’hôtel"
            requis
            autoFocus
            placeholder="Ex. Hôtel Le Céleste"
            value={form.nom}
            onChange={maj('nom')}
            erreur={erreurs.nom}
          />
          <Input
            label="Ville"
            requis
            placeholder="Ex. Brazzaville"
            value={form.ville}
            onChange={maj('ville')}
            erreur={erreurs.ville}
          />
          {adresseOuverte ? (
            <div className="wiz__duo">
              <Input
                label="Adresse"
                placeholder="Facultatif"
                value={form.adresse}
                onChange={maj('adresse')}
              />
              <Input label="Téléphone" placeholder="+242 …" value={form.tel} onChange={maj('tel')} />
            </div>
          ) : (
            <div className="wiz__plus">
              <Button variante="lien" taille="s" onClick={() => setAdresseOuverte(true)}>
                Ajouter l’adresse et le téléphone (pour vos factures)
              </Button>
            </div>
          )}
        </>
      )
    }

    if (etape === 1) {
      return (
        <>
          <div className="wiz__duo">
            <Compteur
              label="Étages"
              valeur={form.etagesHauts}
              min={form.chambresRez === 0 ? 1 : 0}
              max={ETAGES_MAX}
              onChange={(v) => regler('etagesHauts', v)}
              aide={form.etagesHauts === 1 ? '1er étage' : `Du 1er au ${form.etagesHauts}e`}
              alerte={alerteEtages}
            />
            <Compteur
              label="Chambres par étage"
              valeur={form.chambresParEtage}
              min={1}
              max={CHAMBRES_MAX}
              onChange={(v) => regler('chambresParEtage', v)}
              alerte={alerteChambres}
            />
          </div>
          {rezOuvert ? (
            <Compteur
              label="Chambres au rez-de-chaussée"
              valeur={form.chambresRez}
              min={0}
              max={CHAMBRES_MAX}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  chambresRez: v,
                  // Sans chambre au rez-de-chaussée, il faut au moins un étage
                  etagesHauts: v === 0 ? Math.max(1, f.etagesHauts) : f.etagesHauts
                }))
              }
              aide="Rare : le rez-de-chaussée accueille en général la réception."
            />
          ) : (
            <div className="wiz__plus">
              <Button variante="lien" taille="s" onClick={() => setRezOuvert(true)}>
                Ajouter des chambres au rez-de-chaussée
              </Button>
            </div>
          )}
          {erreurs.batiment && (
            <p className="compteur__alerte" role="alert">
              {erreurs.batiment}
            </p>
          )}
        </>
      )
    }

    if (etape === 2) {
      return (
        <>
          <Input
            label={`Tarif moyen par nuit (${DEVISE})`}
            type="number"
            min={0}
            step={500}
            requis
            autoFocus
            value={form.tarif}
            onChange={maj('tarif')}
            erreur={erreurs.tarif}
          />
          <div className="wiz__duo">
            <Input
              label="Heure d’arrivée"
              type="time"
              value={form.arrivee}
              onChange={maj('arrivee')}
              erreur={erreurs.arrivee}
            />
            <Input
              label="Heure de départ"
              type="time"
              value={form.depart}
              onChange={maj('depart')}
              erreur={erreurs.depart}
            />
          </div>
          <p className="wiz__note">Une catégorie « Standard » sera créée à ce tarif pour toutes vos chambres.</p>
        </>
      )
    }

    if (etape === 3) {
      return (
        <>
          <div className="wiz__duo">
            <Input
              label="Prénom"
              requis
              autoFocus
              value={form.prenom}
              onChange={maj('prenom')}
              erreur={erreurs.prenom}
            />
            <Input
              label="Nom"
              requis
              value={form.nomFamille}
              onChange={maj('nomFamille')}
              erreur={erreurs.nomFamille}
            />
          </div>
          <Input
            label="Nom d’utilisateur"
            requis
            placeholder="ex. reception.hotel"
            autoComplete="username"
            value={form.username}
            onChange={maj('username')}
            erreur={erreurs.username}
          />
          <Input
            label="Adresse e-mail"
            requis
            placeholder="vous@hotel.cg"
            autoComplete="username"
            value={form.email}
            onChange={maj('email')}
            erreur={erreurs.email}
          />
          <div className="wiz__duo">
            <Input
              label="Mot de passe"
              type="password"
              requis
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              value={form.motDePasse}
              onChange={maj('motDePasse')}
              erreur={erreurs.motDePasse}
            />
            <Input
              label="Confirmation"
              type="password"
              requis
              autoComplete="new-password"
              value={form.confirmation}
              onChange={maj('confirmation')}
              erreur={erreurs.confirmation}
            />
          </div>
        </>
      )
    }

    return (
      <>
        <div className="recap">
          {recap.map((ligne) => (
            <div className="recap__ligne" key={ligne.etape}>
              <div>
                <p className="recap__titre">{ligne.titre}</p>
                <p className="recap__valeur">{ligne.valeur}</p>
              </div>
              <Button variante="lien" taille="s" onClick={() => setEtape(ligne.etape)}>
                Modifier
              </Button>
            </div>
          ))}
        </div>
        <p className="wiz__note">Tout est enregistré sur cet ordinateur, sans connexion internet.</p>
      </>
    )
  }

  return (
    <div className="auth">
      <PanneauGauche
        etape={etape}
        niveaux={niveaux}
        total={total}
        etagesHauts={form.etagesHauts}
        chambresParEtage={form.chambresParEtage}
        chambresRez={form.chambresRez}
      />

      <main className="auth__principal">
        <form className="auth__formulaire wiz" onSubmit={soumettre} noValidate>
          <p className="wiz__etape">
            Étape {etape + 1} sur {ETAPES.length}
          </p>
          <ProgressBar
            valeur={((etape + 1) / ETAPES.length) * 100}
            libelle="Progression de la création de l’hôtel"
          />
          <h1 className="auth__titre wiz__titre" aria-label={ETAPES[etape].titre}>
            {ETAPES[etape].titre}
          </h1>
          <p className="auth__sous-titre">{ETAPES[etape].aide}</p>

          <div className="wiz__corps" key={etape}>
            {corps()}
          </div>

          <p className="wiz__erreur" role="alert">
            {erreurGlobale}
          </p>

          <div className="wiz__actions">
            {etape > 0 ? (
              <Button variante="secondaire" className="auth__bouton" onClick={retour} disabled={envoi}>
                Retour
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" className="auth__bouton" chargement={envoi}>
              {etape === DERNIERE ? 'Créer mon hôtel' : 'Continuer'}
            </Button>
          </div>
        </form>
      </main>

      <BarreFenetre />
    </div>
  )
}
