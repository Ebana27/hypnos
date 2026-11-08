/* eslint-disable react/prop-types */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Button from './base/Button'
import { STATUTS_CHAMBRE } from './base/CardRoom'
import injecterStyles from './base/injecterStyles'
import {
  CANAUX_ABREGE,
  DEVISE,
  STATUTS_ACTIFS,
  STATUTS_RESERVATION,
  ajouterJours,
  aujourdhui,
  chambreReservable,
  cleJour,
  ecartJours,
  enConflit,
  formatArgent,
  formatCourt,
  heuresEntre,
  jourDe,
  libelleHeures,
  libelleNuits,
  montantPassage,
  versLocal
} from '../lib/reservations'

const NB_JOURS = 75
const JOURS_AVANT = 7 // jours affichés avant aujourd'hui
const HAUTEUR_LIGNE = 62
const LARGEUR_CHAMBRES = 128
const JOUR_MS = 86_400_000
const JOURS_SEMAINE = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
const LEGENDE = ['paiement_attente', 'confirmee', 'en_sejour', 'terminee']
const DUREE_CREATION_PASSAGE_H = 2

// Niveaux de zoom : largeur d'une journée, pas de déplacement d'un passage (en heures),
// graduation affichée dans l'en-tête (en heures, 0 = aucune) et saut des boutons « ‹ ›».
const ZOOMS = {
  jour: { libelle: 'Jours', largeur: 68, pasHeures: 24, graduation: 0, navJours: 7 },
  demi: { libelle: '6 h', largeur: 288, pasHeures: 1, graduation: 6, navJours: 3 },
  heures: { libelle: 'Heures', largeur: 960, pasHeures: 0.5, graduation: 1, navJours: 1 }
}

const borner = (valeur, min, max) => Math.min(max, Math.max(min, valeur))

const formatLong = (date) =>
  date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const indexDuJour = (debutPeriode, date) => ecartJours(debutPeriode, jourDe(date))
const indexHoraire = (debutPeriode, texte) => {
  const s = String(texte ?? '')
  const jour = indexDuJour(debutPeriode, s)
  if (s.length <= 10) return jour
  const h = Number(s.slice(11, 13)) || 0
  const m = Number(s.slice(14, 16)) || 0
  return jour + (h * 60 + m) / 1440
}
// Décale une date de n jours (séjours en nuitées) en gardant l'heure d'origine
const decalerJours = (texte, jours, heureParDefaut) => {
  const s = String(texte ?? '')
  if (s.length <= 10) return `${cleJour(ajouterJours(jourDe(s), jours))}T${heureParDefaut}`
  const d = new Date(s)
  d.setDate(d.getDate() + jours)
  return versLocal(d)
}
// Décale une date de n minutes (passages)
const decalerMinutes = (texte, minutes) => {
  const d = new Date(String(texte).length <= 10 ? `${texte}T15:00` : texte)
  d.setMinutes(d.getMinutes() + minutes)
  return versLocal(d)
}

// Ce que l'on peut faire d'une barre selon l'état du séjour
const droitsDe = (statut) => ({
  deplacer: statut === 'confirmee' || statut === 'en_attente',
  debut: statut === 'confirmee' || statut === 'en_attente',
  fin: statut !== 'terminee'
})

const STYLES = `
.tl {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ---------- Barre d'outils et légende ---------- */
.tl__outils {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.tl__stats {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 10px;
  margin-right: auto;
}
.tl__stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 132px;
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
.tl__stat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 11px;
}
.tl__stat-label i {
  width: 7px; height: 7px; border-radius: 50%; background: var(--tl-c, var(--color-accent));
}
.tl__stat b {
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}
.tl__stat b small { color: var(--color-text-muted); font: 500 11px 'Inter', sans-serif; }
.tl__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.tl__zoom {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}
.tl__zoom button {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.tl__zoom button:hover { color: var(--color-accent); }
.tl__zoom button[aria-pressed='true'] {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
.tl__legende {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 2px 1px;
  font-size: 11px;
  color: var(--color-text-muted);
}
@media (max-width: 760px) {
  .tl__stat { min-width: 112px; flex: 1 1 112px; }
  .tl__aide { margin-left: 0; flex-basis: 100%; }
}
.tl__legende span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tl__legende i {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: var(--c);
}
.tl__aide {
  margin-left: auto;
}

/* ---------- Plateau ---------- */
.tl__defil {
  height: calc(100vh - 360px);
  min-height: 320px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  cursor: grab;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}
.tl__defil--pan {
  cursor: grabbing;
  user-select: none;
}
.tl__plateau {
  display: grid;
  grid-template-columns: var(--tl-cw) auto;
  grid-template-rows: 58px auto;
  width: max-content;
}
.tl__coin {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 8;
  padding: 18px 14px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ---------- Jours ---------- */
.tl__jours {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
.tl__jour {
  position: relative;
  flex: none;
  width: var(--tl-dw);
  padding-top: 9px;
  border-left: 1px solid var(--color-border);
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
}
.tl__jour b {
  display: block;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
.tl__jour-label { display: block; }
.tl__jour--we {
  background: var(--color-background-soft);
}
.tl__jour--auj {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
.tl__jour--auj b {
  color: var(--color-accent-contrast);
}
/* Zoom : le jour reste lisible en défilant (le libellé suit la fenêtre) */
.tl--zoom .tl__jour { text-align: left; }
.tl--zoom .tl__jour-label {
  position: sticky;
  left: calc(var(--tl-cw) + 10px);
  display: inline-block;
  padding-left: 10px;
}
.tl--zoom .tl__jour-label b { display: inline; margin-left: 6px; font-size: 15px; }
.tl__heures {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  height: 16px;
  border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}
.tl__heures i {
  flex: none;
  box-sizing: border-box;
  padding: 2px 0 0 3px;
  border-left: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  font-size: 9px;
  font-style: normal;
  line-height: 12px;
  opacity: 0.8;
}
.tl__mois {
  position: absolute;
  top: 2px;
  left: 4px;
  z-index: 1;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--color-text);
  color: var(--color-background);
  font-size: 9px;
}

/* ---------- Chambres ---------- */
.tl__chambres {
  position: sticky;
  left: 0;
  z-index: 5;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}
.tl__chambre {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: var(--tl-rh);
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--color-border);
}
.tl__chambre::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 5px;
  border-radius: 0 5px 5px 0;
  background: var(--tl-etage);
}
.tl__chambre b {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}
.tl__chambre span {
  font-size: 11px;
  color: var(--color-text-muted);
}
.tl__chambre .tl__statut { font-size:10px; font-weight:600; color:var(--color-text); }

/* ---------- Piste ---------- */
.tl__piste {
  position: relative;
  width: calc(var(--tl-n) * var(--tl-dw));
  overflow: hidden;
  background-image:
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--color-border) 55%, transparent) 1px, transparent 1px);
  background-size: var(--tl-dw) var(--tl-rh), var(--tl-dw) var(--tl-rh), var(--tl-sub) var(--tl-rh);
  background-position: 0 -1px, 0 0, 0 0;
}
.tl__col {
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--tl-dw);
  background: var(--color-background-soft);
  opacity: 0.6;
  pointer-events: none;
}
.tl__col--auj {
  background: var(--color-accent-wash);
  box-shadow: inset 2px 0 0 var(--color-accent);
  opacity: 1;
}
/* Ligne « maintenant » : repère des séjours courts */
.tl__maintenant {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  width: 2px;
  margin-left: -1px;
  background: var(--color-danger);
  pointer-events: none;
}
.tl__maintenant::before {
  content: '';
  position: absolute;
  top: 0;
  left: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
}

/* Case libre sous le curseur : un clic crée une réservation */
.tl__case {
  position: absolute;
  display: grid;
  place-items: center;
  height: var(--tl-rh);
  border: 1px dashed var(--color-accent);
  border-radius: 8px;
  background: var(--color-accent-wash);
  color: var(--color-accent);
  pointer-events: none;
}

/* ---------- Réservations ---------- */
.tl__resa {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: calc(var(--tl-rh) - 14px);
  margin-top: 7px;
  padding: 5px 22px 5px 14px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--resa-fond);
  color: var(--resa-texte);
  white-space: nowrap;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  transition: filter 0.12s;
}
.tl__resa:hover {
  filter: brightness(1.08);
}
.tl__resa--deplace {
  z-index: 4;
  cursor: grabbing;
  filter: drop-shadow(0 10px 14px color-mix(in srgb, var(--hypnos-black) 30%, transparent)) brightness(1.1);
}
.tl__resa--refus {
  background: repeating-linear-gradient(
    45deg,
    var(--color-danger) 0 8px,
    color-mix(in srgb, var(--color-danger) 80%, var(--white)) 8px 16px
  );
  color: var(--white);
}
.tl__resa b {
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
}
.tl__resa small {
  overflow: hidden;
  font-size: 10px;
  opacity: 0.88;
  text-overflow: ellipsis;
}
/* Barres courtes : on garde l'essentiel, le détail est dans l'aperçu au survol */
.tl__resa--etroit { padding: 5px 9px; border-radius: 9px; }
.tl__resa--etroit .tl__canal { display: none; }
.tl__resa--court small { display: none; }
.tl__resa--minuscule { padding: 0; border-radius: 7px; }
.tl__resa--minuscule b,
.tl__resa--minuscule small { display: none; }
.tl__canal {
  position: absolute;
  top: 5px;
  right: 20px;
  padding: 1px 4px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--white) 90%, transparent);
  color: var(--onyx);
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
}
.tl__poignee {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 14px;
  cursor: ew-resize;
}
.tl__resa--etroit .tl__poignee { width: 8px; }
.tl__poignee--g { left: 0; }
.tl__poignee--d { right: 0; }
.tl__poignee::after {
  content: '';
  position: absolute;
  top: 32%;
  bottom: 32%;
  left: 5px;
  width: 3px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0;
}
.tl__resa--etroit .tl__poignee::after { left: 2px; }
.tl__resa:hover .tl__poignee::after,
.tl__resa--deplace .tl__poignee::after {
  opacity: 0.7;
}

/* ---------- Bulle de déplacement ---------- */
.tl__bulle {
  position: fixed;
  z-index: 3500;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--hypnos-black);
  color: var(--platinum);
  font-size: 12px;
  pointer-events: none;
}
.tl__bulle b {
  font-weight: 700;
}

/* ---------- Aperçu au survol : l'essentiel seulement (le détail est dans la fiche, au clic) ---------- */
.tl__carte {
  position: fixed;
  z-index: 3400;
  width: 280px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
  color: var(--color-text);
  font-size: 12px;
  pointer-events: none;
  animation: tl-carte 0.12s ease both;
}
.tl__carte-entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.tl__carte-entete b {
  overflow: hidden;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl__carte-statut {
  flex-shrink: 0;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: var(--c);
  color: var(--t);
  font-size: 10px;
  font-weight: 600;
}
.tl__carte-ligne {
  margin-top: 6px;
  color: var(--color-text-muted);
}
.tl__carte-paiement {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  font-weight: 600;
  color: var(--color-success);
}
.tl__carte-du {
  color: var(--color-danger);
}
.tl__carte-aide {
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-faint);
}
@keyframes tl-carte {
  from { opacity: 0; transform: translateY(4px); }
}
@media (prefers-reduced-motion: reduce) {
  .tl__carte { animation: none; }
}

.tl__vide {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}
.booking-page--plein {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  background: var(--color-background);
}

.booking-page--plein .tl {
  flex: 1;
  min-height: 0;
}

.booking-page--plein .tl__defil {
  flex: 1;
  height: auto;
  min-height: 0;
}
`

injecterStyles('hypnos-booking-timeline', STYLES)

// ============================================================
//  APERÇU D'UNE RÉSERVATION (affiché au survol) : qui, où, quand, reste à payer
// ============================================================
function CarteReservation({ r, position }) {
  const infos = STATUTS_RESERVATION[r.statutAffiche]
  const nomComplet = r.client ? `${r.client.prenom} ${r.client.nom}` : r.clientNom
  const reste = Math.max(r.reste, 0)
  const style = {
    left: position.gauche,
    ...(position.dessous ? { top: position.bord } : { bottom: position.bord })
  }

  return (
    <div className="tl__carte" role="tooltip" style={style}>
      <div className="tl__carte-entete">
        <b>{nomComplet}</b>
        <span className="tl__carte-statut" style={{ '--c': infos.fond, '--t': infos.texte }}>
          {infos.libelle}
        </span>
      </div>
      <p className="tl__carte-ligne">
        Chambre {r.numeroChambre} · {r.typeLabel}
      </p>
      <p className="tl__carte-ligne">
        {r.typeSejour === 'heure'
          ? `${formatLong(jourDe(r.dateDebut))} ${String(r.dateDebut).slice(11, 16)} → ${String(r.dateFin).slice(11, 16)} · ${libelleHeures(heuresEntre(r.dateDebut, r.dateFin))}`
          : `${formatLong(jourDe(r.dateDebut))} → ${formatLong(jourDe(r.dateFin))} · ${libelleNuits(r.nuits)}`}
      </p>
      <p className={`tl__carte-paiement${reste > 0 ? ' tl__carte-du' : ''}`}>
        {reste > 0 ? `Reste à payer : ${formatArgent(reste)} ${DEVISE}` : 'Séjour soldé'}
      </p>
      <p className="tl__carte-aide">Cliquez pour ouvrir la fiche.</p>
    </div>
  )
}

/**
 * Props :
 *  chambres      [{ id, numero, etage, statut, typeLabel, prixNuit }] déjà triées
 *  reservations  réservations enrichies (clientNom, nuits, total, services, canal, statutAffiche…)
 *  onOuvrir(id)                      clic sur une réservation
 *  onDeplacer(id, { chambreId, debut, fin })  après un glisser valide
 *  onCreer({ chambreId, debut, fin, typeSejour }) clic sur une case libre
 *  onRefus(message)                  glisser impossible
 */
export default function BookingTimeline({
  chambres,
  reservations,
  onOuvrir,
  onDeplacer,
  onCreer,
  onRefus
}) {
  const refDefil = useRef(null)
  const refPiste = useRef(null)
  const refGeste = useRef(null)
  const refGesteBouge = useRef(false) // un glisser vient d'avoir lieu : le clic qui suit est ignoré
  const refCase = useRef('') // dernière case survolée (évite des calculs inutiles)
  const refCentre = useRef(null) // jour au centre de l'écran, conservé pendant un changement de zoom
  const [zoom, setZoom] = useState('jour')
  const [apercu, setApercu] = useState(null)
  const [pan, setPan] = useState(false)
  const [survol, setSurvol] = useState(null) // aperçu d'une réservation
  const [caseSurvol, setCaseSurvol] = useState(null) // case libre sous le curseur
  const [maintenant, setMaintenant] = useState(() => new Date())

  const infosZoom = ZOOMS[zoom]
  const lj = infosZoom.largeur // largeur d'une journée, en pixels
  const zoome = zoom !== 'jour'

  const auj = useMemo(() => aujourdhui(), [])
  const debut = useMemo(() => ajouterJours(auj, -JOURS_AVANT), [auj])
  const jours = useMemo(
    () => Array.from({ length: NB_JOURS }, (_, i) => ajouterJours(debut, i)),
    [debut]
  )

  const indexLigne = useMemo(() => new Map(chambres.map((c, i) => [c.id, i])), [chambres])

  const visibles = useMemo(
    () =>
      reservations
        .filter((r) => r.statut !== 'annulee' && indexLigne.has(r.chambreId))
        .map((r) => ({
          ...r,
          ligne: indexLigne.get(r.chambreId),
          idxDebut: r.typeSejour === 'heure' ? indexHoraire(debut, r.dateDebut) : ecartJours(debut, jourDe(r.dateDebut)),
          idxFin: r.typeSejour === 'heure' ? indexHoraire(debut, r.dateFin) : ecartJours(debut, jourDe(r.dateFin))
        }))
        .filter((r) => r.idxFin > 0 && r.idxDebut < NB_JOURS),
    [reservations, indexLigne, debut]
  )

  const stats = useMemo(() => {
    const actives = reservations.filter((r) => STATUTS_ACTIFS.includes(r.statut))
    const maintenantIso = versLocal(new Date())
    const occupees = new Set(
      actives.filter((r) => { const d0 = String(r.dateDebut).length === 10 ? `${r.dateDebut}T15:00` : String(r.dateDebut).slice(0, 16); const d1 = String(r.dateFin).length === 10 ? `${r.dateFin}T11:00` : String(r.dateFin).slice(0, 16); return d0 <= maintenantIso && maintenantIso < d1 }).map((r) => r.chambreId)
    ).size
    return {
      occupees,
      nuits: actives.reduce((somme, r) => somme + r.nuits, 0),
      revenu: actives.reduce((somme, r) => somme + r.total, 0)
    }
  }, [reservations, auj])

  // La ligne « maintenant » avance toute seule
  useEffect(() => {
    const minuteur = window.setInterval(() => setMaintenant(new Date()), 60_000)
    return () => window.clearInterval(minuteur)
  }, [])
  const idxMaintenant = (maintenant.getTime() - debut.getTime()) / JOUR_MS

  // Au démarrage : la veille d'aujourd'hui est la première colonne visible
  useEffect(() => {
    if (refDefil.current) refDefil.current.scrollLeft = (JOURS_AVANT - 1) * ZOOMS.jour.largeur
  }, [])

  // Après un changement de zoom : on retrouve le même moment au centre de l'écran
  useLayoutEffect(() => {
    const defil = refDefil.current
    if (refCentre.current == null || !defil) return
    defil.scrollLeft = Math.max(0, refCentre.current * lj - (defil.clientWidth - LARGEUR_CHAMBRES) / 2)
    refCentre.current = null
  }, [lj])

  function changerZoom(niveau) {
    if (niveau === zoom) return
    const defil = refDefil.current
    if (defil) refCentre.current = (defil.scrollLeft + (defil.clientWidth - LARGEUR_CHAMBRES) / 2) / lj
    masquerSurvols()
    setZoom(niveau)
  }

  const defiler = (nombreJours) =>
    refDefil.current?.scrollBy({ left: nombreJours * lj, behavior: 'smooth' })
  const versAujourdhui = () => {
    const fraction = (maintenant.getHours() * 60 + maintenant.getMinutes()) / 1440
    const cible = zoome ? (JOURS_AVANT + fraction) * lj - 180 : (JOURS_AVANT - 1) * lj
    refDefil.current?.scrollTo({ left: Math.max(0, cible), behavior: 'smooth' })
  }

  // ---------- Cases et survol ----------
  // Case (jour, chambre, heure) sous le curseur, ou null si le curseur est hors de la piste
  function celluleSous(e) {
    const piste = refPiste.current
    if (!piste) return null
    const rect = piste.getBoundingClientRect()
    const x = (e.clientX - rect.left) / lj
    const jour = Math.floor(x)
    const ligne = Math.floor((e.clientY - rect.top) / HAUTEUR_LIGNE)
    if (jour < 0 || jour >= NB_JOURS || ligne < 0 || ligne >= chambres.length) return null
    return { jour, ligne, heure: Math.floor((x - jour) * 24) }
  }

  // Dézoomé : une nuit sur la case. Zoomé : un passage de 2 h à l'heure survolée.
  const candidatPour = ({ jour, ligne, heure }) => {
    if (!zoome) {
      return {
        chambreId: chambres[ligne].id,
        debut: cleJour(ajouterJours(debut, jour)),
        fin: cleJour(ajouterJours(debut, jour + 1)),
        typeSejour: 'nuit'
      }
    }
    const arrivee = ajouterJours(debut, jour)
    arrivee.setHours(heure, 0, 0, 0)
    const depart = new Date(arrivee.getTime() + DUREE_CREATION_PASSAGE_H * 3600000)
    return {
      chambreId: chambres[ligne].id,
      debut: versLocal(arrivee),
      fin: versLocal(depart),
      typeSejour: 'heure'
    }
  }

  // Place l'aperçu sous la barre (ou au-dessus s'il n'y a pas la place)
  function positionCarte(rect, x) {
    const dessous = rect.bottom + 190 < window.innerHeight
    return {
      gauche: Math.min(Math.max(8, x - 24), window.innerWidth - 288),
      dessous,
      bord: dessous ? rect.bottom + 8 : window.innerHeight - rect.top + 8
    }
  }

  function masquerSurvols() {
    setSurvol(null)
    setCaseSurvol(null)
    refCase.current = ''
  }

  function survolerPlateau(e) {
    const barre = e.target.closest('[data-resa]')
    if (barre) {
      if (refCase.current) {
        refCase.current = ''
        setCaseSurvol(null)
      }
      const id = Number(barre.dataset.resa)
      setSurvol((s) =>
        s && s.id === id ? s : { id, ...positionCarte(barre.getBoundingClientRect(), e.clientX) }
      )
      return
    }

    setSurvol(null)
    if (!e.target.closest('.tl__piste')) {
      if (refCase.current) {
        refCase.current = ''
        setCaseSurvol(null)
      }
      return
    }

    const cellule = celluleSous(e)
    const cle = cellule ? `${cellule.jour}:${cellule.ligne}:${zoome ? cellule.heure : 0}` : ''
    if (cle === refCase.current) return
    refCase.current = cle
    setCaseSurvol(
      cellule &&
        !enConflit(reservations, candidatPour(cellule)) &&
        chambreReservable(chambres[cellule.ligne], candidatPour(cellule).debut)
        ? cellule
        : null
    )
  }

  // ---------- Gestes : déplacer, allonger, faire défiler ----------
  function surPointerBas(e) {
    const defil = refDefil.current
    refGesteBouge.current = false
    masquerSurvols()

    const barre = e.target.closest('[data-resa]')

    if (barre) {
      const r = visibles.find((v) => String(v.id) === barre.dataset.resa)
      if (!r) return
      const poignee = e.target.dataset.poignee
      refGeste.current = {
        type: 'resa',
        r,
        mode: poignee === 'g' ? 'debut' : poignee === 'd' ? 'fin' : 'deplacer',
        x: e.clientX,
        y: e.clientY,
        sl: defil.scrollLeft,
        st: defil.scrollTop,
        bouge: false,
        candidat: null
      }
      barre.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }

    if (e.pointerType === 'mouse' && e.button === 0) {
      refGeste.current = {
        type: 'pan',
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sl: defil.scrollLeft,
        st: defil.scrollTop,
        actif: false
      }
    }
  }

  function surPointerBouge(e) {
    const g = refGeste.current
    if (!g) {
      survolerPlateau(e)
      return
    }
    const defil = refDefil.current

    if (g.type === 'pan') {
      if (!g.actif) {
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return
        g.actif = true
        refGesteBouge.current = true
        // Capture seulement une fois le mouvement commencé, pour ne pas gêner le clic
        e.currentTarget.setPointerCapture(g.pointerId)
        setPan(true)
      }
      defil.scrollLeft = g.sl - (e.clientX - g.x)
      defil.scrollTop = g.st - (e.clientY - g.y)
      return
    }

    if (!droitsDe(g.r.statut)[g.mode]) return
    if (!g.bouge) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return
      g.bouge = true
      refGesteBouge.current = true
    }

    // Défilement automatique près des bords
    const rect = defil.getBoundingClientRect()
    if (e.clientX > rect.right - 70) defil.scrollLeft += 14
    else if (e.clientX < rect.left + LARGEUR_CHAMBRES + 60) defil.scrollLeft -= 14

    // Une nuitée se déplace par jours entiers ; un passage par pas d'une demi-heure ou d'une heure selon le zoom
    const passage = g.r.typeSejour === 'heure'
    const pasJours = passage ? infosZoom.pasHeures / 24 : 1
    const brut = (e.clientX - g.x + defil.scrollLeft - g.sl) / lj
    const dj = Math.round(brut / pasJours) * pasJours
    const dl = Math.round((e.clientY - g.y + defil.scrollTop - g.st) / HAUTEUR_LIGNE)

    let { idxDebut: d, idxFin: f, ligne } = g.r
    const dureeMin = passage ? 1 / 24 : 1
    if (g.mode === 'deplacer') {
      d += dj
      f += dj
      ligne = borner(ligne + dl, 0, chambres.length - 1)
    } else if (g.mode === 'debut') {
      d = Math.min(d + dj, f - dureeMin)
    } else {
      f = Math.max(f + dj, d + dureeMin)
    }

    // Les dates candidates sont calculées depuis les bornes finales (d, f) : jamais de départ avant l'arrivée
    const dd = d - g.r.idxDebut
    const df = f - g.r.idxFin
    const candidat = {
      chambreId: chambres[ligne].id,
      debut: passage ? decalerMinutes(g.r.dateDebut, Math.round(dd * 1440)) : decalerJours(g.r.dateDebut, Math.round(dd), '15:00'),
      fin: passage ? decalerMinutes(g.r.dateFin, Math.round(df * 1440)) : decalerJours(g.r.dateFin, Math.round(df), '11:00')
    }
    // Une chambre hors service ou en nettoyage n'accepte pas de nouvelle arrivée ;
    // rester dans sa propre chambre est toujours permis.
    const ok =
      d >= 0 &&
      f <= NB_JOURS &&
      candidat.fin > candidat.debut &&
      !enConflit(reservations, candidat, g.r.id) &&
      (chambres[ligne].id === g.r.chambreId || chambreReservable(chambres[ligne], candidat.debut))
    g.candidat = ok ? candidat : null
    setApercu({ id: g.r.id, idxDebut: d, idxFin: f, ligne, ok, x: e.clientX, y: e.clientY })
  }

  function surPointerHaut() {
    const g = refGeste.current
    refGeste.current = null
    setPan(false)
    setApercu(null)
    refCase.current = ''
    if (!g || g.type !== 'resa') return

    if (!g.bouge) {
      onOuvrir(g.r.id)
      return
    }
    if (!g.candidat) {
      onRefus?.('Modification impossible : chambre déjà occupée, hors service ou hors de la période affichée.')
      return
    }
    const c = g.candidat
    if (c.chambreId === g.r.chambreId && c.debut === g.r.dateDebut && c.fin === g.r.dateFin) return
    onDeplacer(g.r.id, c)
  }

  function surPointerAnnule() {
    refGeste.current = null
    setPan(false)
    setApercu(null)
    refCase.current = ''
  }

  // ---------- Création : clic sur une case libre ----------
  function surClic(e) {
    // Un glisser vient de se terminer : ce clic n'est pas voulu
    if (refGesteBouge.current) {
      refGesteBouge.current = false
      return
    }
    if (e.target.closest('[data-resa]')) return

    const cellule = celluleSous(e)
    if (!cellule) return
    const candidat = candidatPour(cellule)
    if (!chambreReservable(chambres[cellule.ligne], candidat.debut)) {
      onRefus?.('Cette chambre est hors service ou en nettoyage.')
      return
    }
    if (enConflit(reservations, candidat)) {
      onRefus?.(zoome ? 'Cette chambre est déjà réservée sur ce créneau.' : 'Cette chambre est déjà réservée ce jour-là.')
      return
    }
    masquerSurvols()
    onCreer(candidat)
  }

  if (chambres.length === 0) {
    return (
      <p className="tl__vide">
        Aucune chambre pour le moment. Ajoutez des chambres dans l&apos;onglet Chambres pour voir le
        planning.
      </p>
    )
  }

  const enCours = apercu ? visibles.find((v) => v.id === apercu.id) : null
  const resaSurvol = survol && !apercu ? visibles.find((v) => v.id === survol.id) : null

  const dateIdx = (idx) => new Date(debut.getTime() + idx * JOUR_MS)
  const heureIdx = (idx) => dateIdx(idx).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const montantApercu = (r, idxD, idxF, ligne) =>
    r.typeSejour === 'heure'
      ? montantPassage((idxF - idxD) * 24, r.regleArrondi, r.tarifApplique, chambres[ligne].prixNuit).montant + r.services
      : Math.round(idxF - idxD) * (r.tarifApplique || chambres[ligne].prixNuit) + r.services

  const graduation = infosZoom.graduation
  const largeurCaseSurvol = zoome ? (lj * DUREE_CREATION_PASSAGE_H) / 24 : lj

  return (
    <div
      className={`tl${zoome ? ' tl--zoom' : ''}`}
      style={{
        '--tl-dw': `${lj}px`,
        '--tl-sub': `${zoome ? (lj * graduation) / 24 : lj}px`,
        '--tl-rh': `${HAUTEUR_LIGNE}px`,
        '--tl-cw': `${LARGEUR_CHAMBRES}px`,
        '--tl-n': NB_JOURS
      }}
    >
      <div className="tl__outils">
        <div className="tl__stats" aria-label="Résumé du planning">
          <div className="tl__stat">
            <span className="tl__stat-label" style={{ '--tl-c': 'var(--color-accent)' }}><i /> Chambres occupées</span>
            <b>{stats.occupees} <small>/ {chambres.length}</small></b>
          </div>
          <div className="tl__stat">
            <span className="tl__stat-label" style={{ '--tl-c': 'var(--color-accent-soft)' }}><i /> Nuitées planifiées</span>
            <b>{stats.nuits}</b>
          </div>
          <div className="tl__stat">
            <span className="tl__stat-label" style={{ '--tl-c': 'var(--color-success)' }}><i /> Revenu planifié</span>
            <b>{formatArgent(stats.revenu)} <small>{DEVISE}</small></b>
          </div>
        </div>

        <div className="tl__nav">
          <div className="tl__zoom" role="group" aria-label="Échelle du planning">
            {Object.entries(ZOOMS).map(([id, z]) => (
              <button key={id} type="button" aria-pressed={zoom === id} title={id === 'jour' ? 'Vue par jours' : id === 'demi' ? 'Zoom : graduation toutes les 6 heures' : 'Zoom maximal : graduation à l’heure, idéal pour les passages'} onClick={() => changerZoom(id)}>
                {z.libelle}
              </button>
            ))}
          </div>
          <Button variante="secondaire" taille="s" icone={ChevronLeft} onClick={() => defiler(-infosZoom.navJours)}>
            {infosZoom.navJours} j
          </Button>
          <Button variante="secondaire" taille="s" onClick={versAujourdhui}>
            {zoome ? 'Maintenant' : 'Aujourd’hui'}
          </Button>
          <Button
            variante="secondaire"
            taille="s"
            iconeDroite={ChevronRight}
            onClick={() => defiler(infosZoom.navJours)}
          >
            {infosZoom.navJours} j
          </Button>
        </div>
      </div>

      <div className="tl__legende">
        {LEGENDE.map((statut) => (
          <span key={statut} style={{ '--c': STATUTS_RESERVATION[statut].fond }}>
            <i />
            {STATUTS_RESERVATION[statut].libelle}
          </span>
        ))}
        <span className="tl__aide">
          {zoome
            ? 'Clic sur une case libre : passage de 2 h · Glisser : déplacer · Bords : allonger'
            : 'Clic sur une case libre : réserver · Séjours courts : zoom 6 h / Heures · Glisser : déplacer'}
        </span>
      </div>

      <div
        ref={refDefil}
        className={`tl__defil${pan ? ' tl__defil--pan' : ''}`}
        onScroll={masquerSurvols}
      >
        <div
          className="tl__plateau"
          onPointerDown={surPointerBas}
          onPointerMove={surPointerBouge}
          onPointerUp={surPointerHaut}
          onPointerCancel={surPointerAnnule}
          onPointerLeave={masquerSurvols}
        >
          <div className="tl__coin">Chambres</div>

          <div className="tl__jours">
            {jours.map((jour, i) => {
              const weekend = jour.getDay() % 6 === 0
              const estAuj = i === JOURS_AVANT
              const classes = `tl__jour${weekend ? ' tl__jour--we' : ''}${estAuj ? ' tl__jour--auj' : ''}`
              return (
                <div className={classes} key={i}>
                  {(i === 0 || jour.getDate() === 1) && (
                    <em className="tl__mois">
                      {jour.toLocaleDateString('fr-FR', { month: 'short' })}
                    </em>
                  )}
                  <span className="tl__jour-label">
                    {JOURS_SEMAINE[jour.getDay()]}
                    <b>{jour.getDate()}</b>
                  </span>
                  {graduation > 0 && (
                    <span className="tl__heures" aria-hidden="true">
                      {Array.from({ length: 24 / graduation }, (_, k) => (
                        <i key={k} style={{ width: (lj * graduation) / 24 }}>{String(k * graduation).padStart(2, '0')}h</i>
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="tl__chambres">
            {chambres.map((c) => (
              <div
                className="tl__chambre"
                key={c.id}
                title={STATUTS_CHAMBRE[c.statut]?.libelle}
                style={{ '--tl-etage': STATUTS_CHAMBRE[c.statut]?.pastille ?? 'var(--color-text-faint)' }}
                role="button"
                aria-label={`Chambre ${c.numero}, ${STATUTS_CHAMBRE[c.statut]?.libelle ?? 'statut inconnu'}`}
                tabIndex={0}
                onClick={() => {
                  const cleMaintenant = versLocal(new Date())
                  const occupe = reservations.find((r) => r.chambreId === c.id && STATUTS_ACTIFS.includes(r.statut) && String(r.dateDebut).slice(0, 16) <= cleMaintenant && String(r.dateFin).slice(0, 16) > cleMaintenant)
                  const prochaine = reservations.find((r) => r.chambreId === c.id && STATUTS_ACTIFS.includes(r.statut) && String(r.dateDebut).slice(0, 10) >= cleJour(auj))
                  if (occupe || prochaine) onOuvrir((occupe || prochaine).id)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const r = reservations.find((x) => x.chambreId === c.id && STATUTS_ACTIFS.includes(x.statut)); if (r) onOuvrir(r.id) } }}
              >
                <b>{c.numero}</b>
                <span>{c.typeLabel}</span>
                <span className="tl__statut">{STATUTS_CHAMBRE[c.statut]?.libelle ?? 'Statut inconnu'}</span>
              </div>
            ))}
          </div>

          <div
            ref={refPiste}
            className="tl__piste"
            style={{ height: chambres.length * HAUTEUR_LIGNE }}
            onClick={surClic}
          >
            {jours.map((jour, i) => {
              const weekend = jour.getDay() % 6 === 0
              const estAuj = i === JOURS_AVANT
              if (!weekend && !estAuj) return null
              return (
                <div
                  className={`tl__col${estAuj ? ' tl__col--auj' : ''}`}
                  key={i}
                  style={{ left: i * lj }}
                />
              )
            })}

            {idxMaintenant > 0 && idxMaintenant < NB_JOURS && (
              <div className="tl__maintenant" aria-hidden="true" style={{ left: idxMaintenant * lj }} />
            )}

            {caseSurvol && (
              <div
                className="tl__case"
                aria-hidden="true"
                style={{
                  left: zoome ? (caseSurvol.jour + caseSurvol.heure / 24) * lj : caseSurvol.jour * lj,
                  top: caseSurvol.ligne * HAUTEUR_LIGNE,
                  width: largeurCaseSurvol
                }}
              >
                <Plus size={16} />
              </div>
            )}

            {visibles.map((r) => {
              const ap = apercu?.id === r.id ? apercu : null
              const idxDebut = ap ? ap.idxDebut : r.idxDebut
              const idxFin = ap ? ap.idxFin : r.idxFin
              const ligne = ap ? ap.ligne : r.ligne
              const passage = r.typeSejour === 'heure'
              const largeur = Math.max(passage ? 18 : 0, (idxFin - idxDebut) * lj - 4)
              const montant = ap ? montantApercu(r, idxDebut, idxFin, ligne) : r.total
              const infos = STATUTS_RESERVATION[r.statutAffiche]
              const droits = droitsDe(r.statut)
              const classes = [
                'tl__resa',
                ap && 'tl__resa--deplace',
                ap && !ap.ok && 'tl__resa--refus',
                largeur < 120 && 'tl__resa--etroit',
                largeur < 150 && 'tl__resa--court',
                largeur < 44 && 'tl__resa--minuscule'
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={r.id}
                  data-resa={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${r.clientNom}, chambre ${r.numeroChambre}, ${infos.libelle}`}
                  className={classes}
                  style={{
                    left: idxDebut * lj + 2,
                    width: largeur,
                    top: ligne * HAUTEUR_LIGNE,
                    '--resa-fond': infos.fond,
                    '--resa-texte': infos.texte
                  }}
                  onFocus={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setSurvol({ id: r.id, ...positionCarte(rect, rect.left + 24) })
                  }}
                  onBlur={() => setSurvol(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOuvrir(r.id)
                    }
                  }}
                >
                  {droits.debut && <span className="tl__poignee tl__poignee--g" data-poignee="g" />}
                  <b>{r.clientNom}</b>
                  <small>
                    {passage ? `${String(r.dateDebut).slice(11, 16)}–${String(r.dateFin).slice(11, 16)}` : libelleNuits(Math.round(idxFin - idxDebut))} · {formatArgent(montant)} {DEVISE}
                  </small>
                  <i className="tl__canal">{CANAUX_ABREGE[r.canal]}</i>
                  {droits.fin && <span className="tl__poignee tl__poignee--d" data-poignee="d" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {apercu && enCours && (
        <div className="tl__bulle" style={{ left: apercu.x + 16, top: apercu.y + 16 }}>
          {apercu.ok ? (
            <>
              Chambre <b>{chambres[apercu.ligne].numero}</b> ·{' '}
              {enCours.typeSejour === 'heure'
                ? `${formatCourt(dateIdx(apercu.idxDebut))} ${heureIdx(apercu.idxDebut)} → ${heureIdx(apercu.idxFin)} · ${libelleHeures((apercu.idxFin - apercu.idxDebut) * 24)}`
                : `${formatCourt(dateIdx(apercu.idxDebut))} → ${formatCourt(dateIdx(apercu.idxFin))} · ${libelleNuits(Math.round(apercu.idxFin - apercu.idxDebut))}`}
              <br />
              <b>
                {formatArgent(montantApercu(enCours, apercu.idxDebut, apercu.idxFin, apercu.ligne))} {DEVISE}
              </b>
            </>
          ) : (
            'Chambre indisponible sur ces dates'
          )}
        </div>
      )}

      {resaSurvol && <CarteReservation r={resaSurvol} position={survol} />}
    </div>
  )
}