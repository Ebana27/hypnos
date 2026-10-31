/* eslint-disable react/prop-types */
import { useState } from 'react'
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
/* La place du message est toujours réservée : le formulaire ne « saute » pas */
.login__erreur {
  min-height: 20px;
  margin: 14px 0 22px;
  font-size: 14px;
  color: var(--color-danger);
}
.login__note {
  margin-top: 26px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
}
`

injecterStyles('hypnos-login', STYLES)

export default function Login() {
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
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
              label="Adresse e-mail"
              placeholder="vous@hotel.cg"
              autoComplete="username"
              autoFocus
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>

          <p className="login__erreur" role="alert">
            {erreur}
          </p>

          <Button type="submit" taille="l" pleineLargeur className="auth__bouton" chargement={chargement}>
            Se connecter
          </Button>

          <p className="login__note">
            Hypnos fonctionne sans internet : vos données sont enregistrées sur cet ordinateur.
          </p>
        </form>
      </main>

      <BarreFenetre />
    </div>
  )
}