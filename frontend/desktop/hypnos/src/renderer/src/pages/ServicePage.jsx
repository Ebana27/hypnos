/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, Pencil, Plus, Utensils, Wine } from 'lucide-react'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import Button from '../components/base/Button'
import FailToast from '../components/base/FailToast'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'

const DEVISE = 'XAF'
// Doit rester identique aux catégories de la table `service` (schema.js)
const CATEGORIES = [
  { valeur: 'restaurant', libelle: 'Restaurant' },
  { valeur: 'bar', libelle: 'Bar' },
  { valeur: 'cave', libelle: 'Cave' },
  { valeur: 'autre', libelle: 'Autre service' }
]
const BAR_RESTAURANT = ['restaurant', 'bar', 'cave']

const STYLES = `
.service-page { display:flex; flex-direction:column; gap:18px; min-width:0; }
.service-tabs { display:flex; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--color-border); }
.service-tab { padding:10px 13px; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--color-text-muted); font:inherit; font-size:13px; cursor:pointer; }
.service-tab[aria-selected='true'] { border-bottom-color:var(--color-accent); color:var(--color-accent); font-weight:600; }
.service-toolbar { display:flex; align-items:center; gap:12px; }
.service-toolbar > :first-child { flex:1; }
.service-kpis { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.service-kpi { padding:14px 16px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.service-kpi span { display:block; color:var(--color-text-muted); font-size:11px; }
.service-kpi strong { display:block; margin-top:5px; font-family:var(--font-display); font-size:20px; font-weight:600; }
.service-list { display:grid; gap:10px; }
.service-item { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:16px; padding:14px 16px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.service-item--inactif { opacity:.6; }
.service-item__main { display:flex; align-items:center; gap:12px; min-width:0; }
.service-item__icon { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:11px; background:var(--color-accent-wash); color:var(--color-accent); }
.service-item__name { overflow:hidden; font-size:13px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.service-item__meta { margin-top:3px; color:var(--color-text-muted); font-size:11px; }
.service-item__price { text-align:right; font-size:13px; font-weight:600; white-space:nowrap; }
.service-item__actions { display:flex; gap:6px; }
.service-empty { display:grid; justify-items:center; gap:7px; padding:42px 20px; border:1px dashed var(--color-border); border-radius:var(--radius-m); color:var(--color-text-muted); text-align:center; }
.service-empty strong { color:var(--color-text); font-size:14px; }
.service-empty p { max-width:440px; margin:0; font-size:12px; line-height:1.5; }
.service-form { display:grid; gap:12px; }
.service-form__grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.service-small-note { margin:0; color:var(--color-text-faint); font-size:10px; line-height:1.4; }
@media (max-width:850px) { .service-kpis { grid-template-columns:1fr 1fr; } .service-item { grid-template-columns:minmax(0,1fr) auto; } .service-item__actions { grid-column:1 / -1; justify-content:flex-end; } }
@media (max-width:600px) { .service-toolbar { align-items:stretch; flex-direction:column; } .service-kpis { grid-template-columns:1fr; } .service-item { grid-template-columns:1fr; } .service-item__price { text-align:left; } .service-form__grid { grid-template-columns:1fr; } }
`
injecterStyles('hypnos-service-page', STYLES)

const formatXaf = (valeur) => `${new Intl.NumberFormat('fr-FR').format(Number(valeur) || 0)} ${DEVISE}`
const optionsCategorie = CATEGORIES.map(({ valeur, libelle }) => ({ valeur, libelle }))
const formulaireVide = () => ({ nom: '', categorie: 'restaurant', prix: '' })

function categorieLibelle(valeur) {
  return CATEGORIES.find((categorie) => categorie.valeur === valeur)?.libelle ?? 'Service'
}

function libellePrix(prix) {
  if (prix == null) return 'Prix libre'
  return prix === 0 ? 'Gratuit' : formatXaf(prix)
}

export default function ServicePage() {
  const [services, setServices] = useState([])
  const [onglet, setOnglet] = useState('tous')
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous')
  const [modale, setModale] = useState(null) // null | { id: number | null }
  const [form, setForm] = useState(formulaireVide)
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  const charger = useCallback(async () => {
    try {
      const lignes = await window.electronAPI.getAll('service')
      setServices([...lignes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr')
    return services.filter((service) => {
      const correspondRecherche = !q || `${service.nom} ${categorieLibelle(service.categorie)}`.toLocaleLowerCase('fr').includes(q)
      const correspondOnglet = onglet === 'restaurant' ? BAR_RESTAURANT.includes(service.categorie) : true
      const correspondFiltre = filtre === 'tous' || service.categorie === filtre
      return correspondRecherche && correspondOnglet && correspondFiltre
    })
  }, [services, recherche, onglet, filtre])

  const actifs = services.filter((service) => service.actif).length
  const payants = services.filter((service) => service.prixUnitaire > 0).length

  function ouvrirCreation() {
    setForm(formulaireVide())
    setModale({ id: null })
  }

  function ouvrirEdition(service) {
    setForm({
      nom: service.nom,
      categorie: service.categorie,
      prix: service.prixUnitaire == null ? '' : String(service.prixUnitaire)
    })
    setModale({ id: service.id })
  }

  // Exécute une action, recharge la liste et affiche le résultat. Renvoie true si elle a réussi.
  async function executer(action, message) {
    setChargement(true)
    try {
      await action()
      await charger()
      if (message) setSucces(message)
      return true
    } catch (e) {
      setEchec(e.message)
      return false
    } finally {
      setChargement(false)
    }
  }

  async function enregistrerService() {
    const nom = form.nom.trim()
    if (!nom) return setEchec('Donnez un nom au service ou au produit.')
    // Prix vide = prix libre (saisi au moment de la vente) ; sinon un entier positif ou nul
    const prixSaisi = String(form.prix).trim()
    const prix = prixSaisi === '' ? null : Number(prixSaisi)
    if (prix !== null && (!Number.isInteger(prix) || prix < 0)) {
      return setEchec('Le prix doit être un montant entier positif ou nul, ou laissé vide.')
    }

    const donnees = { nom, categorie: form.categorie, prixUnitaire: prix }
    const ok = modale.id
      ? await executer(() => window.electronAPI.update('service', modale.id, donnees), 'Service modifié.')
      : await executer(() => window.electronAPI.create('service', { ...donnees, actif: true }), 'Service ajouté.')
    if (ok) setModale(null)
  }

  // Un service n'est jamais supprimé (il peut être lié à des consommations) : on le désactive.
  const basculerActif = (service) =>
    executer(
      () => window.electronAPI.update('service', service.id, { actif: !service.actif }),
      service.actif ? `${service.nom} désactivé.` : `${service.nom} réactivé.`
    )

  return (
    <section className="service-page">
      <Header titre="Services" description="Prestations, bar et restauration proposés aux clients">
        <Button icone={Plus} onClick={ouvrirCreation}>Ajouter un service</Button>
      </Header>

      <div className="service-kpis" aria-label="Résumé des services">
        <article className="service-kpi"><span>Services au catalogue</span><strong>{services.length}</strong></article>
        <article className="service-kpi"><span>Services actifs</span><strong>{actifs}</strong></article>
        <article className="service-kpi"><span>Prestations payantes</span><strong>{payants}</strong></article>
      </div>

      <nav className="service-tabs" role="tablist" aria-label="Sections des services">
        <button className="service-tab" role="tab" aria-selected={onglet === 'tous'} onClick={() => { setOnglet('tous'); setFiltre('tous') }}>Tous les services</button>
        <button className="service-tab" role="tab" aria-selected={onglet === 'restaurant'} onClick={() => { setOnglet('restaurant'); setFiltre('tous') }}>Bar & restaurant</button>
      </nav>

      <div className="service-toolbar">
        <InputSearch value={recherche} onChange={setRecherche} placeholder="Rechercher un service…" />
        <Input
          label="Catégorie"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          options={[{ valeur: 'tous', libelle: 'Toutes les catégories' }, ...optionsCategorie]}
        />
      </div>

      {visibles.length ? (
        <div className="service-list">
          {visibles.map((service) => (
            <article className={`service-item${service.actif ? '' : ' service-item--inactif'}`} key={service.id}>
              <div className="service-item__main">
                <span className="service-item__icon" aria-hidden="true">
                  {service.categorie === 'bar' || service.categorie === 'cave' ? <Wine size={18} /> : service.categorie === 'restaurant' ? <Utensils size={18} /> : <Package size={18} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="service-item__name">{service.nom}</div>
                  <div className="service-item__meta">{categorieLibelle(service.categorie)}{service.actif ? '' : ' · Désactivé'}</div>
                </div>
              </div>
              <div className="service-item__price">{libellePrix(service.prixUnitaire)}</div>
              <div className="service-item__actions">
                <Button variante="secondaire" taille="s" icone={Pencil} disabled={chargement} onClick={() => ouvrirEdition(service)}>Modifier</Button>
                <Button variante="secondaire" taille="s" disabled={chargement} onClick={() => basculerActif(service)}>
                  {service.actif ? 'Désactiver' : 'Réactiver'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="service-empty">
          <Package size={25} aria-hidden="true" />
          <strong>{recherche ? 'Aucun résultat' : onglet === 'restaurant' ? 'Aucun service de bar ou de restaurant' : 'Le catalogue est vide'}</strong>
          <p>{recherche ? 'Essayez un autre terme ou changez le filtre de catégorie.' : 'Ajoutez une prestation, un plat ou une boisson. Les services actifs peuvent ensuite être cochés dans la fiche de réservation.'}</p>
          {!recherche && <Button variante="secondaire" icone={Plus} onClick={ouvrirCreation}>Ajouter le premier service</Button>}
        </div>
      )}

      {modale && (
        <Modal
          ouvert
          onFermer={() => setModale(null)}
          titre={modale.id ? 'Modifier le service' : 'Ajouter un service'}
          description="Le bar, le restaurant et les autres prestations partagent le même catalogue."
          taille="m"
          libelleValider={modale.id ? 'Enregistrer' : 'Ajouter au catalogue'}
          onValider={enregistrerService}
          chargement={chargement}
        >
          <div className="service-form">
            <Input label="Nom" requis placeholder="Ex. Petit-déjeuner, eau minérale…" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            <div className="service-form__grid">
              <Input label="Catégorie" value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} options={optionsCategorie} />
              <Input label={`Prix (${DEVISE}, facultatif)`} type="number" min={0} value={form.prix} onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))} />
            </div>
            <p className="service-small-note">Laissez le prix vide si le montant change à chaque vente. Le suivi de stock n’est pas inclus dans cette version.</p>
          </div>
        </Modal>
      )}

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}