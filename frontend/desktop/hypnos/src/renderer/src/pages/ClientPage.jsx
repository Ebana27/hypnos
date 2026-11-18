import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, Pencil, Phone, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/base/Button'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'
import { STATUTS_RESERVATION, formatCourt, jourDe } from '../lib/reservations'

const FORMULAIRE_VIDE = { nom: '', prenom: '', tel: '', email: '', sexe: 'M' }

const TRIS = [
  { valeur: 'az', libelle: 'Nom A → Z' },
  { valeur: 'za', libelle: 'Nom Z → A' },
  { valeur: 'recent', libelle: 'Séjour le plus récent' },
  { valeur: 'sejours', libelle: 'Plus de réservations' }
]

const STYLES = `
.clients-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  align-items: flex-end;
  gap: 12px 16px;
}
.clients__recherche { flex: 1 1 260px; max-width: 420px; }
.clients__tri { flex: 0 0 210px; }
.clients__filtres {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.clients__filtres-groupe { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.clients__filtres-titre { color: var(--color-text-muted); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
.clients__compteur { color: var(--color-text-muted); font-size: 12px; }
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
.clients__lettre {
  padding: 6px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
}
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
.clients__nom { display: block; overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.clients__sous-nom { display: flex; flex-wrap: wrap; gap: 6px; color: var(--color-text-muted); font-size: 11px; }
.clients__etiquette {
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-accent-wash);
  color: var(--color-accent);
  font-size: 10px;
  font-weight: 700;
}
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
.clients__form { display: grid; gap: 12px; }
@media (max-width: 900px) {
  .clients__ligne { grid-template-columns: minmax(180px, 1.5fr) minmax(130px, 1fr) 90px; }
  .clients__ligne > :nth-child(4), .clients__ligne > :nth-child(5) { display: none; }
}
@media (max-width: 620px) {
  .clients__resume { grid-template-columns: 1fr; }
  .clients__recherche, .clients__tri { flex: 1 1 100%; max-width: none; }
  .clients__ligne { grid-template-columns: minmax(0, 1fr) 82px; gap: 8px; }
  .clients__ligne > :nth-child(2), .clients__ligne > :nth-child(3), .clients__ligne > :nth-child(5) { display: none; }
}
`

injecterStyles('hypnos-page-clients', STYLES)

// Recherche et tri insensibles aux accents et à la casse : « Élodie » se trouve avec « elodie »
const normaliser = (valeur) =>
  String(valeur ?? '').trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const chiffres = (valeur) => String(valeur ?? '').replace(/\D/g, '')
const initiales = (client) => `${client.prenom?.[0] ?? ''}${client.nom?.[0] ?? ''}`.toLocaleUpperCase('fr') || '?'
const libelleClient = (client) => `${client.sexe === 'F' ? 'Mme' : 'M.'} ${client.prenom ?? ''} ${client.nom ?? ''}`.trim()
const estFemme = (client) => client.sexe === 'F'
const comparerNom = (a, b) =>
  `${a.nom ?? ''} ${a.prenom ?? ''}`.localeCompare(`${b.nom ?? ''} ${b.prenom ?? ''}`, 'fr', { sensitivity: 'base' })
const lettreDe = (client) => {
  const l = normaliser(client.nom).charAt(0).toLocaleUpperCase('fr')
  return /[A-Z]/.test(l) ? l : '#'
}

function dateAffichee(texte) {
  if (!texte) return '—'
  try { return formatCourt(jourDe(texte)) } catch { return '—' }
}

export default function ClientPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [reservations, setReservations] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous') // réservations : 'tous' | 'avec-sejour' | 'sans-sejour'
  const [filtreSexe, setFiltreSexe] = useState('tous') // 'tous' | 'M' | 'F'
  const [tri, setTri] = useState('az')
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
    const q = normaliser(recherche)
    const qChiffres = chiffres(recherche)
    const liste = clients.filter((client) => {
      const aSejour = (reservationsParClient.get(client.id) ?? []).length > 0
      const correspondSejour = filtre === 'tous' || (filtre === 'avec-sejour' ? aSejour : !aSejour)
      const correspondSexe = filtreSexe === 'tous' || (filtreSexe === 'F' ? estFemme(client) : !estFemme(client))
      const cible = [client.nom, client.prenom, client.tel, client.email].map(normaliser).join(' ')
      // Un numéro se retrouve même saisi avec d'autres espaces : « 06 123 » trouve « +242 06123… »
      const correspondRecherche = !q || cible.includes(q) || (qChiffres.length >= 3 && chiffres(client.tel).includes(qChiffres))
      return correspondSejour && correspondSexe && correspondRecherche
    })
    const dernier = (client) => String((reservationsParClient.get(client.id) ?? [])[0]?.dateDebut ?? '')
    const nombre = (client) => (reservationsParClient.get(client.id) ?? []).length
    return liste.sort((a, b) => {
      if (tri === 'za') return comparerNom(b, a)
      if (tri === 'recent') return dernier(b).localeCompare(dernier(a)) || comparerNom(a, b)
      if (tri === 'sejours') return nombre(b) - nombre(a) || comparerNom(a, b)
      return comparerNom(a, b)
    })
  }, [clients, recherche, filtre, filtreSexe, tri, reservationsParClient])

  const avecSejour = useMemo(
    () => clients.filter((client) => (reservationsParClient.get(client.id) ?? []).length > 0).length,
    [clients, reservationsParClient]
  )
  const nbFemmes = useMemo(() => clients.filter(estFemme).length, [clients])
  const nbHommes = clients.length - nbFemmes
  const regrouper = tri === 'az' || tri === 'za'
  const filtresActifs = filtre !== 'tous' || filtreSexe !== 'tous' || recherche.trim() !== ''

  function reinitialiserFiltres() {
    setFiltre('tous')
    setFiltreSexe('tous')
    setRecherche('')
  }

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
    const donnees = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      tel: form.tel.trim(),
      email: form.email.trim(),
      sexe: form.sexe
    }
    if (!donnees.nom || !donnees.prenom) {
      setErreur('Le prénom et le nom du client sont obligatoires.')
      return
    }
    if (donnees.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donnees.email)) {
      setErreur('L’adresse e-mail ne semble pas valide.')
      return
    }
    if (donnees.tel && chiffres(donnees.tel).length < 6) {
      setErreur('Le numéro de téléphone semble incomplet.')
      return
    }
    // Évite les doublons : même téléphone ou même e-mail qu'un autre client
    const doublon = clients.find((c) => c.id !== clientEnEdition?.id && (
      (donnees.tel && chiffres(c.tel) === chiffres(donnees.tel)) ||
      (donnees.email && normaliser(c.email) === normaliser(donnees.email))
    ))
    if (doublon) {
      setErreur(`Ce téléphone ou cet e-mail appartient déjà à ${libelleClient(doublon)}.`)
      return
    }
    setChargement(true)
    setErreur('')
    try {
      if (clientEnEdition) {
        await window.electronAPI.update('clients', clientEnEdition.id, donnees)
        setSucces('Les coordonnées du client ont été mises à jour.')
      } else {
        await window.electronAPI.create('clients', donnees)
        setSucces('Le client a été ajouté.')
      }
      window.dispatchEvent(new Event('hypnos:donnees-mises-a-jour'))
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

  let lettreCourante = null

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
          <InputSearch
            value={recherche}
            onChange={setRecherche}
            placeholder="Nom, prénom, téléphone ou e-mail"
          />
        </div>
        <div className="clients__tri">
          <Input label="Trier par" value={tri} onChange={(e) => setTri(e.target.value)} options={TRIS} />
        </div>
      </div>

      <div className="clients__filtres">
        <div className="clients__filtres-groupe" role="group" aria-label="Filtrer par civilité">
          <span className="clients__filtres-titre">Civilité</span>
          <FilterPillule libelle="Tous" compteur={clients.length} actif={filtreSexe === 'tous'} onClick={() => setFiltreSexe('tous')} />
          <FilterPillule libelle="Hommes" compteur={nbHommes} actif={filtreSexe === 'M'} onClick={() => setFiltreSexe(filtreSexe === 'M' ? 'tous' : 'M')} />
          <FilterPillule libelle="Femmes" compteur={nbFemmes} actif={filtreSexe === 'F'} onClick={() => setFiltreSexe(filtreSexe === 'F' ? 'tous' : 'F')} />
        </div>
        <div className="clients__filtres-groupe" role="group" aria-label="Filtrer par réservations">
          <span className="clients__filtres-titre">Séjours</span>
          <FilterPillule libelle="Avec réservation" compteur={avecSejour} actif={filtre === 'avec-sejour'} onClick={() => setFiltre(filtre === 'avec-sejour' ? 'tous' : 'avec-sejour')} />
          <FilterPillule libelle="Sans réservation" compteur={clients.length - avecSejour} actif={filtre === 'sans-sejour'} onClick={() => setFiltre(filtre === 'sans-sejour' ? 'tous' : 'sans-sejour')} />
        </div>
        {filtresActifs && (
          <Button variante="lien" taille="s" onClick={reinitialiserFiltres}>Réinitialiser</Button>
        )}
        <span className="clients__compteur" aria-live="polite">{clientsFiltres.length} client(s) affiché(s)</span>
      </div>

      <section className="clients__liste" aria-label="Liste des clients">
        <div className="clients__ligne clients__ligne--entete" aria-hidden="true">
          <span>Client</span><span>Téléphone</span><span>E-mail</span><span>Réservations</span><span>Dernier séjour</span>
        </div>
        {clientsFiltres.length ? clientsFiltres.map((client) => {
          const sejours = reservationsParClient.get(client.id) ?? []
          const derniere = sejours[0]
          const lettre = regrouper ? lettreDe(client) : null
          const enteteLettre = regrouper && lettre !== lettreCourante
          lettreCourante = lettre
          return (
            <div key={client.id}>
              {enteteLettre && <div className="clients__lettre" aria-hidden="true">{lettre}</div>}
              <button
                type="button"
                className="clients__ligne clients__ligne--donnee"
                onClick={() => setClientActif({ mode: 'detail', client })}
              >
                <span className="clients__identite">
                  <span className="clients__avatar" aria-hidden="true">{initiales(client)}</span>
                  <span>
                    <span className="clients__nom">{libelleClient(client)}</span>
                    <span className="clients__sous-nom">
                      Fiche client
                      {client.vip && <span className="clients__etiquette">VIP</span>}
                      {client.loyalty && <span className="clients__etiquette">Fidèle</span>}
                    </span>
                  </span>
                </span>
                <span className="clients__contact"><Phone size={14} aria-hidden="true" /><span>{client.tel || 'Non renseigné'}</span></span>
                <span className="clients__contact"><Mail size={14} aria-hidden="true" /><span>{client.email || 'Non renseigné'}</span></span>
                <span className="clients__sejours">{sejours.length}</span>
                <span className="clients__dernier">{derniere ? dateAffichee(derniere.dateDebut) : 'Aucun séjour'}</span>
              </button>
            </div>
          )
        }) : (
          <p className="clients__vide">
            {clients.length === 0 ? 'Aucun client enregistré. Ajoutez votre premier client.' : 'Aucun résultat pour cette recherche ou ces filtres.'}
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
          <div className="clients__form">
            <Input label="Nom" requis autoFocus value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            <Input label="Prénom" requis value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            <Input label="Téléphone" type="tel" placeholder="Ex. +242 06 …" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} />
            <Input label="Adresse e-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Civilité" value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })} options={[{ valeur: 'M', libelle: 'M.' }, { valeur: 'F', libelle: 'Mme' }]} />
          </div>
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
              <Button
                icone={Plus}
                onClick={() => {
                  const id = clientActif.client.id
                  setClientActif(null)
                  // La réservation s'ouvre avec ce client déjà choisi
                  navigate('/booking', { state: { nouvelle: true, clientId: id } })
                }}
              >
                Nouvelle réservation
              </Button>
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