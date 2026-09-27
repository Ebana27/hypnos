import { useEffect } from 'react'

const ONBOARDING_DURATION = 5000 // ms — modifiable ici

// eslint-disable-next-line react/prop-types
export default function Onboarding({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, ONBOARDING_DURATION)
    return () => clearTimeout(timer)
  }, [onFinish])

  return (
    <div className="onboarding">
      <div className="titlebar">
        <span className="titlebar-drag" />
        <button onClick={() => window.windowControls.minimize()}>—</button>
        <button onClick={() => window.windowControls.close()}>×</button>
      </div>

      <div className="onboarding-content">
        <svg viewBox="0 0 100 100" width="120" height="120">
          <g className="rotating-key">
            {/* remplace par ton tracé de clé ou de lys */}
            <circle cx="50" cy="30" r="15" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="46" y="45" width="8" height="35" fill="currentColor" />
          </g>
        </svg>
        <h1>Hypnos</h1>
      </div>
    </div>
  )
}
