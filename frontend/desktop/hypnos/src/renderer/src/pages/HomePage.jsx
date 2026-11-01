import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, FileText, LogIn, LogOut, Plus, UserPlus, Up } from 'lucide-react'
import Button from '../components/base/Button'
import CardRoom, { STATUTS_CHAMBRE } from '../components/base/CardRoom'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import injecterStyles from '../components/base/injecterStyles'
import KpiCard from '../components/KpiCard'

const DEVISE = 'XAF'

// Raccourcis : pour l'instant ils ouvrent la page concernée.
// La route /planning sera ajoutée avec la page du planning.
const ACTIONS = [
  { libelle: 'Nouvelle réservation', Icone: Plus, vers: '/booking', principale: true },
  { libelle: 'Arrivée', Icone: LogIn, vers: '/booking', aide: "Enregistrer l'arrivée d'un client" },
  { libelle: 'Départ', Icone: LogOut, vers: '/booking', aide: "Enregistrer le départ d'un client" },
  { libelle: 'Ajouter un client', Icone: UserPlus, vers: '/clients' },
  { libelle: 'Importer Excel', Icone: FileText, vers: '/param' },
  { libelle: 'Up', Icone: up, vers: '/param' },
  {
    libelle: 'Voir le planning',
    Icone: Calendar,
    vers: '/planning',
    aide: 'Le planning se met en plein écran avec F11'
  }
]

// Statuts qui font occuper une chambre dans le calcul du taux d'occupation
const STATUTS_OCCUPANTS = ['confirmee', 'en_sejour', 'terminee']

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

// Les dates sont stockées en texte ISO. On les lit en heure locale, à minuit,
// pour qu'un « 2026-10-29 » reste le 29 quel que soit le fuseau.
const jourDe = (texte) => {
  const [a, m, j] = String(texte).slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, j)
}
const cleJour = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const formatCourt = (date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const nombre = (n) => Math.round(n).toLocaleString('fr-FR')

function libelleEtage(etage) {
  if (etage === 0) return 'RDC'
  return etage === 1 ? '1er étage' : `${etage}e étage`
}

const nomClient = (c) => (c ? `${c.sexe === 'F' ? 'Mme' : 'M.'} ${c.nom}` : 'Client inconnu')
const initiales = (c) => (c ? `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase() : '?')

// La base ne connaît pas encore « en séjour » : on déduit le statut affiché
// à partir de la date du jour et du statut enregistré.
function statutAffiche(reservation, aujourdhui) {
  if (reservation.statut === 'annulee') return 'annulee'
  if (reservation.statut === 'terminee') return 'terminee'
  const debut = jourDe(reservation.dateDebut).getTime()
  const fin = jourDe(reservation.dateFin).getTime()
  const t = aujourdhui.getTime()
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

// ============================================================
//  PAGE
// ============================================================

export default function HomePage() {
  const navigate = useNavigate()
  const [donnees, setDonnees] = useState(null) // null tant que rien n'est chargé
  const [erreur, setErreur] = useState('')
  const [filtreStatut, setFiltreStatut] = useState(null)
  const [etageChoisi, setEtageChoisi] = useState(null)

  const charger = useCallback(async () => {
    try {
      const [chambres, reservations, clients, factures] = await Promise.all([
        window.electronAPI.getAll('chambre'),
        window.electronAPI.getAll('reservation'),
        window.electronAPI.getAll('clients'),
        window.electronAPI.getAll('facture')
      ])
      setErreur('')
      setDonnees({ chambres, reservations, clients, factures })
    } catch (e) {
      setErreur(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  // Tous les calculs, faits une seule fois par chargement des données
  const calculs = useMemo(() => {
    if (!donnees) return null
    const { chambres, reservations, clients, factures } = donnees
    const aujourdhui = jourDe(cleJour(new Date()))

    const clientsParId = Object.fromEntries(clients.map((c) => [c.id, c]))
    const chambresParId = Object.fromEntries(chambres.map((c) => [c.id, c]))

    const triees = [...chambres].sort((a, b) =>
      a.numero.localeCompare(b.numero, 'fr', { numeric: true })
    )
    const etages = [...new Set(chambres.map((c) => c.etage))].sort((a, b) => a - b)
    const compteurs = {}
    for (const c of chambres) compteurs[c.statut] = (compteurs[c.statut] ?? 0) + 1

    const revenu = factures
      .filter((f) => f.statut !== 'annulee' && cleJour(new Date(f.dateEmission)) === cleJour(aujourdhui))
      .reduce((somme, f) => somme + f.total, 0)

    const arrivees = reservations.filter(
      (r) => r.statut === 'confirmee' && jourDe(r.dateDebut).getTime() === aujourdhui.getTime()
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
        libelle: 'Revenu du jour',
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
        id: 'arrivees',
        libelle: 'Arrivées du jour',
        valeur: String(arrivees),
        suffixe: 'prévues',
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
          periode: `${formatCourt(jourDe(r.dateDebut))} – ${formatCourt(jourDe(r.dateFin))}`,
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
        {ACTIONS.map(({ libelle, Icone, vers, principale, aide }) => (
          <Button
            key={libelle}
            variante={principale ? 'principal' : 'secondaire'}
            icone={Icone}
            title={aide}
            onClick={() => navigate(vers)}
          >
            {libelle}
          </Button>
        ))}
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

      <FailToast ouvert={Boolean(erreur)} message={erreur} onFermer={() => setErreur('')} />
    </div>
  )
}