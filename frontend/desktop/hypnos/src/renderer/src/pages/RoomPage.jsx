import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import Button from '../components/base/Button'
import CardRoom, { STATUTS_CHAMBRE } from '../components/base/CardRoom'
import FailToast from '../components/base/FailToast'
import FilterPillule from '../components/base/FilterPillule'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'

// Les alertes (nettoyage, hôtel complet) vivent dans les notifications de la barre supérieure ;
// la liste des catégories et leurs tarifs s'ouvre dans une fenêtre : la page montre d'abord les chambres.
const STYLES = `
.chambres__outils { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin-bottom:12px; }
.chambres__recherche { flex:1 1 240px; max-width:360px; }
.chambres__filtres { display:flex; flex-wrap:wrap; gap:8px; }
.chambres__filtres--categories { margin-bottom:16px; }
.chambres__bandeau { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 14px; margin-bottom:16px; padding:10px 14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); font-size:13px; }
.chambres__etage { margin-bottom:22px; }
.chambres__etage-titre { display:flex; align-items:baseline; gap:8px; margin-bottom:10px; font-size:14px; font-weight:600; color:var(--color-text); }
.chambres__etage-titre small { color:var(--color-text-muted); font-size:12px; font-weight:500; }
.chambres__grille { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:12px; }
.chambres__vide { padding:40px 0; text-align:center; font-size:14px; color:var(--color-text-muted); }
.chambres__occupant { margin:0 0 12px; padding:12px; border-radius:var(--radius-s); background:var(--color-background-soft); font-size:13px; }
.chambres__occupant p { margin:4px 0 0; }
.chambres__prete { margin-bottom:12px; }
.chambres__statuts { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

/* ---------- Fenêtre des catégories : une ligne compacte par catégorie ---------- */
.chambres__cat-liste { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
.chambres__cat { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px 14px; padding:12px 14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.chambres__cat-infos strong { display:block; font-size:14px; }
.chambres__cat-infos span { color:var(--color-text-muted); font-size:12px; }
.chambres__cat-tarifs { display:flex; flex-wrap:wrap; gap:4px 16px; grid-column:1 / -1; color:var(--color-text-muted); font-size:12px; }
.chambres__cat-tarifs b { color:var(--color-text); font-weight:700; white-space:nowrap; }
.chambres__cat-actions { display:flex; gap:6px; }
.chambres__cat-vide { margin:0 0 4px; color:var(--color-text-muted); font-size:13px; }
.chambres__avertissement { margin:0; padding:8px 10px; border-radius:var(--radius-s); background:color-mix(in srgb,var(--color-warning) 14%,var(--color-surface)); color:var(--color-text); font-size:11px; line-height:1.4; }
.chambres__pied { display:flex; flex-wrap:wrap; gap:8px; width:100%; }

/* ---------- Formulaires ---------- */
.chambres__form-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; width:100%; min-width:0; }
.chambres__form-grid > *, .chambres__form-grid * { min-width:0; box-sizing:border-box; }
.chambres__form-grid input:not([type="checkbox"]):not([type="radio"]), .chambres__form-grid select { width:100%; max-width:100%; min-width:0; box-sizing:border-box; }
.chambres__plein { grid-column:1 / -1; }
.chambres__aide { position:relative; width:100%; min-width:0; }
.chambres__aide-icone { position:absolute; z-index:2; top:2px; right:2px; display:grid; place-items:center; width:16px; height:16px; border:1px solid var(--color-border); border-radius:50%; background:var(--color-surface); color:var(--color-text-muted); font-size:10px; font-weight:700; pointer-events:none; }
.chambres__aide label { padding-right:22px; cursor:help; }
.chambres__aide::after { content:attr(data-aide); position:absolute; z-index:30; left:0; bottom:calc(100% + 6px); width:max-content; max-width:min(270px,calc(100vw - 40px)); padding:8px 10px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-text); color:var(--color-surface); box-shadow:0 8px 24px rgba(0,0,0,.18); font-size:12px; line-height:1.4; opacity:0; transform:translateY(3px); pointer-events:none; transition:opacity .12s ease .4s,transform .12s ease .4s; }
.chambres__aide:hover::after, .chambres__aide:focus-within::after { opacity:1; transform:translateY(0); }

@media (max-width:640px) {
  .chambres__recherche { max-width:none; }
  .chambres__grille { grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:10px; }
  .chambres__form-grid { grid-template-columns:minmax(0,1fr); }
  .chambres__plein { grid-column:1; }
  .chambres__statuts { grid-template-columns:1fr; }
}
`

injecterStyles('hypnos-page-chambres', STYLES)

function AideSurvol({ texte, className = '', children }) {
  return <div className={`chambres__aide ${className}`.trim()} data-aide={texte}><span className="chambres__aide-icone" aria-hidden="true">i</span>{children}</div>
}

const CATEGORIE_VIDE = { label: '', prix: '', prixHoraire: '', reglePassage: 'prorata', capacite: '' }
const chambreVide = (types) => ({
  numero: '',
  etage: '0',
  typeId: types.length === 1 ? String(types[0].id) : '',
  climatisation: false,
  television: false
})

function borneReservation(valeur, heure) {
  const texte = String(valeur ?? '')
  return texte.length === 10 ? `${texte}T${heure}` : texte.slice(0, 16)
}
const versLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const formatXaf = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`
const normaliser = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function libelleEtage(etage) {
  if (etage === 0) return 'RDC'
  return etage === 1 ? '1er étage' : `${etage}e étage`
}

export default function RoomPage() {
  const location = useLocation()
  const [chambres, setChambres] = useState([])
  const [types, setTypes] = useState([])
  const [reservations, setReservations] = useState([])
  const [clients, setClients] = useState([])
  // Les notifications de la barre supérieure ouvrent cette page déjà filtrée (ex. « nettoyage »)
  const [filtre, setFiltre] = useState(location.state?.filtre ?? 'tous')
  const [filtreCategorie, setFiltreCategorie] = useState(null)
  const [recherche, setRecherche] = useState('')

  const [modale, setModale] = useState(null) // 'chambre' | 'modifier-chambre' | 'categories' | 'categorie' | 'statut' | 'supprimer-chambre'
  const [selection, setSelection] = useState(null)
  const [categorieSelectionnee, setCategorieSelectionnee] = useState(null)
  const [chambreEnEdition, setChambreEnEdition] = useState(null)
  const [formChambre, setFormChambre] = useState(chambreVide([]))
  const [formCategorie, setFormCategorie] = useState(CATEGORIE_VIDE)

  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  useEffect(() => {
    if (location.state?.filtre) setFiltre(location.state.filtre)
  }, [location.state])

  const charger = useCallback(async () => {
    try {
      const [c, t, r, cl] = await Promise.all([
        window.electronAPI.getAll('chambre'),
        window.electronAPI.getAll('typedechambre'),
        window.electronAPI.getAll('reservation'),
        window.electronAPI.getAll('clients')
      ])
      setChambres(c)
      setTypes(t)
      setReservations(r)
      setClients(cl)
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  // Exécute une action, recharge la liste, ferme (ou change de) fenêtre et affiche le résultat
  async function executer(action, messageSucces, retour = null) {
    setChargement(true)
    try {
      await action()
      window.dispatchEvent(new Event('hypnos:donnees-mises-a-jour'))
      await charger()
      setModale(retour)
      setSucces(messageSucces)
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  const enregistrerChambre = () => {
    const numero = formChambre.numero.trim()
    const etage = Number(formChambre.etage)
    if (!numero) return setEchec('Indiquez le numéro de la chambre.')
    if (!Number.isInteger(etage) || etage < 0) return setEchec("L'étage doit être un nombre entier (0 pour le rez-de-chaussée).")
    if (!formChambre.typeId) return setEchec('Choisissez une catégorie pour rattacher cette chambre.')
    if (chambres.some((c) => c.id !== chambreEnEdition?.id && String(c.numero).trim().toLowerCase() === numero.toLowerCase())) {
      return setEchec(`Une chambre ${numero} existe déjà.`)
    }
    const donnees = {
      numero,
      etage,
      typeId: Number(formChambre.typeId),
      climatisation: Boolean(formChambre.climatisation),
      television: Boolean(formChambre.television)
    }
    const action = chambreEnEdition
      ? () => window.electronAPI.update('chambre', chambreEnEdition.id, donnees)
      : () => window.electronAPI.create('chambre', donnees)
    return executer(action, chambreEnEdition
      ? `Chambre ${donnees.numero} et sa catégorie ont été modifiées.`
      : `Chambre ${donnees.numero} ajoutée à la catégorie choisie.`)
  }

  const enregistrerCategorie = () => {
    const donneesCategorie = {
      label: formCategorie.label.trim(),
      prix: Number(formCategorie.prix),
      prixHoraire: Number(formCategorie.prixHoraire || 0),
      reglePassage: formCategorie.reglePassage,
      capacite: Number(formCategorie.capacite)
    }
    if (!donneesCategorie.label) return setEchec('Donnez un nom à la catégorie.')
    if (!Number.isInteger(donneesCategorie.prix) || donneesCategorie.prix < 0) return setEchec('Le prix par nuit doit être un montant entier positif.')
    if (!Number.isInteger(donneesCategorie.prixHoraire) || donneesCategorie.prixHoraire < 0) return setEchec('Le tarif horaire doit être un montant entier positif.')
    if (!Number.isInteger(donneesCategorie.capacite) || donneesCategorie.capacite < 1) return setEchec('La capacité doit être d’au moins 1 personne.')
    const action = categorieSelectionnee
      ? () => window.electronAPI.update('typedechambre', categorieSelectionnee.id, donneesCategorie)
      : () => window.electronAPI.create('typedechambre', donneesCategorie)
    const message = categorieSelectionnee
      ? `Catégorie « ${donneesCategorie.label} » modifiée.`
      : `Catégorie « ${donneesCategorie.label} » ajoutée.`
    return executer(action, message, 'categories')
  }

  const changerStatut = (statut) =>
    executer(
      () => window.electronAPI.update('chambre', selection.id, { statut }),
      `Chambre ${selection.numero} : ${STATUTS_CHAMBRE[statut].libelle}.`
    )

  const marquerToutesPretes = () =>
    executer(
      () => Promise.all(nettoyage.map((c) => window.electronAPI.update('chambre', c.id, { statut: 'disponible' }))),
      `${nettoyage.length} chambre(s) prête(s) : disponible(s).`
    )

  function ouvrirChambre() {
    if (types.length === 0) {
      setEchec("Créez d'abord une catégorie de chambre.")
      setModale('categories')
      return
    }
    setChambreEnEdition(null)
    setFormChambre({ ...chambreVide(types), typeId: filtreCategorie ? String(filtreCategorie) : chambreVide(types).typeId })
    setModale('chambre')
  }

  function ouvrirCategorie() {
    setCategorieSelectionnee(null)
    setFormCategorie(CATEGORIE_VIDE)
    setModale('categorie')
  }

  function ouvrirChambrePourCategorie(categorie) {
    setChambreEnEdition(null)
    setFormChambre({ ...chambreVide(types), typeId: String(categorie.id) })
    setModale('chambre')
  }

  function modifierChambre(chambre) {
    setChambreEnEdition(chambre)
    setFormChambre({
      numero: chambre.numero ?? '',
      etage: String(chambre.etage ?? 0),
      typeId: String(chambre.typeId ?? ''),
      climatisation: Boolean(chambre.climatisation),
      television: Boolean(chambre.television)
    })
    setModale('modifier-chambre')
  }

  function modifierCategorie(categorie) {
    setCategorieSelectionnee(categorie)
    setFormCategorie({
      label: categorie.label ?? '',
      prix: String(categorie.prix ?? ''),
      prixHoraire: String(categorie.prixHoraire ?? 0),
      reglePassage: categorie.reglePassage ?? 'prorata',
      capacite: String(categorie.capacite ?? '')
    })
    setModale('categorie')
  }

  // ---------- Données affichées ----------
  const typesParId = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types])

  const visibles = useMemo(() => {
    const mot = normaliser(recherche.trim())
    return chambres
      .filter((c) => filtre === 'tous' || c.statut === filtre)
      .filter((c) => !filtreCategorie || Number(c.typeId) === Number(filtreCategorie))
      .filter((c) => !mot || normaliser(`${c.numero} ${typesParId[c.typeId]?.label ?? ''}`).includes(mot))
      .sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
  }, [chambres, filtre, filtreCategorie, recherche, typesParId])
  const etages = [...new Set(visibles.map((c) => c.etage))].sort((a, b) => a - b)
  const compter = (statut) => chambres.filter((c) => c.statut === statut).length
  const maintenantIso = versLocal(new Date())
  const actives = reservations.filter((r) => ['confirmee', 'en_sejour'].includes(r.statut))
  const enCoursDans = (chambreId) =>
    actives.find((r) => r.chambreId === chambreId && borneReservation(r.dateDebut, '15:00') <= maintenantIso && borneReservation(r.dateFin, '11:00') > maintenantIso)
  const nettoyage = chambres.filter((c) => c.statut === 'nettoyage')
  const clientOccupant = selection && (() => {
    const r = enCoursDans(selection.id)
    return r ? { reservation: r, client: clients.find((x) => x.id === r.clientId) } : null
  })()
  const fermer = () => setModale(null)
  const passagePlusCherQueNuit = Number(formCategorie.prixHoraire) > Number(formCategorie.prix) && Number(formCategorie.prix) > 0

  return (
    <section>
      <Header titre="Chambres">
        <Button variante="secondaire" icone={Layers} onClick={() => setModale('categories')}>
          Catégories
        </Button>
        <Button icone={Plus} onClick={ouvrirChambre}>
          Ajouter une chambre
        </Button>
      </Header>

      <div className="chambres__outils">
        <div className="chambres__recherche">
          <InputSearch value={recherche} onChange={setRecherche} placeholder="Rechercher une chambre…" />
        </div>
        <div className="chambres__filtres" aria-label="Filtrer par statut">
          <FilterPillule
            libelle="Toutes"
            compteur={chambres.length}
            actif={filtre === 'tous'}
            onClick={() => setFiltre('tous')}
          />
          {Object.keys(STATUTS_CHAMBRE).map((statut) => (
            <FilterPillule
              key={statut}
              statut={statut}
              compteur={compter(statut)}
              actif={filtre === statut}
              onClick={() => setFiltre(filtre === statut ? 'tous' : statut)}
            />
          ))}
        </div>
      </div>

      {types.length > 1 && (
        <div className="chambres__filtres chambres__filtres--categories" aria-label="Filtrer par catégorie">
          {types.map((t) => (
            <FilterPillule
              key={t.id}
              libelle={t.label}
              compteur={chambres.filter((c) => Number(c.typeId) === Number(t.id)).length}
              actif={Number(filtreCategorie) === Number(t.id)}
              onClick={() => setFiltreCategorie(Number(filtreCategorie) === Number(t.id) ? null : t.id)}
            />
          ))}
        </div>
      )}

      {filtre === 'nettoyage' && nettoyage.length > 0 && (
        <div className="chambres__bandeau" role="status">
          <span>{nettoyage.length} chambre(s) en nettoyage : marquez-les prêtes une fois le ménage terminé.</span>
          <Button taille="s" icone={Check} disabled={chargement} onClick={marquerToutesPretes}>
            Tout marquer prêt
          </Button>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="chambres__vide">
          {chambres.length === 0
            ? 'Aucune chambre pour le moment. Ajoutez une catégorie, puis votre première chambre.'
            : 'Aucune chambre ne correspond à ces filtres.'}
        </p>
      ) : (
        etages.map((etage) => {
          const duEtage = visibles.filter((c) => c.etage === etage)
          return (
            <div className="chambres__etage" key={etage}>
              <h3 className="chambres__etage-titre">{libelleEtage(etage)} <small>{duEtage.length} chambre(s)</small></h3>
              <div className="chambres__grille">
                {duEtage.map((c) => (
                  <CardRoom
                    key={c.id}
                    numero={c.numero}
                    statut={c.statut}
                    detail={typesParId[c.typeId]?.label}
                    onClick={() => {
                      setSelection(c)
                      setModale('statut')
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* ---------- Catégories et tarifs ---------- */}
      <Modal
        ouvert={modale === 'categories'}
        onFermer={fermer}
        titre="Catégories de chambres"
        description="Tarifs en XAF par nuitée ou par heure de passage, et capacité maximale"
        taille="m"
        pied={
          <div className="chambres__pied">
            <Button icone={Plus} onClick={ouvrirCategorie}>Ajouter une catégorie</Button>
            <Button variante="fantome" onClick={fermer}>Fermer</Button>
          </div>
        }
      >
        {types.length > 0 ? (
          <ul className="chambres__cat-liste">
            {types.map((categorie) => (
              <li className="chambres__cat" key={categorie.id}>
                <div className="chambres__cat-infos">
                  <strong>{categorie.label}</strong>
                  <span>
                    {chambres.filter((c) => Number(c.typeId) === Number(categorie.id)).length} chambre(s) · {categorie.capacite} {Number(categorie.capacite) === 1 ? 'personne' : 'personnes'}
                  </span>
                </div>
                <div className="chambres__cat-actions">
                  <Button variante="fantome" taille="s" icone={Plus} aria-label={`Ajouter une chambre ${categorie.label}`} onClick={() => ouvrirChambrePourCategorie(categorie)}>Chambre</Button>
                  <Button variante="secondaire" taille="s" icone={Pencil} aria-label={`Modifier la catégorie ${categorie.label}`} onClick={() => modifierCategorie(categorie)}>Modifier</Button>
                </div>
                <div className="chambres__cat-tarifs">
                  <span>Nuitée <b>{formatXaf(categorie.prix)}</b></span>
                  <span>Passage <b>{Number(categorie.prixHoraire || 0).toLocaleString('fr-FR')} XAF/h</b> · {categorie.reglePassage === 'heure_commencee' ? 'heure commencée' : 'au prorata'}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="chambres__cat-vide">Aucune catégorie. Ajoutez-en une pour pouvoir créer des chambres.</p>
        )}
      </Modal>

      {/* ---------- Ajouter / modifier une catégorie ---------- */}
      <Modal
        ouvert={modale === 'categorie'}
        onFermer={() => setModale('categories')}
        titre={categorieSelectionnee ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
        libelleValider={categorieSelectionnee ? 'Enregistrer' : 'Ajouter'}
        onValider={enregistrerCategorie}
        chargement={chargement}
      >
        <div className="chambres__form-grid">
          <Input
            label="Nom de la catégorie"
            placeholder="Ex. Standard"
            requis
            value={formCategorie.label}
            onChange={(e) => setFormCategorie({ ...formCategorie, label: e.target.value })}
          />
          <AideSurvol texte="Prix appliqué à une nuitée. Le prix est enregistré sur la réservation au moment de la vente.">
            <Input
              label="Prix par nuit (XAF)"
              type="number"
              min={0}
              requis
              placeholder="15000"
              value={formCategorie.prix}
              onChange={(e) => setFormCategorie({ ...formCategorie, prix: e.target.value })}
            />
          </AideSurvol>
          <AideSurvol texte="Tarif de base par heure pour chaque séjour de passage de cette catégorie.">
            <Input
              label="Tarif horaire (XAF / heure)"
              type="number"
              min={0}
              requis
              value={formCategorie.prixHoraire}
              onChange={(e) => setFormCategorie({ ...formCategorie, prixHoraire: e.target.value })}
            />
          </AideSurvol>
          <AideSurvol texte="Cette règle s’applique à tous les séjours de passage des chambres de cette catégorie.">
            <Input
              label="Calcul du passage"
              value={formCategorie.reglePassage}
              onChange={(e) => setFormCategorie({ ...formCategorie, reglePassage: e.target.value })}
              options={[
                { valeur: 'prorata', libelle: 'Au prorata de la durée' },
                { valeur: 'heure_commencee', libelle: 'Toute heure commencée' }
              ]}
            />
          </AideSurvol>
          <Input
            label="Capacité (personnes)"
            type="number"
            min={1}
            requis
            placeholder="2"
            value={formCategorie.capacite}
            onChange={(e) => setFormCategorie({ ...formCategorie, capacite: e.target.value })}
          />
          {passagePlusCherQueNuit && (
            <p className="chambres__avertissement chambres__plein" role="note">
              Le tarif horaire dépasse le prix de la nuitée : un passage de quelques heures serait plus cher qu’une nuit. Dans les réservations, le passage est plafonné au prix de la nuitée.
            </p>
          )}
        </div>
      </Modal>

      {/* ---------- Ajouter / modifier une chambre ---------- */}
      <Modal
        ouvert={modale === 'chambre' || modale === 'modifier-chambre'}
        onFermer={fermer}
        titre={chambreEnEdition ? `Modifier la chambre ${chambreEnEdition.numero}` : 'Ajouter une chambre'}
        libelleValider={chambreEnEdition ? 'Enregistrer' : 'Ajouter'}
        onValider={enregistrerChambre}
        chargement={chargement}
      >
        <div className="chambres__form-grid">
          <Input
            label="Numéro"
            placeholder="Ex. 206"
            requis
            value={formChambre.numero}
            onChange={(e) => setFormChambre({ ...formChambre, numero: e.target.value })}
          />
          <AideSurvol texte="Saisissez 0 pour le rez-de-chaussée.">
            <Input
              label="Étage"
              type="number"
              min={0}
              requis
              value={formChambre.etage}
              onChange={(e) => setFormChambre({ ...formChambre, etage: e.target.value })}
            />
          </AideSurvol>
          <AideSurvol texte="Choisissez la catégorie : elle détermine le tarif nuitée, le tarif passage et la capacité." className="chambres__plein">
            <Input
              label="Catégorie"
              requis
              placeholder="Choisir une catégorie"
              value={formChambre.typeId}
              onChange={(e) => setFormChambre({ ...formChambre, typeId: e.target.value })}
              options={types.map((t) => ({
                valeur: String(t.id),
                libelle: `${t.label} · ${Number(t.prix || 0).toLocaleString('fr-FR')} XAF/nuit · ${Number(t.prixHoraire || 0).toLocaleString('fr-FR')} XAF/h`
              }))}
            />
          </AideSurvol>
          <fieldset className="chambres__statuts chambres__plein" style={{ border: 0, padding: 0 }}>
            <label><input type="checkbox" checked={formChambre.climatisation} onChange={(e) => setFormChambre({ ...formChambre, climatisation: e.target.checked })} /> Climatisation</label>
            <label><input type="checkbox" checked={formChambre.television} onChange={(e) => setFormChambre({ ...formChambre, television: e.target.checked })} /> Télévision</label>
          </fieldset>
        </div>
      </Modal>

      {/* ---------- Changer le statut ---------- */}
      <Modal
        ouvert={modale === 'statut'}
        onFermer={fermer}
        titre={`Chambre ${selection?.numero ?? ''}`}
        description={`${typesParId[selection?.typeId]?.label ?? ''} · statut actuel : ${STATUTS_CHAMBRE[selection?.statut]?.libelle ?? '—'}`}
        pied={
          <div className="chambres__pied">
            <Button variante="secondaire" icone={Pencil} onClick={() => selection && modifierChambre(selection)}>Modifier chambre / catégorie</Button>
            <Button
              variante="danger-doux"
              icone={Trash2}
              disabled={chargement || reservations.some((r) => Number(r.chambreId) === Number(selection?.id))}
              onClick={() => setModale('supprimer-chambre')}
            >Supprimer</Button>
            <Button variante="fantome" onClick={fermer}>Fermer</Button>
          </div>
        }
      >
        {reservations.some((r) => Number(r.chambreId) === Number(selection?.id)) && (
          <p className="chambres__avertissement" role="note">Cette chambre apparaît dans l’historique de réservations; elle ne peut pas être supprimée afin de préserver les séjours et les encaissements associés.</p>
        )}
        {clientOccupant ? (
          <div className="chambres__occupant">
            <strong>{clientOccupant.client ? `${clientOccupant.client.prenom} ${clientOccupant.client.nom}` : 'Client'}</strong>
            <p>{clientOccupant.client?.tel || 'Téléphone non renseigné'}</p>
            <p>Séjour : {String(clientOccupant.reservation.dateDebut).replace('T', ' ')} → {String(clientOccupant.reservation.dateFin).replace('T', ' ')}</p>
            <p>Libre après le {new Date(borneReservation(clientOccupant.reservation.dateFin, '11:00')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} (nettoyage à confirmer)</p>
          </div>
        ) : <p className="chambres__occupant">Aucun séjour en cours dans cette chambre.</p>}
        {selection?.statut === 'nettoyage' && (
          <div className="chambres__prete">
            <Button pleineLargeur icone={Check} disabled={chargement} onClick={() => changerStatut('disponible')}>
              Nettoyage terminé : marquer disponible
            </Button>
          </div>
        )}
        <div className="chambres__statuts">
          {Object.entries(STATUTS_CHAMBRE).map(([statut, infos]) => (
            <Button
              key={statut}
              variante={selection?.statut === statut ? 'principal' : 'secondaire'}
              icone={infos.icone}
              disabled={chargement}
              onClick={() => changerStatut(statut)}
            >
              {infos.libelle}
            </Button>
          ))}
        </div>
      </Modal>

      <Modal
        ouvert={modale === 'supprimer-chambre'}
        onFermer={fermer}
        titre={`Supprimer la chambre ${selection?.numero ?? ''} ?`}
        description="Cette action est définitive. Les chambres liées à une réservation ou à une demande ne peuvent pas être supprimées."
        libelleValider="Supprimer définitivement"
        onValider={() => selection && executer(
          () => window.electronAPI.remove('chambre', selection.id),
          `Chambre ${selection.numero} supprimée.`
        )}
        chargement={chargement}
      >
        <p>La chambre {selection?.numero ?? ''} sera retirée de l’inventaire de l’hôtel. Si elle est encore référencée par une demande, Hypnos refusera la suppression sans effacer les données liées.</p>
      </Modal>

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}
