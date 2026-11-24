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
.param__code { display:block; padding:14px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); font:700 18px/1.5 monospace; letter-spacing:.08em; text-align:center; user-select:all; overflow-wrap:anywhere; }
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
  const [compte, setCompte] = useState(null)
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasseActuel, setMotDePasseActuel] = useState('')
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('')
  const [codeSecours, setCodeSecours] = useState('')
  const [urlApi, setUrlApi] = useState('')
  const [identifiantApi, setIdentifiantApi] = useState('')
  const [motDePasseApi, setMotDePasseApi] = useState('')
  const [apiConnectee, setApiConnectee] = useState(false)
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
      setCompte(session?.utilisateur ?? null)
      setIdentifiant(session?.utilisateur?.username ?? '')
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

  useEffect(() => {
    window.electronAPI.kpay.configuration()
      .then((configuration) => {
        setUrlApi(configuration.baseUrl ?? '')
        setApiConnectee(Boolean(configuration.connected))
      })
      .catch((e) => setEchec(e.message))
  }, [])

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

  async function enregistrerAcces() {
    if (!motDePasseActuel) return setEchec('Saisissez votre mot de passe actuel pour confirmer le changement.')
    setChargement(true)
    try {
      const utilisateur = await window.electronAPI.changerAcces(motDePasseActuel, identifiant, nouveauMotDePasse)
      setCompte(utilisateur)
      setIdentifiant(utilisateur.username)
      setMotDePasseActuel('')
      setNouveauMotDePasse('')
      setSucces('Identifiants mis à jour.')
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function creerCodeSecours() {
    if (!motDePasseActuel) return setEchec('Saisissez votre mot de passe actuel pour générer un code.')
    setChargement(true)
    try {
      const resultat = await window.electronAPI.genererCodeSecours(motDePasseActuel)
      setCodeSecours(resultat.recoveryCode)
      setMotDePasseActuel('')
      setSucces('Nouveau code de secours créé. Il remplace l’ancien.')
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function connecterApi() {
    setChargement(true)
    try {
      const resultat = await window.electronAPI.kpay.connexion(urlApi, identifiantApi, motDePasseApi)
      setUrlApi(resultat.baseUrl)
      setMotDePasseApi('')
      setApiConnectee(true)
      setSucces('Connecté au backend Django. Le JWT reste en mémoire pendant cette session.')
    } catch (e) {
      setEchec(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function deconnecterApi() {
    try {
      await window.electronAPI.kpay.deconnexion()
      setApiConnectee(false)
      setSucces('Déconnecté du backend Django.')
    } catch (e) {
      setEchec(e.message)
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

      <div className="param__carte">
        <h2 className="param__titre">Compte et accès</h2>
        <p className="param__texte">Corrigez un nom d’utilisateur mal saisi ou changez le mot de passe. Pour ces opérations, votre mot de passe actuel est demandé.</p>
        {compte ? (
          <>
            <div className="param__grille">
              <Input label="Nom d’utilisateur" requis autoComplete="username" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
              <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)} />
              <Input label="Nouveau mot de passe (facultatif)" type="password" autoComplete="new-password" aide="8 caractères minimum. Laissez vide pour ne changer que le nom d’utilisateur." value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} />
            </div>
            <div className="param__pied"><Button chargement={chargement} disabled={!motDePasseActuel || !identifiant.trim()} onClick={enregistrerAcces}>Mettre à jour l’accès</Button></div>
            <p className="param__texte">Code de secours : à générer et conserver hors de cet ordinateur. La récupération remplace ce code après son utilisation.</p>
            <div className="param__pied"><Button variante="secondaire" chargement={chargement} disabled={!motDePasseActuel} onClick={creerCodeSecours}>Générer / remplacer le code de secours</Button></div>
            {codeSecours && <><output className="param__code" aria-label="Code de secours">{codeSecours}</output><div className="param__pied"><Button variante="fantome" onClick={async () => { try { await navigator.clipboard.writeText(codeSecours) } catch { /* le code reste sélectionnable */ } }}>Copier le code</Button></div></>}
          </>
        ) : <p className="param__texte">Chargement du compte…</p>}
      </div>

      <div className="param__carte">
        <h2 className="param__titre">Backend Django et KPay</h2>
        <p className="param__texte">
          Connexion distincte du compte local Hypnos. Saisissez l’origine HTTPS ngrok de Django et un compte Django actif. Le mot de passe n’est pas conservé; les JWT restent en mémoire et seront redemandés au prochain démarrage.
        </p>
        <div className="param__grille">
          <Input label="URL publique de l’API Django" type="url" placeholder="https://xxxx.ngrok-free.dev" value={urlApi} onChange={(e) => setUrlApi(e.target.value)} />
          <Input label="Nom d’utilisateur Django" autoComplete="username" value={identifiantApi} onChange={(e) => setIdentifiantApi(e.target.value)} />
          <Input label="Mot de passe Django" type="password" autoComplete="current-password" value={motDePasseApi} onChange={(e) => setMotDePasseApi(e.target.value)} />
        </div>
        <div className="param__pied">
          {apiConnectee ? (
            <Button variante="secondaire" onClick={deconnecterApi}>Déconnecter l’API</Button>
          ) : (
            <Button chargement={chargement} disabled={!urlApi.trim() || !identifiantApi.trim() || !motDePasseApi} onClick={connecterApi}>Se connecter à Django</Button>
          )}
        </div>
      </div>

      <SuccessToast ouvert={Boolean(succes)} message={succes} onFermer={() => setSucces('')} />
      <FailToast ouvert={Boolean(echec)} message={echec} onFermer={() => setEchec('')} />
    </section>
  )
}
