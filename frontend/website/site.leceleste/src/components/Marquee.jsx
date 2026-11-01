import { useEffect, useRef } from 'react'
import { animate } from 'animejs'

import { gsap } from '../lib/motion'

const WORDS = [
  'Chambres & suites',
  'Table d’hôtes',
  'Terrasse',
  'Piscine',
  'Petit-déjeuner',
  'Vélos',
]

export default function Marquee() {
  const marquee = useRef(null)
  const track = useRef(null)

  // animejs fait tourner la bande. Le contenu est duplique et la piste
  // parcourt -50% : la boucle est invisible.
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(marquee.current, { opacity: 1, duration: 0.9, ease: 'power2.out' })
    })

    const instance = animate(track.current, {
      x: ['0%', '-50%'],
      duration: 28000,
      ease: 'linear',
      loop: true,
    })

    return () => {
      ctx.revert()
      instance.pause()
    }
  }, [])

  return (
    <div className="marquee" ref={marquee} aria-hidden="true">
      <div className="marquee__track" ref={track}>
        {[...WORDS, ...WORDS].map((word, index) => (
          <span key={`${word}-${index}`}>{word}</span>
        ))}
      </div>
    </div>
  )
}