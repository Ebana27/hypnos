import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import './styles/onloading.css'

const DESIGN_W = 1111 // taille de la maquette Figma
const DESIGN_H = 400
const onloading_DURATION = 12000 // ms — duree de la barre de progression
const FADE_DURATION = 415 // ms — doit suivre la transition de .onloading

// eslint-disable-next-line react/prop-types
export default function onloading({ onFinish }) {
  const [percent, setPercent] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [scale, setScale] = useState(1)

  // La maquette (1111x491) est reduite/agrandie pour tenir dans la fenetre.
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // onFinish est recree a chaque rendu du parent : on le garde dans une ref
  // pour ne pas relancer l'animation (la barre repartirait de zero).
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    let frame
    let fade
    let done
    const start = performance.now()

    const tick = (now) => {
      const value = Math.min(100, Math.floor(((now - start) / onloading_DURATION) * 100))
      setPercent(value) // React ignore l'appel si la valeur n'a pas change
      if (value < 100) {
        frame = requestAnimationFrame(tick)
      } else {
        // 100% -> on efface l'ecran -> on ouvre la fenetre principale.
        fade = setTimeout(() => setLeaving(true), 150)
        done = setTimeout(() => {
          if (typeof onFinishRef.current === 'function') {
            onFinishRef.current()
          } else if (typeof window.electronAPI?.finishonloading === 'function') {
            window.electronAPI.finishonloading()
          } else {
            console.error(
              'Impossible de terminer l’onloading : aucune méthode IPC disponible.'
            )
          }
        }, 150 + FADE_DURATION)
      }
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [])

  return (
    <div className={`onloading${leaving ? ' onloading--leaving' : ''}`}>
      <span className="onloading-drag" />
      <button
        className="onloading-close"
        aria-label="Fermer"
        onClick={() => window.windowControls.close()}
      >
        ×
      </button>

      <div className="onloading-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="onloading-circle onloading-circle--main" />
        <div className="onloading-circle onloading-circle--side" />

        <p className="onloading-percent">{percent}%</p>

        <div
          className="onloading-track"
          role="progressbar"
          aria-label="Chargement"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="onloading-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  )
}
