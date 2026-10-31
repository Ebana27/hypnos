import { useEffect, useMemo, useState } from 'react'
import Header from '../components/base/Header'
import injecterStyles from '../components/base/injecterStyles'
import { formatArgent } from '../lib/reservations'

const STYLES = `
.rapports { display:flex; flex-direction:column; gap:20px; }
.rapports__outils { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.rapports__periode { display:flex; gap:6px; padding:4px; border:1px solid var(--color-border); border-radius:var(--radius-pill); background:var(--color-surface); }
.rapports__periode button { padding:7px 13px; border:0; border-radius:var(--radius-pill); background:transparent; color:var(--color-text-muted); font:500 12px 'Inter',sans-serif; cursor:pointer; }
.rapports__periode button[aria-pressed='true'] { background:var(--color-accent); color:var(--color-accent-contrast); }
.rapports__grille { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.rapports__carte { padding:18px 20px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); }
.rapports__label { color:var(--color-text-muted); font:500 12px 'Inter',sans-serif; }
.rapports__valeur { margin-top:8px; color:var(--color-text); font:600 clamp(24px,3vw,32px) 'Lora',Georgia,serif; }
.rapports__note { margin-top:6px; color:var(--color-text-faint); font:12px 'Inter',sans-serif; }
.rapports__etat { padding:28px; color:var(--color-text-muted); text-align:center; }
@media(max-width:700px) { .rapports__grille { grid-template-columns:1fr; } }
`
injecterStyles('hypnos-page-rapports', STYLES)

const cleDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export default function RapportPage() {
  const [jours, setJours] = useState(7)
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let actif = true
    Promise.all([
      window.electronAPI.getAll('reservation'),
      window.electronAPI.getAll('facture'),
      window.electronAPI.getAll('chambre')
    ]).then(([reservations, factures, chambres]) => {
      if (actif) setDonnees({ reservations, factures, chambres })
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
    const revenu = donnees.factures
      .filter(f => f.statut !== 'annulee' && String(f.dateEmission).slice(0,10) >= debutCle && String(f.dateEmission).slice(0,10) < finExclusive)
      .reduce((s,f) => s + Number(f.total || 0), 0)

    // Une chambre compte au plus une fois par nuit, même si des données se chevauchent.
    const nuits = new Set()
    for (let i=0; i<jours; i++) {
      const jour = new Date(debut); jour.setDate(debut.getDate()+i)
      const cle = cleDate(jour)
      for (const r of resas) {
        if (r.dateDebut <= cle && cle < r.dateFin) nuits.add(`${cle}:${r.chambreId}`)
      }
    }
    const capacite = donnees.chambres.length * jours
    const occupation = capacite ? Math.round(nuits.size / capacite * 100) : 0
    return { nbReservations, revenu, occupation, nbChambres: donnees.chambres.length }
  }, [donnees, jours])

  return (
    <div className="rapports">
      <Header titre="Rapports" />
      <div className="rapports__outils">
        <p className="rapports__note">Synthèse calculée à partir des réservations et factures locales.</p>
        <div className="rapports__periode" aria-label="Période du rapport">
          {[7,30].map(n => <button key={n} type="button" aria-pressed={jours===n} onClick={() => setJours(n)}>{n} jours</button>)}
        </div>
      </div>
      {erreur ? <p className="rapports__etat" role="alert">{erreur}</p> : !stats ? <p className="rapports__etat">Chargement des données…</p> : (
        <section className="rapports__grille" aria-label={`Indicateurs sur ${jours} jours`}>
          <article className="rapports__carte"><p className="rapports__label">Chiffre facturé</p><p className="rapports__valeur">{formatArgent(stats.revenu)} XAF</p><p className="rapports__note">Factures émises sur la période</p></article>
          <article className="rapports__carte"><p className="rapports__label">Réservations</p><p className="rapports__valeur">{stats.nbReservations}</p><p className="rapports__note">Hors réservations annulées</p></article>
          <article className="rapports__carte"><p className="rapports__label">Occupation moyenne</p><p className="rapports__valeur">{stats.occupation}%</p><p className="rapports__note">{stats.nbChambres} chambres · nuits réservées / capacité</p></article>
        </section>
      )}
    </div>
  )
}
