/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Button from './base/Button'
import Input from './base/Input'
import PanneauMarque, { BarreFenetre } from './base/PanneauMarque'
import injecterStyles from './base/injecterStyles'

const STYLES = `
.login__champs {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.login__mdp {
  position: relative;
}
/* Œil aligné sur le champ (le label est au-dessus) */
.login__oeil {
  position: absolute;
  right: 14px;
  bottom: 0;
  height: var(--hauteur-champ, 52px);
  display: flex;
  align-items: center;
  border: 0;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}
.login__oeil:hover { color: var(--color-text, inherit); }
/* La place du message est toujours réservée : le formulaire ne « saute » pas */
.login__erreur {
  min-height: 20px;
  margin: 14px 0 22px;
  font-size: 14px;
  color: var(--color-danger);
}
.login__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.login__creer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 26px;
  font-size: 14px;
  color: var(--color-text-muted);
}
`

injecterStyles('hypnos-login', STYLES)

export default function Login({ onDemo, onCreerHotel }) {
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [visible, setVisible] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  async function soumettre(e) {
    e.preventDefault()
    if (chargement) return
    setErreur('')
    setChargement(true)
    try {
      await window.electronAPI.connexion(identifiant, motDePasse)
      window.windowControls.loginDone() // la fenêtre se ferme, on garde l'indicateur
    } catch (err) {
      setErreur(err.message)
      setChargement(false)
    }
  }

  return (
    <div className="auth">
      <PanneauMarque
        titre={
          <>
            Bon retour
            <br />
            parmi nous.
          </>
        }
        texte="Connectez-vous pour retrouver vos réservations, vos chambres et vos clients."
      />

      <main className="auth__principal">
        <form className="auth__formulaire" onSubmit={soumettre} noValidate>
          <h1 className="auth__titre">Connexion</h1>
          <p className="auth__sous-titre">Accédez à l’espace de votre hôtel.</p>

          <div className="login__champs">
            <Input
              label="Nom d’utilisateur"
              placeholder="ex. reception.hotel"
              autoComplete="username"
              autoFocus
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
            />
            <div className="login__mdp">
              <Input
                label="Mot de passe"
                type={visible ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
              <button
                type="button"
                className="login__oeil"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <p className="login__erreur" role="alert">
            {erreur}
          </p>

          <div className="login__actions">
            <Button type="submit" taille="l" pleineLargeur className="auth__bouton" chargement={chargement}>
              Se connecter
            </Button>
            {onDemo && (
              <Button type="button" variante="secondaire" taille="l" pleineLargeur onClick={onDemo}>
                Continuer en mode démo
              </Button>
            )}
          </div>

          {onCreerHotel && (
            <p className="login__creer">
              Pas encore d’hôtel ?
              <Button type="button" variante="lien" taille="s" onClick={onCreerHotel}>
                Créer mon hôtel
              </Button>
            </p>
          )}
        </form>
      </main>

      <BarreFenetre />
    </div>
  )
}
