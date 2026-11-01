/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Plus } from 'lucide-react'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import Button from '../components/base/Button'
import injecterStyles from '../components/base/injecterStyles'

const DEVISE = 'XAF'
const CATEGORIES_ENTREE = [
  { valeur: 'encaissement', libelle: 'Paiement client' },
  { valeur: 'service', libelle: 'Vente de service / restaurant' },
  { valeur: 'fond-caisse', libelle: 'Fond ajouté à la caisse' },
  { valeur: 'autre-entree', libelle: 'Autre entrée' }
]
const CATEGORIES_SORTIE = [
  { valeur: 'achat', libelle: 'Achat / approvisionnement' },
  { valeur: 'depense', libelle: 'Dépense de fonctionnement' },
  { valeur: 'retrait', libelle: 'Retrait / prélèvement' },
  { valeur: 'autre-sortie', libelle: 'Autre sortie' }
]

const STYLES = `
.accounting-page { display:flex; flex-direction:column; gap:18px; min-width:0; }
.accounting-notice { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); color:var(--color-text-muted); font-size:12px; line-height:1.5; }
.accounting-notice p { margin:0; }
.accounting-notice strong { color:var(--color-text); }
.accounting-kpis { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.accounting-kpi { padding:16px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.accounting-kpi span { color:var(--color-text-muted); font-size:11px; }
.accounting-kpi strong { display:block; margin-top:6px; font-family:var(--font-display); font-size:21px; font-weight:600; }
.accounting-kpi--in strong { color:var(--color-success); }
.accounting-kpi--out strong { color:var(--color-danger); }
.accounting-actions { display:flex; flex-wrap:wrap; gap:9px; }
.accounting-toolbar { display:flex; align-items:center; gap:12px; }
.accounting-toolbar > :first-child { flex:1; }
.accounting-table-wrap { overflow-x:auto; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.accounting-table { width:100%; border-collapse:collapse; font-size:12px; }
.accounting-table th, .accounting-table td { padding:12px 14px; border-bottom:1px solid var(--color-border); text-align:left; white-space:nowrap; }
.accounting-table th { color:var(--color-text-muted); font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.accounting-table tbody tr:last-child td { border-bottom:0; }
.accounting-table__note { max-width:320px; overflow:hidden; color:var(--color-text-muted); text-overflow:ellipsis; }
.accounting-amount { font-weight:700; text-align:right !important; }
.accounting-amount--in { color:var(--color-success); }
.accounting-amount--out { color:var(--color-danger); }
.accounting-empty { display:grid; justify-items:center; gap:8px; padding:45px 20px; color:var(--color-text-muted); text-align:center; }
.accounting-empty strong { color:var(--color-text); font-size:14px; }
.accounting-empty p { max-width:450px; margin:0; font-size:12px; line-height:1.5; }
.accounting-form { display:grid; gap:12px; }
.accounting-form__grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.accounting-form__type { display:flex; gap:8px; }
.accounting-form__type button { flex:1; padding:10px; border:1px solid var(--color-border); border-radius:var(--radius-s); background:var(--color-surface); color:var(--color-text-muted); font:inherit; font-size:12px; cursor:pointer; }
.accounting-form__type button[aria-pressed='true'] { border-color:var(--color-accent); background:var(--color-accent-wash); color:var(--color-accent); font-weight:600; }
.accounting-error { margin:0; color:var(--color-danger); font-size:12px; }
.accounting-note { margin:0; color:var(--color-text-faint); font-size:10px; line-height:1.45; }
@media (max-width:760px) { .accounting-kpis { grid-template-columns:1fr; } .accounting-toolbar { align-items:stretch; flex-direction:column; } }
@media (max-width:520px) { .accounting-form__grid { grid-template-columns:1fr; } }
`
injecterStyles('hypnos-accounting-page', STYLES)

const formatXaf = (valeur) => `${new Intl.NumberFormat('fr-FR').format(Number(valeur) || 0)} ${DEVISE}`
const dateLocaleCle = () => {
  const maintenant = new Date()
  return new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function AccountingPage() {
  const [mouvements, setMouvements] = useState([])
  const [modalOuverte, setModalOuverte] = useState(false)
  const [type, setType] = useState('entree')
  const [form, setForm] = useState({ montant: '', categorie: 'encaissement', date: dateLocaleCle(), note: '' })
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState('')

  const solde = useMemo(() => mouvements.reduce((total, m) => total + (m.type === 'entree' ? m.montant : -m.montant), 0), [mouvements])
  const totalEntrees = useMemo(() => mouvements.filter((m) => m.type === 'entree').reduce((somme, m) => somme + m.montant, 0), [mouvements])
  const totalSorties = useMemo(() => mouvements.filter((m) => m.type === 'sortie').reduce((somme, m) => somme + m.montant, 0), [mouvements])
  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr')
    return [...mouvements].reverse().filter((m) => !q || `${m.categorieLibelle} ${m.note} ${m.date}`.toLocaleLowerCase('fr').includes(q))
  }, [mouvements, recherche])

  function ouvrir(typeInitial = 'entree') {
    setType(typeInitial)
    setForm({ montant: '', categorie: typeInitial === 'entree' ? 'encaissement' : 'achat', date: dateLocaleCle(), note: '' })
    setErreur('')
    setModalOuverte(true)
  }

  function changerType(nouveauType) {
    setType(nouveauType)
    setForm((f) => ({ ...f, categorie: nouveauType === 'entree' ? 'encaissement' : 'achat' }))
    setErreur('')
  }

  function enregistrerMouvement() {
    const montant = Number(form.montant)
    if (!Number.isFinite(montant) || montant <= 0) return setErreur('Saisis un montant supérieur à zéro.')
    if (!form.date) return setErreur('Choisis la date du mouvement.')
    if (type === 'sortie' && montant > solde) return setErreur(`Solde insuffisant. Solde actuel : ${formatXaf(solde)}. Enregistre une entrée de caisse avant cette sortie.`)
    const categories = type === 'entree' ? CATEGORIES_ENTREE : CATEGORIES_SORTIE
    const categorieLibelle = categories.find((c) => c.valeur === form.categorie)?.libelle ?? 'Autre'
    setMouvements((actuels) => [...actuels, {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      montant,
      categorie: form.categorie,
      categorieLibelle,
      date: form.date,
      note: form.note.trim()
    }])
    setModalOuverte(false)
  }

  return (
    <section className="accounting-page">
      <Header titre="Comptabilité" description="Suivi simple des entrées et sorties de caisse">
        <div className="accounting-actions">
          <Button variante="secondaire" icone={ArrowDownLeft} onClick={() => ouvrir('entree')}>Entrée de caisse</Button>
          <Button variante="danger-doux" icone={ArrowUpRight} onClick={() => ouvrir('sortie')}>Sortie de caisse</Button>
        </div>
      </Header>

      <div className="accounting-notice">
        <CircleDollarSign size={17} aria-hidden="true" />
        <p><strong>Journal de caisse simple, pas encore une comptabilité complète.</strong> Les mouvements saisis restent en mémoire jusqu’au rechargement. Cette page ne modifie pas la base et ne génère pas encore de factures ni d’écritures comptables.</p>
      </div>

      <div className="accounting-kpis" aria-label="Résumé de caisse">
        <article className="accounting-kpi"><span>Solde calculé</span><strong>{formatXaf(solde)}</strong></article>
        <article className="accounting-kpi accounting-kpi--in"><span>Total des entrées</span><strong>{formatXaf(totalEntrees)}</strong></article>
        <article className="accounting-kpi accounting-kpi--out"><span>Total des sorties</span><strong>{formatXaf(totalSorties)}</strong></article>
      </div>

      <div className="accounting-toolbar">
        <InputSearch value={recherche} onChange={setRecherche} placeholder="Rechercher par motif, catégorie ou date…" />
      </div>

      {visibles.length ? (
        <div className="accounting-table-wrap">
          <table className="accounting-table">
            <thead><tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Note</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(`${m.date}T12:00:00`).toLocaleDateString('fr-FR')}</td>
                  <td>{m.type === 'entree' ? 'Entrée' : 'Sortie'}</td>
                  <td>{m.categorieLibelle}</td>
                  <td className="accounting-table__note">{m.note || '—'}</td>
                  <td className={`accounting-amount accounting-amount--${m.type}`}>{m.type === 'entree' ? '+' : '−'} {formatXaf(m.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="accounting-empty">
          <CircleDollarSign size={26} aria-hidden="true" />
          <strong>{recherche ? 'Aucun mouvement trouvé' : 'Aucun mouvement de caisse'}</strong>
          <p>{recherche ? 'Essaie un autre terme de recherche.' : 'Commence par enregistrer le fond de caisse ou une recette. Ensuite, tu pourras saisir les dépenses et retraits dans la limite du solde disponible.'}</p>
          {!recherche && <Button variante="secondaire" icone={Plus} onClick={() => ouvrir('entree')}>Enregistrer une entrée</Button>}
        </div>
      )}

      {modalOuverte && (
        <Modal
          ouvert
          onFermer={() => setModalOuverte(false)}
          titre={type === 'entree' ? 'Enregistrer une entrée de caisse' : 'Enregistrer une sortie de caisse'}
          description="Saisis le montant et le motif pour garder une trace du mouvement."
          taille="m"
          libelleValider={type === 'entree' ? 'Ajouter l’entrée' : 'Enregistrer la sortie'}
          onValider={enregistrerMouvement}
        >
          <div className="accounting-form">
            <div className="accounting-form__type" role="group" aria-label="Type de mouvement">
              <button type="button" aria-pressed={type === 'entree'} onClick={() => changerType('entree')}>Entrée</button>
              <button type="button" aria-pressed={type === 'sortie'} onClick={() => changerType('sortie')}>Sortie</button>
            </div>
            <div className="accounting-form__grid">
              <Input label={`Montant (${DEVISE})`} type="number" min={1} requis value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} />
              <Input label="Date" type="date" requis value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <Input label="Catégorie" value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} options={type === 'entree' ? CATEGORIES_ENTREE : CATEGORIES_SORTIE} />
            <Input label="Motif / référence (facultatif)" placeholder="Ex. achat de boissons, paiement réservation…" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            {erreur && <p className="accounting-error" role="alert">{erreur}</p>}
            <p className="accounting-note">Une sortie supérieure au solde calculé est refusée. Cette saisie est locale et ne sera pas conservée après rechargement.</p>
          </div>
        </Modal>
      )}
    </section>
  )
}
