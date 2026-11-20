import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, X } from 'lucide-react'

const ROLES = { administrateur: 'Administrateur', receptionniste: 'Réceptionniste' }
const ACTIVE = new Set(['confirmee', 'en_sejour'])
const formatLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const borne = (value, time) => {
  const s = String(value ?? '')
  if (!s) return ''
  return s.length === 10 ? `${s}T${time}` : s.slice(0, 16).replace(' ', 'T')
}
const horaireLisible = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'horaire prévu dépassé'
    : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
function libelleNotifications(nombre) {
  if (nombre === 0) return 'Aucune notification'
  return `${nombre} notification${nombre > 1 ? 's' : ''}`
}

const STYLES = `
.topbar { display:flex; justify-content:space-between; align-items:center; gap:20px; width:100%; margin-top:24px; padding:10px 20px 16px 0; }
.topbar__search { display:flex; align-items:center; flex:1; gap:10px; max-width:460px; padding:10px 16px; border:1px solid var(--color-border); border-radius:var(--radius-pill); background:var(--color-surface); color:var(--color-text-muted); }
.topbar__search:focus-within { border-color:var(--color-accent); }
.topbar__search input { width:100%; border:0; outline:0; background:none; font:inherit; font-size:13px; color:var(--color-text); }
.topbar__droite { display:flex; align-items:center; gap:14px; }
.topbar__notif-conteneur { position:relative; }
.topbar__notif { position:relative; display:grid; place-items:center; width:38px; height:38px; border:1px solid var(--color-border); border-radius:50%; background:var(--color-surface); color:var(--color-text); cursor:pointer; }
.topbar__notif:hover,.topbar__notif[aria-expanded='true'] { border-color:var(--color-accent); background:var(--color-accent-wash); color:var(--color-accent); }
.topbar__pastille { position:absolute; top:-4px; right:-4px; display:grid; place-items:center; min-width:16px; height:16px; padding:0 4px; border-radius:var(--radius-pill); background:var(--color-accent); color:var(--color-accent-contrast); font-size:10px; font-weight:700; }
.topbar__notifications { position:absolute; top:calc(100% + 12px); right:-8px; z-index:4000; width:min(380px,calc(100vw - 32px)); overflow:hidden; border:1px solid var(--color-border); border-radius:var(--radius-m); background:var(--color-surface); color:var(--color-text); box-shadow:var(--color-shadow); }
.topbar__notifications-entete { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:15px 16px; border-bottom:1px solid var(--color-border); }
.topbar__notifications-titre { margin:0; font-family:var(--font-display); font-size:15px; font-weight:600; }
.topbar__notifications-fermer { display:grid; place-items:center; width:30px; height:30px; border:0; border-radius:50%; background:transparent; color:var(--color-text-muted); cursor:pointer; }
.topbar__notifications-liste { display:grid; gap:0; max-height:360px; overflow:auto; margin:0; padding:0; list-style:none; }
.topbar__notification { display:block; width:100%; padding:12px 16px; border:0; border-bottom:1px solid var(--color-border); background:transparent; color:var(--color-text-muted); font:inherit; font-size:12px; line-height:1.45; text-align:left; cursor:pointer; }
.topbar__notification:hover { background:var(--color-accent-wash); }
.topbar__notification strong { display:block; margin-bottom:2px; color:var(--color-text); font-size:13px; }
.topbar__notification--alerte { background:color-mix(in srgb,var(--color-warning) 10%,var(--color-surface)); }
.topbar__notifications-vide { padding:24px 20px 26px; text-align:center; }
.topbar__notifications-vide strong { display:block; font-size:13px; }
.topbar__notifications-vide p { margin:4px 0 0; color:var(--color-text-muted); font-size:12px; line-height:1.5; }
.topbar__profil { display:flex; align-items:center; gap:10px; padding:4px 12px 4px 4px; border:1px solid var(--color-border); border-radius:var(--radius-pill); background:var(--color-surface); }
.topbar__avatar { display:grid; place-items:center; width:30px; height:30px; border-radius:50%; background:var(--color-background-mute); color:var(--color-text-muted); font-size:11px; font-weight:700; }
.topbar__infos { display:flex; flex-direction:column; line-height:1.1; }
.topbar__nom { color:var(--color-text); font-size:13px; font-weight:600; }
.topbar__role { color:var(--color-text-muted); font-size:11px; }
@media (max-width:600px) { .topbar { gap:10px; } .topbar__profil { gap:6px; padding-right:7px; } .topbar__nom { max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } }
`

export default function Topbar() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [chambres, setChambres] = useState([])
  const [reservations, setReservations] = useState([])
  const [hotel, setHotel] = useState(null)
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const conteneurRef = useRef(null)
  const alertesVuesRef = useRef(new Set())

  useEffect(() => {
    let actif = true
    const charger = async () => {
      try {
        const [s, c, r] = await Promise.all([
          window.electronAPI.sessionCourante(),
          window.electronAPI.getAll('chambre'),
          window.electronAPI.getAll('reservation')
        ])
        if (!actif) return
        setSession(s)
        setChambres(c ?? [])
        setReservations(r ?? [])
        setHotel(s?.hotel ?? null)
      } catch { /* La barre reste utilisable tant que la base démarre. */ }
    }
    charger()
    const timer = window.setInterval(charger, 15_000)
    window.addEventListener('hypnos:donnees-mises-a-jour', charger)
    return () => {
      actif = false
      window.clearInterval(timer)
      window.removeEventListener('hypnos:donnees-mises-a-jour', charger)
    }
  }, [])

  const maintenant = new Date()
  const now = formatLocal(maintenant)
  const actives = reservations.filter((r) => ACTIVE.has(r.statut))
  const notifications = []
  for (const chambre of chambres.filter((c) => c.statut === 'nettoyage')) {
    const depuis = chambre.statutDepuis ? new Date(chambre.statutDepuis) : null
    const minutes = depuis && !Number.isNaN(depuis.getTime()) ? Math.max(0, Math.floor((maintenant - depuis) / 60_000)) : null
    const attente = Number(hotel?.margeNettoyageMinutes ?? 60)
    notifications.push({
      id: `nettoyage-${chambre.id}`,
      vers: '/rooms',
      etat: { filtre: 'nettoyage' },
      urgente: minutes !== null && minutes >= attente,
      titre: `Chambre ${chambre.numero} en nettoyage`,
      detail: minutes === null ? 'À traiter : la chambre est marquée en nettoyage.' : `Depuis ${minutes} min${minutes >= attente ? ' — délai prévu dépassé, vérifier le ménage.' : '.'}`
    })
  }
  const chambresParId = new Map(chambres.map((chambre) => [Number(chambre.id), chambre]))
  const heureArrivee = String(hotel?.heureArrivee || '15:00').slice(0, 5)
  const heureDepart = String(hotel?.heureDepart || '11:00').slice(0, 5)
  for (const reservation of reservations) {
    const chambre = chambresParId.get(Number(reservation.chambreId))
    const numeroChambre = chambre?.numero ?? reservation.chambreId
    if (reservation.statut === 'confirmee') {
      const arriveePrevue = borne(reservation.dateDebut, heureArrivee)
      if (arriveePrevue && arriveePrevue <= now) {
        notifications.push({
          id: `retard-arrivee-${reservation.id}`,
          vers: '/booking',
          etat: { recherche: String(numeroChambre) },
          urgente: true,
          ouvrirAutomatiquement: false,
          titre: `Arrivée en retard · chambre ${numeroChambre}`,
          detail: `Arrivée prévue le ${horaireLisible(arriveePrevue)}. Vérifiez la présence du client puis confirmez l’arrivée dans la réservation.`
        })
      }
    } else if (reservation.statut === 'en_sejour') {
      const departPrevu = borne(reservation.dateFin, heureDepart)
      if (departPrevu && departPrevu <= now) {
        notifications.push({
          id: `retard-depart-${reservation.id}`,
          vers: '/booking',
          etat: { recherche: String(numeroChambre) },
          urgente: true,
          ouvrirAutomatiquement: false,
          titre: `Départ en retard · chambre ${numeroChambre}`,
          detail: `Départ prévu le ${horaireLisible(departPrevu)}. Confirmez le départ après la sortie du client.`
        })
      }
    }
  }
  if (chambres.length > 0) {
    const toutesIndisponibles = chambres.every((c) => {
      if (c.statut === 'maintenance' || c.statut === 'nettoyage') return true
      const occupee = actives.some((r) => Number(r.chambreId) === Number(c.id) && borne(r.dateDebut, '15:00') <= now && now < borne(r.dateFin, '11:00'))
      return c.statut === 'occupee' || occupee
    })
    if (toutesIndisponibles) notifications.unshift({ id: 'hotel-complet', vers: '/rooms', urgente: true, titre: 'Aucune chambre disponible', detail: 'Toutes les chambres sont occupées, en nettoyage ou en maintenance.' })
  }

  // Le panneau ne s'ouvre seul que pour une alerte URGENTE jamais montrée :
  // un simple nettoyage en cours ne doit pas surgir au milieu d'une saisie.
  const cleUrgentes = notifications
    .filter((n) => n.urgente && n.ouvrirAutomatiquement !== false)
    .map((n) => n.id)
    .sort()
    .join('|')
  useEffect(() => {
    const nouvelles = cleUrgentes.split('|').filter((id) => id && !alertesVuesRef.current.has(id))
    if (nouvelles.length > 0) {
      nouvelles.forEach((id) => alertesVuesRef.current.add(id))
      setOuvert(true)
    }
  }, [cleUrgentes])

  useEffect(() => {
    if (!ouvert) return undefined
    const fermerExterieur = (event) => { if (!conteneurRef.current?.contains(event.target)) setOuvert(false) }
    const fermerEchap = (event) => { if (event.key === 'Escape') setOuvert(false) }
    document.addEventListener('pointerdown', fermerExterieur)
    document.addEventListener('keydown', fermerEchap)
    return () => { document.removeEventListener('pointerdown', fermerExterieur); document.removeEventListener('keydown', fermerEchap) }
  }, [ouvert])

  // Entrée : ouvre la liste des réservations filtrée sur le terme (client, chambre)
  function lancerRecherche(event) {
    event.preventDefault()
    const terme = recherche.trim()
    if (!terme) return
    navigate('/booking', { state: { recherche: terme } })
    setRecherche('')
  }

  const u = session?.utilisateur
  const nom = u ? `${u.firstName} ${u.lastName}`.trim() || u.username : ''
  const role = ROLES[u?.role] ?? u?.role ?? ''
  return (
    <div className="topbar">
      <style>{STYLES}</style>
      <form className="topbar__search" role="search" onSubmit={lancerRecherche}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder="Rechercher un client, une chambre, une réservation…"
          aria-label="Rechercher un client, une chambre, une réservation"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </form>
      <div className="topbar__droite">
        <div className="topbar__notif-conteneur" ref={conteneurRef}>
          <button type="button" className="topbar__notif" aria-label={libelleNotifications(notifications.length)} aria-expanded={ouvert} aria-controls="panneau-notifications" aria-haspopup="dialog" onClick={() => setOuvert((value) => !value)}>
            <Bell size={18} strokeWidth={1.8} />
            {notifications.length > 0 && (
              <span className="topbar__pastille">
                {notifications.length > 99 ? '99+' : notifications.length}
              </span>
            )}
          </button>
          {ouvert && (
            <section
              className="topbar__notifications"
              id="panneau-notifications"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="topbar__notifications-entete">
                <h2 className="topbar__notifications-titre">Notifications</h2>
                <button
                  type="button"
                  className="topbar__notifications-fermer"
                  aria-label="Fermer les notifications"
                  onClick={() => setOuvert(false)}
                >
                  <X size={16} />
                </button>
              </div>
              {notifications.length ? (
                <ul className="topbar__notifications-liste">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`topbar__notification${n.urgente ? ' topbar__notification--alerte' : ''}`}
                        onClick={() => {
                          setOuvert(false)
                          navigate(n.vers, n.etat ? { state: n.etat } : undefined)
                        }}
                      >
                        <strong>{n.titre}</strong>
                        {n.detail}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="topbar__notifications-vide">
                  <strong>Aucune notification pour le moment</strong>
                  <p>
                    Les alertes de nettoyage, de disponibilité et les retards de séjour apparaîtront ici.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
        <div className="topbar__profil"><span className="topbar__avatar" aria-hidden="true">{nom.charAt(0)}</span><div className="topbar__infos"><span className="topbar__nom">{nom}</span><span className="topbar__role">{role}</span></div></div>
      </div>
    </div>
  )
}
