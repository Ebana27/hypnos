import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitText from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export { gsap, ScrollTrigger }

/**
 * Pose les animations au montage d'une page :
 *   [data-split]    titre masque, les lignes montent une a une
 *   [data-reveal]   apparition au scroll (l'etat de depart est en CSS)
 *   [data-parallax] image qui glisse plus lentement que la page
 *
 * Tout est encapsule dans un contexte GSAP : le retour `ctx.revert()`
 * supprime les timelines et les ScrollTrigger de la page precedente.
 */
export function mountMotion(scope) {
  const ctx = gsap.context(() => {
    gsap.utils.toArray('[data-split]').forEach((el) => {
      const split = SplitText.create(el, { type: 'lines', mask: 'lines' })
      gsap.from(split.lines, {
        yPercent: 118,
        duration: 1.35,
        ease: 'expo.out',
        stagger: 0.09,
      })
    })

    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      })
    })

    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      gsap.fromTo(
        el,
        { yPercent: -7 },
        {
          yPercent: 7,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
    })

    ScrollTrigger.refresh()
  }, scope)

  return () => ctx.revert()
}