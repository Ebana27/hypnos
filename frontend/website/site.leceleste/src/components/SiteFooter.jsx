export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span className="footer__word">LeCeleste</span>

        <div className="footer__cols">
          <div>
            <h3>La maison</h3>
            <ul>
              <li>42 chambres</li>
              <li>Table d'hôtes</li>
              <li>Piscine &amp; terrasse</li>
              <li>Vélos en libre-service</li>
            </ul>
          </div>

          <div>
            <h3>Trouver</h3>
            <ul>
              <li>24 corniche du Château</li>
              <li>13008 Marseille</li>
              <li>Bus 83 — arrêt Castellane</li>
            </ul>
          </div>

          <div>
            <h3>Écrire</h3>
            <ul>
              <li>
                <a href="mailto:bonjour@leceleste.fr">bonjour@leceleste.fr</a>
              </li>
              <li>
                <a href="tel:+33491000000">+33 4 91 00 00 00</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__legal">
          <span>© {new Date().getFullYear()} LeCeleste</span>
          <span>Mentions légales · Confidentialité</span>
        </div>
      </div>
    </footer>
  )
}