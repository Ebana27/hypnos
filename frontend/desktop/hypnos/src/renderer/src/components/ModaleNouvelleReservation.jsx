/* eslint-disable react/prop-types */
// À placer dans : src/renderer/src/components/ModaleNouvelleReservation.jsx
// Formulaire de nouvelle réservation : trois colonnes en grille (Client · Séjour · Facture),
// sans défilement. Le total et le bouton de confirmation sont toujours visibles.
import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import Button from './base/Button'
import Input from './base/Input'
import Modal from './base/Modal'
import injecterStyles from './base/injecterStyles'
import {
  CANAUX,
  DEVISE,
  ajouterJours,
  aujourdhui,
  chambreReservable,
  cleJour,
  enConflit,
  formatArgent,
  jourDe,
  libelleNuits,
  nuitsEntre
} from '../lib/reservations'

export const NOUVEAU_CLIENT = '__nouveau'

const OPTIONS_CANAL = Object.entries(CANAUX).map(([valeur, libelle]) => ({ valeur, libelle }))
const OPTIONS_SEXE = [
  { valeur: 'M', libelle: 'Homme' },
  { valeur: 'F', libelle: 'Femme' }
]
const OPTIONS_MODE = [
  { valeur: 'especes', libelle: 'Espèces' },
  { valeur: 'carte', libelle: 'Carte' },
  { valeur: 'mtn_money', libelle: 'MTN Money' },
  { valeur: 'airtel_money', libelle: 'Airtel Money' }
]

const normaliser = (texte) =>
  String(texte)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const libelleDate = (date) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : 'À choisir'

const STYLES = `
.resa-new {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
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
.resa-new__col--facture {
  background: var(--color-background-soft);
}
.resa-new__titre {
  margin: 0;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
}
.resa-new__grille {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.resa-new__plein {
  grid-column: 1 / -1;
}

/* ---------- Client ---------- */
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
.resa-new__choix:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-wash);
}
.resa-new__choix strong {
  font-size: 13px;
  font-weight: 600;
}
.resa-new__choix span {
  font-size: 11px;
  color: var(--color-text-muted);
}
.resa-new__vide {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}
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
.resa-new__client strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

/* ---------- Facture ---------- */
.resa-new__lignes {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
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
.resa-new__total strong {
  font-weight: 600;
  text-align: right;
  color: var(--color-text);
}
.resa-new__totaux {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.resa-new__net {
  color: var(--color-text);
  font-weight: 600;
}
.resa-new__net strong {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--color-accent);
}
.resa-new__note {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-faint);
}

@media (max-width: 940px) {
  .resa-new { grid-template-columns: 1fr 1fr; }
  .resa-new__col--facture { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .resa-new { grid-template-columns: 1fr; }
}
`

injecterStyles('hypnos-modale-nouvelle-reservation', STYLES)

const formulaireInitial = (prefill = {}) => ({
  clientId: '',
  nom: '',
  prenom: '',
  tel: '',
  email: '',
  sexe: 'M',
  chambreId: prefill.chambreId ? String(prefill.chambreId) : '',
  debut: prefill.debut ?? cleJour(aujourdhui()),
  fin: prefill.fin ?? cleJour(ajouterJours(aujourdhui(), 1)),
  personnes: '1',
  canal: 'direct',
  statut: 'confirmee',
  acompte: '',
  modeAcompte: 'especes'
})

/**
 * Props :
 *  prefill      { chambreId, debut, fin } facultatif (clic sur une case du planning)
 *  modele       modèle construit par BookingPage (chambres, resas, clients, clientsRecents…)
 *  chargement   création en cours
 *  onFermer, onCreer(form), onErreur(message)
 */
export default function ModaleNouvelleReservation({
  prefill,
  modele,
  chargement,
  onFermer,
  onCreer,
  onErreur
}) {
  const [form, setForm] = useState(() => formulaireInitial(prefill))
  const [recherche, setRecherche] = useState('')
  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))

  const nouveauClient = form.clientId === NOUVEAU_CLIENT
  const clientChoisi = modele.clients.find((c) => String(c.id) === String(form.clientId))
  const periodeValide = Boolean(form.debut && form.fin && form.fin > form.debut)
  const requete = normaliser(recherche.trim())

  // Au plus 4 propositions affichées dans la colonne (pas de liste flottante, donc pas de défilement)
  const propositions = useMemo(() => {
    if (!requete) return modele.clientsRecents.slice(0, 4)
    return modele.clients
      .filter((c) =>
        normaliser(`${c.prenom ?? ''} ${c.nom ?? ''} ${c.tel ?? ''} ${c.email ?? ''}`).includes(requete)
      )
      .slice(0, 4)
  }, [modele.clients, modele.clientsRecents, requete])

  // Hors service : jamais proposée. En nettoyage : pas pour une arrivée aujourd'hui.
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
  const chambre = modele.chambresParId[Number(form.chambreId)]
  const chambreIndisponible =
    Boolean(form.chambreId) && !libres.some((c) => String(c.id) === form.chambreId)
  const nuits = periodeValide ? nuitsEntre(form.debut, form.fin) : 0
  const sousTotal = chambre && nuits > 0 ? nuits * chambre.prixNuit : 0
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

  // Si l'arrivée dépasse le départ, le départ est repoussé au lendemain
  function changerDebut(e) {
    const debut = e.target.value
    setForm((f) => ({
      ...f,
      debut,
      fin: debut && f.fin <= debut ? cleJour(ajouterJours(jourDe(debut), 1)) : f.fin
    }))
  }

  function valider() {
    if (!form.clientId) return onErreur('Choisissez un client ou créez-en un.')
    if (nouveauClient && (!form.prenom.trim() || !form.nom.trim())) {
      return onErreur('Le prénom et le nom du client sont obligatoires.')
    }
    if (!periodeValide) return onErreur("La date de départ doit être après la date d'arrivée.")
    if (!form.chambreId) return onErreur('Choisissez une chambre.')
    if (chambreIndisponible) return onErreur('Cette chambre n’est pas disponible sur cette période.')
    const personnes = Number(form.personnes)
    if (!(personnes >= 1)) return onErreur('Il faut au moins une personne.')
    if (chambre && personnes > chambre.capacite) {
      return onErreur(`Cette chambre accueille ${chambre.capacite} personne(s) au maximum.`)
    }
    if (!Number.isInteger(acompte) || acompte < 0) return onErreur('L’acompte doit être un montant entier.')
    if (acompte > sousTotal) return onErreur("L'acompte dépasse le montant du séjour.")
    return onCreer(form)
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Nouvelle réservation"
      description="Client · séjour · estimation de la facture"
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
              </div>
              <Button variante="secondaire" taille="s" onClick={() => choisirClient(null)}>
                Changer de client
              </Button>
            </>
          ) : nouveauClient ? (
            <>
              <div className="resa-new__grille">
                <Input label="Prénom" requis value={form.prenom} onChange={maj('prenom')} />
                <Input label="Nom" requis value={form.nom} onChange={maj('nom')} />
                <Input label="Téléphone" placeholder="+242 …" value={form.tel} onChange={maj('tel')} />
                <Input label="E-mail" type="email" value={form.email} onChange={maj('email')} />
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
            <Input label="Arrivée" type="date" requis value={form.debut} onChange={changerDebut} />
            <Input
              label="Départ"
              type="date"
              requis
              min={form.debut}
              value={form.fin}
              onChange={maj('fin')}
            />
            <Input
              className="resa-new__plein"
              label="Chambre"
              requis
              placeholder={libres.length ? 'Choisir une chambre' : 'Aucune chambre libre'}
              value={form.chambreId}
              onChange={maj('chambreId')}
              erreur={chambreIndisponible ? 'Indisponible sur ces dates.' : undefined}
              options={libres.map((c) => ({
                valeur: String(c.id),
                libelle: `${c.numero} · ${c.typeLabel} · ${formatArgent(c.prixNuit)} ${DEVISE}/nuit`
              }))}
            />
            <Input
              label="Personnes"
              type="number"
              min={1}
              value={form.personnes}
              onChange={maj('personnes')}
            />
            <Input label="Canal" value={form.canal} onChange={maj('canal')} options={OPTIONS_CANAL} />
            <Input
              label={`Acompte (${DEVISE})`}
              type="number"
              min={0}
              value={form.acompte}
              onChange={maj('acompte')}
            />
            <Input
              label="Mode de paiement"
              value={form.modeAcompte}
              onChange={maj('modeAcompte')}
              options={OPTIONS_MODE}
            />
          </div>
        </section>

        {/* ---------- Colonne 3 : facture (toujours visible) ---------- */}
        <aside className="resa-new__col resa-new__col--facture" aria-label="Aperçu de la facture">
          <h3 className="resa-new__titre">Facture (estimation)</h3>
          <ul className="resa-new__lignes">
            <li>
              <span>Client</span>
              <strong>{nomAffiche}</strong>
            </li>
            <li>
              <span>Séjour</span>
              <strong>
                {periodeValide ? `${libelleDate(form.debut)} → ${libelleDate(form.fin)}` : 'À définir'}
              </strong>
            </li>
            <li>
              <span>Durée</span>
              <strong>{periodeValide ? libelleNuits(nuits) : '—'}</strong>
            </li>
            <li>
              <span>Chambre</span>
              <strong>{chambre ? `${chambre.numero} · ${chambre.typeLabel}` : 'À choisir'}</strong>
            </li>
            {chambre && (
              <li>
                <span>Tarif</span>
                <strong>
                  {formatArgent(chambre.prixNuit)} {DEVISE} × {nuits}
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
            <p className="resa-new__note">TVA non configurée : montants hors taxe.</p>
            <Button pleineLargeur icone={Check} chargement={chargement} onClick={valider}>
              Confirmer la réservation
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  )
}