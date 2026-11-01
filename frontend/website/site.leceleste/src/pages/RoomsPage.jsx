import { Link } from 'react-router-dom'

import { ROOMS } from '../data/hotel'

export default function RoomsPage() {
  return (
    <div className="page">
      <div className="wrap">
        <div className="page__head">
          <p className="eyebrow" data-reveal>
            Les chambres
          </p>
          <h1 className="display" data-split style={{ marginTop: '1.5rem' }}>
            Six chambres,
            <br />
            <em>une seule mer</em>
          </h1>
          <p className="lead" data-reveal style={{ marginTop: '2rem' }}>
            Toutes ont la mer en vue, à un degré près. Check-in 15 h, check-out 11 h,
            petit-déjeuner compris.
          </p>
        </div>

        <div className="rooms-grid">
          {ROOMS.map((room) => (
            <article className="room-card" key={room.num} data-reveal>
              <img src={room.image(900)} alt={room.name} loading="lazy" />
              <div className="room-card__body">
                <h2 className="room-card__name">{room.name}</h2>
                <span className="meta">{room.price}</span>
              </div>
              <p className="room-card__desc">
                {room.desc}
                <br />
                {room.spec}
              </p>
            </article>
          ))}
        </div>

        <p style={{ marginTop: '4rem' }}>
          <Link className="btn" to="/#reserver">
            Réserver
          </Link>{' '}
          <Link className="btn btn--ghost" to="/">
            Retour à l’accueil
          </Link>
        </p>
      </div>
    </div>
  )
}