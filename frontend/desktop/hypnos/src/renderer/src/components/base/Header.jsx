/* eslint-disable react/prop-types */
import injecterStyles from './injecterStyles'

const STYLES = `
.entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}
.entete__titre {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-text);
}
.entete__description {
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text-muted);
}
.entete__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
`

injecterStyles('hypnos-header', STYLES)

/**
 * En-tête d'une page.
 *  titre        titre de la page
 *  description  phrase d'explication (facultative)
 *  children     boutons d'action alignés à droite
 *
 * Exemple :
 *  <Header titre="Réservations">
 *    <Button variante="secondaire">Importer Excel</Button>
 *    <Button icone={Plus}>Nouvelle réservation</Button>
 *  </Header>
 */
export default function Header({ titre, description, children }) {
  return (
    <header className="entete">
      <div>
        <h1 className="entete__titre">{titre}</h1>
        {description && <p className="entete__description">{description}</p>}
      </div>
      {children && <div className="entete__actions">{children}</div>}
    </header>
  )
}