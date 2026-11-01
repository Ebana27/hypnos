export default function Intro() {
  return (
    <section className="intro">
      <div className="wrap intro__grid">
        <p className="eyebrow" data-reveal>
          La maison
        </p>

        <div>
          <p className="intro__statement" data-reveal>
            Une maison de famille posée sur la corniche, <em>fermée en janvier</em> et
            ouverte le reste de l’année, où l’on vient pour la vue et l’on reste pour le
            petit-déjeuner.
          </p>

          <div className="intro__aside" data-reveal>
            <hr />
<p className="lead">
              Nous avons gardé les volumes d’origine : les carreaux de ciment, les volets
              en fer, la cage d’escalier de 1904. Les chambres, elles, ont été refaites
              en 2024 — sans rien enlever de ce qui faisait l’époque.
            </p>
            <a className="btn btn--ghost" href="#lieu">
              Faire le tour
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}