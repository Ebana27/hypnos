/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import Button from '../components/base/Button'
import FailToast from '../components/base/FailToast'
import Header from '../components/base/Header'
import Input from '../components/base/Input'
import SuccessToast from '../components/base/SuccessToast'
import injecterStyles from '../components/base/injecterStyles'

const THEMES = [
  { valeur: 'system', libelle: 'Automatique', aide: 'Suit le réglage de Windows', Icone: Monitor },
  { valeur: 'light', libelle: 'Clair', aide: 'Fond clair en permanence', Icone: Sun },
  { valeur: 'dark', libelle: 'Sombre', aide: 'Fond sombre en permanence', Icone: Moon }
]

const STYLES = `
.param { display:flex; flex-direction:column; gap:20px; min-width:0; max-width:760px; }
.param__carte { display:flex; flex-direction:column; gap:14px; padding:20px; border:1px solid var(--color-border); border-radius:var(--radius-l); background:var(--color-surface); }
.param__titre { margin:0; font-family:var(--font-display); font-size:16px; font-weight:600; }
.param__texte { margin:-8px 0 0; color:var(--color-text-muted); font-size:12px; line-height:1.5; }
.param__themes { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.param__theme { display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); color:var(--color-text); font:inherit; text-align:left; cursor:pointer; }
.param__theme:hover { border-color:var(--color-accent); }
.param__theme[aria-pressed='true'] { border-color:var(--color-accent); background:var(--color-accent-wash); color:var(--color-accent); box-shadow:inset 0 0 0 1px var(--color-accent); }
.param__theme strong { font-size:13px; font-weight:600; }
.param__theme span { color:var(--color-text-muted); font-size:11px; }
.param__grille { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.param__choix-fin { max-width:360px; }
.param__pied { display:flex; justify-content:flex-end; }
@media (max-width:640px) { .param__themes, .param__grille { grid-template-columns:1fr; } }
`
injecterStyles('hypnos-page-param', STYLES)

// Si base.css choisit les couleurs avec l'attribut data-theme, il suit le choix ; sinon c'est
// la valeur « prefers-color-scheme », déjà modifiée par le processus principal, qui s'en charge.
function appliquerThemeAuDocument(theme) {
  const racine = document.documentElement
  if (theme === 'system') delete racine.dataset.theme
  else racine.dataset.theme = theme
}

const heureCourte = (h) => String(h ?? '').slice(0, 5)

export default function ParamPage() {
  const [theme, setTheme] = useState('system')
  const [hotelId, setHotelId] = useState(null)
  const [form, setForm] = useState({
    arrivee: '15:00',
    depart: '11:00',
    marge: '60',
    statutApresDepart: 'nettoyage'
  })
  const [initial, setInitial] = useState(null)
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState('')
  const [echec, setEchec] = useState('')

  const charger = useCallback(async () => {
    try {
      const api = window.electronAPI
      const [themeActuel, session] = await Promise.all([api.apparence.obtenir(), api.sessionCourante()])
      setTheme(themeActuel)
      if (!session?.hotel) return
      const h = await api.getById('hotel', session.hotel.id)
      setHotelId(h.id)
      const valeurs = {
        arrivee: heureCourte(h.heureArrivee),
        depart: heureCourte(h.heureDepart),
        marge: String(h.margeNettoyageMinutes),
        statutApresDepart: h.statutChambreApresDepart ?? 'nettoyage'
      }
      setForm(valeurs)
      setInitial(valeurs)
    } catch (e) {
      setEchec(e.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  async function choisirTheme(valeur) {
    const precedent = theme
    setTheme(valeur)
    appliquerThemeAuDocument(valeur)
    try {
      await window.electronAPI.apparence.definir(valeur)
    } catch (e) {
      setTheme(precedent)
      appliquerThemeAuDocument(precedent)
      setEchec(e.message)
    }
  }

  const modifie =
    initial &&
    (form.arrivee !== initial.arrivee ||
      form.depart !== initial.depart ||
      form.marge !== initial.marge ||
      form.statutApresDepart !== initial.statutApresDepart)

  async function enregistrerHotel() {
    if (!form.arrivee || !form.depart) return setEchec('Indiquez les heures d’arrivée et de départ.')
    const marge = Number(form.marge)
    if (!Number.isInteger(marge) || marge < 0 || marge > 240) {
      return setEchec('La marge de nettoyage doit être comprise entre 0 et 240 minutes.')
    }
    setChargement(true)
    try {
      await window.electronAPI.update('hotel', hotelId, {
        heureArrivee: `${form.arrivee}:00`,
        heureDepart: `${form.depart}:00`,
        margeNettoyageMinutes: marge,
        statutChambreApresDepart: form.statutApresDepart
      })
      setInitial({ ...form })
      setSucces('Paramètres enregistrés.')
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  const maj = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }))

  return (
    <section className="param">
      <Header titre="Paramètres" description="Apparence et réglages de l’hôtel" />

      <div className="param__carte">
        <h2 className="param__titre">Apparence</h2>
        <p className="param__texte">Le choix s’applique à toutes les fenêtres et est conservé à la prochaine ouverture.</p>
        <div className="param__themes" role="group" aria-label="Thème de l’application">
          {THEMES.map(({ valeur, libelle, aide, Icone }) => (
            <button key={valeur} type="button" className="param__theme" aria-pressed={theme === valeur} onClick={() => choisirTheme(valeur)}>
              <Icone size={18} aria-hidden="true" />
              <strong>{libelle}</strong>
              <span>{aide}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="param__carte">
        <h2 className="param__titre">Hôtel</h2>
        <p className="param__texte">Les heures servent de référence pour les arrivées et les départs. La marge de nettoyage est le délai prévu pour préparer une chambre après un départ.</p>
        {hotelId ? (
          <>
            <div className="param__grille">
              <Input label="Heure d’arrivée" type="time" requis value={form.arrivee} onChange={maj('arrivee')} />
              <Input label="Heure de départ" type="time" requis value={form.depart} onChange={maj('depart')} />
              <Input label="Marge de nettoyage (minutes)" type="number" min={0} max={240} value={form.marge} onChange={maj('marge')} />
            </div>
            <Input
              className="param__choix-fin"
              label="Statut de la chambre après départ"
              aide="Appliqué lorsque le personnel confirme le départ du client."
              value={form.statutApresDepart}
              onChange={maj('statutApresDepart')}
              options={[
                { valeur: 'disponible', libelle: 'Disponible' },
                { valeur: 'nettoyage', libelle: 'En nettoyage' }
              ]}
            />
            <div className="param__pied">
              <Button chargement={chargement} disabled={!modifie} onClick={enregistrerHotel}>Enregistrer</Button>
            </div>
          </>
        ) : (
          <p className="param__texte">Chargement des informations de l’hôtel…</p>
        )}
      </div>

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}
