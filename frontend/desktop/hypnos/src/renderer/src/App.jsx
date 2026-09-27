import { useState } from 'react'
import Onboarding from './components/Onboarding'

const isOnboarding = new URLSearchParams(window.location.search).get('onboarding') === '1'

function App() {
  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(isOnboarding)

  const handleFinish = () => {
    setShowOnboarding(false)
    if (isOnboarding) window.windowControls.onboardingDone()
  }

  if (showOnboarding) {
    return <Onboarding onFinish={handleFinish} />
  }
  // Fin Onboarding

  return (
    <>
      <div className='containerNew'>
        <h1>Bonjour, Hypnos</h1>
        <p>Vous êtes l'hôtel celeste</p>
      </div>
    </>
  )
}

export default App
