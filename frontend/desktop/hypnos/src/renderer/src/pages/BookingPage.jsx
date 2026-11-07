/* eslint-disable react/prop-types */
// Page Réservations : liste, planning, nouvelle réservation (grille), fiche d'une réservation (blocs horizontaux).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  CalendarRange,
  Check,
  List,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Plus,
  Search
} from 'lucide-react'
import BookingTimeline from '../components/BookingTimeline'
import MethodesPaiement from '../components/MethodesPaiement'
import Button from '../components/base/Button'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'
import {
  CANAUX,
  DEVISE,
  DUREE_MAX_PASSAGE_H,
  ORDRE_STATUTS,
  STATUTS_RESERVATION,
  ajouterJours,
  aujourdhui,
  chambreReservable,
  cleJour,
  enConflit,
  formatArgent,
  formatCourt,
  initiales,
  jourDe,
  libelleHeures,
  libelleNuits,
  montantPassage,
  nomClient,
  nuitsEntre,
  heuresEntre,
  prixSejour,
  statutAffiche,
  montantPayeEffectif,
  totaux,
  versLocal
} from '../lib/reservations'

const NOUVEAU_CLIENT = '__nouveau'
const OPTIONS_CANAL = Object.entries(CANAUX).map(([valeur, libelle]) => ({ valeur, libelle }))
const OPTIONS_SEXE = [
  { valeur: 'M', libelle: 'Homme' },
  { valeur: 'F', libelle: 'Femme' }
]
const LIBELLES_MODE = {
  especes: 'Espèces',
  carte: 'Carte',
  mtn_money: 'MTN Money',
  airtel_money: 'Airtel Money'
}
const LIBELLES_PAIEMENT = {
  acompte: 'Acompte',
  paiement_client: 'Règlement',
  remboursement_acompte: 'Remboursement'
}
const estMobileMoney = (mode) => mode === 'mtn_money' || mode === 'airtel_money'

function AideSurvol({ texte, className = '', children }) {
  return (
    <div className={`resa-new__aide-champ ${className}`.trim()} data-aide={texte}>
      <span className="resa-new__aide-icone" aria-hidden="true">i</span>
      {children}
    </div>
  )
}

const normaliser = (texte) =>
  String(texte)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const dateHeureLocale = (valeur, heure = '15:00') => {
  const s = String(valeur ?? '')
  if (!s) return ''
  return s.length === 10 ? `${s}T${heure}` : s.slice(0, 16)
}
const libelleDate = (date) => {
  const s = String(date ?? '')
  if (!s) return 'À choisir'
  const d = new Date(`${s.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? 'Date invalide' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
const heureDe = (valeur, defaut) => String(valeur ?? '').slice(11, 16) || defaut
const periodeCourte = (debut, fin) =>
  `${formatCourt(jourDe(debut))} ${heureDe(debut, '15:00')} → ${formatCourt(jourDe(fin))} ${heureDe(fin, '11:00')}`
const finMaxPassage = (debut) => {
  const d = new Date(debut)
  if (Number.isNaN(d.getTime())) return undefined
  return versLocal(new Date(d.getTime() + DUREE_MAX_PASSAGE_H * 3600000))
}

// ============================================================
//  STYLE (intégré à la page)
// ============================================================
const STYLES = `
/* ---------- Choix de la vue ---------- */
.vues {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}
.vues__bouton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.vues__bouton:hover { color: var(--color-accent); }
.vues__bouton[aria-selected='true'] {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

/* ---------- Liste ---------- */
.resas__outils { margin-bottom: 14px; }
.resas__filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.resas__liste { display: flex; flex-direction: column; }
.resas__etat {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}
.resas__vide-titre {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.ligne-resa {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 8px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-s);
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.ligne-resa:hover { background: var(--color-accent-wash); }
.ligne-resa__avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--color-background-mute);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}
.ligne-resa__infos { flex: 1; min-width: 0; }
.ligne-resa__nom {
  display: block;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ligne-resa__detail {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
}
.ligne-resa__montant {
  flex-shrink: 0;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
}
.ligne-resa__reste {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-warning);
}
.badge-resa {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--badge-fond);
  color: var(--badge-texte);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

/* ---------- Fiche d'une réservation : un bandeau, puis trois blocs côte à côte ---------- */
.fiche {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.fiche__bandeau {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-border);
}
.fiche__bloc {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
  padding: 10px 14px;
  background: var(--color-background-soft);
}
.fiche__etiquette { font-size: 11px; color: var(--color-text-muted); }
.fiche__bloc strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fiche__bloc small {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fiche__cartes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 12px;
  align-items: stretch;
}
.fiche__carte {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
.fiche__carte--paiement { border-color: var(--color-border-strong); }
.fiche__titre {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
}
.fiche__sous-titre { margin: 0; font-size: 12px; font-weight: 600; }
.fiche__grille { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.fiche__note { margin: 0; font-size: 12px; color: var(--color-text-muted); }
.fiche__services { display: grid; grid-template-columns: 1fr; gap: 8px; }
.fiche__service-ligne { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.fiche__service {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  cursor: pointer;
}
.fiche__service input { flex-shrink: 0; accent-color: var(--color-accent); }
.fiche__prix { flex-shrink: 0; font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
.fiche__prix-libre { width: 100px; min-width: 0; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-s); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 12px; }
.fiche__services-total { display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--color-border); font-size: 12px; font-weight: 600; }
.fiche__lignes { display: grid; gap: 6px; margin: 0; }
.fiche__lignes div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.fiche__lignes dt { color: var(--color-text-muted); }
.fiche__lignes dd { margin: 0; font-weight: 600; text-align: right; white-space: nowrap; }
.fiche__sous-ligne { padding-left: 10px; font-size: 11px; }
.fiche__paye dd { color: var(--color-success); }
.fiche__reste {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  font-size: 12px;
  font-weight: 600;
}
.fiche__reste strong { font-family: var(--font-display); font-size: 20px; }
.fiche__reste--solde {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  color: var(--color-success);
}
.fiche__historique {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 11px;
  color: var(--color-text-muted);
}
.fiche__historique li { display: flex; justify-content: space-between; gap: 10px; }
.fiche__historique strong { color: var(--color-text); font-weight: 600; white-space: nowrap; }
.fiche__encaisser {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.detail-resa__pied {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}
.detail-resa__pied-droite { display: flex; flex-wrap: wrap; gap: 10px; }
.fiche__plein { grid-column: 1 / -1; }
/* Aucun champ ne déborde de sa carte */
.fiche__carte, .fiche__carte *, .fiche__grille > * { min-width: 0; box-sizing: border-box; }
.fiche__carte input:not([type='checkbox']):not([type='radio']), .fiche__carte select { width: 100%; max-width: 100%; }
.fiche__carte .fiche__prix-libre { width: 100px; }
@media (max-width: 940px) {
  .fiche__bandeau { grid-template-columns: 1fr 1fr; }
  .fiche__cartes { grid-template-columns: 1fr 1fr; }
  .fiche__carte--paiement { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .fiche__cartes { grid-template-columns: 1fr; }
}

/* ---------- Tableau « avant / après » du déplacement ---------- */
.detail-resa__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.detail-resa__table th,
.detail-resa__table td {
  padding: 8px 4px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
.detail-resa__table th:last-child,
.detail-resa__table td:last-child { text-align: right; }
.detail-resa__table th { font-size: 11px; color: var(--color-text-muted); }
.detail-resa__table b { font-weight: 700; }

/* ---------- Nouvelle réservation : champs contraints, panneaux aérés ---------- */
.resa-new {
  /* ---- Réglage des infobulles (AideSurvol) ---- */
  --aide-delai-apparition: 500ms;   /* attente avant d'afficher l'infobulle au survol */
  --aide-duree-apparition: 150ms;   /* durée du fondu d'apparition */
  --aide-delai-disparition: 0ms;    /* attente avant de la masquer quand la souris part */
  --aide-duree-disparition: 200ms;  /* durée du fondu de disparition */
  display: grid;
  grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr);
  gap: 14px;
  align-items: start;
  width: 100%;
}
.resa-new__col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
.resa-new__bas { grid-column:1 / -1; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); align-items:start; gap:14px; min-width:0; }
.resa-new__invoice { display:flex; flex-direction:column; gap:12px; }
.resa-new__invoice .resa-new__totaux { margin-top:auto; }
.resa-new__titre {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
}
.resa-new__grille { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; min-width:0; }
.resa-new__col, .resa-new__col *, .resa-new__grille > *, .resa-new__bas > * { min-width:0; box-sizing:border-box; }
.resa-new__col input:not([type="checkbox"]):not([type="radio"]), .resa-new__col select, .resa-new__col textarea { width:100%; max-width:100%; min-width:0; box-sizing:border-box; }
.resa-new__plein { grid-column: 1 / -1; }
.resa-new__etiquette {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.resa-new__liste {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.resa-new__choix {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-s);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.resa-new__choix:hover { border-color: var(--color-accent); background: var(--color-accent-wash); }
.resa-new__choix strong { font-size: 13px; font-weight: 600; }
.resa-new__choix span { font-size: 11px; color: var(--color-text-muted); }
.resa-new__vide { margin: 0; font-size: 12px; color: var(--color-text-muted); }
.resa-new__client {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px;
  border-radius: var(--radius-s);
  background: var(--color-background-soft);
  font-size: 12px;
  color: var(--color-text-muted);
}
.resa-new__client strong { font-size: 14px; font-weight: 600; color: var(--color-text); }
.resa-new__lignes { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.resa-new__lignes li,
.resa-new__total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.resa-new__lignes strong,
.resa-new__total strong { font-weight: 600; text-align: right; color: var(--color-text); }
.resa-new__totaux {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.resa-new__net { color: var(--color-text); font-weight: 600; }
.resa-new__net strong { font-family: var(--font-display); font-size: 20px; color: var(--color-accent); }
.resa-new__note { margin: 0; font-size: 11px; color: var(--color-text-faint); }
.resa-new__aide-champ { position:relative; width:100%; min-width:0; }
.resa-new__aide-champ:hover, .resa-new__aide-champ:focus-within { z-index:31; }
.resa-new__aide-only { height:18px; }
.resa-new__actions { grid-column:1 / -1; display:flex; justify-content:flex-end; padding-top:10px; border-top:1px solid var(--color-border); }
.resa-new__aide-icone { position:absolute; z-index:2; top:2px; right:2px; display:grid; place-items:center; width:16px; height:16px; border:1px solid var(--color-border); border-radius:50%; background:var(--color-surface); color:var(--color-text-muted); font-size:10px; font-weight:700; pointer-events:none; }
.resa-new__aide-champ label { padding-right:22px; cursor:help; }
.resa-new__aide-champ::after { content:attr(data-aide); position:absolute; z-index:30; left:0; bottom:calc(100% + 6px); width:max-content; max-width:min(280px, calc(100vw - 40px)); padding:8px 10px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-text); color:var(--color-surface); box-shadow:0 8px 24px rgba(0,0,0,.18); font-size:12px; line-height:1.4; white-space:normal; overflow-wrap:anywhere; opacity:0; transform:translateY(3px); pointer-events:none; transition:opacity var(--aide-duree-disparition) ease var(--aide-delai-disparition), transform var(--aide-duree-disparition) ease var(--aide-delai-disparition); }
.resa-new__aide-champ:hover::after, .resa-new__aide-champ:focus-within::after { opacity:1; transform:translateY(0); transition:opacity var(--aide-duree-apparition) ease var(--aide-delai-apparition), transform var(--aide-duree-apparition) ease var(--aide-delai-apparition); }
.resa-new__infos-supp { display:grid; gap:8px; padding-top:8px; border-top:1px solid var(--color-border); }
.resa-new__onglets { display:flex; gap:6px; flex-wrap:wrap; }
.resa-new__onglet { padding:6px 9px; border:1px solid var(--color-border); border-radius:var(--radius-pill); background:var(--color-surface); color:var(--color-text-muted); font:inherit; font-size:11px; cursor:pointer; }
.resa-new__onglet[aria-selected='true'] { border-color:var(--color-accent); background:var(--color-accent-wash); color:var(--color-accent); }
.resa-new__textarea { width:100%; min-height:75px; resize:vertical; padding:9px 10px; border:1px solid var(--color-border); border-radius:var(--radius-s); background:var(--color-surface); color:var(--color-text); font:inherit; font-size:12px; }
.resa-new__paiement-note { margin:6px 0; color:var(--color-text-muted); font-size:11px; line-height:1.45; }
.facture__actions { display:flex; gap:6px; flex-wrap:wrap; }
#facture-imprimable { display:grid; gap:8px; padding:12px; border:1px solid var(--color-border); border-radius:var(--radius-s); }
#facture-imprimable > strong { font-size:13px; }
#facture-imprimable > p { margin:0; font-size:12px; color:var(--color-text-muted); }
@media print { body * { visibility:hidden !important; } #facture-imprimable, #facture-imprimable * { visibility:visible !important; } #facture-imprimable { position:fixed; inset:0 auto auto 0; width:100%; padding:24px; border:0; color:#111; background:#fff; } .facture__actions, .modal__pied, .fiche__encaisser { display:none !important; } }
@media (max-width: 900px) { .resa-new { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } }
@media (max-width: 680px) { .resa-new, .resa-new__bas { grid-template-columns:minmax(0,1fr); } .resa-new__bas { grid-column:1; } }
`

injecterStyles('hypnos-page-reservations', STYLES)

// ============================================================
//  DONNÉES : tout ce que les deux vues ont besoin de savoir
// ============================================================

function construireModele({
  chambres,
  types,
  reservations,
  clients,
  services,
  consommations,
  mouvements
}) {
  const typesParId = Object.fromEntries(types.map((t) => [t.id, t]))
  const clientsParId = Object.fromEntries(clients.map((c) => [c.id, c]))
  const servicesParId = Object.fromEntries(services.map((s) => [s.id, s]))

  const consosParResa = {}
  for (const c of consommations) {
    if (c.reservationId != null) (consosParResa[c.reservationId] ??= []).push(c)
  }

  // Paiements, acomptes et remboursements rattachés à chaque réservation (écrits par la caisse)
  const paiementsParResa = {}
  for (const m of mouvements) {
    if (m.reservationId != null) (paiementsParResa[m.reservationId] ??= []).push(m)
  }

  const chambresTriees = [...chambres]
    .sort((a, b) => a.etage - b.etage || a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
    .map((c) => {
      const type = typesParId[c.typeId]
      return {
        id: c.id,
        numero: c.numero,
        etage: c.etage,
        statut: c.statut,
        typeLabel: type?.label ?? '',
        prixNuit: type?.prix ?? 0,
        prixHoraire: type?.prixHoraire ?? 0,
        reglePassage: type?.reglePassage ?? 'prorata',
        capacite: type?.capacite ?? 1
      }
    })
  const chambresParId = Object.fromEntries(chambresTriees.map((c) => [c.id, c]))

  const resas = reservations.map((r) => {
    const chambre = chambresParId[r.chambreId]
    const client = clientsParId[r.clientId]
    // Le montant d'un service = montant enregistré, sinon prix du catalogue × quantité
    // (les anciennes consommations créées sans montant sont ainsi rattrapées).
    const consos = (consosParResa[r.id] ?? []).map((c) => {
      const s = servicesParId[c.serviceId]
      const montant =
        Number(c.montant) > 0 ? Number(c.montant) : Math.round((s?.prixUnitaire ?? 0) * (c.quantite ?? 1))
      return { ...c, serviceNom: s?.nom ?? 'Service', montant }
    })
    const prixNuit = chambre?.prixNuit ?? 0
    const paiements = paiementsParResa[r.id] ?? []
    const montantPaye = montantPayeEffectif(r, paiements)
    const reservationAvecPaye = { ...r, montantPaye }
    const calc = totaux(reservationAvecPaye, prixNuit, consos)
    return {
      ...r,
      montantPaye,
      client,
      clientNom: nomClient(client),
      numeroChambre: chambre?.numero ?? '?',
      typeLabel: chambre?.typeLabel ?? '',
      capacite: chambre?.capacite ?? 1,
      prixNuit,
      nuits: r.typeSejour === 'heure' ? 0 : nuitsEntre(r.dateDebut, r.dateFin),
      consos,
      paiements: [...paiements].sort((a, b) => b.id - a.id),
      ...calc,
      statutAffiche: statutAffiche(r.statut, calc.reste)
    }
  })

  const derniereReservationClient = new Map()
  for (const r of resas) {
    if (r.statut === 'annulee') continue
    const courante = derniereReservationClient.get(r.clientId)
    if (!courante || String(r.dateDebut) > String(courante)) {
      derniereReservationClient.set(r.clientId, r.dateDebut)
    }
  }
  const clientsRecents = [...clients].sort(
    (a, b) =>
      String(derniereReservationClient.get(b.id) ?? '').localeCompare(
        String(derniereReservationClient.get(a.id) ?? '')
      ) || String(b.id).localeCompare(String(a.id), 'fr', { numeric: true })
  )

  return {
    chambres: chambresTriees,
    chambresParId,
    resas,
    clientsRecents,
    clients: [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    // Les services actifs peuvent être cochés dans la fiche d'un séjour
    services: services.filter((s) => s.actif)
  }
}

function Badge({ statut }) {
  const infos = STATUTS_RESERVATION[statut]
  return (
    <span className="badge-resa" style={{ '--badge-fond': infos.fond, '--badge-texte': infos.texte }}>
      {infos.libelle}
    </span>
  )
}

// ============================================================
//  FENÊTRE : NOUVELLE RÉSERVATION
// ============================================================

const formulaireInitial = (prefill = {}) => {
  const typeSejour = prefill.typeSejour ?? 'nuit'
  const today = cleJour(aujourdhui())
  const debutRaw = prefill.debut ?? today
  const debut = dateHeureLocale(debutRaw, '15:00')
  const finRaw = prefill.fin ?? (typeSejour === 'heure' ? `${debut.slice(0, 10)}T16:00` : cleJour(ajouterJours(jourDe(debut), 1)))
  const fin = dateHeureLocale(finRaw, typeSejour === 'heure' ? '16:00' : '11:00')
  return {
    clientId: '', nom: '', prenom: '', tel: '', email: '', sexe: 'M', document: '',
    preference: '', allergies: '', infoGenerales: '', vip: false, loyalty: false,
    chambreId: prefill.chambreId ? String(prefill.chambreId) : '', debut, fin,
    personnes: '1', adultes: '1', enfants: '0', typeGroupe: 'seul',
    demandesSpeciales: '', conditionsPaiement: 'acompte_solde', canal: 'direct', statut: 'confirmee',
    acompte: '', modeAcompte: 'especes', modePaiement: 'especes', numeroPaiement: '',
    typeSejour, modeTarif: typeSejour === 'heure' ? 'heure' : 'nuit', regleArrondi: 'prorata'
  }
}

function ModaleNouvelle({ prefill, modele, chargement, onFermer, onCreer, onErreur }) {
  const [form, setForm] = useState(() => formulaireInitial(prefill))
  const [recherche, setRecherche] = useState('')
  const [infosSuppAffichees, setInfosSuppAffichees] = useState(false)
  const [ongletInfo, setOngletInfo] = useState('allergies')
  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))

  const nouveauClient = form.clientId === NOUVEAU_CLIENT
  const clientChoisi = modele.clients.find((c) => String(c.id) === String(form.clientId))
  const periodeValide = Boolean(form.debut && form.fin && form.fin > form.debut)
  const modeHeure = form.typeSejour === 'heure'
  const chambre = modele.chambresParId[Number(form.chambreId)]
  const tarif = !chambre ? 0 : modeHeure ? chambre.prixHoraire : chambre.prixNuit
  const reglePassage = chambre?.reglePassage ?? 'prorata'
  const dureeHeures = periodeValide ? heuresEntre(form.debut, form.fin) : 0
  const passageTropLong = modeHeure && dureeHeures > DUREE_MAX_PASSAGE_H
  const unitesTarif = !modeHeure
    ? `${nuitsEntre(form.debut, form.fin)} nuit(s)`
    : `${reglePassage === 'heure_commencee' ? Math.ceil(dureeHeures) : libelleHeures(dureeHeures).replace(/ heures?$/, '')} h`
  const requete = normaliser(recherche.trim())

  // Au plus 4 propositions, affichées dans la colonne (pas de liste flottante)
  const propositions = useMemo(() => {
    if (!requete) return modele.clientsRecents.slice(0, 4)
    return modele.clients
      .filter((c) =>
        normaliser(`${c.prenom ?? ''} ${c.nom ?? ''} ${c.tel ?? ''} ${c.email ?? ''}`).includes(requete)
      )
      .slice(0, 4)
  }, [modele.clients, modele.clientsRecents, requete])

  // Hors service : jamais proposée. En nettoyage : seulement si l'arrivée est dans les jours suivants.
  const libres = useMemo(
    () =>
      periodeValide
        ? modele.chambres.filter(
            (c) =>
              chambreReservable(c, form.debut) &&
              !enConflit(modele.resas, { chambreId: c.id, debut: form.debut, fin: form.fin })
          )
        : modele.chambres.filter((c) => c.statut !== 'maintenance'),
    [periodeValide, form.debut, form.fin, modele]
  )
  const chambreIndisponible =
    Boolean(form.chambreId) && !libres.some((c) => String(c.id) === form.chambreId)
  const nuits = periodeValide && !modeHeure ? nuitsEntre(form.debut, form.fin) : 0
  const plafond = periodeValide && chambre && modeHeure
    ? montantPassage(dureeHeures, reglePassage, tarif, chambre.prixNuit)
    : { plafonne: false }
  const sousTotal = periodeValide && chambre ? prixSejour({ debut: form.debut, fin: form.fin, typeSejour: form.typeSejour, modeTarif: modeHeure ? 'heure' : 'nuit', regleArrondi: reglePassage, tarif }, chambre.prixNuit) : 0
  const acompte = Number(form.acompte || 0)

  const nomAffiche = nouveauClient
    ? `${form.prenom} ${form.nom}`.trim() || 'Nouveau client'
    : clientChoisi
      ? `${clientChoisi.prenom} ${clientChoisi.nom}`
      : 'À choisir'

  function choisirClient(client) {
    setForm((f) => ({ ...f, clientId: client ? String(client.id) : '' }))
    setRecherche('')
  }

  // Si l'arrivée dépasse le départ, le départ est repoussé (1 h en passage, lendemain en nuitée)
  function changerDebut(e) {
    const debut = e.target.value
    setForm((f) => {
      if (!debut || f.fin > debut) return { ...f, debut }
      if (f.typeSejour === 'heure') {
        const prochain = new Date(debut)
        prochain.setHours(prochain.getHours() + 1)
        return { ...f, debut, fin: versLocal(prochain) }
      }
      return { ...f, debut, fin: `${cleJour(ajouterJours(jourDe(debut), 1))}T11:00` }
    })
  }

  function changerTypeSejour(e) {
    const passage = e.target.value === 'heure'
    setForm((f) => {
      const jour = String(f.debut).slice(0, 10)
      const heureArrivee = String(f.debut).slice(11, 16) || '15:00'
      if (passage) {
        const d = new Date(`${jour}T${heureArrivee}`)
        d.setHours(d.getHours() + 1)
        return { ...f, typeSejour: 'heure', modeTarif: 'heure', debut: `${jour}T${heureArrivee}`, fin: versLocal(d) }
      }
      const jourFin = String(f.fin).slice(0, 10) === jour ? cleJour(ajouterJours(jourDe(jour), 1)) : String(f.fin).slice(0, 10)
      return { ...f, typeSejour: 'nuit', modeTarif: 'nuit', debut: `${jour}T${heureArrivee}`, fin: `${jourFin}T11:00` }
    })
  }

  function valider() {
    if (!form.clientId) return onErreur('Choisissez un client ou créez-en un.')
    if (nouveauClient && (!form.prenom.trim() || !form.nom.trim())) {
      return onErreur('Le prénom et le nom du client sont obligatoires.')
    }
    if (!periodeValide) return onErreur("La date de départ doit être après la date d'arrivée.")
    if (!form.chambreId) return onErreur('Choisissez une chambre.')
    if (chambreIndisponible) return onErreur('Cette chambre n’est pas disponible sur cette période.')
    if (passageTropLong) {
      return onErreur(`Un passage ne peut pas dépasser ${DUREE_MAX_PASSAGE_H} h : choisissez « Nuitée ».`)
    }
    const adultes = Number(form.adultes ?? form.personnes ?? 1)
    const enfants = Number(form.enfants ?? 0)
    const personnes = adultes + enfants
    if (!Number.isInteger(adultes) || adultes < 1 || !Number.isInteger(enfants) || enfants < 0) return onErreur('Indiquez au moins un adulte et un nombre d’enfants valide.')
    if (chambre && personnes > chambre.capacite) {
      return onErreur(`Cette chambre accueille ${chambre.capacite} personne(s) au maximum.`)
    }
    if (estMobileMoney(form.modePaiement) && !form.numeroPaiement.trim()) return onErreur('Saisissez le numéro Mobile Money du client.')
    if (!Number.isInteger(acompte) || acompte < 0) return onErreur('L’acompte doit être un montant entier.')
    if (acompte > sousTotal) return onErreur("L'acompte dépasse le montant du séjour.")
    return onCreer({ ...form, personnes, modeAcompte: form.modePaiement, typeSejour: modeHeure ? 'heure' : 'nuit', modeTarif: modeHeure ? 'heure' : 'nuit', regleArrondi: modeHeure ? reglePassage : 'prorata', tarifApplique: tarif })
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Nouvelle réservation"
      description="Client · séjour · paiement · récapitulatif"
      taille="xl"
    >
      <div className="resa-new">
        {/* ---------- Colonne 1 : client ---------- */}
        <section className="resa-new__col" aria-label="Client">
          <h3 className="resa-new__titre">Client</h3>

          {clientChoisi ? (
            <>
              <div className="resa-new__client">
                <strong>
                  {clientChoisi.prenom} {clientChoisi.nom}
                </strong>
                <span>{clientChoisi.tel || 'Téléphone non renseigné'}</span>
                <span>{clientChoisi.email || 'E-mail non renseigné'}</span>
                <span>{clientChoisi.vip ? 'VIP' : ''}{clientChoisi.vip && clientChoisi.loyalty ? ' · ' : ''}{clientChoisi.loyalty ? 'Client fidèle' : ''}</span>
                {clientChoisi.document && <span>Document : {clientChoisi.document}</span>}
              </div>
              <Button variante="secondaire" taille="s" onClick={() => choisirClient(null)}>Changer de client</Button>
              <button type="button" className="resa-new__onglet" aria-expanded={infosSuppAffichees} onClick={() => setInfosSuppAffichees((v) => !v)}>{infosSuppAffichees ? 'Masquer les informations' : 'Informations additionnelles'}</button>
              {infosSuppAffichees && <div className="resa-new__infos-supp">
                <div className="resa-new__onglets" role="tablist" aria-label="Informations client">
                  {[['allergies', 'Allergies'], ['preference', 'Préférences'], ['infoGenerales', 'Informations générales']].map(([id, label]) => <button key={id} type="button" className="resa-new__onglet" role="tab" aria-selected={ongletInfo === id} title={`Afficher ${label.toLowerCase()}`} onClick={() => setOngletInfo(id)}>{label} ⓘ</button>)}
                </div>
                <textarea className="resa-new__textarea" aria-label={ongletInfo} readOnly value={clientChoisi[ongletInfo] ?? ''} placeholder="Aucune information renseignée." />
              </div>}
            </>
          ) : nouveauClient ? (
            <>
              <div className="resa-new__grille">
                <Input label="Prénom" requis value={form.prenom} onChange={maj('prenom')} />
                <Input label="Nom" requis value={form.nom} onChange={maj('nom')} />
                <Input label="Téléphone" placeholder="+242 …" value={form.tel} onChange={maj('tel')} />
                <Input label="E-mail" type="email" value={form.email} onChange={maj('email')} />
                <AideSurvol texte="Numéro du document du client, si nécessaire." className="resa-new__plein"><Input label="Document d’identité" value={form.document} onChange={maj('document')} /></AideSurvol>
                <button type="button" className="resa-new__onglet resa-new__plein" aria-expanded={infosSuppAffichees} onClick={() => setInfosSuppAffichees((v) => !v)}>
                  {infosSuppAffichees ? 'Masquer les informations additionnelles' : '＋ Informations additionnelles'}
                </button>
                {infosSuppAffichees && <div className="resa-new__infos-supp resa-new__plein">
                  <div className="resa-new__onglets" role="tablist" aria-label="Informations client">
                    {[['allergies', 'Allergies'], ['preference', 'Préférences'], ['infoGenerales', 'Informations générales']].map(([id, label]) => <button key={id} type="button" className="resa-new__onglet" role="tab" aria-selected={ongletInfo === id} title={`Informations sur ${label.toLowerCase()}`} onClick={() => setOngletInfo(id)}>{label} <span aria-hidden="true">ⓘ</span></button>)}
                  </div>
                  <textarea className="resa-new__textarea" aria-label={ongletInfo === 'allergies' ? 'Allergies' : ongletInfo === 'preference' ? 'Préférences' : 'Informations générales'} placeholder={ongletInfo === 'allergies' ? 'Allergies et précautions à connaître…' : ongletInfo === 'preference' ? 'Préférences du client…' : 'Informations utiles à la réception…'} value={form[ongletInfo]} onChange={(e) => setForm((f) => ({ ...f, [ongletInfo]: e.target.value }))} />
                  <div className="resa-new__grille">
                    <label><input type="checkbox" checked={form.vip} onChange={(e) => setForm((f) => ({ ...f, vip: e.target.checked }))} /> Client VIP</label>
                    <label><input type="checkbox" checked={form.loyalty} onChange={(e) => setForm((f) => ({ ...f, loyalty: e.target.checked }))} /> Client fidèle</label>
                  </div>
                </div>}
                <Input
                  className="resa-new__plein"
                  label="Sexe"
                  value={form.sexe}
                  onChange={maj('sexe')}
                  options={OPTIONS_SEXE}
                />
              </div>
              <Button variante="fantome" taille="s" onClick={() => choisirClient(null)}>
                Choisir un client existant
              </Button>
            </>
          ) : (
            <>
              <Input
                label="Rechercher un client"
                icone={Search}
                placeholder="Nom, téléphone, e-mail…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <p className="resa-new__etiquette">{requete ? 'Résultats' : 'Clients récents'}</p>
              {propositions.length > 0 ? (
                <ul className="resa-new__liste">
                  {propositions.map((c) => (
                    <li key={c.id}>
                      <button type="button" className="resa-new__choix" onClick={() => choisirClient(c)}>
                        <strong>
                          {c.prenom} {c.nom}
                        </strong>
                        <span>{c.tel || c.email || 'Coordonnées non renseignées'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="resa-new__vide">Aucun client trouvé.</p>
              )}
              <Button
                variante="secondaire"
                icone={Plus}
                onClick={() => setForm((f) => ({ ...f, clientId: NOUVEAU_CLIENT }))}
              >
                Nouveau client
              </Button>
            </>
          )}
        </section>

        {/* ---------- Colonne 2 : séjour ---------- */}
        <section className="resa-new__col" aria-label="Séjour">
          <h3 className="resa-new__titre">Séjour</h3>
          <div className="resa-new__grille">
            <AideSurvol texte={`Une nuitée suit le tarif nuit. Un passage (${DUREE_MAX_PASSAGE_H} h maximum) est facturé à l’heure, sans jamais dépasser le prix de la nuitée.`} className="resa-new__plein">
              <Input
                label="Type de séjour"
                value={form.typeSejour}
                onChange={changerTypeSejour}
                options={[{ valeur: 'nuit', libelle: 'Nuitée' }, { valeur: 'heure', libelle: 'Passage' }]}
              />
            </AideSurvol>
            <AideSurvol texte="Indiquez la date et l’heure réelles d’arrivée. Elles restent modifiables en cas d’erreur."><Input label="Arrivée" type="datetime-local" requis value={dateHeureLocale(form.debut)} onChange={changerDebut} /></AideSurvol>
            <AideSurvol texte="Indiquez la date et l’heure prévues de départ."><Input label="Départ" type="datetime-local" requis min={form.debut} max={modeHeure ? finMaxPassage(form.debut) : undefined} value={dateHeureLocale(form.fin, '11:00')} onChange={maj('fin')} erreur={passageTropLong ? `Passage limité à ${DUREE_MAX_PASSAGE_H} h.` : undefined} /></AideSurvol>
            <AideSurvol texte="La liste ne montre que les chambres disponibles sur toute la période." className="resa-new__plein">
              <Input
                label="Chambre"
                requis
                placeholder={libres.length ? 'Choisir une chambre' : 'Aucune chambre libre'}
                value={form.chambreId}
                onChange={maj('chambreId')}
                erreur={chambreIndisponible ? 'Indisponible sur ces dates.' : undefined}
                options={libres.map((c) => ({
                  valeur: String(c.id),
                  libelle: `${c.numero} · ${c.typeLabel} · ${formatArgent(modeHeure ? c.prixHoraire : c.prixNuit)} ${DEVISE}/${modeHeure ? 'heure de passage' : 'nuitée'}${c.statut === 'nettoyage' ? ' · en nettoyage' : ''}`
                }))}
              />
            </AideSurvol>
            <AideSurvol texte="Nombre d’adultes qui séjourneront dans la chambre."><Input label="Adultes" type="number" min={1} value={form.adultes} onChange={maj('adultes')} /></AideSurvol>
            <AideSurvol texte="Nombre d’enfants, même si un lit séparé n’est pas requis."><Input label="Enfants" type="number" min={0} value={form.enfants} onChange={maj('enfants')} /></AideSurvol>
            <AideSurvol texte="Sélectionnez individuel ou groupe."><Input label="Type de client" value={form.typeGroupe} onChange={maj('typeGroupe')} options={[{ valeur: 'seul', libelle: 'Individuel / seul' }, { valeur: 'groupe', libelle: 'Groupe' }]} /></AideSurvol>
            <AideSurvol texte="Origine de la réservation : réception, téléphone, agence ou plateforme."><Input label="Canal / agence" value={form.canal} onChange={maj('canal')} options={OPTIONS_CANAL} /></AideSurvol>
            <AideSurvol texte="Indiquez les demandes à transmettre à l’équipe de réception." className="resa-new__plein"><Input label="Demandes spéciales" value={form.demandesSpeciales} onChange={maj('demandesSpeciales')} /></AideSurvol>
          </div>
        </section>

        {/* ---------- Paiement et récapitulatif : deux cartes distinctes ---------- */}
        <div className="resa-new__bas">
          <section className="resa-new__col" aria-label="Paiement et acompte">
            <h3 className="resa-new__titre">Paiement</h3>
            <p className="resa-new__etiquette" title="Moyen utilisé pour l’acompte et le règlement du séjour.">Moyen de paiement</p>
            <MethodesPaiement
              valeur={form.modePaiement}
              onChange={(v) => setForm((f) => ({ ...f, modePaiement: v, modeAcompte: v }))}
            />
            {estMobileMoney(form.modePaiement) && (
              <AideSurvol texte="Le numéro est conservé pour le paiement mobile. Le déclenchement nécessitera un prestataire connecté.">
                <Input label="Numéro Mobile Money" type="tel" placeholder="+242 …" value={form.numeroPaiement} onChange={maj('numeroPaiement')} />
              </AideSurvol>
            )}
            {form.modePaiement === 'carte' && (
              <AideSurvol texte="Utilisez un terminal ou un prestataire de paiement sécurisé. Ne saisissez jamais de numéro de carte dans Hypnos.">
                <p className="resa-new__paiement-note">Paiement carte sur terminal externe : aucun numéro n’est saisi ici.</p>
              </AideSurvol>
            )}
            <AideSurvol texte="Choisissez quand et par qui le séjour sera réglé."><Input label="Conditions de paiement" value={form.conditionsPaiement} onChange={maj('conditionsPaiement')} options={[
              { valeur: 'acompte_solde', libelle: 'Acompte à la réservation, solde à l’arrivée' },
              { valeur: 'total_arrivee', libelle: 'Paiement total à l’arrivée' },
              { valeur: 'prepayee', libelle: 'Séjour prépayé' },
              { valeur: 'facturation_societe', libelle: 'Facturation entreprise / agence' }
            ]} /></AideSurvol>
            <Input label={`Acompte (${DEVISE}) · payé en ${LIBELLES_MODE[form.modePaiement]}`} type="number" min={0} value={form.acompte} onChange={maj('acompte')} />
            {estMobileMoney(form.modePaiement) && <Button variante="secondaire" disabled title="Aucun prestataire marchand n’est encore connecté.">Déclencher le paiement — bientôt disponible</Button>}
            <AideSurvol texte="Les moyens mobiles sont enregistrés comme choix prévu. Aucun débit réel n’est lancé sans intégration marchand." className="resa-new__aide-only" />
          </section>
          <section className="resa-new__col resa-new__invoice" aria-label="Récapitulatif du séjour">
            <h3 className="resa-new__titre">Récapitulatif</h3>
            <ul className="resa-new__lignes">
              <li>
                <span>Client</span>
                <strong>{nomAffiche}</strong>
              </li>
              <li>
                <span>Séjour</span>
                <strong>
                  {periodeValide ? `${libelleDate(form.debut)} ${String(form.debut).slice(11, 16)} → ${libelleDate(form.fin)} ${String(form.fin).slice(11, 16)}` : 'À définir'}
                </strong>
              </li>
              <li>
                <span>Durée</span>
                <strong>{periodeValide ? (modeHeure ? libelleHeures(dureeHeures) : libelleNuits(nuits)) : '—'}</strong>
              </li>
              <li>
                <span>Chambre</span>
                <strong>{chambre ? `${chambre.numero} · ${chambre.typeLabel}` : 'À choisir'}</strong>
              </li>
              {chambre && (
                <li>
                  <span>Tarif</span>
                  <strong>
                    {formatArgent(tarif)} {DEVISE} × {unitesTarif}
                    {plafond.plafonne ? ' (plafonné à la nuitée)' : ''}
                  </strong>
                </li>
              )}
            </ul>

            <div className="resa-new__totaux">
              <div className="resa-new__total">
                <span>Total du séjour</span>
                <strong>
                  {formatArgent(sousTotal)} {DEVISE}
                </strong>
              </div>
              <div className="resa-new__total">
                <span>Acompte</span>
                <strong>
                  {acompte > 0 ? '− ' : ''}
                  {formatArgent(acompte)} {DEVISE}
                </strong>
              </div>
              <div className="resa-new__total resa-new__net">
                <span>Reste à payer</span>
                <strong>
                  {formatArgent(Math.max(sousTotal - acompte, 0))} {DEVISE}
                </strong>
              </div>
              <AideSurvol texte="Les services (bar, restaurant…) s’ajoutent depuis la fiche de la réservation. Taxes et mentions comptables à configurer avant émission officielle." className="resa-new__aide-only" />
            </div>
          </section>
        </div>
        <div className="resa-new__actions">
          <Button icone={Check} chargement={chargement} onClick={valider}>Confirmer la réservation</Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
//  FENÊTRE : FICHE D'UNE RÉSERVATION
//    1. Séjour    : modifier les dates, les personnes, le canal
//    2. Services  : cocher les services utilisés (prix inclus dans le total)
//    3. Paiement  : facture, encaisser, partager
// ============================================================

function partagerFacture(canal, resa) {
  const numero = String(resa.client?.tel ?? '').replace(/[^0-9+]/g, '')
  const adresse = String(resa.client?.email ?? '')
  const periode = `${formatCourt(jourDe(resa.dateDebut))} ${heureDe(resa.dateDebut, '15:00')} – ${formatCourt(jourDe(resa.dateFin))} ${heureDe(resa.dateFin, '11:00')}`
  const services = resa.consos.length
    ? ` Services : ${resa.consos.map((c) => `${c.serviceNom} ${formatArgent(c.montant)}`).join(', ')}.`
    : ''
  const texte = `Hypnos — récapitulatif provisoire de réservation n°${resa.id}. Client : ${resa.clientNom}. Chambre ${resa.numeroChambre}. Séjour : ${periode}.${services} Total indicatif : ${formatArgent(resa.total)} ${DEVISE}. Reste à payer : ${formatArgent(Math.max(resa.reste, 0))} ${DEVISE}. Taxes/mentions à valider.`
  const body = encodeURIComponent(texte)
  const url = canal === 'whatsapp'
    ? `https://wa.me/${numero.replace(/\D/g, '')}?text=${body}`
    : canal === 'email'
      ? `mailto:${encodeURIComponent(adresse)}?subject=${encodeURIComponent(`Récapitulatif réservation ${resa.id}`)}&body=${body}`
      : `sms:${encodeURIComponent(numero)}?body=${body}`
  window.open(url, '_blank', 'noopener')
}

function ModaleDetail({
  resa,
  toutes,
  services,
  chargement,
  onFermer,
  onErreur,
  onEnregistrer,
  onAjouterConso,
  onRetirerConso,
  onEncaisser,
  onChangerStatut
}) {
  const [form, setForm] = useState({})
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState('especes')
  const [annulation, setAnnulation] = useState(false)
  const [departConfirm, setDepartConfirm] = useState(false)
  const [prixLibre, setPrixLibre] = useState({})

  // Recharge les champs quand la réservation change réellement (enregistrement, statut…).
  // Le reste à payer n'en fait PAS partie : cocher un service ou encaisser ne doit pas effacer les saisies.
  useEffect(() => {
    setForm({
      debut: dateHeureLocale(resa.dateDebut, '15:00'),
      fin: dateHeureLocale(resa.dateFin, '11:00'),
      canal: resa.canal,
      personnes: String(resa.nombreDePersonne),
      adultes: String(resa.nombreAdultes ?? resa.nombreDePersonne ?? 1),
      enfants: String(resa.nombreEnfants ?? 0),
      typeSejour: resa.typeSejour ?? 'nuit',
      modeTarif: resa.modeTarif ?? 'nuit',
      regleArrondi: resa.regleArrondi ?? 'prorata',
      tarifApplique: String(resa.tarifApplique ?? 0)
    })
    setAnnulation(false)
    setDepartConfirm(false)
  }, [resa.dateDebut, resa.dateFin, resa.canal, resa.nombreDePersonne, resa.nombreAdultes, resa.nombreEnfants, resa.statut, resa.typeSejour, resa.modeTarif, resa.regleArrondi, resa.tarifApplique])

  // Le montant à encaisser suit le reste à payer (nouveau service, paiement reçu…)
  useEffect(() => {
    setMontant(String(Math.max(resa.reste, 0)))
  }, [resa.reste])

  const modifiable = ['en_attente', 'confirmee', 'en_sejour'].includes(resa.statut)
  const arriveeModifiable = resa.statut === 'en_attente' || resa.statut === 'confirmee'
  const peutEncaisser = resa.statut !== 'annulee' && resa.reste > 0
  const modifie =
    form.debut !== dateHeureLocale(resa.dateDebut, '15:00') ||
    form.fin !== dateHeureLocale(resa.dateFin, '11:00') ||
    form.canal !== resa.canal ||
    form.personnes !== String(resa.nombreDePersonne) ||
    form.adultes !== String(resa.nombreAdultes ?? resa.nombreDePersonne ?? 1) ||
    form.enfants !== String(resa.nombreEnfants ?? 0) ||
    form.typeSejour !== (resa.typeSejour ?? 'nuit') ||
    form.modeTarif !== (resa.modeTarif ?? 'nuit') ||
    form.regleArrondi !== (resa.regleArrondi ?? 'prorata') ||
    form.tarifApplique !== String(resa.tarifApplique ?? 0)
  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))
  const nomComplet = resa.client ? `${resa.client.prenom} ${resa.client.nom}` : resa.clientNom
  const reste = Math.max(resa.reste, 0)
  const modeHeure = resa.typeSejour === 'heure'
  const dureeHeures = heuresEntre(resa.dateDebut, resa.dateFin)

  function enregistrer() {
    if (!form.debut || !form.fin || form.fin <= form.debut) {
      return onErreur("La date de départ doit être après la date d'arrivée.")
    }
    if (modeHeure && heuresEntre(form.debut, form.fin) > DUREE_MAX_PASSAGE_H) {
      return onErreur(`Un passage ne peut pas dépasser ${DUREE_MAX_PASSAGE_H} h.`)
    }
    if (enConflit(toutes, { chambreId: resa.chambreId, debut: form.debut, fin: form.fin }, resa.id)) {
      return onErreur('Cette chambre est déjà réservée sur cette période.')
    }
    const adultes = Number(form.adultes ?? form.personnes ?? 1)
    const enfants = Number(form.enfants ?? 0)
    const personnes = adultes + enfants
    if (!Number.isInteger(adultes) || adultes < 1 || !Number.isInteger(enfants) || enfants < 0) return onErreur('Indiquez au moins un adulte et un nombre d’enfants valide.')
    if (personnes > resa.capacite) {
      return onErreur(`Cette chambre accueille ${resa.capacite} personne(s) au maximum.`)
    }
    return onEnregistrer({ ...form, personnes })
  }

  function encaisser() {
    const v = Number(montant)
    if (!(v > 0)) return onErreur('Saisissez un montant supérieur à 0.')
    if (v > resa.reste) return onErreur('Le montant dépasse le reste à payer.')
    return onEncaisser(v, mode)
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={nomComplet}
      description={`Réservation n°${resa.id}`}
      taille="xl"
      pied={
        <div className="detail-resa__pied">
          <div>
            {(resa.statut === 'en_attente' || resa.statut === 'confirmee') &&
              (annulation && resa.montantPaye > 0 ? (
                <>
                  <Button
                    variante="danger-doux"
                    disabled={chargement}
                    onClick={() => onChangerStatut('annuler', { rembourser: true })}
                  >
                    Annuler et rembourser {formatArgent(resa.montantPaye)} {DEVISE}
                  </Button>
                  <Button
                    variante="danger-doux"
                    disabled={chargement}
                    onClick={() => onChangerStatut('annuler', { rembourser: false })}
                  >
                    Annuler et conserver l’acompte
                  </Button>
                </>
              ) : (
                <Button
                  variante="danger-doux"
                  disabled={chargement}
                  onClick={() => (annulation ? onChangerStatut('annuler') : setAnnulation(true))}
                >
                  {annulation ? 'Confirmer l’annulation ?' : 'Annuler la réservation'}
                </Button>
              ))}
          </div>
          <div className="detail-resa__pied-droite">
            <Button variante="secondaire" onClick={onFermer}>
              Fermer
            </Button>
            {modifiable && modifie && (
              <Button variante="contour" chargement={chargement} onClick={enregistrer}>
                Enregistrer les modifications
              </Button>
            )}
            {arriveeModifiable && (
              <Button icone={LogIn} disabled={chargement} onClick={() => onChangerStatut('arrivee')}>
                Arrivée
              </Button>
            )}
            {resa.statut === 'en_sejour' &&
              (departConfirm && reste > 0 ? (
                <>
                  <Button variante="secondaire" onClick={() => setDepartConfirm(false)}>
                    Retour à l’encaissement
                  </Button>
                  <Button variante="danger-doux" disabled={chargement} onClick={() => onChangerStatut('depart')}>
                    Partir avec {formatArgent(reste)} {DEVISE} impayés
                  </Button>
                </>
              ) : (
                <Button
                  icone={LogOut}
                  disabled={chargement}
                  onClick={() => (reste > 0 ? setDepartConfirm(true) : onChangerStatut('depart'))}
                >
                  Départ
                </Button>
              ))}
          </div>
        </div>
      }
    >
      <div className="fiche">
        {/* ---------- Bandeau : où en est cette réservation ---------- */}
        <div className="fiche__bandeau">
          <div className="fiche__bloc">
            <span className="fiche__etiquette">Statut</span>
            <Badge statut={resa.statutAffiche} />
          </div>
          <div className="fiche__bloc">
            <span className="fiche__etiquette">Séjour</span>
            <strong>{periodeCourte(resa.dateDebut, resa.dateFin)}</strong>
            <small>{modeHeure ? `Passage · ${libelleHeures(dureeHeures)}` : `Nuitée · ${libelleNuits(resa.nuits)}`}</small>
          </div>
          <div className="fiche__bloc">
            <span className="fiche__etiquette">Chambre</span>
            <strong>Chambre {resa.numeroChambre}</strong>
            <small>{resa.typeLabel}</small>
          </div>
          <div className="fiche__bloc">
            <span className="fiche__etiquette">Contact</span>
            <strong>{resa.client?.tel || '—'}</strong>
            <small>{resa.client?.email || 'E-mail non renseigné'}</small>
          </div>
        </div>

        <div className="fiche__cartes">
          {/* ---------- Bloc 1 : séjour ---------- */}
          <section className="fiche__carte" aria-label="Séjour">
            <h3 className="fiche__titre">Séjour</h3>
            <div className="fiche__grille">
              <Input
                className="fiche__plein"
                label="Arrivée"
                type="datetime-local"
                value={dateHeureLocale(form.debut)}
                onChange={maj('debut')}
                disabled={!arriveeModifiable}
              />
              <Input
                className="fiche__plein"
                label="Départ"
                type="datetime-local"
                value={dateHeureLocale(form.fin, '11:00')}
                min={form.debut}
                max={modeHeure ? finMaxPassage(form.debut) : undefined}
                onChange={maj('fin')}
                disabled={!modifiable}
              />
              <Input label="Adultes" type="number" min={1} value={form.adultes ?? '1'} onChange={maj('adultes')} disabled={!modifiable} />
              <Input label="Enfants" type="number" min={0} value={form.enfants ?? '0'} onChange={maj('enfants')} disabled={!modifiable} />
              <Input
                className="fiche__plein"
                label="Canal"
                value={form.canal ?? ''}
                onChange={maj('canal')}
                options={OPTIONS_CANAL}
                disabled={!modifiable}
              />
            </div>
          </section>

          {/* ---------- Bloc 2 : services ---------- */}
          <section className="fiche__carte" aria-label="Services utilisés">
            <h3 className="fiche__titre">Services utilisés</h3>
            {modifiable ? (
              services.length === 0 ? (
                <p className="fiche__note">Aucun service actif. Ajoutez-en dans l’onglet Services.</p>
              ) : (
                <div className="fiche__services">
                  {services.map((s) => {
                    const conso = resa.consos.find((c) => c.serviceId === s.id)
                    const libre = s.prixUnitaire == null
                    return (
                      <div className="fiche__service-ligne" key={s.id}>
                        <label className="fiche__service">
                          <input
                            type="checkbox"
                            checked={Boolean(conso)}
                            disabled={chargement}
                            onChange={() => (conso ? onRetirerConso(conso.id) : onAjouterConso(s.id, prixLibre[s.id]))}
                          />
                          <span>{s.nom}</span>
                        </label>
                        {conso ? (
                          <strong className="fiche__prix">{formatArgent(conso.montant)} {DEVISE}</strong>
                        ) : libre ? (
                          <input
                            className="fiche__prix-libre"
                            type="number"
                            min={0}
                            placeholder="Montant"
                            aria-label={`Montant pour ${s.nom}`}
                            value={prixLibre[s.id] ?? ''}
                            onChange={(e) => setPrixLibre((p) => ({ ...p, [s.id]: e.target.value }))}
                          />
                        ) : (
                          <span className="fiche__prix">{s.prixUnitaire === 0 ? 'Gratuit' : `${formatArgent(s.prixUnitaire)} ${DEVISE}`}</span>
                        )}
                      </div>
                    )
                  })}
                  {resa.services > 0 && (
                    <div className="fiche__services-total">
                      <span>Total services</span>
                      <span>{formatArgent(resa.services)} {DEVISE}</span>
                    </div>
                  )}
                </div>
              )
            ) : resa.consos.length > 0 ? (
              <p className="fiche__note">
                {resa.consos.map((c) => `${c.serviceNom} (${formatArgent(c.montant)} ${DEVISE})`).join(', ')}
              </p>
            ) : (
              <p className="fiche__note">Aucun service utilisé.</p>
            )}
          </section>

          {/* ---------- Bloc 3 : paiement ---------- */}
          <section className="fiche__carte fiche__carte--paiement" aria-label="Paiement">
            <h3 className="fiche__titre">Paiement</h3>

            <div id="facture-imprimable">
              <strong>Facture provisoire · Réservation n°{resa.id}</strong>
              <p>{nomComplet} · Chambre {resa.numeroChambre} · {periodeCourte(resa.dateDebut, resa.dateFin).replace('→', '–')}</p>
              <dl className="fiche__lignes">
                <div>
                  <dt>
                    {modeHeure
                      ? `Passage (${formatArgent(resa.tarifApplique)} ${DEVISE}/h · ${resa.regleArrondi === 'heure_commencee' ? 'heure commencée' : 'prorata'})${resa.plafonne ? ' · plafonné au tarif nuitée' : ''}`
                      : `Nuitée (${formatArgent(resa.tarifApplique || resa.prixNuit)} × ${resa.nuits} nuit(s))`}
                  </dt>
                  <dd>{formatArgent(resa.hebergement)} {DEVISE}</dd>
                </div>
                {resa.consos.map((c) => (
                  <div key={c.id}>
                    <dt className="fiche__sous-ligne">• {c.serviceNom}</dt>
                    <dd>{formatArgent(c.montant)} {DEVISE}</dd>
                  </div>
                ))}
                <div>
                  <dt>Total</dt>
                  <dd>{formatArgent(resa.total)} {DEVISE}</dd>
                </div>
                <div className="fiche__paye">
                  <dt>Déjà payé</dt>
                  <dd>{formatArgent(resa.montantPaye)} {DEVISE}</dd>
                </div>
              </dl>

              <div className={`fiche__reste${reste > 0 ? '' : ' fiche__reste--solde'}`}>
                <span>{reste > 0 ? 'Reste à payer' : 'Soldé'}</span>
                <strong>{formatArgent(reste)} {DEVISE}</strong>
              </div>

              <p className="fiche__note">Aperçu indicatif : taxes et mentions comptables doivent être configurées et validées avant émission officielle.</p>
              {resa.paiements.length > 0 && (
                <ul className="fiche__historique" aria-label="Paiements reçus">
                  {resa.paiements.slice(0, 2).map((p) => (
                    <li key={p.id}>
                      <span>
                        {LIBELLES_PAIEMENT[p.categorie] ?? p.categorie}
                        {p.modePaiement ? ` · ${LIBELLES_MODE[p.modePaiement] ?? p.modePaiement}` : ''} ·{' '}
                        {formatCourt(jourDe(p.dateMouvement))}
                      </span>
                      <strong>
                        {p.type === 'sortie' ? '− ' : '+ '}
                        {formatArgent(p.montant)}
                      </strong>
                    </li>
                  ))}
                  {resa.paiements.length > 2 && (
                    <li>
                      <span>+ {resa.paiements.length - 2} autre(s) dans la Comptabilité</span>
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* L'action la plus importante (encaisser) vient avant le partage */}
            {peutEncaisser && (
              <div className="fiche__encaisser">
                <p className="fiche__sous-titre">
                  {resa.statut === 'confirmee' ? 'Encaisser un acompte' : 'Encaisser un paiement'}
                </p>
                <MethodesPaiement valeur={mode} onChange={setMode} />
                <Input
                  label={`Montant (${DEVISE})`}
                  type="number"
                  min={0}
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                />
                <Button variante="succes" pleineLargeur disabled={chargement} onClick={encaisser}>
                  Encaisser
                </Button>
              </div>
            )}

            <div className="facture__actions" aria-label="Partager ou imprimer le récapitulatif">
              <Button variante="secondaire" taille="s" onClick={() => partagerFacture('whatsapp', resa)}>WhatsApp</Button>
              <Button variante="secondaire" taille="s" onClick={() => partagerFacture('email', resa)}>E-mail</Button>
              <Button variante="secondaire" taille="s" onClick={() => partagerFacture('sms', resa)}>SMS</Button>
              <Button variante="secondaire" taille="s" onClick={() => window.print()}>Imprimer</Button>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
//  FENÊTRE : CONFIRMER UN DÉPLACEMENT (glisser sur le planning)
// ============================================================

function ModaleDeplacement({ resa, candidat, modele, chargement, onFermer, onValider }) {
  const chambreApres = modele.chambresParId[candidat.chambreId]
  const modeHeure = resa.typeSejour === 'heure'
  const nuitsApres = modeHeure ? 0 : nuitsEntre(candidat.debut, candidat.fin)
  const tarifApres = resa.tarifApplique || (modeHeure ? chambreApres?.prixHoraire : chambreApres?.prixNuit) || 0
  const montantApres = modeHeure
    ? montantPassage(heuresEntre(candidat.debut, candidat.fin), resa.regleArrondi, tarifApres, chambreApres?.prixNuit).montant + resa.services
    : nuitsApres * tarifApres + resa.services

  const lignes = [
    ['Chambre', resa.numeroChambre, chambreApres?.numero ?? '?'],
    ['Arrivée', `${formatCourt(jourDe(resa.dateDebut))} ${heureDe(resa.dateDebut, '15:00')}`, `${formatCourt(jourDe(candidat.debut))} ${heureDe(candidat.debut, '15:00')}`],
    ['Départ', `${formatCourt(jourDe(resa.dateFin))} ${heureDe(resa.dateFin, '11:00')}`, `${formatCourt(jourDe(candidat.fin))} ${heureDe(candidat.fin, '11:00')}`],
    ['Durée', modeHeure ? `${libelleHeures(heuresEntre(resa.dateDebut, resa.dateFin))} (passage)` : libelleNuits(resa.nuits), modeHeure ? `${libelleHeures(heuresEntre(candidat.debut, candidat.fin))} (passage)` : libelleNuits(nuitsApres)],
    ['Montant', `${formatArgent(resa.total)} ${DEVISE}`, `${formatArgent(montantApres)} ${DEVISE}`]
  ]

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Confirmer la modification ?"
      description={`Séjour de ${resa.clientNom}`}
      libelleValider="Oui, confirmer"
      libelleAnnuler="Non, revenir en arrière"
      onValider={onValider}
      chargement={chargement}
    >
      <table className="detail-resa__table">
        <thead>
          <tr>
            <th />
            <th>Avant</th>
            <th>Après</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map(([libelle, avant, apres]) => (
            <tr key={libelle}>
              <td>{libelle}</td>
              <td>{avant}</td>
              <td>
                <b>{apres}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}

// ============================================================
//  PAGE
// ============================================================

export default function BookingPage({ vueInitiale = 'liste', pleinEcran: pleinEcranInitial = false }) {
  // Les raccourcis de l'accueil transmettent leur intention : { nouvelle: true } ou { filtre: 'en_sejour' }
  const location = useLocation()
  const [pleinEcran, setPleinEcran] = useState(pleinEcranInitial)

  const [donnees, setDonnees] = useState(null)
  const [vue, setVue] = useState(vueInitiale) // 'liste' | 'planning'
  const [recherche, setRecherche] = useState(location.state?.recherche ?? '')
  const [filtre, setFiltre] = useState(location.state?.filtre ?? null)

  const [nouvelle, setNouvelle] = useState(location.state?.nouvelle ? {} : null) // préremplissage de la fenêtre de création
  const [selectionId, setSelectionId] = useState(null)
  const [deplacement, setDeplacement] = useState(null) // { id, candidat }

  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  // Recherche lancée depuis la barre supérieure alors que cette page est déjà ouverte
  useEffect(() => {
    if (location.state?.recherche) {
      setRecherche(location.state.recherche)
      setVue('liste')
    }
  }, [location.state])

  useEffect(() => {
    if (!pleinEcran) return undefined
    const echap = (event) => {
      if (event.key === 'Escape') setPleinEcran(false)
    }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [pleinEcran])

  const charger = useCallback(async () => {
    try {
      const api = window.electronAPI
      const [chambres, types, reservations, clients, services, consommations, mouvements] =
        await Promise.all([
          api.getAll('chambre'),
          api.getAll('typedechambre'),
          api.getAll('reservation'),
          api.getAll('clients'),
          api.getAll('service'),
          api.getAll('consommation'),
          api.getAll('mouvementcaisse')
        ])
      setDonnees({ chambres, types, reservations, clients, services, consommations, mouvements })
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const modele = useMemo(() => (donnees ? construireModele(donnees) : null), [donnees])

  const compteurs = useMemo(() => {
    const c = {}
    for (const r of modele?.resas ?? []) c[r.statutAffiche] = (c[r.statutAffiche] ?? 0) + 1
    return c
  }, [modele])

  const affichees = useMemo(() => {
    if (!modele) return []
    const mot = normaliser(recherche.trim())
    return modele.resas
      .filter((r) => !filtre || r.statutAffiche === filtre)
      .filter(
        (r) =>
          !mot || normaliser(`${r.clientNom} ${r.client?.prenom ?? ''} ${r.numeroChambre}`).includes(mot)
      )
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
  }, [modele, recherche, filtre])

  // ---------- Actions ----------
  // Exécute une action, recharge les données et affiche le résultat. Renvoie true si elle a réussi.
  async function executer(action, messageSucces) {
    setChargement(true)
    try {
      await action()
      window.dispatchEvent(new Event('hypnos:donnees-mises-a-jour'))
      await charger()
      if (messageSucces) setSucces(messageSucces)
      return true
    } catch (e) {
      setEchec(e.message)
      return false
    } finally {
      setChargement(false)
    }
  }

  const maj = (r, patch, message) =>
    executer(() => window.electronAPI.update('reservation', r.id, patch), message)

  // L'auteur de la réservation est fixé côté serveur à partir de la session.
  async function creerReservation(form) {
    let erreurAcompte = ''
    const ok = await executer(async () => {
      let clientId = Number(form.clientId)
      if (form.clientId === NOUVEAU_CLIENT) {
        const client = await window.electronAPI.create('clients', {
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          tel: form.tel.trim(),
          email: form.email.trim(),
          sexe: form.sexe,
          document: form.document.trim(),
          preference: form.preference.trim(),
          allergies: form.allergies.trim(),
          infoGenerales: form.infoGenerales.trim(),
          vip: Boolean(form.vip),
          loyalty: Boolean(form.loyalty)
        })
        clientId = client.id
      }
      const creee = await window.electronAPI.create('reservation', {
        clientId,
        chambreId: Number(form.chambreId),
        dateDebut: form.debut,
        dateFin: form.fin,
        typeSejour: form.typeSejour ?? 'nuit',
        modeTarif: form.typeSejour === 'heure' ? form.modeTarif : 'nuit',
        regleArrondi: form.regleArrondi ?? 'prorata',
        tarifApplique: Number(form.tarifApplique ?? 0),
        nombreDePersonne: Number(form.personnes),
        nombreAdultes: Number(form.adultes ?? form.personnes ?? 1),
        nombreEnfants: Number(form.enfants ?? 0),
        typeGroupe: form.typeGroupe ?? 'seul',
        demandesSpeciales: form.demandesSpeciales?.trim() ?? '',
        conditionsPaiement: form.conditionsPaiement?.trim() ?? '',
        modePaiement: form.modePaiement ?? 'especes',
        numeroPaiement: form.numeroPaiement?.trim() ?? '',
        statut: 'confirmee',
        canal: form.canal
      })
      const acompte = Number(form.acompte || 0)
      if (acompte > 0) {
        // La réservation existe déjà : si l'encaissement échoue, on le signale sans bloquer la création.
        try {
          await window.electronAPI.encaisser(creee.id, {
            montant: acompte,
            mode: form.modePaiement,
            nature: 'acompte'
          })
        } catch (e) {
          erreurAcompte = e.message
        }
      }
    }, '')
    if (ok) {
      setNouvelle(null)
      if (erreurAcompte) setEchec(`Réservation créée, mais l’acompte n’a pas été enregistré : ${erreurAcompte}. Ajoutez-le depuis la fiche.`)
      else setSucces('Réservation créée' + (Number(form.acompte || 0) > 0 ? ' avec acompte enregistré.' : '.'))
      window.dispatchEvent(new Event('hypnos:donnees-mises-a-jour'))
    }
  }

  const enregistrer = (r, form) =>
    maj(
      r,
      {
        dateDebut: form.debut,
        dateFin: form.fin,
        canal: form.canal,
        nombreDePersonne: Number(form.personnes ?? (Number(form.adultes) + Number(form.enfants))),
        nombreAdultes: Number(form.adultes ?? form.personnes ?? 1),
        nombreEnfants: Number(form.enfants ?? 0)
      },
      'Modifications enregistrées.'
    )

  // Avant l'arrivée (réservation confirmée) : acompte. Ensuite : paiement du séjour.
  function encaisser(r, montant, mode) {
    const nature = r.statut === 'confirmee' ? 'acompte' : 'paiement_client'
    return executer(
      () => window.electronAPI.encaisser(r.id, { montant, mode, nature }),
      `${formatArgent(montant)} ${DEVISE} encaissés${nature === 'acompte' ? ' (acompte)' : ''}.`
    )
  }

  // « Service utilisé » : une consommation de quantité 1 dont le montant (prix du catalogue,
  // ou prix libre saisi) est enregistré, donc compté dans le total et le reste à payer.
  function ajouterConso(r, serviceId, prixLibre) {
    const service = modele.services.find((s) => s.id === Number(serviceId))
    if (!service) return setEchec('Service introuvable.')
    const prix = service.prixUnitaire ?? Number(prixLibre)
    if (service.prixUnitaire == null && !(prix > 0)) {
      return setEchec('Saisissez le montant de ce service (prix libre).')
    }
    return executer(
      () =>
        window.electronAPI.create('consommation', {
          clientId: r.clientId,
          serviceId: service.id,
          reservationId: r.id,
          statut: 'consomme',
          quantite: 1,
          montant: Math.round(prix || 0)
        }),
      `${service.nom} ajouté (${formatArgent(prix || 0)} ${DEVISE}).`
    )
  }

  const retirerConso = (consoId) =>
    executer(() => window.electronAPI.remove('consommation', consoId), 'Consommation retirée.')

  // Arrivée : la chambre devient occupée. Départ : elle passe en nettoyage.
  async function changerStatut(r, action, options = {}) {
    const api = window.electronAPI
    if (action === 'arrivee') {
      await executer(() => api.arrivee(r.id), `Arrivée enregistrée : chambre ${r.numeroChambre}.`)
    } else if (action === 'depart') {
      const ok = await executer(
        () => api.depart(r.id),
        r.reste > 0 ? '' : `Départ enregistré : chambre ${r.numeroChambre} à nettoyer.`
      )
      if (ok && r.reste > 0) {
        setEchec(`Départ enregistré, mais il reste ${formatArgent(r.reste)} ${DEVISE} à payer.`)
      }
    } else if (action === 'annuler') {
      const ok = await executer(() => api.annuler(r.id, options), 'Réservation annulée.')
      if (ok) setSelectionId(null)
    }
  }

  async function validerDeplacement(r) {
    const { candidat } = deplacement
    const ok = await maj(
      r,
      { chambreId: candidat.chambreId, dateDebut: candidat.debut, dateFin: candidat.fin },
      'Réservation modifiée.'
    )
    if (ok) setDeplacement(null)
  }

  // ---------- Affichage ----------
  if (!modele) {
    return (
      <>
        <Header titre="Réservations" />
        {echec ? (
          <div className="resas__etat">
            <Button variante="secondaire" onClick={charger}>
              Réessayer
            </Button>
          </div>
        ) : (
          <p className="resas__etat">Chargement…</p>
        )}
        <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
      </>
    )
  }

  const resaSelectionnee = modele.resas.find((r) => r.id === selectionId)
  const resaDeplacee = deplacement ? modele.resas.find((r) => r.id === deplacement.id) : null

  return (
    <section className={pleinEcran ? 'booking-page booking-page--plein' : 'booking-page'}>
      <Header titre="Réservations">
        <div className="vues" role="tablist" aria-label="Affichage des réservations">
          <button
            type="button"
            role="tab"
            className="vues__bouton"
            aria-selected={vue === 'liste'}
            onClick={() => setVue('liste')}
          >
            <List size={16} aria-hidden="true" />
            Liste
          </button>
          <button
            type="button"
            role="tab"
            className="vues__bouton"
            aria-selected={vue === 'planning'}
            onClick={() => setVue('planning')}
          >
            <CalendarRange size={16} aria-hidden="true" />
            Planning
          </button>
        </div>
        <Button icone={Plus} onClick={() => setNouvelle({})}>
          Nouvelle réservation
        </Button>
        {vue === 'planning' && (
          <Button
            variante="secondaire"
            icone={pleinEcran ? Minimize2 : Maximize2}
            aria-pressed={pleinEcran}
            onClick={() => setPleinEcran((etat) => !etat)}
          >
            {pleinEcran ? 'Quitter le plein écran' : 'Plein écran'}
          </Button>
        )}
      </Header>

      {vue === 'liste' ? (
        <>
          <div className="resas__outils">
            <InputSearch
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher un client ou une chambre…"
            />
          </div>

          <div className="resas__filtres">
            <FilterPillule
              libelle="Toutes"
              compteur={modele.resas.length}
              actif={!filtre}
              onClick={() => setFiltre(null)}
            />
            {ORDRE_STATUTS.map((statut) => (
              <FilterPillule
                key={statut}
                libelle={STATUTS_RESERVATION[statut].libelle}
                compteur={compteurs[statut] ?? 0}
                actif={filtre === statut}
                onClick={() => setFiltre(filtre === statut ? null : statut)}
              />
            ))}
          </div>

          {affichees.length > 0 ? (
            <ul className="resas__liste">
              {affichees.map((r) => (
                <li key={r.id}>
                  <button type="button" className="ligne-resa" onClick={() => setSelectionId(r.id)}>
                    <span className="ligne-resa__avatar" aria-hidden="true">
                      {initiales(r.client)}
                    </span>
                    <span className="ligne-resa__infos">
                      <span className="ligne-resa__nom">{r.clientNom}</span>
                      <span className="ligne-resa__detail">
                        Chambre {r.numeroChambre} · {formatCourt(jourDe(r.dateDebut))} {heureDe(r.dateDebut, '15:00')} – {formatCourt(jourDe(r.dateFin))} {heureDe(r.dateFin, '11:00')} · {r.typeSejour === 'heure' ? `${libelleHeures(heuresEntre(r.dateDebut, r.dateFin))} (passage)` : libelleNuits(r.nuits)}
                      </span>
                    </span>
                    <span className="ligne-resa__montant">
                      {formatArgent(r.total)} {DEVISE}
                      {r.reste > 0 && r.statut !== 'annulee' && (
                        <span className="ligne-resa__reste">Reste {formatArgent(r.reste)}</span>
                      )}
                    </span>
                    <Badge statut={r.statutAffiche} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="resas__etat">
              <p className="resas__vide-titre">
                {modele.resas.length === 0 ? 'Aucune réservation.' : 'Aucune réservation trouvée.'}
              </p>
              <p>
                {modele.resas.length === 0
                  ? 'Créez une réservation pour la voir apparaître ici.'
                  : 'Modifiez votre recherche ou votre filtre.'}
              </p>
            </div>
          )}
        </>
      ) : (
        <BookingTimeline
          chambres={modele.chambres}
          reservations={modele.resas}
          onOuvrir={setSelectionId}
          onDeplacer={(id, candidat) => setDeplacement({ id, candidat })}
          onCreer={(c) => setNouvelle({ chambreId: c.chambreId, debut: c.debut, fin: c.fin })}
          onRefus={setEchec}
        />
      )}

      {nouvelle && (
        <ModaleNouvelle
          prefill={nouvelle}
          modele={modele}
          chargement={chargement}
          onFermer={() => setNouvelle(null)}
          onCreer={creerReservation}
          onErreur={setEchec}
        />
      )}

      {resaSelectionnee && (
        <ModaleDetail
          resa={resaSelectionnee}
          toutes={modele.resas}
          services={modele.services}
          chargement={chargement}
          onFermer={() => setSelectionId(null)}
          onErreur={setEchec}
          onEnregistrer={(form) => enregistrer(resaSelectionnee, form)}
          onAjouterConso={(serviceId, prix) => ajouterConso(resaSelectionnee, serviceId, prix)}
          onRetirerConso={retirerConso}
          onEncaisser={(montant, mode) => encaisser(resaSelectionnee, montant, mode)}
          onChangerStatut={(action, options) => changerStatut(resaSelectionnee, action, options)}
        />
      )}

      {resaDeplacee && (
        <ModaleDeplacement
          resa={resaDeplacee}
          candidat={deplacement.candidat}
          modele={modele}
          chargement={chargement}
          onFermer={() => setDeplacement(null)}
          onValider={() => validerDeplacement(resaDeplacee)}
        />
      )}

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}