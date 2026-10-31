import { GALLERY } from '../data/hotel'

export default function LieuSection() {
  return (
    <section className="lieu" id="lieu">
      <div className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow" data-reveal>
              Le lieu
            </p>
            <h2 className="h2" data-reveal>
              Une maison face au large
            </h2>
          </div>
          <p className="meta" data-reveal>
            Corniche — Marseille
          </p>
        </div>

        <div className="lieu__grid">
          {GALLERY.map((item) => (
            <figure className={`lieu__item lieu__item--${item.size}`} key={item.id}>
              <img src={item.image(1200)} alt={item.caption} loading="lazy" data-parallax />
              <figcaption>{item.caption}</figcaption>
            </figure>
          ))}
        </div>

        <div className="lieu__text">
          <p className="eyebrow" data-reveal>
            Venir
          </p>
          <div>
            <p className="lead" data-reveal>
              À dix minutes à pied du Vieux-Port, à vingt minutes de l’aéroport, et
              directement accessible en bus 83 depuis la gare. Le parking de la maison
              est gratuit pour les clients.
            </p>
            <p className="lead" data-reveal>
              Check-in à partir de 15 h, check-out jusqu’à 11 h. La table d’hôtes sert le
              dîner tous les soirs, sur place ou sur la terrasse selon la saison.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}