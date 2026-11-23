/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Button from './base/Button'
import Input from './base/Input'
import PanneauMarque, { BarreFenetre } from './base/PanneauMarque'
import injecterStyles from './base/injecterStyles'

const STYLES = `
.login__champs { display:flex; flex-direction:column; gap:20px; }
.login__mdp { position:relative; }
.login__oeil { position:absolute; right:14px; bottom:0; height:var(--hauteur-champ,52px); display:flex; align-items:center; border:0; background:none; color:var(--color-text-muted); cursor:pointer; }
.login__oeil:hover { color:var(--color-text,inherit); }
.login__erreur { min-height:20px; margin:14px 0 22px; font-size:14px; color:var(--color-danger); }
.login__actions { display:flex; flex-direction:column; gap:12px; }
.login__creer { display:flex; align-items:center; justify-content:center; gap:4px; margin-top:26px; font-size:14px; color:var(--color-text-muted); }
.login__code { display:block; padding:16px 12px; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-background-soft); font:700 clamp(16px,2.4vw,22px)/1.5 monospace; letter-spacing:.06em; text-align:center; user-select:all; overflow-wrap:anywhere; }
.login__lien { align-self:flex-start; margin-top:12px; }
`
injecterStyles('hypnos-login', STYLES)

export default function Login({ onDemo, onCreerHotel }) {
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [visible, setVisible] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [recuperation, setRecuperation] = useState(false)
  const [codeSecours, setCodeSecours] = useState('')
  const [nouvelIdentifiant, setNouvelIdentifiant] = useState('')
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('')
  const [codeRemplace, setCodeRemplace] = useState('')

  async function soumettre(e) {
    e.preventDefault()
    if (chargement) return
    setErreur('')
    setChargement(true)
    try {
      if (recuperation) {
        const resultat = await window.electronAPI.recupererAcces(codeSecours, nouvelIdentifiant, nouveauMotDePasse)
        setIdentifiant(resultat.utilisateur.username)
        setCodeRemplace(resultat.recoveryCode)
      } else {
        await window.electronAPI.connexion(identifiant, motDePasse)
        window.windowControls.loginDone()
      }
    } catch (err) {
      setErreur(err.message)
      setChargement(false)
    }
  }

  return (
    <div className="auth">
      <PanneauMarque
        titre={<>Bon retour<br />parmi nous.</>}
        texte="Connectez-vous pour retrouver vos réservations, vos chambres et vos clients."
      />
      <main className="auth__principal">
        <form className="auth__formulaire" onSubmit={soumettre} noValidate>
          {codeRemplace ? (
            <>
              <h1 className="auth__titre">Nouvelle clé de récupération</h1>
              <p className="auth__sous-titre">Votre accès est rétabli. Ce nouveau code remplace l’ancien; conservez-le hors de cet ordinateur.</p>
              <output className="login__code" aria-label="Nouveau code de secours">{codeRemplace}</output>
              <p className="login__erreur" role="alert">{erreur}</p>
              <div className="login__actions">
                <Button type="button" variante="secondaire" pleineLargeur onClick={async () => {
                  try { await navigator.clipboard.writeText(codeRemplace) } catch { /* le code reste sélectionnable */ }
                }}>Copier le code</Button>
                <Button type="button" pleineLargeur onClick={() => window.windowControls.loginDone()}>J’ai enregistré le code et continuer</Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="auth__titre">{recuperation ? 'Récupérer mon accès' : 'Connexion'}</h1>
              <p className="auth__sous-titre">
                {recuperation ? 'Saisissez votre code de secours pour définir un nom d’utilisateur et un mot de passe.' : 'Accédez à l’espace de votre hôtel.'}
              </p>
              {recuperation ? (
                <div className="login__champs">
                  <Input label="Code de secours" requis autoComplete="off" placeholder="XXXX-XXXX-…" value={codeSecours} onChange={(e) => setCodeSecours(e.target.value)} />
                  <Input label="Nouveau nom d’utilisateur" requis autoComplete="username" placeholder="ex. reception.hotel" value={nouvelIdentifiant} onChange={(e) => setNouvelIdentifiant(e.target.value)} />
                  <Input label="Nouveau mot de passe" requis type="password" autoComplete="new-password" placeholder="8 caractères minimum" value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} />
                </div>
              ) : (
                <div className="login__champs">
                  <Input label="Nom d’utilisateur" placeholder="ex. reception.hotel" autoComplete="username" autoFocus value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
                  <div className="login__mdp">
                    <Input label="Mot de passe" type={visible ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                    <button type="button" className="login__oeil" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {visible ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              )}
              <p className="login__erreur" role="alert">{erreur}</p>
              <div className="login__actions">
                <Button type="submit" taille="l" pleineLargeur className="auth__bouton" chargement={chargement}>
                  {recuperation ? 'Réinitialiser et se connecter' : 'Se connecter'}
                </Button>
                {!recuperation && onDemo && <Button type="button" variante="secondaire" taille="l" pleineLargeur onClick={onDemo}>Continuer en mode démo</Button>}
              </div>
              <Button type="button" variante="lien" taille="s" className="login__lien" onClick={() => {
                setRecuperation((v) => !v)
                setErreur('')
                setChargement(false)
              }}>
                {recuperation ? 'Retour à la connexion' : 'Nom d’utilisateur ou mot de passe oublié ?'}
              </Button>
              {!recuperation && onCreerHotel && (
                <p className="login__creer">Pas encore d’hôtel ? <Button type="button" variante="lien" taille="s" onClick={onCreerHotel}>Créer mon hôtel</Button></p>
              )}
            </>
          )}
        </form>
      </main>
      <BarreFenetre />
    </div>
  )
}
