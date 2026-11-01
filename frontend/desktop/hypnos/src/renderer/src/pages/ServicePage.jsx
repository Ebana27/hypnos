/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { Minus, Package, Plus, Utensils, Wine } from 'lucide-react'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import Button from '../components/base/Button'
import injecterStyles from '../components/base/injecterStyles'

const DEVISE = 'XAF'
const CATEGORIES = [
  { valeur: 'restaurant', libelle: 'Restaurant' },
  { valeur: 'bar', libelle: 'Bar / cave' },
  { valeur: 'bien-etre', libelle: 'Bien-être' },
  { valeur: 'loisirs', libelle: 'Loisirs' },
  { valeur: 'transport', libelle: 'Transport' },
  { valeur: 'autre', libelle: 'Autre service' }
]

const STYLES = `
.service-page { display:flex; flex-direction:column; gap:18px; min-width:0; }
.service-banner { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); color:var(--color-text-muted); font-size:12px; line-height:1.5; }
.service-banner strong { color:var(--color-text); }
.service-banner p { margin:0; }
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
.service-item__main { display:flex; align-items:center; gap:12px; min-width:0; }
.service-item__icon { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:11px; background:var(--color-accent-wash); color:var(--color-accent); }
.service-item__name { overflow:hidden; font-size:13px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.service-item__meta { margin-top:3px; color:var(--color-text-muted); font-size:11px; }
.service-item__price { text-align:right; font-size:13px; font-weight:600; white-space:nowrap; }
.service-stock { display:flex; align-items:center; gap:7px; color:var(--color-text-muted); font-size:11px; white-space:nowrap; }
.service-stock strong { color:var(--color-text); }
.service-stock--low strong { color:var(--color-danger); }
.service-stock__actions { display:flex; gap:4px; }
.service-empty { display:grid; justify-items:center; gap:7px; padding:42px 20px; border:1px dashed var(--color-border); border-radius:var(--radius-m); color:var(--color-text-muted); text-align:center; }
.service-empty strong { color:var(--color-text); font-size:14px; }
.service-empty p { max-width:440px; margin:0; font-size:12px; line-height:1.5; }
.service-form { display:grid; gap:12px; }
.service-form__grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.service-form__stock { display:grid; gap:10px; padding:12px; border:1px solid var(--color-border); border-radius:var(--radius-s); background:var(--color-background-soft); }
.service-check { display:flex; align-items:flex-start; gap:8px; color:var(--color-text); font-size:12px; line-height:1.4; }
.service-check input { margin-top:2px; accent-color:var(--color-accent); }
.service-small-note { margin:0; color:var(--color-text-faint); font-size:10px; line-height:1.4; }
@media (max-width:850px) { .service-kpis { grid-template-columns:1fr 1fr; } .service-item { grid-template-columns:minmax(0,1fr) auto; } .service-stock { grid-column:1 / -1; justify-content:flex-end; } }
@media (max-width:600px) { .service-toolbar { align-items:stretch; flex-direction:column; } .service-kpis { grid-template-columns:1fr; } .service-item { grid-template-columns:1fr; } .service-item__price { text-align:left; } .service-stock { justify-content:space-between; } .service-form__grid { grid-template-columns:1fr; } }
`
injecterStyles('hypnos-service-page', STYLES)

const formatXaf = (valeur) => `${new Intl.NumberFormat('fr-FR').format(Number(valeur) || 0)} ${DEVISE}`
const optionsCategorie = CATEGORIES.map(({ valeur, libelle }) => ({ valeur, libelle }))
const formulaireVide = () => ({ nom: '', categorie: 'restaurant', prix: '', description: '', suitStock: false, stock: '0', seuil: '3' })

function categorieLibelle(valeur) {
  return CATEGORIES.find((categorie) => categorie.valeur === valeur)?.libelle ?? 'Service'
}

export default function ServicePage() {
  const [services, setServices] = useState([])
  const [onglet, setOnglet] = useState('services')
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous')
  const [modaleOuverte, setModaleOuverte] = useState(false)
  const [form, setForm] = useState(formulaireVide)
  const [erreur, setErreur] = useState('')

  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr')
    return services.filter((service) => {
      const correspondRecherche = !q || `${service.nom} ${service.description} ${categorieLibelle(service.categorie)}`.toLocaleLowerCase('fr').includes(q)
      const correspondOnglet = onglet === 'stock' ? service.suitStock : onglet === 'restaurant' ? ['restaurant', 'bar'].includes(service.categorie) : true
      const correspondFiltre = filtre === 'tous' || service.categorie === filtre
      return correspondRecherche && correspondOnglet && correspondFiltre
    })
  }, [services, recherche, onglet, filtre])

  const stockBas = services.filter((service) => service.suitStock && service.stock <= service.seuil).length
  const payants = services.filter((service) => service.prix > 0).length

  function ouvrirCreation() {
    setForm(formulaireVide())
    setErreur('')
    setModaleOuverte(true)
  }

  function enregistrerService() {
    const nom = form.nom.trim()
    const prix = Number(form.prix)
    if (!nom) return setErreur('Donne un nom au service ou au produit.')
    if (!Number.isFinite(prix) || prix < 0) return setErreur('Le prix doit être un montant positif ou nul.')
    const nouvelElement = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nom,
      categorie: form.categorie,
      prix,
      description: form.description.trim(),
      suitStock: form.suitStock,
      stock: form.suitStock ? Math.max(0, Number(form.stock) || 0) : 0,
      seuil: form.suitStock ? Math.max(0, Number(form.seuil) || 0) : 0
    }
    setServices((actuels) => [nouvelElement, ...actuels])
    setModaleOuverte(false)
  }

  function ajusterStock(id, variation) {
    setServices((actuels) => actuels.map((service) => service.id === id
      ? { ...service, stock: Math.max(0, service.stock + variation) }
      : service))
  }

  return (
    <section className="service-page">
      <Header titre="Services" description="Prestations, bar, restauration et suivi de stock">
        <Button icone={Plus} onClick={ouvrirCreation}>Ajouter un service</Button>
      </Header>

      <div className="service-banner">
        <Package size={17} aria-hidden="true" />
        <p><strong>Prototype sans base de données :</strong> les services et mouvements de stock ajoutés ici restent en mémoire jusqu’à la fermeture ou au rechargement de la page. La liaison client / réservation sera branchée lorsque l’API et le schéma seront prêts.</p>
      </div>

      <div className="service-kpis" aria-label="Résumé des services">
        <article className="service-kpi"><span>Services au catalogue</span><strong>{services.length}</strong></article>
        <article className="service-kpi"><span>Prestations payantes</span><strong>{payants}</strong></article>
        <article className="service-kpi"><span>Articles au seuil de stock</span><strong>{stockBas}</strong></article>
      </div>

      <nav className="service-tabs" role="tablist" aria-label="Sections des services">
        <button className="service-tab" role="tab" aria-selected={onglet === 'services'} onClick={() => { setOnglet('services'); setFiltre('tous') }}>Prestations</button>
        <button className="service-tab" role="tab" aria-selected={onglet === 'restaurant'} onClick={() => { setOnglet('restaurant'); setFiltre('tous') }}>Bar & restaurant</button>
        <button className="service-tab" role="tab" aria-selected={onglet === 'stock'} onClick={() => { setOnglet('stock'); setFiltre('tous') }}>Stock</button>
      </nav>

      <div className="service-toolbar">
        <InputSearch value={recherche} onChange={setRecherche} placeholder="Rechercher un service ou un article…" />
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
            <article className="service-item" key={service.id}>
              <div className="service-item__main">
                <span className="service-item__icon" aria-hidden="true">
                  {service.categorie === 'bar' ? <Wine size={18} /> : service.categorie === 'restaurant' ? <Utensils size={18} /> : <Package size={18} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="service-item__name">{service.nom}</div>
                  <div className="service-item__meta">{categorieLibelle(service.categorie)}{service.description ? ` · ${service.description}` : ''}</div>
                </div>
              </div>
              <div className="service-item__price">{service.prix ? formatXaf(service.prix) : 'Gratuit'}</div>
              {service.suitStock ? (
                <div className={`service-stock${service.stock <= service.seuil ? ' service-stock--low' : ''}`}>
                  <span>Stock : <strong>{service.stock}</strong> · seuil {service.seuil}</span>
                  <span className="service-stock__actions">
                    <Button variante="secondaire" taille="s" icone={Minus} aria-label={`Retirer une unité de ${service.nom}`} disabled={service.stock <= 0} onClick={() => ajusterStock(service.id, -1)} />
                    <Button variante="secondaire" taille="s" icone={Plus} aria-label={`Ajouter une unité de ${service.nom}`} onClick={() => ajusterStock(service.id, 1)} />
                  </span>
                </div>
              ) : <div className="service-stock">Stock non suivi</div>}
            </article>
          ))}
        </div>
      ) : (
        <div className="service-empty">
          <Package size={25} aria-hidden="true" />
          <strong>{recherche ? 'Aucun résultat' : onglet === 'stock' ? 'Aucun article suivi en stock' : onglet === 'restaurant' ? 'Le bar et le restaurant sont prêts à configurer' : 'Le catalogue est vide'}</strong>
          <p>{recherche ? 'Essaie un autre terme ou change le filtre de catégorie.' : 'Ajoute une prestation, un plat, une boisson ou un article. Le stock se suit en activant cette option dans le formulaire.'}</p>
          {!recherche && <Button variante="secondaire" icone={Plus} onClick={ouvrirCreation}>Ajouter le premier élément</Button>}
        </div>
      )}

      {modaleOuverte && (
        <Modal
          ouvert
          onFermer={() => setModaleOuverte(false)}
          titre="Ajouter un service ou un article"
          description="Le bar, le restaurant et les autres prestations partagent le même catalogue pour le moment."
          taille="m"
          libelleValider="Ajouter au catalogue"
          onValider={enregistrerService}
        >
          <div className="service-form">
            <Input label="Nom" requis placeholder="Ex. Petit-déjeuner, eau minérale…" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            <div className="service-form__grid">
              <Input label="Catégorie" value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} options={optionsCategorie} />
              <Input label={`Prix (${DEVISE})`} type="number" min={0} value={form.prix} onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))} />
            </div>
            <Input label="Description (facultative)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="service-form__stock">
              <label className="service-check"><input type="checkbox" checked={form.suitStock} onChange={(e) => setForm((f) => ({ ...f, suitStock: e.target.checked }))} /> Suivre cet article en stock (utile pour les boissons, aliments et produits)</label>
              {form.suitStock && (
                <div className="service-form__grid">
                  <Input label="Quantité initiale" type="number" min={0} value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
                  <Input label="Alerte sous le seuil" type="number" min={0} value={form.seuil} onChange={(e) => setForm((f) => ({ ...f, seuil: e.target.value }))} />
                </div>
              )}
            </div>
            {erreur && <p role="alert" style={{ margin: 0, color: 'var(--color-danger)', fontSize: 12 }}>{erreur}</p>}
            <p className="service-small-note">Aucune donnée n’est écrite en base dans cette version. Le débit automatique du stock lors d’une consommation viendra avec le module de caisse/service.</p>
          </div>
        </Modal>
      )}
    </section>
  )
}
