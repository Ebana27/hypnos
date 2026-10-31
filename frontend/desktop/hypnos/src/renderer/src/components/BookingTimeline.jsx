/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Button from './base/Button'
import injecterStyles from './base/injecterStyles'
import {
  CANAUX,
  CANAUX_ABREGE,
  DEVISE,
  STATUTS_ACTIFS,
  STATUTS_RESERVATION,
  ajouterJours,
  aujourdhui,
  cleJour,
  ecartJours,
  enConflit,
  formatArgent,
  formatCourt,
  jourDe,
  libelleNuits
} from '../lib/reservations'


const NB_JOURS = 75
const JOURS_AVANT = 7 // jours affichés avant aujourd'hui
const LARGEUR_JOUR = 68
const HAUTEUR_LIGNE = 62
const LARGEUR_CHAMBRES = 128
const JOURS_SEMAINE = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
const COULEURS_ETAGE = ['var(--color-accent)', 'var(--color-warning)', 'var(--color-success)']
const LEGENDE = ['en_attente', 'confirmee', 'en_sejour', 'terminee']

const borner = (valeur, min, max) => Math.min(max, Math.max(min, valeur))

const formatLong = (date) =>
  date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

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
  gap: 16px;
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
  gap: 8px;
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
.tl__mois {
  position: absolute;
  top: 2px;
  left: 4px;
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

/* ---------- Piste ---------- */
.tl__piste {
  position: relative;
  width: calc(var(--tl-n) * var(--tl-dw));
  overflow: hidden;
  background-image:
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
  background-size: var(--tl-dw) var(--tl-rh);
  background-position: 0 -1px, 0 0;
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

/* Case libre sous le curseur : un clic crée une réservation */
.tl__case {
  position: absolute;
  display: grid;
  place-items: center;
  width: var(--tl-dw);
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

/* ---------- Fiche d'une réservation (au survol) ---------- */
.tl__carte {
  position: fixed;
  z-index: 3400;
  width: 320px;
  padding: 14px 16px;
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
.tl__carte-tel {
  margin-top: 2px;
  color: var(--color-text-muted);
}
.tl__carte-liste {
  display: grid;
  gap: 5px;
  margin-top: 10px;
}
.tl__carte-liste div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.tl__carte-liste dt {
  color: var(--color-text-muted);
}
.tl__carte-liste dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
.tl__carte-du {
  color: var(--color-danger);
}
.tl__carte-conso {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.tl__carte-aide {
  margin-top: 8px;
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
//  FICHE D'UNE RÉSERVATION (affichée au survol)
// ============================================================
function CarteReservation({ r, position }) {
  const infos = STATUTS_RESERVATION[r.statut]
  const nomComplet = r.client ? `${r.client.prenom} ${r.client.nom}` : r.clientNom
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
      {r.client?.tel && <p className="tl__carte-tel">{r.client.tel}</p>}

      <dl className="tl__carte-liste">
        <div>
          <dt>Chambre</dt>
          <dd>
            {r.numeroChambre} · {r.typeLabel}
          </dd>
        </div>
        <div>
          <dt>Arrivée</dt>
          <dd>{formatLong(jourDe(r.dateDebut))}</dd>
        </div>
        <div>
          <dt>Départ</dt>
          <dd>{formatLong(jourDe(r.dateFin))}</dd>
        </div>
        <div>
          <dt>Séjour</dt>
          <dd>
            {libelleNuits(r.nuits)} · {r.nombreDePersonne} personne{r.nombreDePersonne > 1 ? 's' : ''}
          </dd>
        </div>
        <div>
          <dt>Canal</dt>
          <dd>{CANAUX[r.canal] ?? r.canal}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>
            {formatArgent(r.total)} {DEVISE}
          </dd>
        </div>
        <div>
          <dt>Payé</dt>
          <dd>
            {formatArgent(r.montantPaye)} {DEVISE}
          </dd>
        </div>
        <div>
          <dt>Reste à payer</dt>
          <dd className={r.reste > 0 ? 'tl__carte-du' : undefined}>
            {formatArgent(Math.max(r.reste, 0))} {DEVISE}
          </dd>
        </div>
      </dl>

      {r.consos.length > 0 && (
        <p className="tl__carte-conso">
          Services : {r.consos.map((c) => `${c.serviceNom} ×${c.quantite}`).join(', ')}
        </p>
      )}
      <p className="tl__carte-aide">Cliquez pour ouvrir la réservation.</p>
    </div>
  )
}

/**
 * Props :
 *  chambres      [{ id, numero, etage, typeLabel, prixNuit }] déjà triées
 *  reservations  réservations enrichies (clientNom, nuits, total, services, canal…)
 *  onOuvrir(id)                      clic sur une réservation
 *  onDeplacer(id, { chambreId, debut, fin })  après un glisser valide
 *  onCreer({ chambreId, debut, fin }) clic sur une case libre
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
  const [apercu, setApercu] = useState(null)
  const [pan, setPan] = useState(false)
  const [survol, setSurvol] = useState(null) // fiche d'une réservation
  const [caseSurvol, setCaseSurvol] = useState(null) // case libre sous le curseur

  const auj = useMemo(() => aujourdhui(), [])
  const debut = useMemo(() => ajouterJours(auj, -JOURS_AVANT), [auj])
  const jours = useMemo(
    () => Array.from({ length: NB_JOURS }, (_, i) => ajouterJours(debut, i)),
    [debut]
  )

  const indexLigne = useMemo(() => new Map(chambres.map((c, i) => [c.id, i])), [chambres])

  const couleursEtage = useMemo(() => {
    const etages = [...new Set(chambres.map((c) => c.etage))].sort((a, b) => a - b)
    return Object.fromEntries(etages.map((e, i) => [e, COULEURS_ETAGE[i % COULEURS_ETAGE.length]]))
  }, [chambres])

  const visibles = useMemo(
    () =>
      reservations
        .filter((r) => r.statut !== 'annulee' && indexLigne.has(r.chambreId))
        .map((r) => ({
          ...r,
          ligne: indexLigne.get(r.chambreId),
          idxDebut: ecartJours(debut, jourDe(r.dateDebut)),
          idxFin: ecartJours(debut, jourDe(r.dateFin))
        }))
        .filter((r) => r.idxFin > 0 && r.idxDebut < NB_JOURS),
    [reservations, indexLigne, debut]
  )

  const stats = useMemo(() => {
    const actives = reservations.filter((r) => STATUTS_ACTIFS.includes(r.statut))
    const cle = cleJour(auj)
    const occupees = new Set(
      actives.filter((r) => r.dateDebut <= cle && cle < r.dateFin).map((r) => r.chambreId)
    ).size
    return {
      occupees,
      nuits: actives.reduce((somme, r) => somme + r.nuits, 0),
      revenu: actives.reduce((somme, r) => somme + r.total, 0)
    }
  }, [reservations, auj])

  // Au démarrage : la veille d'aujourd'hui est la première colonne visible
  useEffect(() => {
    if (refDefil.current) refDefil.current.scrollLeft = (JOURS_AVANT - 1) * LARGEUR_JOUR
  }, [])

  const defiler = (nombreJours) =>
    refDefil.current?.scrollBy({ left: nombreJours * LARGEUR_JOUR, behavior: 'smooth' })
  const versAujourdhui = () =>
    refDefil.current?.scrollTo({ left: (JOURS_AVANT - 1) * LARGEUR_JOUR, behavior: 'smooth' })

  // ---------- Cases et survol ----------
  // Case (jour, chambre) sous le curseur, ou null si le curseur est hors de la piste
  function celluleSous(e) {
    const piste = refPiste.current
    if (!piste) return null
    const rect = piste.getBoundingClientRect()
    const jour = Math.floor((e.clientX - rect.left) / LARGEUR_JOUR)
    const ligne = Math.floor((e.clientY - rect.top) / HAUTEUR_LIGNE)
    if (jour < 0 || jour >= NB_JOURS || ligne < 0 || ligne >= chambres.length) return null
    return { jour, ligne }
  }

  // Réservation d'une nuit qui commencerait sur cette case
  const candidatPour = ({ jour, ligne }) => ({
    chambreId: chambres[ligne].id,
    debut: cleJour(ajouterJours(debut, jour)),
    fin: cleJour(ajouterJours(debut, jour + 1))
  })

  // Place la fiche sous la barre (ou au-dessus s'il n'y a pas la place)
  function positionCarte(rect, x) {
    const dessous = rect.bottom + 290 < window.innerHeight
    return {
      gauche: Math.min(Math.max(8, x - 24), window.innerWidth - 328),
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
    const cle = cellule ? `${cellule.jour}:${cellule.ligne}` : ''
    if (cle === refCase.current) return
    refCase.current = cle
    setCaseSurvol(cellule && !enConflit(reservations, candidatPour(cellule)) ? cellule : null)
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

    const dj = Math.round((e.clientX - g.x + defil.scrollLeft - g.sl) / LARGEUR_JOUR)
    const dl = Math.round((e.clientY - g.y + defil.scrollTop - g.st) / HAUTEUR_LIGNE)

    let { idxDebut: d, idxFin: f, ligne } = g.r
    if (g.mode === 'deplacer') {
      d += dj
      f += dj
      ligne = borner(ligne + dl, 0, chambres.length - 1)
    } else if (g.mode === 'debut') {
      d = Math.min(d + dj, f - 1)
    } else {
      f = Math.max(f + dj, d + 1)
    }

    const candidat = {
      chambreId: chambres[ligne].id,
      debut: cleJour(ajouterJours(debut, d)),
      fin: cleJour(ajouterJours(debut, f))
    }
    const ok = d >= 0 && f <= NB_JOURS && !enConflit(reservations, candidat, g.r.id)
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
      onRefus?.('Modification impossible : chambre déjà occupée ou hors de la période affichée.')
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
    if (enConflit(reservations, candidat)) {
      onRefus?.('Cette chambre est déjà réservée ce jour-là.')
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

  return (
    <div
      className="tl"
      style={{
        '--tl-dw': `${LARGEUR_JOUR}px`,
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
          <Button variante="secondaire" taille="s" icone={ChevronLeft} onClick={() => defiler(-7)}>
            7 j
          </Button>
          <Button variante="secondaire" taille="s" onClick={versAujourdhui}>
            Aujourd’hui
          </Button>
          <Button
            variante="secondaire"
            taille="s"
            iconeDroite={ChevronRight}
            onClick={() => defiler(7)}
          >
            7 j
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
          Clic sur une case libre : réserver · Survol : détails · Glisser : déplacer · Bords :
          allonger
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
                  {JOURS_SEMAINE[jour.getDay()]}
                  <b>{jour.getDate()}</b>
                </div>
              )
            })}
          </div>

          <div className="tl__chambres">
            {chambres.map((c) => (
              <div className="tl__chambre" key={c.id} style={{ '--tl-etage': couleursEtage[c.etage] }}>
                <b>{c.numero}</b>
                <span>{c.typeLabel}</span>
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
                  style={{ left: i * LARGEUR_JOUR }}
                />
              )
            })}

            {caseSurvol && (
              <div
                className="tl__case"
                aria-hidden="true"
                style={{ left: caseSurvol.jour * LARGEUR_JOUR, top: caseSurvol.ligne * HAUTEUR_LIGNE }}
              >
                <Plus size={16} />
              </div>
            )}

            {visibles.map((r) => {
              const ap = apercu?.id === r.id ? apercu : null
              const idxDebut = ap ? ap.idxDebut : r.idxDebut
              const idxFin = ap ? ap.idxFin : r.idxFin
              const ligne = ap ? ap.ligne : r.ligne
              const nuits = idxFin - idxDebut
              const montant = ap ? nuits * chambres[ligne].prixNuit + r.services : r.total
              const infos = STATUTS_RESERVATION[r.statut]
              const droits = droitsDe(r.statut)
              const classes = `tl__resa${ap ? ' tl__resa--deplace' : ''}${ap && !ap.ok ? ' tl__resa--refus' : ''}`

              return (
                <div
                  key={r.id}
                  data-resa={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${r.clientNom}, chambre ${r.numeroChambre}, ${infos.libelle}`}
                  className={classes}
                  style={{
                    left: idxDebut * LARGEUR_JOUR + 2,
                    width: nuits * LARGEUR_JOUR - 4,
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
                    {libelleNuits(nuits)} · {formatArgent(montant)} {DEVISE}
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
              {formatCourt(ajouterJours(debut, apercu.idxDebut))} →{' '}
              {formatCourt(ajouterJours(debut, apercu.idxFin))} ·{' '}
              {libelleNuits(apercu.idxFin - apercu.idxDebut)}
              <br />
              <b>
                {formatArgent(
                  (apercu.idxFin - apercu.idxDebut) * chambres[apercu.ligne].prixNuit +
                    enCours.services
                )}{' '}
                {DEVISE}
              </b>
            </>
          ) : (
            'Chambre déjà occupée sur ces dates'
          )}
        </div>
      )}

      {resaSurvol && <CarteReservation r={resaSurvol} position={survol} />}
    </div>
  )
}