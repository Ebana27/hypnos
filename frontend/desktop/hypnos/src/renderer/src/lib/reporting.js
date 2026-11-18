import { cleJour, montantPayeEffectif, totaux } from './reservations'

const RECETTES = new Set(['acompte', 'paiement_client', 'service'])
const REMBOURSEMENTS = new Set(['remboursement_acompte'])
const HEURE_ARRIVEE_DEFAUT = '15:00'
const HEURE_DEPART_DEFAUT = '11:00'

export function dateHeureLocale(valeur, heureDefaut = '00:00') {
  const texte = String(valeur ?? '').trim()
  if (!texte) return null
  const valeurLocale = texte.length === 10 ? `${texte}T${heureDefaut}` : texte.slice(0, 16)
  const date = new Date(valeurLocale)
  return Number.isNaN(date.getTime()) ? null : date
}

const debutReservation = (r) => dateHeureLocale(r.dateDebut, HEURE_ARRIVEE_DEFAUT)
const finReservation = (r) => dateHeureLocale(r.dateFin, HEURE_DEPART_DEFAUT)
const dateDuJour = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const plusJours = (date, n) => {
  const resultat = new Date(date)
  resultat.setDate(resultat.getDate() + n)
  return resultat
}
const jourChevaucheSejour = (reservation, jour) => {
  const debut = debutReservation(reservation)
  const fin = finReservation(reservation)
  if (!debut || !fin) return false
  const demain = plusJours(jour, 1)
  return debut < demain && fin > jour
}
const heureLisible = (date) => date?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? '—'
const dateLisible = (date) => date?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) ?? '—'

function montantReservation(reservation, typesParId, chambresParId, consosParReservation, servicesParId) {
  const chambre = chambresParId[reservation.chambreId]
  const type = typesParId[chambre?.typeId]
  const consommations = (consosParReservation[reservation.id] ?? []).map((consommation) => {
    const service = servicesParId[consommation.serviceId]
    const montant = Number(consommation.montant) > 0
      ? Number(consommation.montant)
      : Number(service?.prixUnitaire || 0) * Number(consommation.quantite || 1)
    return { ...consommation, montant }
  })
  const paiements = reservation.mouvementsPaiement ?? []
  const montantPaye = montantPayeEffectif(reservation, paiements)
  const resultat = totaux({ ...reservation, montantPaye }, Number(type?.prix || 0), consommations)
  return {
    total: Math.max(0, Number(resultat.total || 0)),
    paye: Math.max(0, Number(montantPaye || 0)),
    reste: Math.max(0, Number(resultat.total || 0) - Number(montantPaye || 0))
  }
}

function echeancePaiement(reservation) {
  const debut = debutReservation(reservation)
  const fin = finReservation(reservation)
  switch (reservation.conditionsPaiement) {
    case 'prepayee':
    case 'total_arrivee':
      return debut
    case 'acompte_solde':
      return fin
    case 'facturation_societe':
      // Le contrat de facturation d'entreprise n'a pas d'échéance stockée : ne pas inventer un retard.
      return null
    default:
      // Les anciennes réservations n'ont pas toujours de conditions saisies. Un séjour clôturé
      // non réglé est néanmoins exigible à partir de son départ réel/prévu.
      return reservation.statut === 'terminee' ? fin : null
  }
}

function dureeRetard(debut, maintenant) {
  if (!debut || debut >= maintenant) return ''
  const minutes = Math.max(1, Math.floor((maintenant.getTime() - debut.getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min de retard`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `${heures} h de retard`
  const jours = Math.floor(heures / 24)
  return `${jours} j ${heures % 24} h de retard`
}

export function calculerRapport(donnees, jours = 30, horloge = new Date()) {
  if (!donnees) return null
  const maintenant = new Date(horloge)
  const aujourdHui = dateDuJour(maintenant)
  const debutPeriode = plusJours(aujourdHui, -(jours - 1))
  const resas = (donnees.reservations ?? []).filter((r) => r.statut !== 'annulee')
  const chambres = donnees.chambres ?? []
  const chambresParId = Object.fromEntries(chambres.map((c) => [c.id, c]))
  const typesParId = Object.fromEntries((donnees.types ?? []).map((t) => [t.id, t]))
  const clientsParId = Object.fromEntries((donnees.clients ?? []).map((c) => [c.id, c]))
  const servicesParId = Object.fromEntries((donnees.services ?? []).map((s) => [s.id, s]))
  const consosParReservation = {}
  for (const consommation of donnees.consommations ?? []) {
    if (consommation.reservationId != null) {
      (consosParReservation[consommation.reservationId] ??= []).push(consommation)
    }
  }
  const mouvementsParReservation = {}
  for (const mouvement of donnees.mouvements ?? []) {
    if (mouvement.reservationId != null && ['acompte', 'paiement_client', 'remboursement_acompte'].includes(mouvement.categorie)) {
      (mouvementsParReservation[mouvement.reservationId] ??= []).push(mouvement)
    }
  }
  const enrichies = resas.map((r) => {
    const mouvementsPaiement = mouvementsParReservation[r.id] ?? []
    const soldes = montantReservation({ ...r, mouvementsPaiement }, typesParId, chambresParId, consosParReservation, servicesParId)
    const echeance = echeancePaiement(r)
    const retardPaiement = soldes.reste > 0 && echeance !== null && echeance < maintenant
    const client = clientsParId[r.clientId]
    return {
      ...r,
      ...soldes,
      echeance,
      retardPaiement,
      clientNom: client ? `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() : 'Client non renseigné',
      chambreNumero: chambresParId[r.chambreId]?.numero ?? '—',
      dateDebutReelle: debutReservation(r),
      dateFinReelle: finReservation(r)
    }
  })

  const mouvementsRecettes = (donnees.mouvements ?? []).filter((m) =>
    (m.type === 'entree' && RECETTES.has(m.categorie)) || (m.type === 'sortie' && REMBOURSEMENTS.has(m.categorie))
  )
  const dateDebutCle = cleJour(debutPeriode)
  const lendemainCle = cleJour(plusJours(aujourdHui, 1))
  const mouvementsPeriode = mouvementsRecettes.filter((m) => {
    const jour = String(m.dateMouvement ?? '').slice(0, 10)
    return jour >= dateDebutCle && jour < lendemainCle
  })
  const brutEncaisse = mouvementsPeriode
    .filter((m) => m.type === 'entree')
    .reduce((somme, m) => somme + Number(m.montant || 0), 0)
  const remboursements = mouvementsPeriode
    .filter((m) => m.type === 'sortie')
    .reduce((somme, m) => somme + Number(m.montant || 0), 0)
  const encaisseNet = brutEncaisse - remboursements
  const nombreReservations = resas.filter((r) => {
    const jour = String(r.dateDebut ?? '').slice(0, 10)
    return jour >= dateDebutCle && jour < lendemainCle
  }).length

  const detailsParJour = Array.from({ length: jours }, (_, index) => {
    const jour = plusJours(debutPeriode, index)
    const cle = cleJour(jour)
    const lendemain = cleJour(plusJours(jour, 1))
    const mouvementsJour = mouvementsRecettes.filter((m) => String(m.dateMouvement ?? '').slice(0, 10) === cle)
    const recette = mouvementsJour
      .reduce((somme, m) => somme + (m.type === 'sortie' ? -1 : 1) * Number(m.montant || 0), 0)
    const chambresOccupees = new Set(resas
      .filter((r) => jourChevaucheSejour(r, jour))
      .map((r) => Number(r.chambreId)))
    const occupation = chambres.length ? Math.round(chambresOccupees.size / chambres.length * 100) : 0
    return {
      cle,
      label: jour.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      date: jour,
      encaissement: recette,
      occupation,
      reservations: resas.filter((r) => String(r.dateDebut ?? '').slice(0, 10) === cle).length,
      lendemain
    }
  })

  const aujourdHuiCle = cleJour(aujourdHui)
  const dansSeptJours = cleJour(plusJours(aujourdHui, 7))
  const arriveesEnRetard = enrichies.filter((r) =>
    r.statut === 'confirmee' && r.dateDebutReelle && r.dateDebutReelle < maintenant
  ).sort((a, b) => a.dateDebutReelle - b.dateDebutReelle)
  const departsenRetard = enrichies.filter((r) =>
    r.statut === 'en_sejour' && r.dateFinReelle && r.dateFinReelle < maintenant
  ).sort((a, b) => a.dateFinReelle - b.dateFinReelle)
  const arriveesAVenir = enrichies.filter((r) => {
    const jour = String(r.dateDebut ?? '').slice(0, 10)
    return r.statut === 'confirmee' && jour >= aujourdHuiCle && jour <= dansSeptJours
  }).sort((a, b) => (a.dateDebutReelle ?? 0) - (b.dateDebutReelle ?? 0))
  const departAujourdhui = enrichies.filter((r) =>
    r.statut === 'en_sejour' && String(r.dateFin ?? '').slice(0, 10) === aujourdHuiCle
  ).sort((a, b) => (a.dateFinReelle ?? 0) - (b.dateFinReelle ?? 0))
  const creances = enrichies.filter((r) => r.reste > 0).sort((a, b) => b.reste - a.reste)
  const creancesEnRetard = creances.filter((r) => r.retardPaiement)
  const totalARecouvrer = creances.reduce((somme, r) => somme + r.reste, 0)
  const totalEnRetard = creancesEnRetard.reduce((somme, r) => somme + r.reste, 0)

  const modesPaiement = {}
  for (const mouvement of mouvementsPeriode) {
    const cle = mouvement.modePaiement || 'non_renseigne'
    modesPaiement[cle] = (modesPaiement[cle] ?? 0) + (mouvement.type === 'sortie' ? -1 : 1) * Number(mouvement.montant || 0)
  }
  const entreesParCategorie = {}
  for (const mouvement of mouvementsPeriode) {
    const cle = mouvement.categorie
    entreesParCategorie[cle] = (entreesParCategorie[cle] ?? 0) + (mouvement.type === 'sortie' ? -1 : 1) * Number(mouvement.montant || 0)
  }
  const compteursChambres = { occupee: 0, disponible: 0, nettoyage: 0, maintenance: 0 }
  for (const chambre of chambres) compteursChambres[chambre.statut] = (compteursChambres[chambre.statut] ?? 0) + 1
  const occupationMoyenne = detailsParJour.length
    ? Math.round(detailsParJour.reduce((somme, item) => somme + item.occupation, 0) / detailsParJour.length)
    : 0

  return {
    maintenant,
    periode: { debut: debutPeriode, fin: aujourdHui, jours },
    encaissements: { brut: brutEncaisse, remboursements, net: encaisseNet },
    nombreReservations,
    occupationMoyenne,
    nombreChambres: chambres.length,
    detailsParJour,
    modesPaiement: Object.entries(modesPaiement).map(([mode, montant]) => ({ mode, montant })).sort((a, b) => b.montant - a.montant),
    categoriesCaisse: Object.entries(entreesParCategorie).map(([categorie, montant]) => ({ categorie, montant })).sort((a, b) => b.montant - a.montant),
    compteursChambres,
    arriveesEnRetard,
    departsenRetard,
    arriveesAVenir,
    departAujourdhui,
    creances,
    creancesEnRetard,
    totalARecouvrer,
    totalEnRetard,
    donneesManquantesPourEcheances: creances.filter((r) => !r.echeance).length
  }
}

export function retardLisible(reservation, maintenant = new Date(), type = 'arrivee') {
  const date = type === 'depart'
    ? reservation.dateFinReelle
    : type === 'echeance'
      ? reservation.dateEcheance ?? reservation.dateDebutReelle
      : reservation.dateDebutReelle ?? reservation.dateFinReelle
  return dureeRetard(date, maintenant)
}

export function heureReservationLisible(valeur, heureDefaut) {
  return heureLisible(dateHeureLocale(valeur, heureDefaut))
}

export function dateReservationLisible(valeur, heureDefaut) {
  const date = dateHeureLocale(valeur, heureDefaut)
  return date ? `${dateLisible(date)} · ${heureLisible(date)}` : '—'
}

export function formatModePaiement(mode) {
  return ({
    especes: 'Espèces',
    carte: 'Carte',
    mtn_money: 'MTN MoMo',
    airtel_money: 'Airtel Money',
    non_renseigne: 'Non renseigné'
  })[mode] ?? String(mode).replaceAll('_', ' ')
}

export function formatCategorieCaisse(categorie) {
  return ({
    acompte: 'Acomptes',
    paiement_client: 'Règlements clients',
    service: 'Services',
    remboursement_acompte: 'Remboursements',
    don: 'Dons',
    renforcement_patron: 'Renforcement caisse',
    autre_entree: 'Autres entrées'
  })[categorie] ?? String(categorie).replaceAll('_', ' ')
}

export function formaterDatePeriode(date) {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatMontantRapport(montant) {
  return `${Math.round(Number(montant || 0)).toLocaleString('fr-FR')} XAF`
}
