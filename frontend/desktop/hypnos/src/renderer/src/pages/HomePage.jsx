import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, Clock3, Inbox, LogIn, LogOut, Plus, UserPlus, X } from 'lucide-react'
import Button from '../components/base/Button'
import CardRoom, { STATUTS_CHAMBRE } from '../components/base/CardRoom'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import injecterStyles from '../components/base/injecterStyles'
import KpiCard from '../components/KpiCard'
import {
  chambreReservable,
  cleJour,
  enConflit,
  formatCourt,
  initiales,
  jourDe,
  nomClient
} from '../lib/reservations'

const DEVISE = 'XAF'

// Les demandes de démonstration créent de vraies lignes en base : elles ne sont proposées
// qu'en développement, jamais dans l'application installée chez le client.
const MODE_DEMO = import.meta.env.DEV

// Raccourcis : ils ouvrent la page concernée ET transmettent leur intention (état de navigation),
// que la page Réservations lit pour ouvrir directement la bonne fenêtre ou le bon filtre.
const ACTIONS = [
  { libelle: 'Nouvelle réservation', Icone: Plus, vers: '/booking', etat: { nouvelle: true }, principale: true },
  { libelle: 'Arrivée', Icone: LogIn, vers: '/booking', etat: { filtre: 'confirmee' }, aide: 'Réservations confirmées à faire arriver' },
  { libelle: 'Départ', Icone: LogOut, vers: '/booking', etat: { filtre: 'en_sejour' }, aide: 'Séjours en cours à clôturer' },
  { libelle: 'Ajouter un client', Icone: UserPlus, vers: '/clients' },
  {
    libelle: 'Voir le planning',
    Icone: Calendar,
    vers: '/planning',
    aide: 'Le planning se met en plein écran avec F11'
  }
]

// Statuts qui font occuper une chambre dans le calcul du taux d'occupation
const STATUTS_OCCUPANTS = ['confirmee', 'en_sejour', 'terminee']

// Entrées de caisse comptées comme recettes (les dons et renforts n'en sont pas)
const RECETTES = ['acompte', 'paiement_client', 'service']

const BADGES = {
  confirmee: 'Confirmée',
  arrivee: 'Arrivée',
  'en-cours': 'En cours',
  depart: 'Départ',
  terminee: 'Terminée',
  annulee: 'Annulée'
}

// ============================================================
//  STYLE (intégré à la page)
// ============================================================
const STYLES = `
.accueil {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.accueil__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.accueil__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.accueil__colonnes {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 20px;
  align-items: start;
}
@media (max-width: 1100px) {
  .accueil__colonnes {
    grid-template-columns: 1fr;
  }
}

.accueil__carte {
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  background: var(--color-surface);
}
.accueil__carte-entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.accueil__carte-titre {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}
.accueil__filtres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.accueil__grille {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.accueil__vide {
  padding: 28px 0;
  text-align: center;
}
.accueil__vide-titre {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.accueil__vide-texte {
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text-muted);
}
.accueil__chargement {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}
.demandes-demo__bouton { position:relative; }
.demandes-demo__compteur { display:inline-grid; place-items:center; min-width:20px; height:20px; padding:0 5px; margin-left:7px; border-radius:999px; background:var(--color-accent); color:var(--color-accent-contrast); font-size:11px; font-weight:700; }
.demandes-demo__voile { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:24px; background:rgba(17,24,39,.46); backdrop-filter:blur(3px); }
.demandes-demo__panneau { position:relative; display:flex; flex-direction:column; width:min(900px,calc(100vw - 48px)); height:min(760px,calc(100dvh - 48px)); max-height:calc(100dvh - 48px); overflow:hidden; border:1px solid var(--color-border); border-radius:var(--radius-l); background:var(--color-surface); box-shadow:0 24px 80px rgba(15,23,42,.28); }
.demandes-demo__entete { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:22px 24px 16px; border-bottom:1px solid var(--color-border); }
.demandes-demo__titre { margin:0; font-family:var(--font-display); font-size:20px; font-weight:700; }
.demandes-demo__intro { margin:6px 0 0; color:var(--color-text-muted); font-size:13px; line-height:1.5; }
.demandes-demo__alerte { margin:14px 20px 4px; padding:11px 12px; border:1px solid color-mix(in srgb,var(--color-warning) 45%,transparent); border-radius:var(--radius-m); background:color-mix(in srgb,var(--color-warning) 12%,var(--color-surface)); color:var(--color-text); font-size:12px; line-height:1.5; }
.demandes-demo__liste { flex:1; overflow:auto; padding:14px 20px 24px; }
.demandes-demo__carte { margin-bottom:12px; padding:14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.demandes-demo__carte--convertie { opacity:.72; }
.demandes-demo__ligne { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.demandes-demo__client { margin:0; font-size:14px; font-weight:700; }
.demandes-demo__source { display:inline-flex; align-items:center; gap:5px; padding:4px 8px; border-radius:999px; background:var(--color-background-soft); color:var(--color-text-muted); font-size:11px; font-weight:600; white-space:nowrap; }
.demandes-demo__detail { display:grid; gap:5px; margin:11px 0 12px; color:var(--color-text-muted); font-size:12px; }
.demandes-demo__choix { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:end; }
.demandes-demo__choix label { display:grid; gap:5px; color:var(--color-text-muted); font-size:11px; }
.demandes-demo__choix select { width:100%; min-width:0; padding:9px 10px; border:1px solid var(--color-border); border-radius:var(--radius-s); background:var(--color-surface); color:var(--color-text); }
.demandes-demo__statut { display:inline-flex; align-items:center; gap:5px; color:var(--color-success); font-size:12px; font-weight:600; }
.demandes-demo__filtres { display:flex; flex-wrap:wrap; gap:8px; padding:12px 20px 0; }
.demandes-demo__filtre { padding:7px 11px; border:1px solid var(--color-border); border-radius:999px; background:var(--color-surface); color:var(--color-text-muted); font:inherit; font-size:12px; cursor:pointer; }
.demandes-demo__filtre[aria-pressed="true"] { border-color:var(--color-accent); background:var(--color-accent-wash); color:var(--color-accent); font-weight:600; }
@media(max-width:560px){ .demandes-demo__voile { padding:12px; } .demandes-demo__panneau { width:100%; height:calc(100dvh - 24px); max-height:calc(100dvh - 24px); border-radius:var(--radius-m); } .demandes-demo__entete { padding:18px 16px 14px; } .demandes-demo__liste { padding-inline:14px; } .demandes-demo__filtres { padding-inline:14px; } .demandes-demo__choix { grid-template-columns:1fr; } }

/* ---------- Dernières réservations ---------- */
.accueil__liste {
  display: flex;
  flex-direction: column;
}
.resa {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}
.resa:last-child {
  border-bottom: none;
}
.resa__avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-background-mute);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
}
.resa__infos {
  flex: 1;
  min-width: 0;
}
.resa__nom {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resa__detail {
  font-size: 12px;
  color: var(--color-text-muted);
}
.resa__badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
}
.resa__badge--confirmee {
  background: var(--color-accent-wash);
  color: var(--color-accent);
}
.resa__badge--arrivee {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
.resa__badge--en-cours {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
}
.resa__badge--depart {
  background: var(--color-text);
  color: var(--color-background);
}
.resa__badge--terminee {
  background: var(--color-background-soft);
  color: var(--color-text-muted);
}
.resa__badge--annulee {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}
`

injecterStyles('hypnos-page-accueil', STYLES)

// ============================================================
//  OUTILS
// ============================================================

const nombre = (n) => Math.round(n).toLocaleString('fr-FR')
const heureDe = (texte) => String(texte).slice(11, 16)

function libelleEtage(etage) {
  if (etage === 0) return 'RDC'
  return etage === 1 ? '1er étage' : `${etage}e étage`
}

// Statut affiché à partir du statut enregistré et de la date du jour.
// « en_sejour » = client dans la chambre : « En cours », ou « Départ » si la date de fin est atteinte.
function statutAffiche(reservation, aujourdhui) {
  if (reservation.statut === 'annulee') return 'annulee'
  if (reservation.statut === 'terminee') return 'terminee'
  const debut = jourDe(reservation.dateDebut).getTime()
  const fin = jourDe(reservation.dateFin).getTime()
  const t = aujourdhui.getTime()
  if (reservation.statut === 'en_sejour') return t >= fin ? 'depart' : 'en-cours'
  if (t >= fin) return 'depart'
  if (t === debut) return 'arrivee'
  if (t > debut) return 'en-cours'
  return 'confirmee'
}

// Part des chambres occupées, en moyenne, sur la semaine en cours (lundi → dimanche)
function tauxSemaine(chambres, reservations, aujourdhui) {
  if (chambres.length === 0) return 0
  const lundi = new Date(aujourdhui)
  lundi.setDate(aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7))
  const actives = reservations.filter((r) => STATUTS_OCCUPANTS.includes(r.statut))

  let nuitsOccupees = 0
  for (let i = 0; i < 7; i++) {
    const jour = new Date(lundi)
    jour.setDate(lundi.getDate() + i)
    const t = jour.getTime()
    const occupees = new Set(
      actives
        .filter((r) => jourDe(r.dateDebut).getTime() <= t && t < jourDe(r.dateFin).getTime())
        .map((r) => r.chambreId)
    )
    nuitsOccupees += occupees.size
  }
  return Math.round((nuitsOccupees / (chambres.length * 7)) * 100)
}

function Vide({ titre, texte }) {
  return (
    <div className="accueil__vide">
      <p className="accueil__vide-titre">{titre}</p>
      <p className="accueil__vide-texte">{texte}</p>
    </div>
  )
}

// Demandes d'exemple (développement uniquement) : aucun connecteur externe n'est encore branché.
function creerDemandesDemo() {
  const demain = new Date(); demain.setDate(demain.getDate() + 1)
  const apresDemain = new Date(demain); apresDemain.setDate(apresDemain.getDate() + 1)
  const dansUneSemaine = new Date(); dansUneSemaine.setDate(dansUneSemaine.getDate() + 7)
  const fmt = (d, h, m = '00') => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${h}:${m}`
  return [
    { id: 'demo-site-101', source: 'Site web', canal: 'site', prenom: 'Amina', nom: 'Mabiala', tel: '+242 06 123 45 67', email: 'amina.demo@example.test', sexe: 'F', arrivee: fmt(demain, '15', '00'), depart: fmt(demain, '19', '00'), adultes: 1, enfants: 0, type: 'heure' },
    { id: 'demo-booking-204', source: 'Booking.com', canal: 'booking', prenom: 'Jean', nom: 'Moussa', tel: '+242 05 987 65 43', email: 'jean.demo@example.test', sexe: 'M', arrivee: fmt(apresDemain, '15', '00'), depart: fmt(dansUneSemaine, '11', '00'), adultes: 2, enfants: 1, type: 'nuit' },
    { id: 'demo-hypnos-309', source: 'Application Hypnos', canal: 'site', prenom: 'Clarisse', nom: 'Ngoma', tel: '+242 06 555 00 11', email: 'clarisse.demo@example.test', sexe: 'F', arrivee: fmt(dansUneSemaine, '10', '00'), depart: fmt(dansUneSemaine, '14', '00'), adultes: 2, enfants: 0, type: 'heure' }
  ]
}
const dateDemande = (s) => new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ============================================================
//  PAGE
// ============================================================

export default function HomePage() {
  const navigate = useNavigate()
  const [donnees, setDonnees] = useState(null) // null tant que rien n'est chargé
  const [erreur, setErreur] = useState('')
  const [filtreStatut, setFiltreStatut] = useState(null)
  const [etageChoisi, setEtageChoisi] = useState(null)
  const [demandesOuvert, setDemandesOuvert] = useState(false)
  const [demandesDemo, setDemandesDemo] = useState(() => (MODE_DEMO ? creerDemandesDemo() : []))
  const [sourceDemande, setSourceDemande] = useState('Toutes')
  const [chambreChoisie, setChambreChoisie] = useState({})
  const [messageDemande, setMessageDemande] = useState('')
  const [conversionEnCours, setConversionEnCours] = useState('')

  const charger = useCallback(async () => {
    try {
      const [chambres, reservations, clients, mouvements] = await Promise.all([
        window.electronAPI.getAll('chambre'),
        window.electronAPI.getAll('reservation'),
        window.electronAPI.getAll('clients'),
        window.electronAPI.getAll('mouvementcaisse')
      ])
      setErreur('')
      setDonnees({ chambres, reservations, clients, mouvements })
    } catch (e) {
      setErreur(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  useEffect(() => {
    if (!demandesOuvert) return undefined
    const fermerAvecEscape = (event) => { if (event.key === 'Escape') setDemandesOuvert(false) }
    window.addEventListener('keydown', fermerAvecEscape)
    return () => window.removeEventListener('keydown', fermerAvecEscape)
  }, [demandesOuvert])

  const demandesEnAttente = demandesDemo.filter((d) => !d.convertie)
  const demandesVisibles = demandesDemo.filter((d) => sourceDemande === 'Toutes' || d.source === sourceDemande)

  async function convertirDemande(demande) {
    const chambreId = Number(chambreChoisie[demande.id])
    const chambre = donnees?.chambres.find((c) => Number(c.id) === chambreId)
    if (!chambre) { setMessageDemande('Choisissez une chambre avant de convertir cette demande.'); return }
    if (!chambreReservable(chambre, demande.arrivee)) { setMessageDemande('Cette chambre est en maintenance ou en nettoyage à cette date. Choisissez-en une autre.'); return }
    if (enConflit(donnees.reservations, { chambreId, debut: demande.arrivee, fin: demande.depart })) { setMessageDemande('Cette chambre est déjà réservée sur ce créneau. Sélectionnez une autre chambre.'); return }
    setConversionEnCours(demande.id); setMessageDemande('')
    try {
      // Évite de dupliquer le client si le même téléphone ou e-mail existe déjà
      const existant = donnees.clients.find((c) => (demande.tel && c.tel === demande.tel) || (demande.email && c.email === demande.email))
      const client = existant ?? await window.electronAPI.create('clients', { nom: demande.nom, prenom: demande.prenom, tel: demande.tel, email: demande.email, sexe: demande.sexe, document: '', preference: '', allergies: '', infoGenerales: '' })
      await window.electronAPI.create('reservation', {
        clientId: client.id, chambreId, dateDebut: demande.arrivee, dateFin: demande.depart,
        typeSejour: demande.type, modeTarif: demande.type === 'heure' ? 'heure' : 'nuit',
        nombreDePersonne: demande.adultes + demande.enfants, nombreAdultes: demande.adultes, nombreEnfants: demande.enfants,
        typeGroupe: demande.adultes + demande.enfants > 1 ? 'groupe' : 'seul',
        statut: 'confirmee', canal: demande.canal, conditionsPaiement: '', modePaiement: 'especes', numeroPaiement: ''
      })
      setDemandesDemo((liste) => liste.map((d) => d.id === demande.id ? { ...d, convertie: true } : d))
      setMessageDemande(`Demande de démonstration convertie en réservation pour la chambre ${chambre.numero}.`)
      window.dispatchEvent(new Event('hypnos:donnees-mises-a-jour'))
      await charger()
    } catch (e) { setMessageDemande(`Conversion impossible : ${e.message}`) }
    finally { setConversionEnCours('') }
  }

  // Tous les calculs, faits une seule fois par chargement des données
  const calculs = useMemo(() => {
    if (!donnees) return null
    const { chambres, reservations, clients, mouvements } = donnees
    const aujourdhui = jourDe(cleJour(new Date()))

    const clientsParId = Object.fromEntries(clients.map((c) => [c.id, c]))
    const chambresParId = Object.fromEntries(chambres.map((c) => [c.id, c]))

    const triees = [...chambres].sort((a, b) =>
      a.numero.localeCompare(b.numero, 'fr', { numeric: true })
    )
    const etages = [...new Set(chambres.map((c) => c.etage))].sort((a, b) => a - b)
    const compteurs = {}
    for (const c of chambres) compteurs[c.statut] = (compteurs[c.statut] ?? 0) + 1

    const revenu = mouvements
      .filter(
        (m) =>
          m.type === 'entree' &&
          RECETTES.includes(m.categorie) &&
          m.dateMouvement === cleJour(aujourdhui)
      )
      .reduce((somme, m) => somme + m.montant, 0)

    // Départs du jour : séjours en cours dont la date de fin est aujourd'hui
    const departs = reservations.filter(
      (r) => r.statut === 'en_sejour' && jourDe(r.dateFin).getTime() === aujourdhui.getTime()
    ).length

    const occupationHebdomadaire = tauxSemaine(chambres, reservations, aujourdhui)
    const kpis = [
      {
        id: 'occupees',
        libelle: 'Chambres occupées',
        valeur: String(compteurs.occupee ?? 0),
        suffixe: `/${chambres.length}`,
        teinte: 'principal'
      },
      {
        id: 'revenu',
        libelle: 'Encaissé du jour',
        valeur: nombre(revenu),
        suffixe: DEVISE,
        teinte: 'succes'
      },
      {
        id: 'taux',
        libelle: "Taux d'occupation",
        valeur: `${occupationHebdomadaire}%`,
        suffixe: '/semaine',
        teinte: 'lavande',
        progression: occupationHebdomadaire
      },
      {
        id: 'departs',
        libelle: 'Départs prévus aujourd’hui',
        valeur: String(departs),
        suffixe: 'à traiter',
        teinte: 'avertissement'
      }
    ]

    const recentes = [...reservations]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 5)
      .map((r) => {
        const client = clientsParId[r.clientId]
        return {
          id: r.id,
          nom: nomClient(client),
          initiales: initiales(client),
          chambre: chambresParId[r.chambreId]?.numero ?? '?',
          // Un passage affiche ses heures ; une nuitée affiche ses jours
          periode: r.typeSejour === 'heure'
            ? `${formatCourt(jourDe(r.dateDebut))} ${heureDe(r.dateDebut)}–${heureDe(r.dateFin)}`
            : `${formatCourt(jourDe(r.dateDebut))} – ${formatCourt(jourDe(r.dateFin))}`,
          affiche: statutAffiche(r, aujourdhui)
        }
      })

    return { kpis, triees, etages, compteurs, recentes, total: chambres.length }
  }, [donnees])

  if (!calculs) {
    return (
      <>
        {erreur ? (
          <div className="accueil__chargement">
            <Button variante="secondaire" onClick={charger}>
              Réessayer
            </Button>
          </div>
        ) : (
          <p className="accueil__chargement">Chargement…</p>
        )}

        <FailToast ouvert={Boolean(erreur)} message={erreur} onFermer={() => setErreur('')} />
      </>
    )
  }

  const { kpis, triees, etages, compteurs, recentes, total } = calculs
  const etage = etages.includes(etageChoisi) ? etageChoisi : etages[0]
  const visibles = triees.filter(
    (c) => c.etage === etage && (!filtreStatut || c.statut === filtreStatut)
  )

  return (
    <div className="accueil">
      <div className="accueil__actions">
        {ACTIONS.map(({ libelle, Icone, vers, etat, principale, aide }) => (
          <Button key={libelle} variante={principale ? 'principal' : 'secondaire'} icone={Icone} title={aide} onClick={() => navigate(vers, etat ? { state: etat } : undefined)}>{libelle}</Button>
        ))}
        {MODE_DEMO && (
          <Button variante="secondaire" icone={Inbox} className="demandes-demo__bouton" onClick={() => { setDemandesOuvert(true); setMessageDemande('') }}>
            Demandes <span className="demandes-demo__compteur">{demandesEnAttente.length}</span>
          </Button>
        )}
      </div>

      <section className="accueil__kpis" aria-label="Indicateurs du jour">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </section>

      <div className="accueil__colonnes">
        <section className="accueil__carte">
          <div className="accueil__carte-entete">
            <h2 className="accueil__carte-titre">État des chambres</h2>
            <Button variante="lien" taille="s" onClick={() => navigate('/rooms')}>
              Voir tout
            </Button>
          </div>

          <div className="accueil__filtres">
            {Object.keys(STATUTS_CHAMBRE).map((statut) => (
              <FilterPillule
                key={statut}
                statut={statut}
                compteur={compteurs[statut] ?? 0}
                actif={filtreStatut === statut}
                onClick={() => setFiltreStatut(filtreStatut === statut ? null : statut)}
              />
            ))}
          </div>

          {etages.length > 0 && (
            <div className="accueil__filtres">
              {etages.map((e) => (
                <FilterPillule
                  key={e}
                  libelle={libelleEtage(e)}
                  actif={e === etage}
                  onClick={() => setEtageChoisi(e)}
                />
              ))}
            </div>
          )}

          {visibles.length > 0 ? (
            <div className="accueil__grille">
              {visibles.map((c) => (
                <CardRoom key={c.id} numero={c.numero} statut={c.statut} />
              ))}
            </div>
          ) : total === 0 ? (
            <Vide
              titre="Aucune chambre enregistrée."
              texte="Ajoutez une catégorie puis votre première chambre dans l'onglet Chambres."
            />
          ) : (
            <Vide
              titre="Aucune chambre trouvée."
              texte="Essayez un autre numéro ou un autre statut."
            />
          )}
        </section>

        <section className="accueil__carte">
          <div className="accueil__carte-entete">
            <h2 className="accueil__carte-titre">Dernières réservations</h2>
            <Button variante="lien" taille="s" onClick={() => navigate('/booking')}>
              Voir tout
            </Button>
          </div>

          {recentes.length > 0 ? (
            <ul className="accueil__liste">
              {recentes.map((r) => (
                <li className="resa" key={r.id}>
                  <span className="resa__avatar" aria-hidden="true">
                    {r.initiales}
                  </span>
                  <div className="resa__infos">
                    <p className="resa__nom">{r.nom}</p>
                    <p className="resa__detail">
                      Chambre {r.chambre} · {r.periode}
                    </p>
                  </div>
                  <span className={`resa__badge resa__badge--${r.affiche}`}>
                    {BADGES[r.affiche]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Vide
              titre="Aucune réservation trouvée."
              texte="Créez une réservation pour la voir apparaître ici."
            />
          )}
        </section>
      </div>

      {MODE_DEMO && demandesOuvert && (
        <div className="demandes-demo__voile" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDemandesOuvert(false) }}>
          <section className="demandes-demo__panneau" role="dialog" aria-modal="true" aria-labelledby="demandes-demo-titre">
            <header className="demandes-demo__entete"><div><h2 id="demandes-demo-titre" className="demandes-demo__titre">Demandes de réservation</h2><p className="demandes-demo__intro">Demandes du site, Booking.com et de l’application Hypnos.</p></div><Button variante="fantome" icone={X} aria-label="Fermer les demandes" onClick={() => setDemandesOuvert(false)} /></header>
            <div className="demandes-demo__alerte"><strong>Mode démonstration (développement) :</strong> ces demandes sont fictives, mais leur conversion écrit de vraies lignes dans la base locale. Aucun flux réel de site, Booking.com ou Hypnos n’est connecté.</div>
            {messageDemande && <div className="demandes-demo__alerte" role="status">{messageDemande}</div>}
            <div className="demandes-demo__filtres" role="group" aria-label="Filtrer les demandes par source">
              {['Toutes', 'Site web', 'Booking.com', 'Application Hypnos'].map((source) => (
                <button key={source} type="button" className="demandes-demo__filtre" aria-pressed={sourceDemande === source} onClick={() => setSourceDemande(source)}>{source}{source === 'Toutes' ? ` (${demandesDemo.length})` : ` (${demandesDemo.filter((d) => d.source === source).length})`}</button>
              ))}
            </div>
            <div className="demandes-demo__liste">
              {demandesVisibles.map((d) => {
                const chambresLibres = (donnees?.chambres ?? []).filter((c) => chambreReservable(c, d.arrivee) && !enConflit(donnees.reservations, { chambreId: c.id, debut: d.arrivee, fin: d.depart }))
                return <article className={`demandes-demo__carte${d.convertie ? ' demandes-demo__carte--convertie' : ''}`} key={d.id}>
                  <div className="demandes-demo__ligne"><div><p className="demandes-demo__client">{d.prenom} {d.nom}</p><p className="demandes-demo__detail" style={{ margin: '4px 0 0' }}>{d.tel} · {d.adultes + d.enfants} personne(s)</p></div><span className="demandes-demo__source"><Inbox size={13} />{d.source}</span></div>
                  <div className="demandes-demo__detail"><span><Clock3 size={13} style={{ verticalAlign: '-2px' }} /> Arrivée : {dateDemande(d.arrivee)}</span><span>Départ : {dateDemande(d.depart)} · {d.type === 'heure' ? 'Passage' : 'Nuitée'}</span></div>
                  {d.convertie ? <span className="demandes-demo__statut"><Check size={14} /> Convertie en réservation locale</span> : <div className="demandes-demo__choix"><label>Chambre à attribuer<select value={chambreChoisie[d.id] ?? ''} onChange={(e) => setChambreChoisie((s) => ({ ...s, [d.id]: e.target.value }))}><option value="">Choisir une chambre…</option>{chambresLibres.map((c) => <option key={c.id} value={c.id}>Chambre {c.numero}</option>)}</select></label><Button variante="principal" disabled={!chambreChoisie[d.id] || conversionEnCours === d.id} chargement={conversionEnCours === d.id} onClick={() => convertirDemande(d)}>Convertir</Button></div>}
                </article>
              })}
            </div>
          </section>
        </div>
      )}

      <FailToast ouvert={Boolean(erreur)} message={erreur} onFermer={() => setErreur('')} />
    </div>
  )
}