import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/base/SideBar'
import TiltleBar from './components/base/TiltleBar'
import Topbar from './components/TopBar'

import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Onloading from './components/Onloading'
import Register from './components/Register'

import ClientPage from './pages/ClientPage'
import HomePage from './pages/HomePage'
import AccountingPage from './pages/AccountingPage'
import BookingPage from './pages/BookingPage'
import CommunicationPage from './pages/CommunicationPage'
import ParamPage from './pages/ParamPage'
import RapportPage from './pages/RapportPage'
import RoomPage from './pages/RoomPage'
import ServicePage from './pages/ServicePage'

// Le processus principal ouvre chaque fenêtre avec un drapeau dans l'adresse :
//  ?onloading=1  écran de chargement
//  ?onboarding=1 premier lancement : présentation puis création de l'hôtel
//  ?login=1      connexion
// Ce drapeau est placé avant le # : il faut lire window.location.search.
const params = new URLSearchParams(window.location.search)
const isOnloading = params.has('onloading')
const isOnboarding = params.has('onboarding')
const isLogin = params.has('login')

function PremierLancement() {
  const [ecran, setEcran] = useState('presentation')

  if (ecran === 'presentation') return <Onboarding onFinish={() => setEcran('creation')} />
  return <Register onTermine={() => window.windowControls.setupDone()} />
}

function AppContent() {
  if (isOnloading) return <Onloading onFinish={() => window.windowControls.onloadingDone()} />
  if (isOnboarding) return <PremierLancement />
  if (isLogin) return <Login />

  return (
    <div className="app-layout">
      <TiltleBar />
      <div className="app-body">
        <Sidebar />
        <div className="app-main">
          <Topbar />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/clients" element={<ClientPage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/communication" element={<CommunicationPage />} />
              <Route path="/param" element={<ParamPage />} />
              <Route path="/planning" element={<BookingPage vueInitiale="planning" pleinEcran />} />
              <Route path="/rapports" element={<RapportPage />} />
              <Route path="/rooms" element={<RoomPage />} />
              <Route path="/services" element={<ServicePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}