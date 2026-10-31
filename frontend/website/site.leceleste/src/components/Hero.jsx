import { useEffect } from 'react'

import { gsap } from '../lib/motion'
import { HERO_IMAGE } from '../data/hotel'

const FACTS = [
  { n: '1928', label: 'Maison fondée' },
  { n: '42', label: 'Chambres' },
  { n: '1', label: "Table d'hôtes" },
]

export default function Hero() {
  // Entree de l'image et du cadre. Le titre, lui, est coupe ligne par
  // ligne par mountMotion() -- ici on ne fait que la photo.
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero__media img', {
        scale: 1.12,
        opacity: 0,
        duration: 1.7,
        ease: 'expo.out',
        delay: 0.15,
      })
      gsap.from('.hero__frame', { opacity: 0, duration: 1.4, ease: 'power2.out' })
      gsap.from('.hero__foot > *', {
        opacity: 0,
        duration: 1.1,
        ease: 'power2.out',
        stagger: 0.12,
        delay: 0.9,
      })
    })

    return () => ctx.revert()
  }, [])

  return (
    <section className="hero">
      <div>
        <p className="eyebrow" data-reveal>
          Hôtel — Marseille, corniche
        </p>

        <h1 className="display hero__title">
          <span className="line" data-split>
            Le Céleste
          </span>
          <span className="line" data-split>
            <em>face au large</em>
          </span>
        </h1>

        <p className="hero__sub" data-reveal>
          Hôtel & table d’hôtes
        </p>

        <div className="hero__lede">
          <p className="lead" data-reveal>
            Quarante-deux chambres sur la corniche, une table qui cuisine ce que la mer
            donne le matin, et une terrasse qui ne ferme jamais vraiment.
          </p>

          <div className="hero__actions" data-reveal>
            <a className="btn" href="#reserver">
              Réserver
            </a>
            <a className="btn btn--ghost" href="#chambres">
              Voir les chambres
            </a>
          </div>
        </div>
      </div>

      <div className="hero__visual">
        <div className="hero__frame" />
        <div className="hero__media">
          <img
            src={HERO_IMAGE}
            alt="Façade de l'hôtel LeCeleste au bord de la mer"
            data-parallax
            fetchPriority="high"
          />
        </div>
        <p className="hero__caption">La 12, côté large — 6 h 40</p>
      </div>

      <div className="hero__foot">
        <dl className="hero__facts">
          {FACTS.map((fact) => (
            <div className="fact" key={fact.label}>
              <dt>{fact.n}</dt>
              <dd>{fact.label}</dd>
            </div>
          ))}
        </dl>

        <span className="scroll-cue">
          Défiler
          <i />
        </span>
      </div>
    </section>
  )
}