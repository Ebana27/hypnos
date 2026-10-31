import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'

import SiteFooter from './components/SiteFooter'
import { mountMotion } from './lib/motion'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import RoomsPage from './pages/RoomsPage'
import './App.css'

const LINKS = [
  { to: '/chambres', label: 'Chambres' },
  { to: '/#lieu', label: 'Le lieu' },
]

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const shell = useRef(null)
  const { pathname, hash } = useLocation()

  // L'en-tete se densifie des que la page defile.
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Les animations repartent a chaque changement de page, une fois les
  // polices chargees : SplitText coupe le titre sur les vraies lignes.
  useEffect(() => {
    let cleanup
    let cancelled = false

    document.fonts.ready.then(() => {
      if (!cancelled) cleanup = mountMotion(shell.current)
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [pathname])

  // Une ancre (#lieu, #reserver) doit s'arreter sous l'en-tete fixe. Les
  // images distantes arrivent apres coup et rallongent la page, donc on
  // realigne a chaque chargement -- tant que l'internaute n'a pas repris
  // la main au molette ou au tactile.
  useEffect(() => {
    if (!hash) return
    const target = document.querySelector(hash)
    if (!target) return

    let hijacked = false
    const stop = () => {
      hijacked = true
    }
    const align = () => {
      if (!hijacked) target.scrollIntoView({ block: 'start', behavior: 'instant' })
    }

    requestAnimationFrame(align)

    // `load` est capture : il ne remonte pas jusqu'a `window`.
    document.addEventListener('load', align, true)
    window.addEventListener('wheel', stop, { passive: true, once: true })
    window.addEventListener('touchstart', stop, { passive: true, once: true })

    const timer = window.setTimeout(() => {
      document.removeEventListener('load', align, true)
    }, 3000)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('load', align, true)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
    }
  }, [hash, pathname])

  return (
    <div className="shell" ref={shell}>
      <header className={`site-header${stuck ? ' is-stuck' : ''}`}>
        <div className="wrap site-header__inner">
          <Link to="/" className="wordmark" onClick={() => setMenuOpen(false)}>
            LeCeleste
          </Link>

          <nav className="nav">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="header__actions">
            <Link className="btn" to="/#reserver">
              Réserver
            </Link>
            <button
              type="button"
              className="burger"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="drawer">
          <Link to="/" onClick={() => setMenuOpen(false)}>
            Accueil
          </Link>
          <Link to="/chambres" onClick={() => setMenuOpen(false)}>
            Chambres
          </Link>
          <Link to="/#lieu" onClick={() => setMenuOpen(false)}>
            Le lieu
          </Link>
          <Link className="btn" to="/#reserver" onClick={() => setMenuOpen(false)}>
            Réserver
          </Link>
          <p className="drawer__foot">Marseille — Corniche</p>
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chambres" element={<RoomsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <SiteFooter />
    </div>
  )
}