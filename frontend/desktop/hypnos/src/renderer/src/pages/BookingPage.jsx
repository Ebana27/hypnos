/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, List, LogIn, LogOut, Plus, X, Maximize2, Minimize2 } from 'lucide-react'
import BookingTimeline from '../components/BookingTimeline'
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
  ORDRE_STATUTS,
  STATUTS_RESERVATION,
  ajouterJours,
  aujourdhui,
  cleJour,
  enConflit,
  formatArgent,
  formatCourt,
  initiales,
  jourDe,
  libelleNuits,
  nomClient,
  nuitsEntre,
  totaux
} from '../lib/reservations'

const NOUVEAU_CLIENT = '__nouveau'
const OPTIONS_CANAL = Object.entries(CANAUX).map(([valeur, libelle]) => ({ valeur, libelle }))
const OPTIONS_STATUT = [
  { valeur: 'confirmee', libelle: 'Confirmée' },
  { valeur: 'en_attente', libelle: 'En attente de paiement' }
]
const OPTIONS_SEXE = [
  { valeur: 'M', libelle: 'Homme' },
  { valeur: 'F', libelle: 'Femme' }
]
const MESSAGE_SANS_UTILISATEUR =
  'Aucun utilisateur enregistré : créez ou connectez un compte avant de continuer.'

const normaliser = (texte) =>
  String(texte)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

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
.vues__bouton:hover {
  color: var(--color-accent);
}
.vues__bouton[aria-selected='true'] {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

/* ---------- Liste ---------- */
.resas__outils {
  margin-bottom: 14px;
}
.resas__filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.resas__liste {
  display: flex;
  flex-direction: column;
}
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
.ligne-resa:hover {
  background: var(--color-accent-wash);
}
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
.ligne-resa__infos {
  flex: 1;
  min-width: 0;
}
.ligne-resa__nom {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ligne-resa__detail {
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

/* ---------- Fenêtre de détail ---------- */
.detail-resa__entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}
.detail-resa__tel {
  font-size: 13px;
  color: var(--color-text-muted);
}
.detail-resa__grille {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.detail-resa__titre {
  font-size: 13px;
  font-weight: 600;
}
.detail-resa__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.detail-resa__table th,
.detail-resa__table td {
  padding: 8px 4px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
.detail-resa__table th:last-child,
.detail-resa__table td:last-child {
  text-align: right;
}
.detail-resa__table th {
  font-size: 11px;
  color: var(--color-text-muted);
}
.detail-resa__table b {
  font-weight: 700;
}
.detail-resa__table tfoot td {
  border-bottom: none;
  font-weight: 700;
}
.detail-resa__paye td {
  color: var(--color-success);
}
.detail-resa__du td {
  color: var(--color-danger);
}
.detail-resa__cellule {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.detail-resa__ligne {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}
.detail-resa__ligne .champ {
  flex: 1;
  min-width: 120px;
}
.detail-resa__note {
  font-size: 12px;
  color: var(--color-text-muted);
}
.detail-resa__pied {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}
.detail-resa__pied-droite {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* ---------- Création horizontale d'une réservation ---------- */
.booking-new {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(250px, 0.75fr);
  gap: 18px;
  width: 100%;
}
.booking-new__principal, .booking-new__extras {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.booking-new__extras {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-background-soft);
}
.booking-new__section-title {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
}
.booking-new__section-note {
  margin: -7px 0 2px;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.45;
}
.booking-new__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.booking-new__client { position: relative; display: flex; flex-direction: column; gap: 5px; }
.booking-new__client-label { color: var(--color-text); font-size: 12px; font-weight: 600; }
.booking-new__client-input {
  width: 100%; min-height: 40px; padding: 9px 12px;
  border: 1px solid var(--color-border); border-radius: var(--radius-s);
  outline: 0; background: var(--color-surface); color: var(--color-text);
  font: inherit; font-size: 13px;
}
.booking-new__client-input:focus { border-color: var(--color-accent); }
.booking-new__suggestions {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
  max-height: 240px; overflow-y: auto; padding: 5px;
  border: 1px solid var(--color-border); border-radius: var(--radius-s);
  background: var(--color-surface); box-shadow: var(--color-shadow);
}
.booking-new__suggestions-label { padding: 6px 8px; color: var(--color-text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.booking-new__suggestion {
  display: flex; flex-direction: column; width: 100%; gap: 2px; padding: 8px;
  border: 0; border-radius: 6px; background: transparent; color: var(--color-text);
  text-align: left; cursor: pointer;
}
.booking-new__suggestion:hover, .booking-new__suggestion:focus-visible { background: var(--color-accent-wash); outline: 0; }
.booking-new__suggestion strong { font-size: 12px; font-weight: 600; }
.booking-new__suggestion span { color: var(--color-text-muted); font-size: 10px; }
.booking-new__empty { padding: 8px; color: var(--color-text-muted); font-size: 12px; }
.booking-new__checklist { display: grid; gap: 10px; }
.booking-new__check { display: flex; align-items: flex-start; gap: 9px; color: var(--color-text); font-size: 12px; line-height: 1.4; cursor: pointer; }
.booking-new__check input { margin: 2px 0 0; accent-color: var(--color-accent); }
.booking-new__textarea { width: 100%; min-height: 68px; resize: vertical; padding: 9px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-s); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 12px; }
.booking-new__non-persistant { margin: 0; padding: 8px 9px; border-radius: var(--radius-s); background: var(--color-accent-wash); color: var(--color-text-muted); font-size: 10px; line-height: 1.45; }
@media (max-width: 760px) {
  .booking-new { grid-template-columns: 1fr; }
  .booking-new__grid { grid-template-columns: 1fr; }
}
`

injecterStyles('hypnos-page-reservations', STYLES)

// ============================================================
//  DONNÉES : tout ce que les deux vues ont besoin de savoir
// ============================================================

function construireModele({ chambres, types, reservations, clients, services, consommations }) {
  const typesParId = Object.fromEntries(types.map((t) => [t.id, t]))
  const clientsParId = Object.fromEntries(clients.map((c) => [c.id, c]))
  const servicesParId = Object.fromEntries(services.map((s) => [s.id, s]))

  const consosParResa = {}
  for (const c of consommations) {
    if (c.reservationId != null) (consosParResa[c.reservationId] ??= []).push(c)
  }

  const chambresTriees = [...chambres]
    .sort((a, b) => a.etage - b.etage || a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
    .map((c) => {
      const type = typesParId[c.typeId]
      return {
        id: c.id,
        numero: c.numero,
        etage: c.etage,
        typeLabel: type?.label ?? '',
        prixNuit: type?.prix ?? 0,
        capacite: type?.capacite ?? 1
      }
    })
  const chambresParId = Object.fromEntries(chambresTriees.map((c) => [c.id, c]))

  const resas = reservations.map((r) => {
    const chambre = chambresParId[r.chambreId]
    const client = clientsParId[r.clientId]
    const consos = (consosParResa[r.id] ?? []).map((c) => ({
      ...c,
      serviceNom: servicesParId[c.serviceId]?.nom ?? 'Service'
    }))
    const prixNuit = chambre?.prixNuit ?? 0
    return {
      ...r,
      client,
      clientNom: nomClient(client),
      numeroChambre: chambre?.numero ?? '?',
      typeLabel: chambre?.typeLabel ?? '',
      capacite: chambre?.capacite ?? 1,
      prixNuit,
      nuits: nuitsEntre(r.dateDebut, r.dateFin),
      consos,
      ...totaux(r, prixNuit, consos)
    }
  })

  const derniereReservationClient = new Map()
  for (const r of resas) {
    if (r.statut === 'annulee') continue
    const courante = derniereReservationClient.get(r.clientId)
    if (!courante || String(r.dateDebut) > String(courante)) derniereReservationClient.set(r.clientId, r.dateDebut)
  }
  const clientsRecents = [...clients].sort((a, b) =>
    String(derniereReservationClient.get(b.id) ?? '').localeCompare(String(derniereReservationClient.get(a.id) ?? '')) ||
    String(b.id).localeCompare(String(a.id), 'fr', { numeric: true })
  )

  return {
    chambres: chambresTriees,
    chambresParId,
    resas,
    clientsRecents,
    clients: [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) ,
    // Seuls les services actifs avec un prix fixe peuvent être ajoutés à un séjour
    services: services.filter((s) => s.actif && s.prixUnitaire != null)
  }
}

function Badge({ statut }) {
  const infos = STATUTS_RESERVATION[statut]
  return (
    <span
      className="badge-resa"
      style={{ '--badge-fond': infos.fond, '--badge-texte': infos.texte }}
    >
      {infos.libelle}
    </span>
  )
}

// ============================================================
//  FENÊTRE : NOUVELLE RÉSERVATION
// ============================================================

const formulaireInitial = (prefill = {}) => ({
  clientId: '',
  nom: '',
  prenom: '',
  tel: '',
  sexe: 'M',
  chambreId: prefill.chambreId ? String(prefill.chambreId) : '',
  debut: prefill.debut ?? cleJour(aujourdhui()),
  fin: prefill.fin ?? cleJour(ajouterJours(aujourdhui(), 1)),
  personnes: '1',
  canal: 'direct',
  statut: 'confirmee'
})

function ModaleNouvelle({ prefill, modele, chargement, onFermer, onCreer, onErreur }) {
  const [form, setForm] = useState(() => formulaireInitial(prefill))
  const [rechercheClient, setRechercheClient] = useState('')
  const [listeClientsOuverte, setListeClientsOuverte] = useState(false)
  const [extras, setExtras] = useState({ heureArrivee: '', litBebe: false, arriveeTardive: false, preferenceCalme: false, demandes: '' })
  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))
  const nouveauClient = form.clientId === NOUVEAU_CLIENT
  const periodeValide = Boolean(form.debut && form.fin && form.fin > form.debut)
  const clientSelectionne = modele.clients.find((c) => String(c.id) === String(form.clientId))
  const queryClient = normaliser(rechercheClient.trim())
  const clientsProposes = useMemo(() => {
    if (!queryClient) return modele.clientsRecents.slice(0, 5)
    return modele.clients
      .filter((c) => normaliser(`${c.prenom ?? ''} ${c.nom ?? ''} ${c.tel ?? ''} ${c.email ?? ''}`).includes(queryClient))
      .sort((a, b) => String(b.id).localeCompare(String(a.id), 'fr', { numeric: true }))
      .slice(0, 10)
  }, [modele.clients, modele.clientsRecents, queryClient])

  const libres = useMemo(
    () => periodeValide
      ? modele.chambres.filter((c) => !enConflit(modele.resas, { chambreId: c.id, debut: form.debut, fin: form.fin }))
      : modele.chambres,
    [periodeValide, form.debut, form.fin, modele]
  )
  const chambre = modele.chambresParId[Number(form.chambreId)]
  const estimation = chambre && periodeValide
    ? `${libelleNuits(nuitsEntre(form.debut, form.fin))} · ${formatArgent(nuitsEntre(form.debut, form.fin) * chambre.prixNuit)} ${DEVISE}`
    : undefined

  function choisirClient(client) {
    setForm((f) => ({ ...f, clientId: String(client.id) }))
    setRechercheClient(`${client.prenom ?? ''} ${client.nom ?? ''}`.trim())
    setListeClientsOuverte(false)
  }

  function choisirNouveauClient() {
    setForm((f) => ({ ...f, clientId: NOUVEAU_CLIENT, nom: '', prenom: '', tel: '', sexe: 'M' }))
    setRechercheClient('')
    setListeClientsOuverte(false)
  }

  function valider() {
    if (!form.clientId) return onErreur('Choisissez un client ou créez-en un.')
    if (nouveauClient && (!form.prenom.trim() || !form.nom.trim())) return onErreur('Le prénom et le nom du client sont obligatoires.')
    if (!periodeValide) return onErreur("La date de départ doit être après la date d'arrivée.")
    if (!form.chambreId) return onErreur('Choisissez une chambre.')
    if (!libres.some((c) => String(c.id) === form.chambreId)) return onErreur('Cette chambre est déjà réservée sur cette période.')
    const personnes = Number(form.personnes)
    if (!(personnes >= 1)) return onErreur('Il faut au moins une personne.')
    if (chambre && personnes > chambre.capacite) return onErreur(`Cette chambre accueille ${chambre.capacite} personne(s) au maximum.`)
    // extras est volontairement gardé côté interface seulement : aucune colonne correspondante dans le schéma actuel.
    return onCreer(form)
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Nouvelle réservation"
      description="Renseignez le séjour et les besoins d’accueil du client."
      taille="l"
      libelleValider="Réserver"
      onValider={valider}
      chargement={chargement}
    >
      <div className="booking-new">
        <section className="booking-new__principal" aria-label="Détails du séjour">
          <div className="booking-new__client">
            <label className="booking-new__client-label" htmlFor="booking-client">Client <span aria-hidden="true">*</span></label>
            <input
              id="booking-client"
              className="booking-new__client-input"
              type="search"
              autoComplete="off"
              placeholder={clientSelectionne ? `${clientSelectionne.prenom} ${clientSelectionne.nom}` : 'Rechercher parmi les clients…'}
              value={nouveauClient ? 'Créer un nouveau client' : rechercheClient}
              onFocus={() => !nouveauClient && setListeClientsOuverte(true)}
              onChange={(e) => {
                setRechercheClient(e.target.value)
                setForm((f) => ({ ...f, clientId: '' }))
                setListeClientsOuverte(true)
              }}
              aria-expanded={listeClientsOuverte && !nouveauClient}
              aria-controls="booking-client-suggestions"
            />
            {listeClientsOuverte && !nouveauClient && (
              <div className="booking-new__suggestions" id="booking-client-suggestions" role="listbox">
                <div className="booking-new__suggestions-label">{queryClient ? 'Résultats (10 maximum)' : 'Clients récents'}</div>
                {clientsProposes.length ? clientsProposes.map((client) => (
                  <button className="booking-new__suggestion" key={client.id} type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => choisirClient(client)}>
                    <strong>{client.prenom} {client.nom}</strong>
                    <span>{client.tel || client.email || 'Coordonnées non renseignées'}</span>
                  </button>
                )) : <div className="booking-new__empty">Aucun client trouvé.</div>}
                <button className="booking-new__suggestion" type="button" onMouseDown={(e) => e.preventDefault()} onClick={choisirNouveauClient}>
                  <strong>+ Créer un nouveau client</strong>
                </button>
              </div>
            )}
            {nouveauClient && (
              <div className="booking-new__grid">
                <Input label="Prénom" requis value={form.prenom} onChange={maj('prenom')} />
                <Input label="Nom" requis value={form.nom} onChange={maj('nom')} />
                <Input label="Téléphone" placeholder="+242 …" value={form.tel} onChange={maj('tel')} />
                <Input label="Sexe" value={form.sexe} onChange={maj('sexe')} options={OPTIONS_SEXE} />
                <Button variante="secondaire" taille="s" onClick={() => { setForm((f) => ({ ...f, clientId: '' })); setRechercheClient('') }}>Choisir un client existant</Button>
              </div>
            )}
          </div>

          <div className="booking-new__grid">
            <Input label="Arrivée" type="date" requis value={form.debut} onChange={maj('debut')} />
            <Input label="Départ" type="date" requis value={form.fin} min={form.debut} onChange={maj('fin')} aide={estimation} />
          </div>
          <Input
            label="Chambre"
            requis
            placeholder={libres.length ? 'Choisir une chambre' : 'Aucune chambre libre'}
            value={form.chambreId}
            onChange={maj('chambreId')}
            aide={periodeValide ? 'Les chambres occupées sur ces dates sont exclues.' : undefined}
            options={libres.map((c) => ({ valeur: String(c.id), libelle: `Chambre ${c.numero} · ${c.typeLabel} · ${formatArgent(c.prixNuit)} ${DEVISE}/nuit` }))}
          />
          <div className="booking-new__grid">
            <Input label="Nombre de personnes" type="number" min={1} requis value={form.personnes} onChange={maj('personnes')} />
            <Input label="Canal de réservation" value={form.canal} onChange={maj('canal')} options={OPTIONS_CANAL} />
          </div>
          <Input label="Statut initial" value={form.statut} onChange={maj('statut')} options={OPTIONS_STATUT} />
        </section>

        <aside className="booking-new__extras" aria-label="Préférences d’accueil">
          <h3 className="booking-new__section-title">Préparer l’accueil</h3>
          <p className="booking-new__section-note">Options de confort pour cette réservation.</p>
          <Input label="Heure d’arrivée estimée" type="time" value={extras.heureArrivee} onChange={(e) => setExtras((x) => ({ ...x, heureArrivee: e.target.value }))} />
          <div className="booking-new__checklist">
            <label className="booking-new__check"><input type="checkbox" checked={extras.litBebe} onChange={(e) => setExtras((x) => ({ ...x, litBebe: e.target.checked }))} /> Lit bébé</label>
            <label className="booking-new__check"><input type="checkbox" checked={extras.arriveeTardive} onChange={(e) => setExtras((x) => ({ ...x, arriveeTardive: e.target.checked }))} /> Arrivée tardive</label>
            <label className="booking-new__check"><input type="checkbox" checked={extras.preferenceCalme} onChange={(e) => setExtras((x) => ({ ...x, preferenceCalme: e.target.checked }))} /> Chambre au calme si possible</label>
          </div>
          <label className="booking-new__client-label" htmlFor="booking-demande">Demande particulière</label>
          <textarea id="booking-demande" className="booking-new__textarea" placeholder="Ex. oreillers supplémentaires…" value={extras.demandes} onChange={(e) => setExtras((x) => ({ ...x, demandes: e.target.value }))} />
          <p className="booking-new__non-persistant">Ces préférences sont en aperçu uniquement : le schéma actuel ne permet pas encore de les enregistrer. Elles ne seront pas conservées après la réservation.</p>
        </aside>
      </div>
    </Modal>
  )
}

// ============================================================
//  FENÊTRE : DÉTAIL D'UNE RÉSERVATION
// ============================================================

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
  const [serviceId, setServiceId] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [montant, setMontant] = useState('')
  const [annulation, setAnnulation] = useState(false)

  // Recharge les champs quand la réservation change (enregistrement, encaissement…)
  useEffect(() => {
    setForm({
      debut: resa.dateDebut,
      fin: resa.dateFin,
      canal: resa.canal,
      personnes: String(resa.nombreDePersonne)
    })
    setMontant(String(Math.max(resa.reste, 0)))
    setAnnulation(false)
  }, [resa.dateDebut, resa.dateFin, resa.canal, resa.nombreDePersonne, resa.reste, resa.statut])

  const modifiable = ['en_attente', 'confirmee', 'en_sejour'].includes(resa.statut)
  const arriveeModifiable = resa.statut === 'en_attente' || resa.statut === 'confirmee'
  const modifie =
    form.debut !== resa.dateDebut ||
    form.fin !== resa.dateFin ||
    form.canal !== resa.canal ||
    form.personnes !== String(resa.nombreDePersonne)
  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))

  function enregistrer() {
    if (!form.debut || !form.fin || form.fin <= form.debut) {
      return onErreur("La date de départ doit être après la date d'arrivée.")
    }
    if (enConflit(toutes, { chambreId: resa.chambreId, debut: form.debut, fin: form.fin }, resa.id)) {
      return onErreur('Cette chambre est déjà réservée sur cette période.')
    }
    const personnes = Number(form.personnes)
    if (!(personnes >= 1)) return onErreur('Il faut au moins une personne.')
    if (personnes > resa.capacite) {
      return onErreur(`Cette chambre accueille ${resa.capacite} personne(s) au maximum.`)
    }
    return onEnregistrer(form)
  }

  function ajouterConso() {
    if (!serviceId) return onErreur('Choisissez un service.')
    const q = Number(quantite)
    if (!(q >= 1)) return onErreur('La quantité doit être d’au moins 1.')
    return onAjouterConso(serviceId, q)
  }

  function encaisser() {
    const v = Number(montant)
    if (!(v > 0)) return onErreur('Saisissez un montant supérieur à 0.')
    return onEncaisser(v)
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={resa.clientNom}
      description={`Chambre ${resa.numeroChambre} · ${resa.typeLabel}`}
      taille="l"
      pied={
        <div className="detail-resa__pied">
          <div>
            {(resa.statut === 'en_attente' || resa.statut === 'confirmee') && (
              <Button
                variante="danger-doux"
                disabled={chargement}
                onClick={() => (annulation ? onChangerStatut('annuler') : setAnnulation(true))}
              >
                {annulation ? 'Confirmer l’annulation ?' : 'Annuler la réservation'}
              </Button>
            )}
          </div>
          <div className="detail-resa__pied-droite">
            <Button variante="secondaire" onClick={onFermer}>
              Fermer
            </Button>
            {modifiable && modifie && (
              <Button variante="contour" chargement={chargement} onClick={enregistrer}>
                Enregistrer
              </Button>
            )}
            {arriveeModifiable && (
              <Button icone={LogIn} disabled={chargement} onClick={() => onChangerStatut('arrivee')}>
                Arrivée
              </Button>
            )}
            {resa.statut === 'en_sejour' && (
              <Button icone={LogOut} disabled={chargement} onClick={() => onChangerStatut('depart')}>
                Départ
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="detail-resa__entete">
        <Badge statut={resa.statut} />
        {resa.client?.tel && <span className="detail-resa__tel">{resa.client.tel}</span>}
      </div>

      <div className="detail-resa__grille">
        <Input
          label="Arrivée"
          type="date"
          value={form.debut ?? ''}
          onChange={maj('debut')}
          disabled={!arriveeModifiable}
        />
        <Input
          label="Départ"
          type="date"
          value={form.fin ?? ''}
          min={form.debut}
          onChange={maj('fin')}
          disabled={!modifiable}
        />
        <Input
          label="Personnes"
          type="number"
          min={1}
          value={form.personnes ?? ''}
          onChange={maj('personnes')}
          disabled={!modifiable}
        />
        <Input
          label="Canal"
          value={form.canal ?? ''}
          onChange={maj('canal')}
          options={OPTIONS_CANAL}
          disabled={!modifiable}
        />
      </div>

      <table className="detail-resa__table">
        <thead>
          <tr>
            <th>Détail</th>
            <th>Qté</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Hébergement ({formatArgent(resa.prixNuit)} / nuit)
            </td>
            <td>{resa.nuits}</td>
            <td>{formatArgent(resa.hebergement)}</td>
          </tr>
          {resa.consos.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="detail-resa__cellule">
                  {c.serviceNom}
                  {modifiable && (
                    <Button
                      variante="fantome"
                      taille="s"
                      iconeSeule
                      icone={X}
                      aria-label={`Retirer ${c.serviceNom}`}
                      disabled={chargement}
                      onClick={() => onRetirerConso(c.id)}
                    />
                  )}
                </span>
              </td>
              <td>{c.quantite}</td>
              <td>{formatArgent(c.montant ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td>
              {formatArgent(resa.total)} {DEVISE}
            </td>
          </tr>
          <tr className="detail-resa__paye">
            <td colSpan={2}>Payé</td>
            <td>
              {formatArgent(resa.montantPaye)} {DEVISE}
            </td>
          </tr>
          <tr className={resa.reste > 0 ? 'detail-resa__du' : undefined}>
            <td colSpan={2}>Reste à payer</td>
            <td>
              {formatArgent(Math.max(resa.reste, 0))} {DEVISE}
            </td>
          </tr>
        </tfoot>
      </table>

      {modifiable && (
        <>
          <p className="detail-resa__titre">Ajouter une consommation</p>
          {services.length === 0 ? (
            <p className="detail-resa__note">
              Aucun service avec un prix n’est enregistré. Ajoutez-en dans l’onglet Services.
            </p>
          ) : (
            <div className="detail-resa__ligne">
              <Input
                label="Service"
                placeholder="Choisir un service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                options={services.map((s) => ({
                  valeur: String(s.id),
                  libelle: `${s.nom} · ${formatArgent(s.prixUnitaire)} ${DEVISE}`
                }))}
              />
              <Input
                label="Quantité"
                type="number"
                min={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
              <Button variante="secondaire" disabled={chargement} onClick={ajouterConso}>
                Ajouter
              </Button>
            </div>
          )}
        </>
      )}

      {resa.statut !== 'annulee' && resa.reste > 0 && (
        <>
          <p className="detail-resa__titre">Encaisser un paiement</p>
          <div className="detail-resa__ligne">
            <Input
              label={`Montant (${DEVISE})`}
              type="number"
              min={0}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
            <Button variante="succes" disabled={chargement} onClick={encaisser}>
              Encaisser
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ============================================================
//  FENÊTRE : CONFIRMER UN DÉPLACEMENT (glisser sur le planning)
// ============================================================

function ModaleDeplacement({ resa, candidat, modele, chargement, onFermer, onValider }) {
  const chambreApres = modele.chambresParId[candidat.chambreId]
  const nuitsApres = nuitsEntre(candidat.debut, candidat.fin)
  const montantApres = nuitsApres * (chambreApres?.prixNuit ?? 0) + resa.services

  const lignes = [
    ['Chambre', resa.numeroChambre, chambreApres?.numero ?? '?'],
    ['Arrivée', formatCourt(jourDe(resa.dateDebut)), formatCourt(jourDe(candidat.debut))],
    ['Départ', formatCourt(jourDe(resa.dateFin)), formatCourt(jourDe(candidat.fin))],
    ['Durée', libelleNuits(resa.nuits), libelleNuits(nuitsApres)],
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
  const [pleinEcran, setPleinEcran] = useState(pleinEcranInitial)

  const [donnees, setDonnees] = useState(null)
  const [vue, setVue] = useState(vueInitiale) // 'liste' | 'planning'
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState(null)

  const [nouvelle, setNouvelle] = useState(null) // préremplissage de la fenêtre de création
  const [selectionId, setSelectionId] = useState(null)
  const [deplacement, setDeplacement] = useState(null) // { id, candidat }

  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  useEffect(() => {
    if (!pleinEcran) return undefined
    const echap = (event) => { if (event.key === 'Escape') setPleinEcran(false) }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [pleinEcran])

  const charger = useCallback(async () => {
    try {
      const api = window.electronAPI
      const [chambres, types, reservations, clients, services, consommations, utilisateurs] =
        await Promise.all([
          api.getAll('chambre'),
          api.getAll('typedechambre'),
          api.getAll('reservation'),
          api.getAll('clients'),
          api.getAll('service'),
          api.getAll('consommation'),
          api.getAll('utilisateur')
        ])
      setDonnees({ chambres, types, reservations, clients, services, consommations, utilisateurs })
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const modele = useMemo(() => (donnees ? construireModele(donnees) : null), [donnees])

  // À remplacer par l'utilisateur connecté quand la connexion mémorisera la session
  const utilisateur = useMemo(
    () => donnees?.utilisateurs.find((u) => u.isActive) ?? donnees?.utilisateurs[0],
    [donnees]
  )

  const compteurs = useMemo(() => {
    const c = {}
    for (const r of modele?.resas ?? []) c[r.statut] = (c[r.statut] ?? 0) + 1
    return c
  }, [modele])

  const affichees = useMemo(() => {
    if (!modele) return []
    const mot = normaliser(recherche.trim())
    return modele.resas
      .filter((r) => !filtre || r.statut === filtre)
      .filter((r) => !mot || normaliser(`${r.clientNom} ${r.client?.prenom ?? ''} ${r.numeroChambre}`).includes(mot))
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))
  }, [modele, recherche, filtre])

  // ---------- Actions ----------
  // Exécute une action, recharge les données et affiche le résultat. Renvoie true si elle a réussi.
  async function executer(action, messageSucces) {
    setChargement(true)
    try {
      await action()
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

  async function creerReservation(form) {
    if (!utilisateur) return setEchec(MESSAGE_SANS_UTILISATEUR)
    const ok = await executer(async () => {
      let clientId = Number(form.clientId)
      if (form.clientId === NOUVEAU_CLIENT) {
        const client = await window.electronAPI.create('clients', {
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          tel: form.tel.trim(),
          email: '',
          sexe: form.sexe
        })
        clientId = client.id
      }
      await window.electronAPI.create('reservation', {
        clientId,
        chambreId: Number(form.chambreId),
        createdBy: utilisateur.id,
        dateDebut: form.debut,
        dateFin: form.fin,
        nombreDePersonne: Number(form.personnes),
        statut: form.statut,
        canal: form.canal
      })
    }, 'Réservation créée.')
    if (ok) setNouvelle(null)
  }

  const enregistrer = (r, form) =>
    maj(
      r,
      {
        dateDebut: form.debut,
        dateFin: form.fin,
        canal: form.canal,
        nombreDePersonne: Number(form.personnes)
      },
      'Modifications enregistrées.'
    )

  function encaisser(r, montant) {
    const paye = r.montantPaye + montant
    const patch = { montantPaye: paye }
    if (r.statut === 'en_attente' && paye >= r.total) patch.statut = 'confirmee'
    return maj(r, patch, `${formatArgent(montant)} ${DEVISE} encaissés.`)
  }

  function ajouterConso(r, serviceId, quantite) {
    if (!utilisateur) return setEchec(MESSAGE_SANS_UTILISATEUR)
    const service = modele.services.find((s) => s.id === Number(serviceId))
    if (!service) return setEchec('Service introuvable.')
    return executer(
      () =>
        window.electronAPI.create('consommation', {
          clientId: r.clientId,
          serviceId: service.id,
          reservationId: r.id,
          createdBy: utilisateur.id,
          statut: 'consomme',
          quantite,
          montant: service.prixUnitaire * quantite
        }),
      `${service.nom} ajouté.`
    )
  }

  const retirerConso = (consoId) =>
    executer(() => window.electronAPI.remove('consommation', consoId), 'Consommation retirée.')

  // Arrivée : la chambre devient occupée. Départ : elle passe en nettoyage.
  async function changerStatut(r, action) {
    const api = window.electronAPI
    if (action === 'arrivee') {
      await executer(async () => {
        await api.update('reservation', r.id, { statut: 'en_sejour' })
        await api.update('chambre', r.chambreId, { statut: 'occupee' })
      }, `Arrivée enregistrée : chambre ${r.numeroChambre}.`)
    } else if (action === 'depart') {
      const ok = await executer(
        async () => {
          await api.update('reservation', r.id, { statut: 'terminee' })
          await api.update('chambre', r.chambreId, { statut: 'nettoyage' })
        },
        r.reste > 0 ? '' : `Départ enregistré : chambre ${r.numeroChambre} à nettoyer.`
      )
      if (ok && r.reste > 0) {
        setEchec(`Départ enregistré, mais il reste ${formatArgent(r.reste)} ${DEVISE} à payer.`)
      }
    } else if (action === 'annuler') {
      const ok = await maj(r, { statut: 'annulee' }, 'Réservation annulée.')
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
              <Button variante="secondaire" icone={pleinEcran ? Minimize2 : Maximize2} aria-pressed={pleinEcran} onClick={() => setPleinEcran((etat) => !etat)}>
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
                        Chambre {r.numeroChambre} · {formatCourt(jourDe(r.dateDebut))} –{' '}
                        {formatCourt(jourDe(r.dateFin))} · {libelleNuits(r.nuits)}
                      </span>
                    </span>
                    <span className="ligne-resa__montant">
                      {formatArgent(r.total)} {DEVISE}
                      {r.reste > 0 && r.statut !== 'annulee' && (
                        <span className="ligne-resa__reste">Reste {formatArgent(r.reste)}</span>
                      )}
                    </span>
                    <Badge statut={r.statut} />
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
          onAjouterConso={(serviceId, q) => ajouterConso(resaSelectionnee, serviceId, q)}
          onRetirerConso={retirerConso}
          onEncaisser={(montant) => encaisser(resaSelectionnee, montant)}
          onChangerStatut={(action) => changerStatut(resaSelectionnee, action)}
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