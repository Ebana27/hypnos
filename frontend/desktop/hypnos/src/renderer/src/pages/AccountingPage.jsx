/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, FileText, Paperclip, Plus, X } from 'lucide-react'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import InputSearch from '../components/base/InputSearch'
import Modal from '../components/base/Modal'
import Button from '../components/base/Button'
import FailToast from '../components/base/FailToast'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'

const DEVISE = 'XAF'
// Saisies à la main. Acomptes et paiements de réservation arrivent automatiquement depuis la fiche de réservation.
const ENTREES = [
  { valeur: 'service', libelle: 'Service (bar, restaurant…)' },
  { valeur: 'don', libelle: 'Don' },
  { valeur: 'renforcement_patron', libelle: 'Renforcement de la caisse par le patron' },
  { valeur: 'autre_entree', libelle: 'Autre entrée' }
]
const SORTIES = [
  { valeur: 'achat', libelle: 'Achat / approvisionnement' },
  { valeur: 'depense', libelle: 'Dépense de fonctionnement' },
  { valeur: 'retrait', libelle: 'Retrait / prélèvement' },
  { valeur: 'autre_sortie', libelle: 'Autre sortie' }
]
const MODES = [
  { valeur: 'especes', libelle: 'Espèces' },
  { valeur: 'carte', libelle: 'Carte' },
  { valeur: 'mtn_money', libelle: 'MTN Money' },
  { valeur: 'airtel_money', libelle: 'Airtel Money' }
]
const LIBELLES = {
  acompte: 'Acompte client',
  paiement_client: 'Paiement client',
  remboursement_acompte: 'Remboursement d’acompte',
  ...Object.fromEntries([...ENTREES, ...SORTIES].map((o) => [o.valeur, o.libelle]))
}
const LIBELLES_MODES = Object.fromEntries(MODES.map((m) => [m.valeur, m.libelle]))

const STYLES = `
.accounting-page { display:flex; flex-direction:column; gap:18px; min-width:0; }
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
.accounting-piece { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.accounting-piece__nom { overflow:hidden; max-width:260px; color:var(--color-text-muted); font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
.accounting-lien { display:inline-flex; align-items:center; gap:4px; padding:0; border:0; background:none; color:var(--color-accent); font:inherit; font-size:12px; cursor:pointer; }
.accounting-lien:hover { text-decoration:underline; }
.accounting-form__type { display:flex; gap:8px; }
.accounting-form__type button { flex:1; padding:10px; border:1px solid var(--color-border); border-radius:var(--radius-s); background:var(--color-surface); color:var(--color-text-muted); font:inherit; font-size:12px; cursor:pointer; }
.accounting-form__type button[aria-pressed='true'] { border-color:var(--color-accent); background:var(--color-accent-wash); color:var(--color-accent); font-weight:600; }
@media (max-width:760px) { .accounting-kpis { grid-template-columns:1fr; } .accounting-toolbar { align-items:stretch; flex-direction:column; } }
@media (max-width:520px) { .accounting-form__grid { grid-template-columns:1fr; } }
`
injecterStyles('hypnos-accounting-page', STYLES)

const formatXaf = (valeur) => `${new Intl.NumberFormat('fr-FR').format(Number(valeur) || 0)} ${DEVISE}`
const dateLocaleCle = () => {
  const maintenant = new Date()
  return new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const formulaireVide = (type) => ({
  montant: '',
  categorie: type === 'entree' ? 'service' : 'achat',
  date: dateLocaleCle(),
  note: '',
  mode: 'especes',
  serviceId: ''
})

export default function AccountingPage() {
  const [mouvements, setMouvements] = useState([])
  const [services, setServices] = useState([])
  const [modale, setModale] = useState(false)
  const [type, setType] = useState('entree')
  const [form, setForm] = useState(() => formulaireVide('entree'))
  const [recherche, setRecherche] = useState('')
  const [piece, setPiece] = useState(null) // { nom, original } : fichier copié, en attente d'enregistrement
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  const charger = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        window.electronAPI.getAll('mouvementcaisse'),
        window.electronAPI.getAll('service')
      ])
      setMouvements(m)
      setServices(s)
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const servicesParId = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services])
  const totalEntrees = mouvements.filter((m) => m.type === 'entree').reduce((s, m) => s + m.montant, 0)
  const totalSorties = mouvements.filter((m) => m.type === 'sortie').reduce((s, m) => s + m.montant, 0)
  const solde = totalEntrees - totalSorties

  const detail = useCallback(
    (m) =>
      [
        m.serviceId ? servicesParId[m.serviceId]?.nom : '',
        m.reservationId ? `Réservation n°${m.reservationId}` : '',
        m.motif
      ].filter(Boolean).join(' · ') || '—',
    [servicesParId]
  )

  const visibles = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr')
    return [...mouvements]
      .sort((a, b) => b.dateMouvement.localeCompare(a.dateMouvement) || b.id - a.id)
      .filter((m) => !q || `${LIBELLES[m.categorie]} ${detail(m)} ${m.dateMouvement}`.toLocaleLowerCase('fr').includes(q))
  }, [mouvements, recherche, detail])

  function ouvrir(typeInitial) {
    setType(typeInitial)
    setForm(formulaireVide(typeInitial))
    setPiece(null)
    setModale(true)
  }

  function changerType(nouveau) {
    setType(nouveau)
    setForm((f) => ({ ...formulaireVide(nouveau), montant: f.montant, date: f.date }))
    if (nouveau === 'entree') setPiece(null)
  }

  async function joindrePiece() {
    try {
      const choisie = await window.electronAPI.caisse.choisirPiece()
      if (choisie) setPiece(choisie)
    } catch (e) {
      setEchec(e.message)
    }
  }

  async function ouvrirPiece(nom) {
    try {
      await window.electronAPI.caisse.ouvrirPiece(nom)
    } catch (e) {
      setEchec(e.message)
    }
  }

  async function enregistrer() {
    setChargement(true)
    try {
      await window.electronAPI.create('mouvementcaisse', {
        type,
        categorie: form.categorie,
        montant: Number(form.montant),
        dateMouvement: form.date,
        motif: form.note,
        modePaiement: type === 'entree' ? form.mode : null,
        serviceId: form.categorie === 'service' && form.serviceId ? Number(form.serviceId) : null,
        pieceChemin: type === 'sortie' ? (piece?.nom ?? null) : null
      })
      await charger()
      setModale(false)
      setSucces(type === 'entree' ? 'Entrée enregistrée.' : 'Sortie enregistrée.')
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  return (
    <section className="accounting-page">
      <Header titre="Comptabilité" description="Journal de caisse : entrées et sorties">
        <div className="accounting-actions">
          <Button variante="secondaire" icone={ArrowDownLeft} onClick={() => ouvrir('entree')}>Entrée de caisse</Button>
          <Button variante="danger-doux" icone={ArrowUpRight} onClick={() => ouvrir('sortie')}>Sortie de caisse</Button>
        </div>
      </Header>

      <div className="accounting-kpis" aria-label="Résumé de caisse">
        <article className="accounting-kpi"><span>Solde de caisse</span><strong>{formatXaf(solde)}</strong></article>
        <article className="accounting-kpi accounting-kpi--in"><span>Total des entrées</span><strong>{formatXaf(totalEntrees)}</strong></article>
        <article className="accounting-kpi accounting-kpi--out"><span>Total des sorties</span><strong>{formatXaf(totalSorties)}</strong></article>
      </div>

      <div className="accounting-toolbar">
        <InputSearch value={recherche} onChange={setRecherche} placeholder="Rechercher par origine, motif ou date…" />
      </div>

      {visibles.length ? (
        <div className="accounting-table-wrap">
          <table className="accounting-table">
            <thead>
              <tr><th>Date</th><th>Origine / catégorie</th><th>Détail</th><th>Mode</th><th style={{ textAlign: 'right' }}>Montant</th></tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(`${m.dateMouvement}T12:00:00`).toLocaleDateString('fr-FR')}</td>
                  <td>{LIBELLES[m.categorie] ?? m.categorie}</td>
                  <td className="accounting-table__note">
                    {detail(m)}
                    {m.pieceChemin && (
                      <>
                        {' '}
                        <button type="button" className="accounting-lien" onClick={() => ouvrirPiece(m.pieceChemin)}>
                          <FileText size={12} aria-hidden="true" /> Pièce
                        </button>
                      </>
                    )}
                  </td>
                  <td>{LIBELLES_MODES[m.modePaiement] ?? '—'}</td>
                  <td className={`accounting-amount accounting-amount--${m.type === 'entree' ? 'in' : 'out'}`}>
                    {m.type === 'entree' ? '+' : '−'} {formatXaf(m.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="accounting-empty">
          <CircleDollarSign size={26} aria-hidden="true" />
          <strong>{recherche ? 'Aucun mouvement trouvé' : 'Aucun mouvement de caisse'}</strong>
          <p>{recherche ? 'Essayez un autre terme.' : 'Commencez par enregistrer le fond de caisse (renforcement par le patron) ou une recette.'}</p>
          {!recherche && <Button variante="secondaire" icone={Plus} onClick={() => ouvrir('entree')}>Enregistrer une entrée</Button>}
        </div>
      )}

      {modale && (
        <Modal
          ouvert
          onFermer={() => setModale(false)}
          titre={type === 'entree' ? 'Entrée de caisse' : 'Sortie de caisse'}
          description={type === 'entree' ? "Indiquez le montant et d'où il vient." : `Solde disponible : ${formatXaf(solde)}`}
          taille="m"
          libelleValider="Enregistrer"
          onValider={enregistrer}
          chargement={chargement}
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
            <Input label={type === 'entree' ? 'Origine' : 'Catégorie'} value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} options={type === 'entree' ? ENTREES : SORTIES} />
            {type === 'entree' && form.categorie === 'service' && (
              <Input
                label="Service concerné"
                requis
                placeholder="Choisir un service"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                options={services.filter((s) => s.actif).map((s) => ({ valeur: String(s.id), libelle: s.nom }))}
              />
            )}
            {type === 'entree' && (
              <Input label="Mode de paiement" value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} options={MODES} />
            )}
            <Input
              label={type === 'sortie' ? 'Motif' : 'Détail (facultatif)'}
              requis={type === 'sortie'}
              placeholder={type === 'sortie' ? 'Ex. achat de boissons' : 'Ex. recette du bar du week-end'}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
            {type === 'sortie' && (
              <div className="accounting-piece">
                <Button variante="secondaire" taille="s" icone={Paperclip} onClick={joindrePiece}>
                  {piece ? 'Changer la pièce' : 'Joindre une pièce justificative'}
                </Button>
                {piece && (
                  <>
                    <span className="accounting-piece__nom">{piece.original}</span>
                    <Button variante="fantome" taille="s" iconeSeule icone={X} aria-label="Retirer la pièce" onClick={() => setPiece(null)} />
                  </>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}