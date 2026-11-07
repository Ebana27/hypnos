// ============================================================
//  Outils partagés des réservations (liste, planning, accueil)
// ============================================================

export const DEVISE = 'XAF'
// Un « passage » ne peut pas dépasser une journée : au-delà, c'est une nuitée.
export const DUREE_MAX_PASSAGE_H = 24

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

// Le format historique AAAA-MM-JJ reste lisible; les nouveaux séjours horaires
// sont stockés en ISO local « AAAA-MM-JJTHH:mm » pour conserver l'ordre lexical SQLite.
export const valeurDateHeure = (valeur, heureDefaut = '15:00') => {
  const texte = String(valeur ?? '')
  if (!texte) return ''
  if (texte.length === 10) return `${texte}T${heureDefaut}`
  return texte.slice(0, 16)
}
export const dateLocalePourInput = (valeur, heureDefaut = '15:00') => valeurDateHeure(valeur, heureDefaut)
export const dateJourPourInput = (valeur) => String(valeur ?? '').slice(0, 10)
// Date locale → « AAAA-MM-JJTHH:mm » (valeur d'un champ datetime-local)
export const versLocal = (d) =>
  `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}T${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`
export const heuresEntre = (debut, fin) => Math.max(0, (new Date(fin).getTime() - new Date(debut).getTime()) / 3600000)

export const libelleHeures = (h) => {
  const n = Math.round(h * 10) / 10
  return `${n.toLocaleString('fr-FR')} heure${n > 1 ? 's' : ''}`
}

// Passage plafonné au prix de la nuitée (par tranche de 24 h) : jamais plus cher qu'une nuit.
export function montantPassage(heures, regle, tarifHeure, tarifNuit) {
  const unites = regle === 'heure_commencee' ? Math.ceil(heures) : heures
  const brut = Math.round(unites * Number(tarifHeure || 0))
  const plafond = Number(tarifNuit || 0) * Math.max(1, Math.ceil(heures / 24))
  const montant = plafond > 0 ? Math.min(brut, plafond) : brut
  return { montant, plafonne: montant < brut }
}

export const prixSejour = ({ debut, fin, typeSejour = 'nuit', modeTarif = 'nuit', regleArrondi = 'prorata', tarif }, tarifNuit = 0) => {
  if (typeSejour === 'nuit') {
    return nuitsEntre(debut, fin) * Number(tarifNuit || 0)
  }
  if (modeTarif === 'acces_reservation' || modeTarif === 'acces_entree') return Number(tarif || 0)
  return montantPassage(heuresEntre(debut, fin), regleArrondi, tarif, tarifNuit).montant
}

// ---------- Formats ----------
export const formatCourt = (date) =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
export const formatArgent = (n) => Math.round(n).toLocaleString('fr-FR')
export const libelleNuits = (n) => `${n} nuit${n > 1 ? 's' : ''}`

// ---------- Statuts ----------
// Fond et texte tirés des jetons de base.css.
export const STATUTS_RESERVATION = {
  // Calculé, jamais enregistré : séjour terminé avec un reste à payer (voir statutAffiche)
  paiement_attente: {
    libelle: 'Paiement en attente',
    fond: 'var(--color-warning)',
    texte: 'var(--onyx)'
  },
  // Ancien statut : gardé pour afficher d'éventuelles anciennes lignes sans erreur
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
export const ORDRE_STATUTS = ['paiement_attente', 'confirmee', 'en_sejour', 'terminee', 'annulee']

// Statuts qui bloquent une chambre (même liste que le processus principal)
export const STATUTS_ACTIFS = ['confirmee', 'en_sejour']

// Séjour terminé mais pas entièrement payé : affiché « Paiement en attente »
export const statutAffiche = (statut, reste) =>
  statut === 'terminee' && reste > 0 ? 'paiement_attente' : statut

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
const BORNE_DEBUT = (valeur) => {
  const texte = String(valeur ?? '')
  return texte.length === 10 ? `${texte}T15:00` : texte.slice(0, 16)
}
const BORNE_FIN = (valeur) => {
  const texte = String(valeur ?? '')
  return texte.length === 10 ? `${texte}T11:00` : texte.slice(0, 16)
}

// Intervalles semi-ouverts : un départ à l'heure exacte d'une arrivée suivante est permis.
export function enConflit(reservations, { chambreId, debut, fin }, ignorerId = null) {
  const debutCandidat = BORNE_DEBUT(debut)
  const finCandidat = BORNE_FIN(fin)
  return reservations.some((o) => {
    if (o.id === ignorerId || Number(o.chambreId) !== Number(chambreId) || !STATUTS_ACTIFS.includes(o.statut)) return false
    return debutCandidat < BORNE_FIN(o.dateFin) && finCandidat > BORNE_DEBUT(o.dateDebut)
  })
}

// Hors service : jamais. En nettoyage : refusée seulement pour une arrivée aujourd'hui ou avant
// (une arrivée dans les jours suivants laisse le temps de nettoyer).
export const chambreReservable = (chambre, debut) => {
  if (chambre.statut === 'maintenance') return false
  if (chambre.statut === 'nettoyage') return String(debut ?? '').slice(0, 10) > cleJour(new Date())
  return true
}

// ---------- Montants ----------
// Le journal de caisse est la source de vérité pour les encaissements liés à une réservation.
// montantPaye reste un repli pour les anciennes données sans mouvement détaillé.
export function montantPayeEffectif(reservation, mouvements = []) {
  const enregistre = Number(reservation?.montantPaye ?? 0)
  const mouvementsPaiement = mouvements.filter((m) => ['acompte', 'paiement_client', 'remboursement_acompte'].includes(m.categorie))
  if (mouvementsPaiement.length === 0) return Math.max(0, enregistre)
  const netJournal = mouvementsPaiement.reduce(
    (total, m) => total + (m.type === 'sortie' ? -1 : 1) * Number(m.montant || 0),
    0
  )
  return Math.max(0, netJournal)
}

export function totaux(reservation, prixNuit, consommations = []) {
  const { dateDebut, dateFin, montantPaye = 0, typeSejour = 'nuit', modeTarif = 'nuit', regleArrondi = 'prorata', tarifApplique = 0, nombreAcces = 1 } = reservation
  let hebergement
  let plafonne = false
  if (typeSejour === 'nuit') {
    hebergement = nuitsEntre(dateDebut, dateFin) * Number(tarifApplique || prixNuit || 0)
  } else if (modeTarif === 'acces_reservation') {
    hebergement = Number(tarifApplique || 0)
  } else if (modeTarif === 'acces_entree') {
    hebergement = Number(tarifApplique || 0) * Math.max(1, Number(nombreAcces || 1))
  } else {
    const p = montantPassage(heuresEntre(dateDebut, dateFin), regleArrondi, tarifApplique, prixNuit)
    hebergement = p.montant
    plafonne = p.plafonne
  }
  const services = consommations.reduce((somme, c) => somme + (Number(c.montant) || 0), 0)
  const total = hebergement + services
  return { hebergement, services, total, reste: total - montantPaye, plafonne }
}