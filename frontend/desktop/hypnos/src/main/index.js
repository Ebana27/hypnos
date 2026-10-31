import { app, shell, BrowserWindow, ipcMain, Menu, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { and, eq, gt, inArray, lt, ne, or, sql, getTableColumns } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import electronUpdater from 'electron-updater'

import { getDb } from './db/client.js'
import {
  chambre,
  client,
  consommation,
  demande,
  facture,
  hotel,
  reservation,
  service,
  typeDeChambre,
  user
} from './db/schema/schema.js'

// electron-updater est publié en CommonJS : on passe par l'export par défaut
const { autoUpdater } = electronUpdater

let onloadingWindow = null // écran de chargement (compteur)
let setupWindow = null // présentation + création de l'hôtel (premier lancement)
let loginWindow = null
let mainWindow = null
let session = null // { userId } de la personne connectée

const db = getDb()
const scrypt = promisify(scryptCallback)

async function hotelExiste() {
  const lignes = await db.select({ id: hotel.id }).from(hotel).limit(1)
  return lignes.length > 0
}

// Mot de passe haché avec scrypt (intégré à Node, aucune dépendance) : « sel:empreinte »
async function hacherMotDePasse(motDePasse) {
  const sel = randomBytes(16)
  const empreinte = await scrypt(motDePasse, sel, 64)
  return `${sel.toString('hex')}:${empreinte.toString('hex')}`
}

async function verifierMotDePasse(motDePasse, stocke) {
  const [selHex, empreinteHex] = String(stocke ?? '').split(':')
  if (!selHex || !empreinteHex) return false
  const attendu = Buffer.from(empreinteHex, 'hex')
  const calcule = await scrypt(motDePasse, Buffer.from(selHex, 'hex'), attendu.length)
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu)
}

// Supprime le menu global (File, Edit, View...) de toutes les fenêtres
Menu.setApplicationMenu(null)

// ============================================================
//  FENÊTRES
// ============================================================

const ICONE = join(__dirname, '../../resources/icon.png')

// Couleur affichée avant le chargement de React.
// Valeurs de --color-background dans base.css (clair / sombre) :
// le processus principal ne peut pas lire le CSS, on les recopie ici.
const couleurDeFond = () => (nativeTheme.shouldUseDarkColors ? '#0a0a0f' : '#f5f6ff')

function loadRenderer(win, flag = null) {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    win.loadURL(flag ? `${base}?${flag}=1` : base)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), flag ? { query: { [flag]: '1' } } : {})
  }
}

// Options communes à toutes les fenêtres de l'application
function creerFenetre(options) {
  return new BrowserWindow({
    frame: false,
    icon: ICONE,
    backgroundColor: couleurDeFond(),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false },
    ...options
  })
}

// Fenêtres fixes (onloading, connexion)
const FENETRE_FIXE = { resizable: false, maximizable: false, fullscreenable: false }

function createOnloadingWindow() {
  onloadingWindow = creerFenetre({ width: 720, height: 300, ...FENETRE_FIXE })
  loadRenderer(onloadingWindow, 'onloading')
  onloadingWindow.on('closed', () => { onloadingWindow = null })
}

function createSetupWindow() {
  setupWindow = creerFenetre({ width: 1000, height: 650, ...FENETRE_FIXE })
  loadRenderer(setupWindow, 'onboarding')
  setupWindow.on('closed', () => { setupWindow = null })
}

function createLoginWindow() {
  loginWindow = creerFenetre({ width: 1000, height: 650, ...FENETRE_FIXE })
  loadRenderer(loginWindow, 'login')
  loginWindow.on('closed', () => { loginWindow = null })
}

function createWindow() {
  mainWindow = creerFenetre({
    width: 1080,
    height: 670,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    show: false
  })
  mainWindow.on('ready-to-show', () => { mainWindow.maximize(); mainWindow.show() })
  mainWindow.on('closed', () => { mainWindow = null })
  loadRenderer(mainWindow)
}

// Ouvre la fenêtre principale (si besoin) et démarre la surveillance des mises à jour
function ouvrirFenetrePrincipale() {
  if (mainWindow) return
  createWindow()
  initialiserMisesAJour()
}

// ---------- Contrôles de fenêtre (barre de titre personnalisée) ----------
ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
ipcMain.on('window:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})

// ---------- Enchaînement : chargement → (présentation + création | connexion) → application ----------
ipcMain.on('onloading:done', async () => {
  try {
    if (await hotelExiste()) {
      if (!loginWindow) createLoginWindow()
    } else if (!setupWindow) {
      createSetupWindow()
    }
  } catch (e) {
    console.error(e)
    if (!loginWindow) createLoginWindow()
  }
  // On ferme le chargement après avoir ouvert la suite, sinon l'application s'arrêterait
  if (onloadingWindow) onloadingWindow.close()
})
ipcMain.on('setup:done', () => {
  if (!session) return // pas de fenêtre principale sans compte
  ouvrirFenetrePrincipale()
  if (setupWindow) setupWindow.close()
})
ipcMain.on('login:done', () => {
  if (!session) return
  ouvrirFenetrePrincipale()
  if (loginWindow) loginWindow.close()
})

// ============================================================
//  BASE DE DONNÉES : migrations et clés étrangères
// ============================================================

// Renvoie true si la base est prête à servir
async function initialiserBase() {
  // Dossier généré par `npx drizzle-kit generate`
  const dossier = app.isPackaged
    ? join(process.resourcesPath, 'drizzle')
    : join(process.cwd(), 'drizzle')

  let prete = true

  if (fs.existsSync(dossier)) {
    try {
      await migrate(db, { migrationsFolder: dossier })
    } catch (e) {
      prete = false
      console.error('Migrations :', e)
      const detail = String(e?.cause?.message ?? e?.message ?? '')
      dialog.showErrorBox(
        'Hypnos',
        is.dev && detail.includes('already exists')
          ? "La base locale existe déjà sans historique de migrations.\nSupprimez local.db (et n'utilisez plus « drizzle-kit push »), puis relancez."
          : "La base de données n'a pas pu être mise à jour."
      )
    }
  } else if (app.isPackaged) {
    prete = false
    dialog.showErrorBox('Hypnos', 'Les fichiers de la base de données sont introuvables.')
  } else {
    console.warn(`Aucun dossier de migrations (${dossier}) : tables non créées automatiquement.`)
  }

  // Après les migrations, car elles manipulent cette option.
  await db.run(sql`PRAGMA foreign_keys = ON`)
  return prete
}

// ============================================================
//  ERREURS : messages en français renvoyés à l'interface
// ============================================================

// Erreur volontaire, déjà lisible par l'utilisateur
class ErreurMetier extends Error {}

const MESSAGES_CONTRAINTES = {
  hotel_etages_min: 'Un hôtel doit avoir au moins 1 étage.',
  hotel_chambres_min: 'Le nombre de chambres ne peut pas être négatif.',
  type_prix_min: 'Le prix ne peut pas être négatif.',
  type_capacite_min: 'La capacité doit être d’au moins 1 personne.',
  chambre_etage_min: "L'étage ne peut pas être négatif.",
  demande_fin_apres_debut: "La date de départ doit être après la date d'arrivée.",
  demande_min_une_personne: 'Il faut au moins une personne.',
  reservation_fin_apres_debut: "La date de départ doit être après la date d'arrivée.",
  reservation_min_une_personne: 'Il faut au moins une personne.',
  service_prix_min: 'Le prix ne peut pas être négatif.',
  consommation_quantite_min: 'La quantité doit être d’au moins 1.',
  facture_total_coherent: 'Le total doit être égal au montant de l’hébergement plus celui des services.'
}

function traduireErreur(e) {
  if (e instanceof ErreurMetier) return e

  // Drizzle enveloppe l'erreur SQLite dans `cause`
  const detail = String(e?.cause?.message ?? e?.message ?? '')

  const check = detail.match(/CHECK constraint failed: (\w+)/)
  if (check) {
    return new ErreurMetier(MESSAGES_CONTRAINTES[check[1]] ?? 'Une valeur saisie est invalide.')
  }
  const unique = detail.match(/UNIQUE constraint failed: ([\w.]+)/)
  if (unique) {
    const champ = unique[1].split('.').pop()
    return new ErreurMetier(`Cette valeur existe déjà (${champ}).`)
  }
  if (detail.includes('FOREIGN KEY constraint failed')) {
    return new ErreurMetier('Opération impossible : cet élément est lié à d’autres données.')
  }
  const obligatoire = detail.match(/NOT NULL constraint failed: ([\w.]+)/)
  if (obligatoire) {
    const champ = obligatoire[1].split('.').pop()
    return new ErreurMetier(`Champ obligatoire manquant : ${champ}.`)
  }
  return new ErreurMetier('Une erreur inattendue est survenue.')
}

// ============================================================
//  OUTILS IPC
// ============================================================

// Fenêtres autorisées à appeler un canal (par défaut : la fenêtre principale)
const depuisPrincipale = () => [mainWindow]

function verifierExpediteur(event, autorisees) {
  if (!autorisees().some((w) => w && event.sender === w.webContents)) {
    throw new ErreurMetier('Action non autorisée depuis cette fenêtre.')
  }
}

function enregistrer(canal, action, autorisees = depuisPrincipale) {
  ipcMain.handle(canal, async (event, ...args) => {
    try {
      verifierExpediteur(event, autorisees)
      return await action(...args)
    } catch (e) {
      console.error(`[IPC ${canal}]`, e)
      throw traduireErreur(e)
    }
  })
}

// Ne garde que les colonnes réelles de la table, sans les champs protégés
function filtrerChamps(table, data, interdits) {
  const colonnes = Object.keys(getTableColumns(table))
  const propre = {}
  for (const [cle, valeur] of Object.entries(data ?? {})) {
    if (colonnes.includes(cle) && !interdits.includes(cle) && valeur !== undefined) {
      propre[cle] = valeur
    }
  }
  return propre
}

const INTERDITS_CREATION = ['id', 'createdAt', 'updatedAt']
const INTERDITS_MISE_A_JOUR = ['id', 'createdAt', 'updatedAt', 'remoteId']

// ============================================================
//  RÈGLES PAR TABLE (exécutées avant création / mise à jour)
// ============================================================

async function verifierTypeChambre(data, mode) {
  if (mode === 'create' && !data.typeId) {
    throw new ErreurMetier('Il faut choisir un type de chambre.')
  }
  if (data.typeId !== undefined) {
    const trouve = await db
      .select({ id: typeDeChambre.id })
      .from(typeDeChambre)
      .where(eq(typeDeChambre.id, Number(data.typeId)))
    if (trouve.length === 0) throw new ErreurMetier("Ce type de chambre n'existe pas.")
    data.typeId = Number(data.typeId)
  }
  return data
}

// Réservations qui bloquent une chambre. Les statuts « en_sejour » et « en_attente »
// sont déjà pris en compte pour le jour où ils seront ajoutés au schéma.
const STATUTS_ACTIFS = ['confirmee', 'en_sejour', 'en_attente']

// Interdit deux réservations actives qui se chevauchent sur une même chambre
async function verifierDisponibilite(data, mode, id) {
  const concerne = ['chambreId', 'dateDebut', 'dateFin', 'statut'].some((c) => c in data)
  if (mode === 'update' && !concerne) return data

  let actuel = {}
  if (mode === 'update') {
    const lignes = await db.select().from(reservation).where(eq(reservation.id, Number(id)))
    if (!lignes[0]) return data
    actuel = lignes[0]
  }

  const final = { statut: 'confirmee', ...actuel, ...data }
  if (!STATUTS_ACTIFS.includes(final.statut)) return data
  if (!final.chambreId || !final.dateDebut || !final.dateFin) return data

  const conflits = await db
    .select({ id: reservation.id })
    .from(reservation)
    .where(
      and(
        eq(reservation.chambreId, Number(final.chambreId)),
        inArray(reservation.statut, STATUTS_ACTIFS),
        lt(reservation.dateDebut, final.dateFin),
        gt(reservation.dateFin, final.dateDebut),
        mode === 'update' ? ne(reservation.id, Number(id)) : undefined
      )
    )
  if (conflits.length > 0) {
    throw new ErreurMetier('Cette chambre est déjà réservée sur cette période.')
  }
  return data
}

// ============================================================
//  CRUD : un seul enregistrement par table
//  Le nom de la clé est le préfixe du canal IPC (ex. « clients:getAll »).
//  Il doit rester identique à la liste TABLES du preload.
// ============================================================

const TABLES = {
  clients: { table: client },
  demande: { table: demande },
  reservation: { table: reservation, avantEcriture: verifierDisponibilite },
  hotel: { table: hotel },
  utilisateur: { table: user, secrets: ['passwordHash'] },
  service: { table: service },
  consommation: { table: consommation },
  chambre: { table: chambre, avantEcriture: verifierTypeChambre },
  typedechambre: { table: typeDeChambre },
  facture: { table: facture }
}

for (const [canal, { table, avantEcriture, secrets = [] }] of Object.entries(TABLES)) {
  // Retire les colonnes secrètes avant de renvoyer une ligne à l'interface
  const masquer = (ligne) => {
    if (!ligne || secrets.length === 0) return ligne
    const copie = { ...ligne }
    for (const s of secrets) delete copie[s]
    return copie
  }

  const preparer = async (data, mode, id) => {
    const interdits = [
      ...(mode === 'create' ? INTERDITS_CREATION : INTERDITS_MISE_A_JOUR),
      ...secrets
    ]
    const propre = filtrerChamps(table, data, interdits)
    return avantEcriture ? ((await avantEcriture(propre, mode, id)) ?? propre) : propre
  }

  enregistrer(`${canal}:getAll`, async () => (await db.select().from(table)).map(masquer))

  enregistrer(`${canal}:getById`, async (id) => {
    const lignes = await db.select().from(table).where(eq(table.id, Number(id)))
    return masquer(lignes[0] ?? null)
  })

  enregistrer(`${canal}:create`, async (data) => {
    const valeurs = await preparer(data, 'create')
    const lignes = await db.insert(table).values(valeurs).returning()
    return masquer(lignes[0])
  })

  enregistrer(`${canal}:update`, async (id, data) => {
    const valeurs = await preparer(data, 'update', id)
    if (Object.keys(valeurs).length === 0) throw new ErreurMetier('Aucune modification à enregistrer.')
    const lignes = await db.update(table).set(valeurs).where(eq(table.id, Number(id))).returning()
    if (!lignes[0]) throw new ErreurMetier('Élément introuvable.')
    return masquer(lignes[0])
  })

  enregistrer(`${canal}:delete`, async (id) => {
    await db.delete(table).where(eq(table.id, Number(id)))
    return { success: true }
  })
}

// ============================================================
//  ACCÈS : création de l'hôtel et connexion (100 % locales)
// ============================================================

const utilisateurPublic = (u) => ({
  id: u.id,
  hotelId: u.hotelId,
  username: u.username,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role
})

// Numérotation continue : 1, 2, 3… en partant du niveau le plus bas.
// Le rez-de-chaussée n'a des chambres que si on le demande (rare : réception et espaces communs).
function planChambres(etagesHauts, chambresParEtage, chambresRez) {
  const plan = []
  let numero = 1
  for (let etage = 0; etage <= etagesHauts; etage++) {
    const nombre = etage === 0 ? chambresRez : chambresParEtage
    for (let i = 0; i < nombre; i++) plan.push({ numero: String(numero++), etage })
  }
  return plan
}

// Vérifie et normalise les données de création : le processus principal ne fait jamais confiance à l'interface
function validerCreation(d) {
  const texte = (v) => String(v ?? '').trim()
  const entier = (v) => Number.parseInt(v, 10)

  const nom = texte(d?.nom)
  const ville = texte(d?.ville)
  if (!nom) throw new ErreurMetier("Indiquez le nom de l'hôtel.")
  if (!ville) throw new ErreurMetier('Indiquez la ville.')

  const etagesHauts = entier(d?.etagesHauts)
  const chambresParEtage = entier(d?.chambresParEtage)
  const chambresRez = entier(d?.chambresRez ?? 0)
  if (!(etagesHauts >= 0 && etagesHauts <= 30)) {
    throw new ErreurMetier("Le nombre d'étages doit être compris entre 0 et 30.")
  }
  if (!(chambresParEtage >= 1 && chambresParEtage <= 60)) {
    throw new ErreurMetier('Le nombre de chambres par étage doit être compris entre 1 et 60.')
  }
  if (!(chambresRez >= 0 && chambresRez <= 60)) {
    throw new ErreurMetier('Le nombre de chambres au rez-de-chaussée doit être compris entre 0 et 60.')
  }
  if (chambresRez + etagesHauts * chambresParEtage < 1) {
    throw new ErreurMetier('Prévoyez au moins une chambre.')
  }

  const tarif = entier(d?.tarif)
  if (!(tarif > 0)) throw new ErreurMetier('Indiquez un tarif moyen supérieur à 0.')

  const heureValide = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)
  const arrivee = texte(d?.arrivee)
  const depart = texte(d?.depart)
  if (!heureValide(arrivee) || !heureValide(depart)) throw new ErreurMetier('Les heures indiquées ne sont pas valides.')

  const prenom = texte(d?.prenom)
  const nomFamille = texte(d?.nomFamille)
  if (!prenom || !nomFamille) throw new ErreurMetier('Indiquez votre prénom et votre nom.')

  const email = texte(d?.email).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurMetier('Adresse e-mail invalide.')

  const motDePasse = String(d?.motDePasse ?? '')
  if (motDePasse.length < 8) throw new ErreurMetier('Le mot de passe doit contenir au moins 8 caractères.')

  return {
    nom, ville, adresse: texte(d?.adresse), tel: texte(d?.tel),
    etagesHauts, chambresParEtage, chambresRez, tarif, arrivee, depart,
    prenom, nomFamille, email, motDePasse
  }
}

// Crée l'hôtel, sa catégorie « Standard », toutes ses chambres et le compte administrateur, en une seule transaction
enregistrer(
  'hotel:creerComplet',
  async (donnees) => {
    if (await hotelExiste()) throw new ErreurMetier('Un hôtel existe déjà sur cet ordinateur.')
    const p = validerCreation(donnees)
    const empreinte = await hacherMotDePasse(p.motDePasse)
    const niveaux = p.etagesHauts + 1 // rez-de-chaussée compris
    const plan = planChambres(p.etagesHauts, p.chambresParEtage, p.chambresRez)

    const admin = await db.transaction(async (tx) => {
      const [h] = await tx
        .insert(hotel)
        .values({
          name: p.nom,
          adresse: p.adresse,
          ville: p.ville,
          tel: p.tel,
          email: p.email,
          nombreEtages: niveaux, // rez-de-chaussée compris
          nombreChambres: plan.length,
          heureArrivee: `${p.arrivee}:00`,
          heureDepart: `${p.depart}:00`
        })
        .returning()

      const [type] = await tx
        .insert(typeDeChambre)
        .values({ label: 'Standard', prix: p.tarif, capacite: 2 })
        .returning()

      await tx.insert(chambre).values(
        plan.map(({ numero, etage }) => ({
          typeId: type.id,
          numero,
          etage,
          statut: 'disponible'
        }))
      )

      const [u] = await tx
        .insert(user)
        .values({
          hotelId: h.id,
          username: p.email,
          email: p.email,
          firstName: p.prenom,
          lastName: p.nomFamille,
          role: 'administrateur',
          passwordHash: empreinte
        })
        .returning()
      return u
    })

    // La transaction ouvre une nouvelle connexion : on réactive les clés étrangères
    await db.run(sql`PRAGMA foreign_keys = ON`)

    session = { userId: admin.id }
    return utilisateurPublic(admin)
  },
  () => [setupWindow]
)

enregistrer(
  'auth:connexion',
  async (identifiant, motDePasse) => {
    const id = String(identifiant ?? '').trim().toLowerCase()
    if (!id || !motDePasse) throw new ErreurMetier('Renseignez votre identifiant et votre mot de passe.')

    const lignes = await db.select().from(user).where(or(eq(user.email, id), eq(user.username, id)))
    const u = lignes[0]
    const valide = Boolean(u && u.isActive && (await verifierMotDePasse(motDePasse, u.passwordHash)))
    if (!valide) {
      await new Promise((r) => setTimeout(r, 600)) // ralentit les essais en rafale
      throw new ErreurMetier('Identifiant ou mot de passe incorrect.')
    }
    session = { userId: u.id }
    return utilisateurPublic(u)
  },
  () => [loginWindow]
)

// Utilisateur et hôtel de la session en cours (barre du haut, réservations…)
enregistrer('session:courante', async () => {
  if (!session) return null
  const [u] = await db.select().from(user).where(eq(user.id, session.userId))
  if (!u) return null
  const [h] = await db.select().from(hotel).where(eq(hotel.id, u.hotelId))
  return {
    utilisateur: utilisateurPublic(u),
    hotel: h
      ? { id: h.id, name: h.name, ville: h.ville, heureArrivee: h.heureArrivee, heureDepart: h.heureDepart }
      : null
  }
})

// En développement : crée un hôtel et un administrateur si la base est vide,
// pour tester les réservations sans passer par la création de compte.
// async function amorcerDev() {
//   if (!is.dev) return
//   const existants = await db.select({ id: hotel.id }).from(hotel)
//   if (existants.length > 0) return
//   const [h] = await db
//     .insert(hotel)
//     .values({
//       name: 'Hôtel Le Céleste',
//       adresse: 'Brazzaville',
//       ville: 'Brazzaville',
//       tel: '+242 00 000 00 00',
//       email: 'contact@hotel.cg',
//       nombreEtages: 3,
//       nombreChambres: 0
//     })
//     .returning()
//   await db.insert(user).values({
//     hotelId: h.id,
//     username: 'admin',
//     email: 'admin@hotel.cg',
//     firstName: 'Ebana',
//     lastName: 'Plamedi',
//     role: 'administrateur'
//   })
// }

// ============================================================
//  MISES À JOUR (GitHub Releases, dépôt « hypnos-update-history »)
//  La publication se fait au git tag (voir .github/workflows/release.yml).
//  L'état est envoyé à la fenêtre principale : la barre de titre l'affiche.
// ============================================================

// aucune | verification | disponible | telechargement | prete | erreur
let etatMaj = { etat: 'aucune' }
let majInitialisee = false

function diffuserMaj(nouvelEtat) {
  etatMaj = nouvelEtat
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('maj:etat', etatMaj)
  }
}

function initialiserMisesAJour() {
  if (majInitialisee) return
  majInitialisee = true

  // En développement, aucune vérification réelle (l'application n'est pas installée).
  // Pour tester l'affichage de la barre de titre : HYPNOS_MAJ_TEST=1 npm run dev
  if (is.dev) {
    if (process.env['HYPNOS_MAJ_TEST']) {
      setTimeout(() => diffuserMaj({ etat: 'disponible', version: '9.9.9' }), 3000)
    }
    return
  }

  autoUpdater.autoDownload = false // l'utilisateur décide du téléchargement
  autoUpdater.autoInstallOnAppQuit = true // installée à la fermeture si déjà téléchargée

  autoUpdater.on('checking-for-update', () => diffuserMaj({ etat: 'verification' }))
  autoUpdater.on('update-not-available', () => diffuserMaj({ etat: 'aucune' }))
  autoUpdater.on('update-available', (info) =>
    diffuserMaj({ etat: 'disponible', version: info.version })
  )
  autoUpdater.on('download-progress', (p) =>
    diffuserMaj({ etat: 'telechargement', pourcent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    diffuserMaj({ etat: 'prete', version: info.version })
  )
  autoUpdater.on('error', (e) => {
    // Hors connexion ou dépôt injoignable : on ne dérange pas l'utilisateur
    console.error('Mise à jour :', e)
    diffuserMaj({ etat: 'erreur' })
  })

  const verifier = () => autoUpdater.checkForUpdates().catch(() => {})
  verifier()
  setInterval(verifier, 4 * 60 * 60 * 1000) // puis toutes les 4 heures
}

enregistrer('maj:etat', async () => etatMaj)

enregistrer('maj:verifier', async () => {
  if (is.dev) return etatMaj
  // Ne relance pas une vérification pendant un téléchargement ou si la mise à jour est prête
  if (etatMaj.etat === 'telechargement' || etatMaj.etat === 'prete') return etatMaj
  await autoUpdater.checkForUpdates()
  return etatMaj
})

enregistrer('maj:telecharger', async () => {
  if (is.dev) throw new ErreurMetier('Les mises à jour sont désactivées en développement.')
  if (etatMaj.etat !== 'disponible') throw new ErreurMetier('Aucune mise à jour à télécharger.')
  diffuserMaj({ etat: 'telechargement', pourcent: 0 })
  await autoUpdater.downloadUpdate()
  return { success: true }
})

enregistrer('maj:installer', async () => {
  if (is.dev) throw new ErreurMetier('Les mises à jour sont désactivées en développement.')
  if (etatMaj.etat !== 'prete') throw new ErreurMetier("La mise à jour n'est pas encore téléchargée.")
  // (silencieux = false, relancer après installation = true)
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { success: true }
})

// ============================================================
//  CYCLE DE VIE DE L'APPLICATION
// ============================================================

app.whenReady().then(async () => {
  // Définit aussi l'identité de l'icône dans la barre des tâches (Windows)
  electronApp.setAppUserModelId('com.hypnos.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)

    // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application
    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // F11 : plein écran de la fenêtre principale (utile pour le planning)
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F11' && window === mainWindow) {
        event.preventDefault()
        window.setFullScreen(!window.isFullScreen())
      }
    })
  })

  const prete = await initialiserBase()
  // Une application installée sans base utilisable ne peut rien faire : on la ferme.
  // En développement on continue pour pouvoir corriger sans tout relancer.
  if (!prete && app.isPackaged) {
    app.quit()
    return
  }

  // if (prete) {
  //   try {
  //     await amorcerDev()
  //   } catch (e) {
  //     console.error('Amorçage :', e)
  //   }
  // }

  createOnloadingWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOnloadingWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})