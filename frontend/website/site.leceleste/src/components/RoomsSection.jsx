import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { gsap } from '../lib/motion'
import { ROOMS } from '../data/hotel'

/**
 * Liste editoriale : pas de vignette de carte, seulement une image qui
 * suit le curseur. L'etat (position, opacite, echelle) appartient
 * entierement a GSAP, le CSS ne pose aucun transform.
 */
function RoomRow({ room }) {
  const row = useRef(null)
  const preview = useRef(null)

  useEffect(() => {
    const element = row.current
    const thumb = preview.current
    if (!element || !thumb || window.matchMedia('(hover: none)').matches) return

    gsap.set(thumb, { xPercent: -50, yPercent: -50, scale: 0.85, opacity: 0 })

    const moveX = gsap.quickTo(thumb, 'x', { duration: 0.55, ease: 'power3' })
    const moveY = gsap.quickTo(thumb, 'y', { duration: 0.55, ease: 'power3' })
    const show = () =>
      gsap.to(thumb, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' })
    const hide = () =>
      gsap.to(thumb, { opacity: 0, scale: 0.85, duration: 0.35, ease: 'power2.in' })

    const onMove = (event) => {
      moveX(event.clientX)
      moveY(event.clientY)
    }

    element.addEventListener('pointerenter', show)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', hide)

    return () => {
      element.removeEventListener('pointerenter', show)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', hide)
      gsap.killTweensOf(thumb)
    }
  }, [])

  return (
    <article className="room" ref={row}>
      <Link className="room__link" to="/chambres">
        <span className="room__num">{room.num}</span>
        <span className="room__name">{room.name}</span>
        <span className="room__spec">{room.spec}</span>
        <span className="room__price">{room.price}</span>
      </Link>

      <div className="room__preview" ref={preview} aria-hidden="true">
        <img src={room.image(640)} alt="" loading="lazy" />
      </div>
    </article>
  )
}

export default function RoomsSection() {
  return (
    <section className="rooms" id="chambres">
      <div className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow" data-reveal>
              Les chambres
            </p>
            <h2 className="h2" data-reveal>
              Six façons de dormir ici
            </h2>
          </div>
          <Link className="btn btn--ghost" to="/chambres" data-reveal>
            Tout voir
          </Link>
        </div>

        {ROOMS.slice(0, 4).map((room) => (
          <RoomRow key={room.num} room={room} />
        ))}
      </div>
    </section>
  )
}