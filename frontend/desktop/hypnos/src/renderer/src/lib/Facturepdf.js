// ============================================================
//  Facture PDF d'une réservation (jsPDF, 100 % local : aucun appel réseau)
//  Dépendance à installer :  npm install jspdf
// ============================================================
import { jsPDF } from 'jspdf'
// « ?inline » force Vite à intégrer le logo en base64 : indispensable pour jsPDF, car une image
// chargée depuis file:// (application empaquetée) ne peut pas être relue par un canvas.
import logotype from '../assets/images/logotype.png?inline'
import {
  DEVISE,
  formatArgent,
  heuresEntre,
  jourDe,
  libelleHeures,
  libelleNuits
} from './reservations'

const ACCENT = [27, 27, 201]
const GRIS = [110, 114, 128]
const NOIR = [24, 26, 32]
const LIGNE = [226, 228, 234]
const FOND = [245, 246, 250]

const LIBELLES_MODE = { especes: 'Espèces', carte: 'Carte', mtn_money: 'MTN Money', airtel_money: 'Airtel Money' }
const LIBELLES_PAIEMENT = { acompte: 'Acompte', paiement_client: 'Règlement', remboursement_acompte: 'Remboursement' }

// Les polices standard de jsPDF ne contiennent ni l'espace insécable fine du format fr-FR (U+202F),
// ni la flèche, ni l'apostrophe typographique : on les remplace avant d'écrire.
const net = (t) =>
  String(t ?? '')
    .replace(/[\u202f\u00a0]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2192/g, '>')
    .replace(/\u2026/g, '...')
const argent = (n) => net(formatArgent(n))
const montant = (n) => `${argent(n)} ${DEVISE}`
const heureDe = (v, defaut) => String(v ?? '').slice(11, 16) || defaut
const dateLongue = (v) => net(jourDe(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))
const moment = (v, defautHeure) => `${dateLongue(v)} à ${heureDe(v, defautHeure)}`
const slug = (t) => net(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')

function infosHotel(hotel) {
  return {
    nom: hotel?.nom ?? hotel?.name ?? hotel?.raisonSociale ?? 'Hypnos Hôtel',
    adresse: hotel?.adresse ?? hotel?.address ?? '',
    tel: hotel?.tel ?? hotel?.telephone ?? hotel?.phone ?? '',
    email: hotel?.email ?? ''
  }
}

function lignesFacture(resa) {
  const lignes = []
  if (resa.typeSejour === 'heure') {
    const h = heuresEntre(resa.dateDebut, resa.dateFin)
    lignes.push({
      libelle: `Passage - chambre ${resa.numeroChambre} (${resa.typeLabel})`,
      detail: `${resa.regleArrondi === 'heure_commencee' ? 'Heure commencée' : 'Au prorata'}${resa.plafonne ? ' - plafonné au tarif de la nuitée' : ''}`,
      qte: libelleHeures(h),
      pu: `${argent(resa.tarifApplique)} /h`,
      total: resa.hebergement
    })
  } else {
    lignes.push({
      libelle: `Nuitée - chambre ${resa.numeroChambre} (${resa.typeLabel})`,
      detail: '',
      qte: libelleNuits(resa.nuits),
      pu: argent(resa.tarifApplique || resa.prixNuit),
      total: resa.hebergement
    })
  }
  for (const c of resa.consos) {
    lignes.push({ libelle: c.serviceNom, detail: 'Service', qte: '1', pu: argent(c.montant), total: c.montant })
  }
  return lignes
}

export async function genererFacturePdf(resa, { hotel } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 16
  const R = 194
  const info = infosHotel(hotel)
  const numero = `FP-${new Date().getFullYear()}-${String(resa.id).padStart(4, '0')}`
  const nomClient = resa.client ? `${resa.client.prenom ?? ''} ${resa.client.nom ?? ''}`.trim() : resa.clientNom
  let y = 16

  const texte = (t, x, yy, { taille = 10, gras = false, couleur = NOIR, align = 'left' } = {}) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal')
    doc.setFontSize(taille)
    doc.setTextColor(...couleur)
    doc.text(net(t), x, yy, { align })
  }
  const assurer = (hauteur) => {
    if (y + hauteur > 272) {
      doc.addPage()
      y = 20
    }
  }

  // ---------- En-tête : logo, titre, numéro ----------
  try {
    const p = doc.getImageProperties(logotype)
    let h = 13
    let w = (h * p.width) / p.height
    if (w > 58) { w = 58; h = (w * p.height) / p.width }
    doc.addImage(logotype, 'PNG', L, y, w, h)
  } catch {
    texte('HYPNOS', L, y + 8, { taille: 20, gras: true, couleur: ACCENT })
  }
  texte('FACTURE PROVISOIRE', R, y + 6, { taille: 16, gras: true, couleur: ACCENT, align: 'right' })
  texte(`N° ${numero}  ·  émise le ${dateLongue(new Date().toISOString())}`, R, y + 12, { taille: 9, couleur: GRIS, align: 'right' })
  y += 24

  // ---------- Hôtel ----------
  texte(info.nom, L, y, { taille: 10, gras: true })
  const coords = [info.adresse, [info.tel, info.email].filter(Boolean).join('  ·  ')].filter(Boolean)
  coords.forEach((ligne, i) => texte(ligne, L, y + 5 + i * 4.5, { taille: 9, couleur: GRIS }))
  y += 6 + coords.length * 4.5 + 6

  // ---------- Client et séjour ----------
  const hauteurBloc = 30
  const largeurBloc = (R - L - 6) / 2
  doc.setFillColor(...FOND)
  doc.roundedRect(L, y, largeurBloc, hauteurBloc, 2, 2, 'F')
  doc.roundedRect(L + largeurBloc + 6, y, largeurBloc, hauteurBloc, 2, 2, 'F')
  texte('FACTURÉ À', L + 4, y + 6, { taille: 8, gras: true, couleur: GRIS })
  texte(nomClient, L + 4, y + 12, { taille: 11, gras: true })
  texte(resa.client?.tel || 'Téléphone non renseigné', L + 4, y + 18, { taille: 9, couleur: GRIS })
  texte(resa.client?.email || 'E-mail non renseigné', L + 4, y + 23, { taille: 9, couleur: GRIS })
  const xS = L + largeurBloc + 10
  texte('SÉJOUR', xS, y + 6, { taille: 8, gras: true, couleur: GRIS })
  texte(`Réservation n°${resa.id}  ·  Chambre ${resa.numeroChambre}`, xS, y + 12, { taille: 10, gras: true })
  texte(`Arrivée : ${moment(resa.dateDebut, '15:00')}`, xS, y + 18, { taille: 9, couleur: GRIS })
  texte(`Départ : ${moment(resa.dateFin, '11:00')}`, xS, y + 23, { taille: 9, couleur: GRIS })
  y += hauteurBloc + 10

  // ---------- Tableau ----------
  const colQte = 128
  const colPu = 156
  doc.setFillColor(...ACCENT)
  doc.roundedRect(L, y, R - L, 8, 1.5, 1.5, 'F')
  texte('Désignation', L + 3, y + 5.4, { taille: 9, gras: true, couleur: [255, 255, 255] })
  texte('Quantité', colQte, y + 5.4, { taille: 9, gras: true, couleur: [255, 255, 255], align: 'right' })
  texte('Prix unitaire', colPu, y + 5.4, { taille: 9, gras: true, couleur: [255, 255, 255], align: 'right' })
  texte(`Montant (${DEVISE})`, R - 3, y + 5.4, { taille: 9, gras: true, couleur: [255, 255, 255], align: 'right' })
  y += 8

  for (const l of lignesFacture(resa)) {
    const h = l.detail ? 11 : 8
    assurer(h)
    texte(l.libelle, L + 3, y + 5.5, { taille: 9.5 })
    if (l.detail) texte(l.detail, L + 3, y + 9.5, { taille: 8, couleur: GRIS })
    texte(l.qte, colQte, y + 5.5, { taille: 9.5, align: 'right' })
    texte(l.pu, colPu, y + 5.5, { taille: 9.5, align: 'right' })
    texte(argent(l.total), R - 3, y + 5.5, { taille: 9.5, gras: true, align: 'right' })
    doc.setDrawColor(...LIGNE)
    doc.line(L, y + h, R, y + h)
    y += h
  }
  y += 6

  // ---------- Totaux ----------
  assurer(40)
  const xT = 118
  const ligneTotal = (libelle, valeur, options = {}) => {
    texte(libelle, xT, y, { taille: 10, couleur: options.couleur ?? GRIS })
    texte(valeur, R - 3, y, { taille: 10, gras: true, couleur: options.couleur ?? NOIR, align: 'right' })
    y += 6.5
  }
  ligneTotal('Total', montant(resa.total))
  ligneTotal('Déjà payé', montant(resa.montantPaye), { couleur: [21, 128, 61] })
  const reste = Math.max(resa.reste, 0)
  y += 1
  doc.setFillColor(...(reste > 0 ? [253, 236, 238] : [229, 246, 236]))
  doc.roundedRect(xT - 4, y - 5, R - xT + 4, 11, 2, 2, 'F')
  const couleurReste = reste > 0 ? [190, 24, 48] : [21, 128, 61]
  texte(reste > 0 ? 'Reste à payer' : 'Soldé', xT, y + 2, { taille: 11, gras: true, couleur: couleurReste })
  texte(montant(reste), R - 3, y + 2, { taille: 12, gras: true, couleur: couleurReste, align: 'right' })
  y += 16

  // ---------- Paiements reçus ----------
  if (resa.paiements.length > 0) {
    assurer(14 + resa.paiements.length * 5)
    texte('Paiements reçus', L, y, { taille: 10, gras: true })
    y += 5
    for (const p of resa.paiements) {
      assurer(6)
      const libelle = `${LIBELLES_PAIEMENT[p.categorie] ?? p.categorie}${p.modePaiement ? ` - ${LIBELLES_MODE[p.modePaiement] ?? p.modePaiement}` : ''}  ·  ${dateLongue(p.dateMouvement)}`
      texte(libelle, L, y, { taille: 9, couleur: GRIS })
      texte(`${p.type === 'sortie' ? '-' : '+'} ${montant(p.montant)}`, R - 3, y, { taille: 9, gras: true, align: 'right' })
      y += 5
    }
  }

  // ---------- Pied de page (sur chaque page) ----------
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LIGNE)
    doc.line(L, 281, R, 281)
    texte('Document provisoire : taxes et mentions comptables à valider avant émission officielle.', L, 286, { taille: 8, couleur: GRIS })
    texte(`${info.nom}  ·  page ${i}/${pages}`, R, 286, { taille: 8, couleur: GRIS, align: 'right' })
  }

  return {
    blob: doc.output('blob'),
    nomFichier: `Facture-${numero}-${slug(nomClient) || 'client'}.pdf`
  }
}

// Enregistre le PDF. Si le preload expose `enregistrerFichier(nom, octets)` (dialogue « Enregistrer sous »
// ou dossier dédié), il est utilisé ; sinon le navigateur intégré télécharge le fichier.
export async function enregistrerFacture(blob, nomFichier) {
  const api = window.electronAPI
  if (typeof api?.enregistrerFichier === 'function') {
    return api.enregistrerFichier(nomFichier, new Uint8Array(await blob.arrayBuffer()))
  }
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return null
}