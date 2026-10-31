import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="page">
      <div className="wrap">
        <p className="eyebrow" data-reveal>
          Erreur 404
        </p>
        <h1 className="display" data-split style={{ marginTop: '1.5rem' }}>
          Cette page
          <br />
          <em>n’existe pas</em>
        </h1>
        <p className="lead" data-reveal style={{ marginTop: '2rem' }}>
          La page a peut-être changé d’adresse. Reprenons depuis le début.
        </p>
        <p style={{ marginTop: '2.5rem' }}>
          <Link className="btn" to="/">
            Retour à l’accueil
          </Link>
        </p>
      </div>
    </div>
  )
}