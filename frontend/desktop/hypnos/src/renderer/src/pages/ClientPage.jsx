import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, Pencil, Phone, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/base/Button'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import Modal from '../components/base/Modal'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'
import { STATUTS_RESERVATION, formatCourt, jourDe } from '../lib/reservations'

const FORMULAIRE_VIDE = { nom: '', prenom: '', tel: '', email: '', sexe: 'M' }

const STYLES = `
.clients-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.clients__resume {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.clients__resume-item {
  padding: 16px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
.clients__resume-valeur {
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}
.clients__resume-libelle {
  margin-top: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
}
.clients__outils {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.clients__recherche {
  flex: 1 1 260px;
  max-width: 420px;
}
.clients__filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.clients__liste {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-surface);
}
.clients__ligne {
  display: grid;
  grid-template-columns: minmax(190px, 1.5fr) minmax(150px, 1fr) minmax(150px, 1fr) 110px 120px;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 13px 16px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  text-align: left;
}
.clients__ligne:last-child { border-bottom: 0; }
.clients__ligne--entete {
  background: var(--color-background-soft);
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 600;
}
.clients__ligne--donnee { cursor: pointer; font: inherit; }
.clients__ligne--donnee:hover { background: var(--color-accent-wash); }
.clients__identite { display: flex; align-items: center; gap: 11px; min-width: 0; }
.clients__avatar {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-accent-wash);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 700;
}
.clients__nom { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.clients__sous-nom { color: var(--color-text-muted); font-size: 11px; }
.clients__contact { display: flex; align-items: center; gap: 7px; min-width: 0; color: var(--color-text-muted); font-size: 12px; }
.clients__contact span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clients__sejours { font-size: 12px; font-weight: 600; }
.clients__dernier { color: var(--color-text-muted); font-size: 12px; }
.clients__vide { padding: 42px 18px; color: var(--color-text-muted); text-align: center; font-size: 13px; }
.clients__historique { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }
.clients__historique-titre { margin-bottom: 2px; font-size: 14px; font-weight: 600; }
.clients__resa {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 14px;
  padding: 11px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-s);
}
.clients__resa-nom { font-size: 13px; font-weight: 600; }
.clients__resa-dates { color: var(--color-text-muted); font-size: 12px; }
.clients__badge { align-self: center; padding: 3px 9px; border-radius: var(--radius-pill); background: var(--color-background-soft); color: var(--color-text-muted); font-size: 10px; font-weight: 600; }
.clients__detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.clients__detail-contact { display: flex; flex-wrap: wrap; gap: 14px; color: var(--color-text-muted); font-size: 13px; }
@media (max-width: 900px) {
  .clients__ligne { grid-template-columns: minmax(180px, 1.5fr) minmax(130px, 1fr) 90px; }
  .clients__ligne > :nth-child(4), .clients__ligne > :nth-child(5) { display: none; }
}
@media (max-width: 620px) {
  .clients__resume { grid-template-columns: 1fr; }
  .clients__ligne { grid-template-columns: minmax(0, 1fr) 82px; gap: 8px; }
  .clients__ligne > :nth-child(2), .clients__ligne > :nth-child(3), .clients__ligne > :nth-child(5) { display: none; }
}
`

injecterStyles('hypnos-page-clients', STYLES)

const texteNormalise = (valeur) => String(valeur ?? '').trim().toLocaleLowerCase('fr')
const initiales = (client) => `${client.prenom?.[0] ?? ''}${client.nom?.[0] ?? ''}`.toLocaleUpperCase('fr') || '?'
const libelleClient = (client) => `${client.sexe === 'F' ? 'Mme' : 'M.'} ${client.prenom ?? ''} ${client.nom ?? ''}`.trim()

function dateAffichee(texte) {
  if (!texte) return '—'
  try { return formatCourt(jourDe(texte)) } catch { return '—' }
}

export default function ClientPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [reservations, setReservations] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous')
  const [clientActif, setClientActif] = useState(null)
  const [clientEnEdition, setClientEnEdition] = useState(null)
  const [form, setForm] = useState(FORMULAIRE_VIDE)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')

  const charger = useCallback(async () => {
    try {
      const [listeClients, listeReservations] = await Promise.all([
        window.electronAPI.getAll('clients'),
        window.electronAPI.getAll('reservation')
      ])
      setClients(listeClients)
      setReservations(listeReservations)
      setErreur('')
    } catch (e) {
      setErreur(e.message || 'Impossible de charger les clients.')
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  const reservationsParClient = useMemo(() => {
    const resultat = new Map()
    for (const reservation of reservations) {
      const liste = resultat.get(reservation.clientId) ?? []
      liste.push(reservation)
      resultat.set(reservation.clientId, liste)
    }
    for (const liste of resultat.values()) {
      liste.sort((a, b) => String(b.dateDebut).localeCompare(String(a.dateDebut)))
    }
    return resultat
  }, [reservations])

  const clientsFiltres = useMemo(() => {
    const q = texteNormalise(recherche)
    return [...clients]
      .filter((client) => {
        const historique = reservationsParClient.get(client.id) ?? []
        const aSejour = historique.length > 0
        const correspondFiltre = filtre === 'tous' || (filtre === 'avec-sejour' ? aSejour : !aSejour)
        const cible = [client.nom, client.prenom, client.tel, client.email].map(texteNormalise).join(' ')
        return correspondFiltre && (!q || cible.includes(q))
      })
      .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
  }, [clients, recherche, filtre, reservationsParClient])

  const avecSejour = useMemo(
    () => clients.filter((client) => (reservationsParClient.get(client.id) ?? []).length > 0).length,
    [clients, reservationsParClient]
  )

  function ouvrirCreation() {
    setClientEnEdition(null)
    setForm(FORMULAIRE_VIDE)
    setClientActif({ mode: 'formulaire' })
  }

  function ouvrirEdition(client) {
    setClientEnEdition(client)
    setForm({
      nom: client.nom ?? '',
      prenom: client.prenom ?? '',
      tel: client.tel ?? '',
      email: client.email ?? '',
      sexe: client.sexe === 'F' ? 'F' : 'M'
    })
    setClientActif({ mode: 'formulaire' })
  }

  async function enregistrerClient(e) {
    e?.preventDefault?.()
    if (!form.nom.trim() || !form.prenom.trim()) {
      setErreur('Le prénom et le nom du client sont obligatoires.')
      return
    }
    setChargement(true)
    setErreur('')
    try {
      const donnees = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        tel: form.tel.trim(),
        email: form.email.trim(),
        sexe: form.sexe
      }
      if (clientEnEdition) {
        await window.electronAPI.update('clients', clientEnEdition.id, donnees)
        setSucces('Les coordonnées du client ont été mises à jour.')
      } else {
        await window.electronAPI.create('clients', donnees)
        setSucces('Le client a été ajouté.')
      }
      setClientActif(null)
      setClientEnEdition(null)
      await charger()
    } catch (e2) {
      setErreur(e2.message || 'Impossible d’enregistrer le client.')
    } finally {
      setChargement(false)
    }
  }

  const historiqueActif = clientActif?.mode === 'detail'
    ? reservationsParClient.get(clientActif.client.id) ?? []
    : []

  return (
    <div className="clients-page">
      <Header titre="Clients">
        <Button icone={Plus} onClick={ouvrirCreation}>Ajouter un client</Button>
      </Header>

      <section className="clients__resume" aria-label="Résumé des clients">
        <article className="clients__resume-item">
          <p className="clients__resume-valeur">{clients.length.toLocaleString('fr-FR')}</p>
          <p className="clients__resume-libelle">Clients enregistrés</p>
        </article>
        <article className="clients__resume-item">
          <p className="clients__resume-valeur">{avecSejour.toLocaleString('fr-FR')}</p>
          <p className="clients__resume-libelle">Avec au moins une réservation</p>
        </article>
        <article className="clients__resume-item">
          <p className="clients__resume-valeur">{reservations.length.toLocaleString('fr-FR')}</p>
          <p className="clients__resume-libelle">Réservations enregistrées</p>
        </article>
      </section>

      <div className="clients__outils">
        <div className="clients__recherche">
          <Input
            label="Rechercher un client"
            placeholder="Nom, prénom, téléphone ou e-mail"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <div className="clients__filtres" aria-label="Filtrer les clients">
          <FilterPillule libelle="Tous" compteur={clients.length} actif={filtre === 'tous'} onClick={() => setFiltre('tous')} />
          <FilterPillule libelle="Avec réservation" compteur={avecSejour} actif={filtre === 'avec-sejour'} onClick={() => setFiltre(filtre === 'avec-sejour' ? 'tous' : 'avec-sejour')} />
          <FilterPillule libelle="Sans réservation" compteur={clients.length - avecSejour} actif={filtre === 'sans-sejour'} onClick={() => setFiltre(filtre === 'sans-sejour' ? 'tous' : 'sans-sejour')} />
        </div>
      </div>

      <section className="clients__liste" aria-label="Liste des clients">
        <div className="clients__ligne clients__ligne--entete" aria-hidden="true">
          <span>Client</span><span>Téléphone</span><span>E-mail</span><span>Réservations</span><span>Début le</span>
        </div>
        {clientsFiltres.length ? clientsFiltres.map((client) => {
          const sejours = reservationsParClient.get(client.id) ?? []
          const derniere = sejours[0]
          return (
            <button
              type="button"
              className="clients__ligne clients__ligne--donnee"
              key={client.id}
              onClick={() => setClientActif({ mode: 'detail', client })}
            >
              <span className="clients__identite">
                <span className="clients__avatar" aria-hidden="true">{initiales(client)}</span>
                <span>
                  <span className="clients__nom">{libelleClient(client)}</span>
                  <span className="clients__sous-nom">Fiche client</span>
                </span>
              </span>
              <span className="clients__contact"><Phone size={14} aria-hidden="true" /><span>{client.tel || 'Non renseigné'}</span></span>
              <span className="clients__contact"><Mail size={14} aria-hidden="true" /><span>{client.email || 'Non renseigné'}</span></span>
              <span className="clients__sejours">{sejours.length}</span>
              <span className="clients__dernier">{derniere ? dateAffichee(derniere.dateDebut) : 'Aucun séjour'}</span>
            </button>
          )
        }) : (
          <p className="clients__vide">
            {clients.length === 0 ? 'Aucun client enregistré. Ajoutez votre premier client.' : 'Aucun résultat pour cette recherche ou ce filtre.'}
          </p>
        )}
      </section>

      {clientActif?.mode === 'formulaire' && (
        <Modal
          ouvert
          onFermer={() => { setClientActif(null); setClientEnEdition(null) }}
          titre={clientEnEdition ? 'Modifier le client' : 'Ajouter un client'}
          description="Ces coordonnées sont enregistrées dans la fiche client."
          libelleValider={clientEnEdition ? 'Enregistrer' : 'Ajouter'}
          onValider={enregistrerClient}
          chargement={chargement}
        >
          <Input label="Nom" requis autoFocus value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          <Input label="Prénom" requis value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
          <Input label="Téléphone" type="tel" placeholder="Ex. +242 06 …" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} />
          <Input label="Adresse e-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Civilité" value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })} options={[{ valeur: 'M', libelle: 'M.' }, { valeur: 'F', libelle: 'Mme' }]} />
        </Modal>
      )}

      {clientActif?.mode === 'detail' && (
        <Modal
          ouvert
          onFermer={() => setClientActif(null)}
          titre={libelleClient(clientActif.client)}
          description={`Fiche client · ${historiqueActif.length} réservation(s)`}
          pied={
            <div className="clients__detail-actions">
              <Button variante="secondaire" icone={Pencil} onClick={() => ouvrirEdition(clientActif.client)}>Modifier la fiche</Button>
              <Button icone={Plus} onClick={() => { setClientActif(null); navigate('/booking') }}>Nouvelle réservation</Button>
            </div>
          }
        >
          <div className="clients__detail-contact">
            <span><Phone size={14} aria-hidden="true" /> {clientActif.client.tel || 'Téléphone non renseigné'}</span>
            <span><Mail size={14} aria-hidden="true" /> {clientActif.client.email || 'E-mail non renseigné'}</span>
          </div>
          <div className="clients__historique">
            <h3 className="clients__historique-titre">Historique des réservations</h3>
            {historiqueActif.length ? historiqueActif.map((reservation) => (
              <article className="clients__resa" key={reservation.id}>
                <div>
                  <p className="clients__resa-nom">Séjour du {dateAffichee(reservation.dateDebut)} au {dateAffichee(reservation.dateFin)}</p>
                  <p className="clients__resa-dates">Réservation n° {reservation.id}</p>
                </div>
                <span className="clients__badge">{STATUTS_RESERVATION[reservation.statut]?.libelle ?? reservation.statut}</span>
              </article>
            )) : <p className="clients__vide">Aucune réservation liée à ce client.</p>}
          </div>
        </Modal>
      )}

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(erreur)} message={erreur} onFermer={() => setErreur('')} />
    </div>
  )
}
