// ============================================================
//  Outils partagés des réservations (liste, planning, accueil)
// ============================================================

export const DEVISE = 'XAF'

const JOUR_MS = 86_400_000
const deuxChiffres = (n) => String(n).padStart(2, '0')

// ---------- Dates ----------
// Stockées en texte « AAAA-MM-JJ », lues à minuit, heure locale.
export const jourDe = (texte) => {
  const [a, m, j] = String(texte).slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, j)
}
export const cleJour = (date) =>
  `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`
export const aujourdhui = () => jourDe(cleJour(new Date()))
export const ajouterJours = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
export const ecartJours = (a, b) => Math.round((b.getTime() - a.getTime()) / JOUR_MS)
export const nuitsEntre = (debut, fin) => Math.max(1, ecartJours(jourDe(debut), jourDe(fin)))

// ---------- Formats ----------
export const formatCourt = (date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
export const formatArgent = (n) => Math.round(n).toLocaleString('fr-FR')
export const libelleNuits = (n) => `${n} nuit${n > 1 ? 's' : ''}`

// ---------- Statuts ----------
// Fond et texte tirés des jetons de base.css.
export const STATUTS_RESERVATION = {
  en_attente: {
    libelle: 'En attente de paiement',
    fond: 'var(--color-warning)',
    texte: 'var(--onyx)'
  },
  confirmee: {
    libelle: 'Confirmée',
    fond: 'var(--color-accent-soft)',
    texte: 'var(--onyx)'
  },
  en_sejour: {
    libelle: 'En séjour',
    fond: 'var(--color-accent)',
    texte: 'var(--color-accent-contrast)'
  },
  terminee: {
    libelle: 'Terminée',
    fond: 'var(--color-success)',
    texte: 'var(--white)'
  },
  annulee: {
    libelle: 'Annulée',
    fond: 'var(--color-background-mute)',
    texte: 'var(--color-text-muted)'
  }
}
export const ORDRE_STATUTS = ['en_attente', 'confirmee', 'en_sejour', 'terminee', 'annulee']

// Statuts qui bloquent une chambre (même liste que le processus principal)
export const STATUTS_ACTIFS = ['en_attente', 'confirmee', 'en_sejour']

// ---------- Canaux ----------
export const CANAUX = {
  direct: 'Direct / réception',
  telephone: 'Téléphone / WhatsApp',
  booking: 'Booking.com',
  entreprise: 'Entreprise / agence',
  site: "Site de l'hôtel"
}
export const CANAUX_ABREGE = { direct: 'DR', telephone: 'TW', booking: 'BK', entreprise: 'EA', site: 'WEB' }

// ---------- Clients ----------
export const nomClient = (c) => (c ? `${c.sexe === 'F' ? 'Mme' : 'M.'} ${c.nom}` : 'Client inconnu')
export const initiales = (c) => (c ? `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase() : '?')

// ---------- Disponibilité ----------
// Vrai si une réservation active occupe déjà la chambre sur la période.
// Une arrivée le jour d'un départ n'est pas un conflit (fin == début).
export function enConflit(reservations, { chambreId, debut, fin }, ignorerId = null) {
  return reservations.some(
    (o) =>
      o.id !== ignorerId &&
      o.chambreId === chambreId &&
      STATUTS_ACTIFS.includes(o.statut) &&
      debut < o.dateFin &&
      fin > o.dateDebut
  )
}

// ---------- Montants ----------
export function totaux({ dateDebut, dateFin, montantPaye = 0 }, prixNuit, consommations = []) {
  const hebergement = nuitsEntre(dateDebut, dateFin) * prixNuit
  const services = consommations.reduce((somme, c) => somme + (c.montant ?? 0), 0)
  const total = hebergement + services
  return { hebergement, services, total, reste: total - montantPaye }
}