import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

import { ScrollTrigger } from '../lib/motion'

/**
 * Alpine gere le formulaire : les deux dates et le nombre de nuits
 * calcule sont de son ressort, React ne les touche pas.
 */
const STATE = `{
  arrivee: '',
  depart: '',
  voyageurs: 2,
  get nuitees() {
    if (!this.arrivee || !this.depart) return 0
    const nights = (new Date(this.depart) - new Date(this.arrivee)) / 86400000
    return nights > 0 ? Math.round(nights) : 0
  },
}`

const NUIT = "nuitees + ' nuit' + (nuitees > 1 ? 's' : '')"
const VOYAGEUR = "voyageurs + ' voyageur' + (voyageurs > 1 ? 's' : '')"

export default function Booking() {
  const counter = useRef(null)

  // animejs compte le nombre de chambres quand la section atteint
  // l'ecran ; c'est ScrollTrigger qui declenche.
  useEffect(() => {
    const target = counter.current
    if (!target) return

    const state = { value: 0 }
    const trigger = ScrollTrigger.create({
      trigger: target,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        animate(state, {
          value: 42,
          duration: 1900,
          ease: 'outExpo',
          onUpdate: () => {
            target.textContent = Math.round(state.value)
          },
        }),
    })

    return () => trigger.kill()
  }, [])

  return (
    <section className="booking" id="reserver">
      <div className="wrap booking__grid">
        <div>
          <p className="eyebrow eyebrow--light" data-reveal>
            Réservation
          </p>
          <h2 className="h2" data-reveal>
            Choisissez
            <br />
            vos dates.
          </h2>
          <p className="lead lead--light" data-reveal>
            <span ref={counter}>42</span> chambres, de la plus discrète à la plus exposée.
            Réservation sans carte bancaire, confirmation le jour même.
          </p>
        </div>

        <form
          className="booking__form"
          {...{ 'x-data': STATE }}
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="field">
            <span>Arrivée</span>
            <input type="date" {...{ 'x-model': 'arrivee' }} />
          </label>

          <label className="field">
            <span>Départ</span>
            <input type="date" {...{ 'x-model': 'depart' }} />
          </label>

          <label className="field">
            <span>Voyageurs</span>
            <input type="number" min="1" max="6" {...{ 'x-model': 'voyageurs' }} />
          </label>

          <div className="booking__foot">
            <p className="booking__total">
              <span {...{ 'x-text': NUIT }} />
              {' · '}
              <span {...{ 'x-text': VOYAGEUR }} />
            </p>
            <button type="submit" className="btn btn--light">
              Vérifier la disponibilité
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}