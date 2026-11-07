import { useEffect, useMemo, useState } from 'react'
import Header from '../components/base/Header'
import injecterStyles from '../components/base/injecterStyles'
import { formatArgent } from '../lib/reservations'

const STYLES = `
.rapports { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.rapports__outils { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.rapports__groupe-btns { display: flex; align-items: center; gap: 8px; }

.rapports__periode, .rapports__type-graphe { display: flex; gap: 4px; padding: 4px; border: 1px solid var(--color-border); border-radius: var(--radius-pill); background: var(--color-surface); }
.rapports__periode button, .rapports__type-graphe button { padding: 7px 14px; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-muted); font: 500 12px 'Inter', sans-serif; cursor: pointer; transition: all 0.2s ease; }
.rapports__periode button:hover, .rapports__type-graphe button:hover { color: var(--color-text); }
.rapports__periode button[aria-pressed='true'], .rapports__type-graphe button[aria-pressed='true'] { background: var(--color-accent); color: var(--color-accent-contrast); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

.rapports__grille { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.rapports__carte { padding: 20px 22px; border: 1px solid var(--color-border); border-radius: var(--radius-m); background: var(--color-surface); transition: transform 0.2s ease, box-shadow 0.2s ease; }
.rapports__carte:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.04); }

.rapports__label { color: var(--color-text-muted); font: 500 12px 'Inter', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
.rapports__valeur { margin-top: 8px; color: var(--color-text); font: 600 clamp(24px, 3vw, 32px) 'Lora', Georgia, serif; }
.rapports__note { margin-top: 6px; color: var(--color-text-faint); font: 12px 'Inter', sans-serif; }

/* Section Graphique Sophistiquée */
.rapports__section-graphe { padding: 24px; border: 1px solid var(--color-border); border-radius: var(--radius-m); background: var(--color-surface); display: flex; flex-direction: column; gap: 20px; }
.rapports__graphe-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.rapports__graphe-titre { font: 600 16px 'Lora', Georgia, serif; color: var(--color-text); }

.rapports__barres-conteneur { display: flex; align-items: flex-end; gap: clamp(4px, 1.5vw, 16px); height: 200px; padding-top: 20px; border-bottom: 1px solid var(--color-border); position: relative; }
.rapports__colonne { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; cursor: pointer; group; }
.rapports__barre { width: 100%; max-width: 36px; background: var(--color-accent); border-radius: 4px 4px 0 0; transition: height 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease; opacity: 0.85; }
.rapports__colonne:hover .rapports__barre { opacity: 1; filter: brightness(1.1); }

.rapports__infobulle { position: absolute; bottom: 105%; left: 50%; transform: translateX(-50%) translateY(4px); background: var(--color-text); color: var(--color-surface); padding: 6px 10px; border-radius: 6px; font: 500 11px 'Inter', sans-serif; white-space: nowrap; pointer-events: none; opacity: 0; transition: all 0.2s ease; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.rapports__colonne:hover .rapports__infobulle { opacity: 1; transform: translateX(-50%) translateY(0); }

.rapports__axe-x { display: flex; justify-content: space-between; color: var(--color-text-faint); font: 10px 'Inter', sans-serif; padding-top: 8px; }
.rapports__etat { padding: 40px; color: var(--color-text-muted); text-align: center; font: 13px 'Inter', sans-serif; }

@media(max-width: 700px) { 
  .rapports__grille { grid-template-columns: 1fr; }
  .rapports__barres-conteneur { height: 150px; }
}
`
injecterStyles('hypnos-page-rapports', STYLES)

// Entrées de caisse comptées comme recettes (les dons et renforts n'en sont pas)
const RECETTES = ['acompte', 'paiement_client', 'service']

const cleDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export default function RapportPage() {
  const [jours, setJours] = useState(7)
  const [vueGraphe, setVueGraphe] = useState('revenu') // 'revenu' ou 'occupation'
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let actif = true
    Promise.all([
      window.electronAPI.getAll('reservation'),
      window.electronAPI.getAll('mouvementcaisse'),
      window.electronAPI.getAll('chambre')
    ]).then(([reservations, mouvements, chambres]) => {
      if (actif) setDonnees({ reservations, mouvements, chambres })
    }).catch((e) => { if (actif) setErreur(e.message || 'Chargement des rapports impossible.') })
    return () => { actif = false }
  }, [])

  const stats = useMemo(() => {
    if (!donnees) return null
    const fin = new Date(); fin.setHours(0,0,0,0)
    const debut = new Date(fin); debut.setDate(fin.getDate() - jours + 1)
    const debutCle = cleDate(debut)
    const demain = new Date(fin); demain.setDate(fin.getDate() + 1)
    const finExclusive = cleDate(demain)
    const resas = donnees.reservations.filter(r => r.statut !== 'annulee')
    const nbReservations = resas.filter(r => r.dateDebut >= debutCle && r.dateDebut < finExclusive).length

    const recettes = donnees.mouvements.filter((m) => m.type === 'entree' && RECETTES.includes(m.categorie))
    const revenu = recettes
      .filter((m) => m.dateMouvement >= debutCle && m.dateMouvement < finExclusive)
      .reduce((s, m) => s + m.montant, 0)

    // Calcul journalier détaillé pour le graphique
    const detailsParJour = []
    for (let i = 0; i < jours; i++) {
      const jour = new Date(debut)
      jour.setDate(debut.getDate() + i)
      const cle = cleDate(jour)
      const labelCourt = jour.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })

      const revJour = recettes
        .filter((m) => m.dateMouvement === cle)
        .reduce((s, m) => s + m.montant, 0)

      const nuitsJour = resas.filter(r => r.dateDebut <= cle && cle < r.dateFin).length
      const capJour = donnees.chambres.length
      const occJour = capJour ? Math.round((nuitsJour / capJour) * 100) : 0

      detailsParJour.push({
        cle,
        labelCourt,
        revenu: revJour,
        occupation: occJour
      })
    }

    const nuitsTotales = new Set()
    for (let i=0; i<jours; i++) {
      const jour = new Date(debut); jour.setDate(debut.getDate()+i)
      const cle = cleDate(jour)
      for (const r of resas) {
        if (r.dateDebut <= cle && cle < r.dateFin) nuitsTotales.add(`${cle}:${r.chambreId}`)
      }
    }
    const capacite = donnees.chambres.length * jours
    const occupation = capacite ? Math.round(nuitsTotales.size / capacite * 100) : 0

    return { nbReservations, revenu, occupation, nbChambres: donnees.chambres.length, detailsParJour }
  }, [donnees, jours])

  const maxValeurGraphe = useMemo(() => {
    if (!stats || !stats.detailsParJour.length) return 100
    const valeurs = stats.detailsParJour.map(d => vueGraphe === 'revenu' ? d.revenu : d.occupation)
    const max = Math.max(...valeurs, vueGraphe === 'occupation' ? 100 : 10)
    return max === 0 ? 100 : max
  }, [stats, vueGraphe])

  return (
    <div className="rapports">
      <Header titre="Rapports & Performances" />
      
      <div className="rapports__outils">
        <p className="rapports__note">Synthèse financière et opérationnelle en temps réel.</p>
        <div className="rapports__groupe-btns">
          <div className="rapports__periode" aria-label="Période du rapport">
            {[7, 30].map(n => (
              <button key={n} type="button" aria-pressed={jours === n} onClick={() => setJours(n)}>
                {n} jours
              </button>
            ))}
          </div>
        </div>
      </div>

      {erreur ? (
        <p className="rapports__etat" role="alert">{erreur}</p>
      ) : !stats ? (
        <p className="rapports__etat">Chargement des indicateurs…</p>
      ) : (
        <>
          {/* Cartes de KPI principales */}
          <section className="rapports__grille" aria-label="Indicateurs clés">
            <article className="rapports__carte">
              <p className="rapports__label">Encaissements</p>
              <p className="rapports__valeur">{formatArgent(stats.revenu)} XAF</p>
              <p className="rapports__note">Entrées de caisse sur la période</p>
            </article>
            <article className="rapports__carte">
              <p className="rapports__label">Réservations</p>
              <p className="rapports__valeur">{stats.nbReservations}</p>
              <p className="rapports__note">Nouvelles réservations validées</p>
            </article>
            <article className="rapports__carte">
              <p className="rapports__label">Occupation moyenne</p>
              <p className="rapports__valeur">{stats.occupation}%</p>
              <p className="rapports__note">{stats.nbChambres} chambres au total</p>
            </article>
          </section>

          {/* Section Graphique Dynamique */}
          <section className="rapports__section-graphe">
            <div className="rapports__graphe-header">
              <h3 className="rapports__graphe-titre">Évolution quotidienne</h3>
              <div className="rapports__type-graphe" aria-label="Type de métrique graphique">
                <button type="button" aria-pressed={vueGraphe === 'revenu'} onClick={() => setVueGraphe('revenu')}>
                  Encaissements
                </button>
                <button type="button" aria-pressed={vueGraphe === 'occupation'} onClick={() => setVueGraphe('occupation')}>
                  Occupation
                </button>
              </div>
            </div>

            <div className="rapports__barres-conteneur">
              {stats.detailsParJour.map((jour) => {
                const val = vueGraphe === 'revenu' ? jour.revenu : jour.occupation
                const hauteurPourcent = maxValeurGraphe ? (val / maxValeurGraphe) * 100 : 0
                return (
                  <div key={jour.cle} className="rapports__colonne">
                    <div 
                      className="rapports__barre" 
                      style={{ height: `${Math.max(hauteurPourcent, 4)}%` }}
                    />
                    <div className="rapports__infobulle">
                      {jour.labelCourt} : {vueGraphe === 'revenu' ? `${formatArgent(val)} XAF` : `${val}%`}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rapports__axe-x">
              <span>{stats.detailsParJour[0]?.labelCourt}</span>
              <span>Aujourd'hui</span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}