import { app, shell, BrowserWindow, ipcMain, Menu, dialog, nativeTheme } from 'electron'
import { join, basename, extname } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { and, eq, inArray, or, sql, getTableColumns } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

import { getDb } from './db/client.js'
import {
  chambre,
  client,
  consommation,
  demande,
  facture,
  hotel,
  MODES_PAIEMENT,
  mouvementCaisse,
  reservation,
  service,
  typeDeChambre,
  user
} from './db/schema/schema.js'
import { montantPayeEffectif, totaux } from '../renderer/src/lib/reservations.js'

// electron-updater n'est PAS importé ici : il est chargé à la demande (voir chargerUpdater),
// uniquement dans l'application installée, pour ne pas ralentir le démarrage.

let onloadingWindow = null // écran de chargement (compteur)
let setupWindow = null // présentation + création de l'hôtel (premier lancement)
let loginWindow = null
let mainWindow = null
let session = null // { userId } de la personne connectée

const db = getDb()
const scrypt = promisify(scryptCallback)

// Date du jour en heure locale, au format AAAA-MM-JJ
const jourLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
//  MESURE DU DÉMARRAGE (développement uniquement)
//  Affiche dans le terminal le temps écoulé depuis le lancement du processus.
// ============================================================

function journal(etape) {
  if (!is.dev) return
  console.log(`[démarrage] ${etape} : ${Math.round(process.uptime() * 1000)} ms`)
}

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
function genererCodeSecours() {
  const brut = randomBytes(12).toString('hex').toUpperCase()
  return brut.match(/.{1,4}/g).join('-')
}
const normaliserCodeSecours = (code) => String(code ?? '').replace(/[^a-f0-9]/gi, '').toLowerCase()

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

// Résolu quand la fenêtre a fini de se préparer (ou après 8 s au plus : on n'attend jamais indéfiniment)
function attendreAffichage(win) {
  return new Promise((resolve) => {
    if (win.isDestroyed() || win.isVisible()) return resolve()
    const fin = () => resolve()
    win.once('ready-to-show', fin)
    win.webContents.once('did-fail-load', fin)
    setTimeout(fin, 8000)
  })
}

// Fermer l'écran de chargement avant la fin du parcours quitte l'application :
// sinon la fenêtre suivante, préparée masquée, garderait le processus en vie sans rien afficher.
let chargementTermine = false

function createOnloadingWindow() {
  onloadingWindow = creerFenetre({ width: 720, height: 300, ...FENETRE_FIXE })
  loadRenderer(onloadingWindow, 'onloading')
  onloadingWindow.once('ready-to-show', () => journal('écran de chargement affiché'))
  onloadingWindow.on('closed', () => {
    onloadingWindow = null
    if (!chargementTermine) app.quit()
  })
}

// Préparée masquée pendant le compteur, affichée par « onloading:done »
function createSetupWindow() {
  setupWindow = creerFenetre({ width: 1000, height: 650, show: false, ...FENETRE_FIXE })
  loadRenderer(setupWindow, 'onboarding')
  setupWindow.on('closed', () => { setupWindow = null })
  return setupWindow
}

function createLoginWindow() {
  loginWindow = creerFenetre({ width: 1000, height: 650, show: false, ...FENETRE_FIXE })
  loadRenderer(loginWindow, 'login')
  loginWindow.on('closed', () => { loginWindow = null })
  return loginWindow
}

// La fenêtre de connexion / création reste visible jusqu'à ce que la principale soit prête
function fermerFenetresAcces() {
  if (loginWindow) loginWindow.close()
  if (setupWindow) setupWindow.close()
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
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    fermerFenetresAcces()
    journal('fenêtre principale affichée')
  })
  mainWindow.on('closed', () => { mainWindow = null })
  loadRenderer(mainWindow)
}

// Ouvre la fenêtre principale (si besoin) et démarre la surveillance des mises à jour
function ouvrirFenetrePrincipale() {
  if (mainWindow) return
  journal('ouverture de la fenêtre principale demandée')
  createWindow()
  initialiserMisesAJour().catch((e) => console.error('Mise à jour :', e))
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

// ============================================================
//  PARCOURS DE DÉMARRAGE
//  chargement → (présentation + création | connexion) → application
//
//  Pendant que le compteur s'affiche, on prépare déjà la suite :
//  migrations, vérification de l'hôtel, création MASQUÉE de la fenêtre suivante.
//  À la fin du compteur, il ne reste qu'à l'afficher.
// ============================================================

let basePromise = null // Promise<boolean> : la base est-elle prête ?
let suitePreparee = null // Promise<{ fenetre, affichable } | null>

async function preparerSuite() {
  const prete = await basePromise
  journal(`base de données ${prete ? 'prête' : 'en échec'}`)

  // Application installée sans base utilisable : on la ferme.
  // En développement on continue pour pouvoir corriger sans tout relancer.
  if (!prete && app.isPackaged) {
    app.quit()
    return null
  }

  let hotelPresent = true // en cas d'erreur, on passe par la connexion
  try {
    hotelPresent = await hotelExiste()
  } catch (e) {
    console.error(e)
  }
  journal('hôtel vérifié')

  const fenetre = hotelPresent
    ? (loginWindow ?? createLoginWindow())
    : (setupWindow ?? createSetupWindow())
  return { fenetre, affichable: attendreAffichage(fenetre) }
}

function demarrerParcours() {
  chargementTermine = false
  createOnloadingWindow()
  suitePreparee = preparerSuite()
}

ipcMain.on('onloading:done', async () => {
  if (chargementTermine) return
  chargementTermine = true
  try {
    const suite = await suitePreparee
    if (suite && !suite.fenetre.isDestroyed()) {
      await suite.affichable
      suite.fenetre.show()
      suite.fenetre.focus()
    }
  } catch (e) {
    console.error(e)
  }
  journal('fenêtre de connexion / création affichée')
  // On ferme le chargement après avoir affiché la suite, sinon l'application s'arrêterait
  if (onloadingWindow) onloadingWindow.close()
})

ipcMain.on('setup:done', () => {
  if (!session) return // pas de fenêtre principale sans compte
  ouvrirFenetrePrincipale()
})

ipcMain.on('login:done', () => {
  if (!session) return
  ouvrirFenetrePrincipale()
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

  // Complète de façon idempotente les colonnes introduites par les tarifs flexibles.
  // Les anciennes lignes conservent leurs tarifs nuit; les tarifs ajoutés démarrent à 0.
  if (prete) {
    const ajouterColonnes = async (table, colonnes) => {
      const existantes = await db.all(sql.raw(`PRAGMA table_info("${table}")`))
      if (!existantes.length) return
      const noms = new Set(existantes.map((c) => c.name))
      for (const [nom, definition] of colonnes) {
        if (!noms.has(nom)) await db.run(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "${nom}" ${definition}`))
      }
    }
    await ajouterColonnes('type_de_chambre', [
      ['prix_horaire', 'INTEGER NOT NULL DEFAULT 0'],
      ['regle_passage', "TEXT NOT NULL DEFAULT 'prorata'"],
    ])
    await ajouterColonnes('chambre', [
      ['climatisation', 'INTEGER NOT NULL DEFAULT 0'],
      ['television', 'INTEGER NOT NULL DEFAULT 0']
    ])
    await ajouterColonnes('client', [
      ['allergies', "TEXT NOT NULL DEFAULT ''"],
      ['info_generales', "TEXT NOT NULL DEFAULT ''"],
      ['vip', 'INTEGER NOT NULL DEFAULT 0']
    ])
    await ajouterColonnes('reservation', [
      ['type_sejour', "TEXT NOT NULL DEFAULT 'nuit'"],
      ['mode_tarif', "TEXT NOT NULL DEFAULT 'nuit'"],
      ['regle_arrondi', "TEXT NOT NULL DEFAULT 'prorata'"],
      ['tarif_applique', 'INTEGER NOT NULL DEFAULT 0'],
      ['nombre_adultes', 'INTEGER NOT NULL DEFAULT 1'],
      ['nombre_enfants', 'INTEGER NOT NULL DEFAULT 0'],
      ['type_groupe', "TEXT NOT NULL DEFAULT 'seul'"],
      ['demandes_speciales', "TEXT NOT NULL DEFAULT ''"],
      ['conditions_paiement', "TEXT NOT NULL DEFAULT ''"],
      ['mode_paiement', "TEXT NOT NULL DEFAULT 'especes'"],
      ['numero_paiement', "TEXT NOT NULL DEFAULT ''"],
      ['kpay_external_id', 'TEXT'],
      ['kpay_status', 'TEXT'],
      ['kpay_mode', 'TEXT'],
      ['kpay_amount', 'INTEGER'],
      ['kpay_recorded', 'INTEGER NOT NULL DEFAULT 0']
    ])
    await ajouterColonnes('hotel', [
      ['statut_chambre_apres_depart', "TEXT NOT NULL DEFAULT 'nettoyage'"]
    ])
    await ajouterColonnes('user', [['recovery_code_hash', 'TEXT']])
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
  facture_total_coherent: 'Le total doit être égal au montant de l’hébergement plus celui des services.',
  mouvement_montant_min: 'Le montant doit être supérieur à 0.'
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

// La connexion Django est distincte du compte local Hypnos. Le mot de passe et les JWT
// restent uniquement en mémoire du processus principal; seule l'URL publique est persistée.
let kpaySession = null
const fichierConfigurationKpay = () => join(app.getPath('userData'), 'kpay-api.json')

function normaliserUrlApi(valeur) {
  let url
  try {
    url = new URL(String(valeur ?? '').trim())
  } catch {
    throw new ErreurMetier('Saisissez l’URL HTTPS publique de l’API Django (ngrok), sans chemin.')
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  const origineNgrok = ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'].some((suffixe) => url.hostname.endsWith(suffixe))
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password) {
    throw new ErreurMetier('L’API doit utiliser HTTPS. HTTP est autorisé uniquement pour localhost.')
  }
  if (!local && !origineNgrok) throw new ErreurMetier('Pour les essais, utilisez votre domaine ngrok HTTPS; les autres hôtes ne sont pas autorisés à recevoir vos identifiants.')
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new ErreurMetier('Saisissez uniquement l’origine de l’API, par exemple https://xxxx.ngrok-free.dev.')
  }
  return url.origin
}

async function lireConfigurationKpay() {
  try {
    const valeur = JSON.parse(await fs.promises.readFile(fichierConfigurationKpay(), 'utf8'))
    return { baseUrl: normaliserUrlApi(valeur.baseUrl) }
  } catch {
    return { baseUrl: '' }
  }
}

async function sauverConfigurationKpay(baseUrl) {
  await fs.promises.mkdir(app.getPath('userData'), { recursive: true })
  await fs.promises.writeFile(fichierConfigurationKpay(), JSON.stringify({ baseUrl }), { mode: 0o600 })
}

async function reponseJsonApi(reponse) {
  let donnees
  try {
    donnees = await reponse.json()
  } catch {
    throw new ErreurMetier(`Réponse illisible de l’API Django (HTTP ${reponse.status}).`)
  }
  if (!reponse.ok) {
    const detail = donnees?.detail || Object.entries(donnees ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
    const erreur = new ErreurMetier(detail || `Erreur API Django (HTTP ${reponse.status}).`)
    erreur.httpStatus = reponse.status
    throw erreur
  }
  return donnees
}

async function resteReservation(tx, r) {
  const [ch] = await tx.select().from(chambre).where(eq(chambre.id, r.chambreId))
  const [type] = ch ? await tx.select().from(typeDeChambre).where(eq(typeDeChambre.id, ch.typeId)) : []
  const consommations = await tx.select().from(consommation).where(eq(consommation.reservationId, r.id))
  const mouvements = await tx.select().from(mouvementCaisse).where(eq(mouvementCaisse.reservationId, r.id))
  const paye = montantPayeEffectif(r, mouvements)
  return totaux({ ...r, montantPaye: paye }, type?.prix ?? 0, consommations).reste
}

async function rafraichirJwtKpay() {
  if (!kpaySession?.refresh) throw new ErreurMetier('Connectez-vous à l’API Django dans Paramètres > KPay.')
  const reponse = await fetch(`${kpaySession.baseUrl}/api/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: kpaySession.refresh })
  })
  const donnees = await reponseJsonApi(reponse)
  kpaySession.access = donnees.access
  if (donnees.refresh) kpaySession.refresh = donnees.refresh
  kpaySession.expire = Date.now() + 55 * 60 * 1000
}

async function appelerApiKpay(route, options = {}) {
  if (!kpaySession) throw new ErreurMetier('Connectez-vous à l’API Django dans Paramètres > KPay.')
  if (Date.now() >= kpaySession.expire) await rafraichirJwtKpay()
  const requete = () => fetch(`${kpaySession.baseUrl}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kpaySession.access}`, ...options.headers }
  })
  let reponse = await requete()
  if (reponse.status === 401) {
    await rafraichirJwtKpay()
    reponse = await requete()
  }
  return reponseJsonApi(reponse)
}

enregistrer('kpay:configuration', async () => ({ ...(await lireConfigurationKpay()), connected: Boolean(kpaySession) }))
enregistrer('kpay:connexion', async (urlSaisie, username, password) => {
  const baseUrl = normaliserUrlApi(urlSaisie)
  if (!String(username ?? '').trim() || !String(password ?? '')) throw new ErreurMetier('Saisissez le nom d’utilisateur et le mot de passe Django.')
  let reponse
  try {
    reponse = await fetch(`${baseUrl}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: String(username).trim(), password: String(password) })
    })
  } catch {
    throw new ErreurMetier('API Django inaccessible. Vérifiez que Django et ngrok sont démarrés et que l’URL ngrok est actuelle.')
  }
  const tokens = await reponseJsonApi(reponse)
  if (!tokens.access || !tokens.refresh) throw new ErreurMetier('L’API Django n’a pas renvoyé les deux jetons JWT attendus.')
  kpaySession = { baseUrl, access: tokens.access, refresh: tokens.refresh, expire: Date.now() + 55 * 60 * 1000 }
  await sauverConfigurationKpay(baseUrl)
  return { connected: true, baseUrl }
})
enregistrer('kpay:deconnexion', async () => {
  kpaySession = null
  return { connected: false }
})

const verrousInitialisationKpay = new Set()
enregistrer('kpay:initier', async (...args) => {
  const id = Number(args[0])
  if (verrousInitialisationKpay.has(id)) throw new ErreurMetier('Une demande de paiement est déjà en cours pour cette réservation.')
  verrousInitialisationKpay.add(id)
  try {
    return await initialiserPaiementKpay(...args)
  } finally {
    verrousInitialisationKpay.delete(id)
  }
})

async function initialiserPaiementKpay(reservationId, montantValeur, mode, numero) {
  const id = Number(reservationId)
  const montant = Number(montantValeur)
  if (!session) throw new ErreurMetier('Session Hypnos expirée : reconnectez-vous.')
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(montant) || montant < 1) throw new ErreurMetier('Réservation ou montant KPay invalide.')
  if (!['mtn_money', 'airtel_money'].includes(mode)) throw new ErreurMetier('Choisissez MTN Money ou Airtel Money.')
  const chiffresNumero = String(numero ?? '').replace(/\D/g, '')
  const national = chiffresNumero.startsWith('242') ? chiffresNumero.slice(3) : chiffresNumero
  if (national.length !== 9) throw new ErreurMetier('Pour le Congo, saisissez +242 suivi des 9 chiffres du numéro Mobile Money.')
  const [r] = await db.select().from(reservation).where(eq(reservation.id, id))
  if (!r || r.statut === 'annulee') throw new ErreurMetier('Réservation introuvable ou annulée.')
  if (r.kpayExternalId && !r.kpayRecorded && ['CREATED', 'PENDING', 'PROCESSING', 'INITIATION_UNKNOWN'].includes(r.kpayStatus)) {
    throw new ErreurMetier(`Un paiement KPay est déjà ${r.kpayStatus === 'INITIATION_UNKNOWN' ? 'en vérification' : 'en cours'} (${r.kpayExternalId}). Vérifiez son statut avant d’en lancer un autre.`)
  }
  const reste = await resteReservation(db, r)
  if (montant > reste) throw new ErreurMetier(`Le montant dépasse le solde de la réservation (${Math.max(0, reste)} XAF).`)
  const externalId = `HYP-${id}-${Date.now()}-${randomBytes(5).toString('hex')}`
  const provider = mode === 'mtn_money' ? 'MTN_MOMO_COG' : 'AIRTEL_COG'
  const [clientReservation] = await db.select().from(client).where(eq(client.id, r.clientId))
  await db.update(reservation).set({
    kpayExternalId: externalId,
    kpayStatus: 'INITIATION_UNKNOWN',
    kpayMode: mode,
    kpayAmount: montant,
    kpayRecorded: false
  }).where(eq(reservation.id, id))
  const payload = {
    mode: 'USSD', amount: montant, currency: 'XAF', externalId, provider,
    phoneNumber: `+242${national}`,
    description: `Hypnos réservation ${id}`,
    customerName: clientReservation ? `${clientReservation.prenom} ${clientReservation.nom}`.trim() : '',
    customerEmail: clientReservation?.email || undefined,
    metadata: { desktopReservationId: id }
  }
  let resultat
  try {
    resultat = await appelerApiKpay('/api/payments/kpay/init/', { method: 'POST', body: JSON.stringify(payload) })
  } catch (erreur) {
    if ([400, 401, 403, 409, 422].includes(erreur.httpStatus)) {
      await db.update(reservation).set({ kpayStatus: 'FAILED' }).where(eq(reservation.id, id))
    }
    throw erreur
  }
  if (resultat.isTest !== true) throw new ErreurMetier('KPay n’a pas confirmé le mode sandbox. Le paiement n’est pas enregistré dans la caisse; vérifiez son statut auprès du backend avant tout nouvel essai.')
  if (resultat.externalId !== externalId || Number(resultat.amount) !== montant || resultat.currency !== 'XAF' || !resultat.status) {
    throw new ErreurMetier('La réponse KPay ne correspond pas à la demande (référence, montant ou devise). Vérifiez le statut avant toute nouvelle tentative.')
  }
  await db.update(reservation).set({
    kpayExternalId: externalId,
    kpayStatus: resultat.status ?? 'INITIATION_UNKNOWN',
    kpayMode: mode,
    kpayAmount: montant,
    kpayRecorded: false
  }).where(eq(reservation.id, id))
  return { externalId, status: resultat.status, isTest: resultat.isTest, amount: resultat.amount, currency: resultat.currency }
}

const verrousVerificationKpay = new Set()
enregistrer('kpay:statut', async (reservationId, externalId) => {
  const id = Number(reservationId)
  const cle = `${id}:${externalId}`
  if (verrousVerificationKpay.has(cle)) throw new ErreurMetier('La vérification de ce paiement est déjà en cours.')
  verrousVerificationKpay.add(cle)
  try {
    return await consulterStatutKpay(id, externalId)
  } finally {
    verrousVerificationKpay.delete(cle)
  }
})

async function consulterStatutKpay(reservationId, externalId) {
  if (!session) throw new ErreurMetier('Session Hypnos expirée : reconnectez-vous avant de vérifier un paiement.')
  const id = Number(reservationId)
  const [r] = await db.select().from(reservation).where(eq(reservation.id, id))
  if (!r || r.kpayExternalId !== externalId || !externalId) throw new ErreurMetier('Ce paiement KPay ne correspond pas à cette réservation.')
  let resultat
  try {
    resultat = await appelerApiKpay(`/api/payments/kpay/status/${encodeURIComponent(externalId)}/`)
  } catch (erreur) {
    if (erreur.httpStatus === 404) {
      await db.update(reservation).set({ kpayStatus: 'FAILED' }).where(eq(reservation.id, id))
      throw new ErreurMetier('Le backend ne connaît pas cette demande. Elle peut être relancée; aucun paiement n’a été comptabilisé.')
    }
    throw erreur
  }
  if (resultat.isTest !== true) throw new ErreurMetier('Le backend n’a pas confirmé que ce paiement est sandbox; aucun reçu local n’a été créé.')
  if (resultat.externalId !== externalId || Number(resultat.amount) !== Number(r.kpayAmount) || resultat.currency !== 'XAF') {
    throw new ErreurMetier('La réponse de statut KPay ne correspond pas à la référence, au montant ou à la devise attendus; aucun reçu local n’a été créé.')
  }
  await db.transaction(async (tx) => {
    const [courante] = await tx.select().from(reservation).where(eq(reservation.id, id))
    if (!courante || courante.kpayExternalId !== externalId) throw new ErreurMetier('La réservation a changé pendant la vérification du paiement.')
    if (resultat.status === 'COMPLETED' && !courante.kpayRecorded) {
      const montant = Number(courante.kpayAmount)
      if (!Number.isInteger(montant) || montant < 1 || Number(resultat.amount) !== montant) throw new ErreurMetier('Le montant confirmé par KPay ne correspond pas au montant attendu; aucun mouvement de caisse n’a été ajouté.')
      const reste = await resteReservation(tx, courante)
      if (montant > reste) throw new ErreurMetier('KPay confirme le paiement, mais le solde local a changé entre-temps. Aucun mouvement n’a été ajouté; rapprochez le paiement manuellement.')
      await tx.update(reservation).set({
        montantPaye: courante.montantPaye + montant,
        kpayStatus: resultat.status,
        kpayRecorded: true
      }).where(eq(reservation.id, id))
      await tx.insert(mouvementCaisse).values({
        type: 'entree',
        categorie: courante.statut === 'confirmee' ? 'acompte' : 'paiement_client',
        montant,
        modePaiement: courante.kpayMode,
        reservationId: id,
        motif: `KPay ${externalId}`,
        dateMouvement: jourLocal(),
        createdBy: session.userId
      })
    } else {
      await tx.update(reservation).set({ kpayStatus: resultat.status }).where(eq(reservation.id, id))
    }
  })
  return { externalId, status: resultat.status, amount: resultat.amount, recorded: resultat.status === 'COMPLETED' }
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

const INTERDITS_CREATION = ['id', 'createdAt', 'updatedAt', 'kpayExternalId', 'kpayStatus', 'kpayMode', 'kpayAmount', 'kpayRecorded']
const INTERDITS_MISE_A_JOUR = ['id', 'createdAt', 'updatedAt', 'remoteId', 'createdBy', 'kpayExternalId', 'kpayStatus', 'kpayMode', 'kpayAmount', 'kpayRecorded']

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
  // Tout changement de statut est daté (nettoyage depuis N min, notifications…)
  if (data.statut !== undefined) data.statutDepuis = new Date().toISOString()
  return data
}

// Paramètres de l'hôtel : heures « HH:MM:SS » valides, marge de nettoyage entre 0 et 240 minutes
async function verifierTarifsTypeChambre(data, mode) {
  const valeurs = ['prix', 'prixHoraire']
  for (const champ of valeurs) {
    if (mode === 'create' && data[champ] === undefined && champ !== 'prixHoraire' && champ !== 'prixAccesReservation' && champ !== 'prixAccesEntree') {
      throw new ErreurMetier('Le tarif par nuit est obligatoire.')
    }
    if (data[champ] !== undefined) {
      const montant = Number(data[champ])
      if (!Number.isInteger(montant) || montant < 0) throw new ErreurMetier('Les tarifs doivent être des montants entiers positifs ou nuls en XAF.')
      data[champ] = montant
    }
  }
  if (data.reglePassage !== undefined && !['prorata', 'heure_commencee'].includes(data.reglePassage)) throw new ErreurMetier('Règle de tarification passage invalide.')
  if (mode === 'create') {
    data.reglePassage ??= 'prorata'
    data.prixHoraire ??= 0
    data.prixAccesReservation ??= 0
    data.prixAccesEntree ??= 0
  }
  return data
}

async function verifierHotel(data) {
  const heureValide = (h) => /^([01]\d|2[0-3]):[0-5]\d:00$/.test(String(h))
  for (const champ of ['heureArrivee', 'heureDepart']) {
    if (data[champ] !== undefined && !heureValide(data[champ])) {
      throw new ErreurMetier('Les heures indiquées ne sont pas valides.')
    }
  }
  if (data.margeNettoyageMinutes !== undefined) {
    const marge = Number(data.margeNettoyageMinutes)
    if (!Number.isInteger(marge) || marge < 0 || marge > 240) {
      throw new ErreurMetier('La marge de nettoyage doit être comprise entre 0 et 240 minutes.')
    }
    data.margeNettoyageMinutes = marge
  }
  if (
    data.statutChambreApresDepart !== undefined &&
    !['disponible', 'nettoyage'].includes(data.statutChambreApresDepart)
  ) {
    throw new ErreurMetier(
      'Le statut de chambre après départ doit être « disponible » ou « nettoyage ».'
    )
  }
  return data
}

// Réservations qui bloquent une chambre.
// « paiement en attente » n'est pas un statut enregistré : c'est un séjour terminé avec un reste à payer.
const STATUTS_ACTIFS = ['confirmee', 'en_sejour']

// Interdit deux réservations actives qui se chevauchent sur une même chambre,
// et toute réservation sur une chambre hors service ou marquée en nettoyage
async function verifierDisponibilite(data, mode, id) {
  const reglesArrondi = ['prorata', 'heure_commencee']
  if (data.typeSejour !== undefined && !['nuit', 'heure'].includes(data.typeSejour)) throw new ErreurMetier('Type de séjour invalide.')
  if (data.modeTarif !== undefined && !['nuit', 'heure'].includes(data.modeTarif)) throw new ErreurMetier('Le tarif se configure dans la catégorie de chambre.')
  if (data.regleArrondi !== undefined && !reglesArrondi.includes(data.regleArrondi)) throw new ErreurMetier('Règle de facturation horaire invalide.')
  if (data.tarifApplique !== undefined) {
    const tarif = Number(data.tarifApplique)
    if (!Number.isInteger(tarif) || tarif < 0) throw new ErreurMetier('Le tarif appliqué doit être un montant entier positif ou nul en XAF.')
    data.tarifApplique = tarif
  }
  if (data.nombreAdultes !== undefined) {
    const n = Number(data.nombreAdultes)
    if (!Number.isInteger(n) || n < 1) throw new ErreurMetier('Il faut au moins un adulte.')
    data.nombreAdultes = n
  }
  if (data.nombreEnfants !== undefined) {
    const n = Number(data.nombreEnfants)
    if (!Number.isInteger(n) || n < 0) throw new ErreurMetier('Le nombre d’enfants doit être positif ou nul.')
    data.nombreEnfants = n
  }
  if (data.typeGroupe !== undefined && !['seul', 'groupe'].includes(data.typeGroupe)) throw new ErreurMetier('Le type de client est invalide.')
  if (data.modePaiement !== undefined && !['especes', 'carte', 'mtn_money', 'airtel_money'].includes(data.modePaiement)) throw new ErreurMetier('Le moyen de paiement est invalide.')
  if (data.numeroPaiement !== undefined) {
    const numero = String(data.numeroPaiement).trim()
    if (numero.length > 30 || (numero && !/^[+0-9() .-]{6,30}$/.test(numero))) throw new ErreurMetier('Le numéro Mobile Money est invalide.')
    data.numeroPaiement = numero
  }
  if (data.modePaiement !== undefined && ['mtn_money', 'airtel_money'].includes(data.modePaiement) && mode === 'create' && !String(data.numeroPaiement ?? '').trim()) throw new ErreurMetier('Saisissez le numéro associé au portefeuille Mobile Money choisi.')
  if (data.conditionsPaiement !== undefined && !['', 'acompte_solde', 'total_arrivee', 'prepayee', 'facturation_societe'].includes(data.conditionsPaiement)) throw new ErreurMetier('Les conditions de paiement sont invalides.')
  if (data.nombreAdultes !== undefined && data.nombreEnfants !== undefined && data.nombreDePersonne !== undefined && Number(data.nombreAdultes) + Number(data.nombreEnfants) !== Number(data.nombreDePersonne)) throw new ErreurMetier('Le total des adultes et des enfants ne correspond pas au nombre de personnes.')
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
  const datesModifiees = mode === 'create' || data.dateDebut !== undefined || data.dateFin !== undefined
  if (datesModifiees) {
    const dateHeureLocaleValide = (v) => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(v)) && !Number.isNaN(new Date(String(v)).getTime())
    if (!dateHeureLocaleValide(final.dateDebut) || !dateHeureLocaleValide(final.dateFin)) {
      throw new ErreurMetier('Renseignez une date et une heure valides pour l’arrivée et le départ.')
    }
  }

  const [ch] = await db
    .select({ statut: chambre.statut, typeId: chambre.typeId })
    .from(chambre)
    .where(eq(chambre.id, Number(final.chambreId)))
  if (ch?.statut === 'maintenance') throw new ErreurMetier('Cette chambre est hors service.')
  if (ch?.statut === 'nettoyage') {
    throw new ErreurMetier('Cette chambre est en cours de nettoyage et doit être libérée par l’équipe avant toute réservation.')
  }
  const actualiserTarifCategorie = mode === 'create' || data.chambreId !== undefined || data.typeSejour !== undefined
  if (actualiserTarifCategorie && final.typeSejour === 'heure' && ch?.typeId) {
    const [categorie] = await db.select().from(typeDeChambre).where(eq(typeDeChambre.id, ch.typeId))
    if (!categorie) throw new ErreurMetier('Catégorie de chambre introuvable.')
    final.modeTarif = 'heure'
    final.tarifApplique = Number(categorie.prixHoraire || 0)
    final.regleArrondi = categorie.reglePassage || 'prorata'
  } else if (actualiserTarifCategorie && final.typeSejour === 'nuit' && ch?.typeId) {
    const [categorie] = await db.select().from(typeDeChambre).where(eq(typeDeChambre.id, ch.typeId))
    if (categorie) {
      final.modeTarif = 'nuit'
      final.tarifApplique = Number(categorie.prix || 0)
    }
  }

  // Lire les réservations actives de la chambre puis normaliser les anciennes dates AAAA-MM-JJ.
  // Les séjours historiques par nuit sont interprétés aux heures d'arrivée/départ de l'hôtel.
  const conflits = await db
    .select({ id: reservation.id, dateDebut: reservation.dateDebut, dateFin: reservation.dateFin })
    .from(reservation)
    .where(and(eq(reservation.chambreId, Number(final.chambreId)), inArray(reservation.statut, STATUTS_ACTIFS)))
  const debutFinal = String(final.dateDebut).length === 10 ? `${final.dateDebut}T15:00` : String(final.dateDebut).slice(0, 16)
  const finFinal = String(final.dateFin).length === 10 ? `${final.dateFin}T11:00` : String(final.dateFin).slice(0, 16)
  const conflit = conflits.some((r) => {
    if (mode === 'update' && Number(r.id) === Number(id)) return false
    const debutExistant = String(r.dateDebut).length === 10 ? `${r.dateDebut}T15:00` : String(r.dateDebut).slice(0, 16)
    const finExistante = String(r.dateFin).length === 10 ? `${r.dateFin}T11:00` : String(r.dateFin).slice(0, 16)
    return debutFinal < finExistante && finFinal > debutExistant
  })
  if (conflit) throw new ErreurMetier('Cette chambre est déjà réservée sur cette période.')
  if (final.modeTarif !== undefined) data.modeTarif = final.modeTarif
  if (final.tarifApplique !== undefined) data.tarifApplique = final.tarifApplique
  if (final.regleArrondi !== undefined) data.regleArrondi = final.regleArrondi
  return data
}

// ============================================================
//  CAISSE
//  Saisies à la main : service, don, renforcement, autre entrée / achat, dépense, retrait, autre sortie.
//  Acomptes, paiements clients et remboursements sont écrits uniquement par les canaux
//  « reservation:encaisser » et « reservation:annuler » (transaction).
// ============================================================

const ENTREES_MANUELLES = ['service', 'don', 'renforcement_patron', 'autre_entree']
const SORTIES_MANUELLES = ['achat', 'depense', 'retrait', 'autre_sortie']

// Solde = entrées − sorties, calculé en base. `executeur` : `db` ou une transaction.
async function soldeCaisse(executeur = db) {
  const [ligne] = await executeur
    .select({
      solde: sql`coalesce(sum(case when ${mouvementCaisse.type} = 'entree' then ${mouvementCaisse.montant} else -${mouvementCaisse.montant} end), 0)`
    })
    .from(mouvementCaisse)
  return Number(ligne.solde)
}

async function verifierCaisse(data) {
  const montant = Number(data.montant)
  if (!Number.isInteger(montant) || montant <= 0) throw new ErreurMetier('Saisissez un montant supérieur à 0.')
  data.montant = montant
  data.motif = String(data.motif ?? '').trim()
  if (!data.dateMouvement) data.dateMouvement = jourLocal()
  if (data.modePaiement && !MODES_PAIEMENT.includes(data.modePaiement)) {
    throw new ErreurMetier('Mode de paiement invalide.')
  }

  // Seule une sortie porte une pièce justificative : le nom doit être celui d'un fichier déjà copié
  if (data.type !== 'sortie') {
    data.pieceChemin = null
  } else if (data.pieceChemin) {
    const nom = basename(String(data.pieceChemin))
    if (nom !== data.pieceChemin || !fs.existsSync(join(dossierPieces(), nom))) {
      throw new ErreurMetier('Pièce justificative introuvable : joignez-la de nouveau.')
    }
  }

  if (data.type === 'entree') {
    if (!ENTREES_MANUELLES.includes(data.categorie)) throw new ErreurMetier("Origine de l'entrée invalide.")
    if (data.categorie === 'service' && !data.serviceId) throw new ErreurMetier('Choisissez le service concerné.')
  } else if (data.type === 'sortie') {
    if (!SORTIES_MANUELLES.includes(data.categorie)) throw new ErreurMetier('Catégorie de sortie invalide.')
    if (!data.motif) throw new ErreurMetier('Le motif est obligatoire pour une sortie de caisse.')
    const solde = await soldeCaisse()
    if (montant > solde) {
      throw new ErreurMetier(`Solde de caisse insuffisant (${solde.toLocaleString('fr-FR')} XAF).`)
    }
  } else {
    throw new ErreurMetier('Type de mouvement invalide.')
  }
  return data
}

// ---------- Pièces justificatives des sorties de caisse ----------
// Le fichier choisi est COPIÉ dans le dossier de données de l'application : il reste disponible
// même si l'original est déplacé. Seul le nom du fichier copié est enregistré en base.
const dossierPieces = () => join(app.getPath('userData'), 'pieces')
const TAILLE_MAX_PIECE = 10 * 1024 * 1024 // 10 Mo

enregistrer('caisse:choisirPiece', async () => {
  const choix = await dialog.showOpenDialog(mainWindow, {
    title: 'Joindre une pièce justificative',
    properties: ['openFile'],
    filters: [{ name: 'Facture ou reçu', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'] }]
  })
  if (choix.canceled || choix.filePaths.length === 0) return null

  const source = choix.filePaths[0]
  if (fs.statSync(source).size > TAILLE_MAX_PIECE) {
    throw new ErreurMetier('Ce fichier dépasse 10 Mo.')
  }
  await fs.promises.mkdir(dossierPieces(), { recursive: true })
  const nom = `${Date.now()}-${randomBytes(4).toString('hex')}${extname(source).toLowerCase()}`
  await fs.promises.copyFile(source, join(dossierPieces(), nom))
  return { nom, original: basename(source) }
})

enregistrer('caisse:ouvrirPiece', async (nom) => {
  const fichier = join(dossierPieces(), basename(String(nom ?? '')))
  if (!fs.existsSync(fichier)) throw new ErreurMetier('Cette pièce est introuvable sur cet ordinateur.')
  const erreur = await shell.openPath(fichier)
  if (erreur) throw new ErreurMetier("Impossible d'ouvrir cette pièce.")
  return { success: true }
})

// ---------- Apparence (thème) ----------
// Mémorisé dans un petit fichier du dossier de données, relu à chaque démarrage.
// `nativeTheme.themeSource` change aussi la valeur « prefers-color-scheme » vue par l'interface.
const THEMES = ['system', 'light', 'dark']
const fichierPreferences = () => join(app.getPath('userData'), 'preferences.json')

function lirePreferences() {
  try {
    return JSON.parse(fs.readFileSync(fichierPreferences(), 'utf8'))
  } catch {
    return {}
  }
}

enregistrer('apparence:obtenir', async () => nativeTheme.themeSource)

enregistrer('apparence:definir', async (theme) => {
  if (!THEMES.includes(theme)) throw new ErreurMetier('Thème invalide.')
  nativeTheme.themeSource = theme
  fs.writeFileSync(fichierPreferences(), JSON.stringify({ ...lirePreferences(), theme }))
  return { theme }
})

// ============================================================
//  CRUD : un seul enregistrement par table
//  Le nom de la clé est le préfixe du canal IPC (ex. « clients:getAll »).
//  Il doit rester identique à la liste TABLES du preload.
//  `ajoutSeul` : lecture et création uniquement (journal non modifiable).
// ============================================================

const TABLES = {
  clients: { table: client },
  demande: { table: demande },
  reservation: { table: reservation, avantEcriture: verifierDisponibilite },
  hotel: { table: hotel, avantEcriture: verifierHotel },
  utilisateur: { table: user, secrets: ['passwordHash', 'recoveryCodeHash'] },
  service: { table: service },
  consommation: { table: consommation },
  chambre: { table: chambre, avantEcriture: verifierTypeChambre },
  typedechambre: { table: typeDeChambre, avantEcriture: verifierTarifsTypeChambre },
  facture: { table: facture },
  mouvementcaisse: { table: mouvementCaisse, avantEcriture: verifierCaisse, ajoutSeul: true }
}

for (const [canal, { table, avantEcriture, secrets = [], ajoutSeul = false }] of Object.entries(TABLES)) {
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
    // L'auteur vient de la session, jamais de l'interface
    if (mode === 'create' && 'createdBy' in getTableColumns(table)) {
      if (!session) throw new ErreurMetier('Session expirée : reconnectez-vous.')
      propre.createdBy = session.userId
    }
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

  // Le journal de caisse n'est jamais modifié ni supprimé : une erreur se corrige par une écriture inverse
  if (ajoutSeul) continue

  enregistrer(`${canal}:update`, async (id, data) => {
    const valeurs = await preparer(data, 'update', id)
    if (Object.keys(valeurs).length === 0) throw new ErreurMetier('Aucune modification à enregistrer.')
    const lignes = await db.update(table).set(valeurs).where(eq(table.id, Number(id))).returning()
    if (!lignes[0]) throw new ErreurMetier('Élément introuvable.')
    return masquer(lignes[0])
  })

  enregistrer(`${canal}:delete`, async (id) => {
    if (canal !== 'chambre') {
      await db.delete(table).where(eq(table.id, Number(id)))
      return { success: true }
    }

    const chambreId = Number(id)
    const resultat = await db.transaction(async (tx) => {
      const [existante] = await tx.select().from(chambre).where(eq(chambre.id, chambreId))
      if (!existante) throw new ErreurMetier('Chambre introuvable.')
      const reservationsLiees = await tx.select({ id: reservation.id }).from(reservation).where(eq(reservation.chambreId, chambreId)).limit(1)
      if (reservationsLiees.length) {
        throw new ErreurMetier('Suppression impossible : cette chambre est liée à une réservation. Conservez-la pour préserver l’historique et la caisse.')
      }
      const demandesLiees = await tx.select({ id: demande.id }).from(demande).where(eq(demande.chambreDemandeeId, chambreId)).limit(1)
      if (demandesLiees.length) {
        throw new ErreurMetier('Suppression impossible : cette chambre est demandée dans une réservation en ligne. Modifiez d’abord la demande.')
      }
      const [utilisateur] = session?.userId
        ? await tx.select({ hotelId: user.hotelId }).from(user).where(eq(user.id, session.userId))
        : []
      const [hotelActif] = utilisateur
        ? await tx.select().from(hotel).where(eq(hotel.id, utilisateur.hotelId))
        : []
      if (!hotelActif) throw new ErreurMetier('Hôtel de la session introuvable.')

      await tx.delete(chambre).where(eq(chambre.id, chambreId))
      await tx.update(hotel).set({ nombreChambres: Math.max(0, hotelActif.nombreChambres - 1) }).where(eq(hotel.id, hotelActif.id))
      return { success: true }
    })
    await db.run(sql`PRAGMA foreign_keys = ON`)
    return resultat
  })
}

// ============================================================
//  ENCAISSEMENT ET ANNULATION (une transaction chacun)
// ============================================================

// Un paiement avant l'arrivée est un acompte, ensuite c'est un règlement : la nature est choisie par l'interface
// selon le statut de la réservation, et validée ici.
enregistrer('reservation:encaisser', async (id, donnees) => {
  const montant = Number(donnees?.montant)
  const nature = donnees?.nature ?? 'paiement_client'
  if (!session) throw new ErreurMetier('Session expirée : reconnectez-vous.')
  if (verrousInitialisationKpay.has(Number(id))) throw new ErreurMetier('Une initiation KPay est en cours. Attendez son résultat avant tout autre encaissement.')
  if (!Number.isInteger(montant) || montant <= 0) throw new ErreurMetier('Saisissez un montant supérieur à 0.')
  if (!MODES_PAIEMENT.includes(donnees?.mode)) throw new ErreurMetier('Choisissez le mode de paiement.')
  if (!['acompte', 'paiement_client'].includes(nature)) throw new ErreurMetier('Nature de paiement invalide.')

  const resultat = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(reservation).where(eq(reservation.id, Number(id)))
    if (!r) throw new ErreurMetier('Réservation introuvable.')
    if (r.statut === 'annulee') throw new ErreurMetier('Cette réservation est annulée.')
    if (r.kpayExternalId && !r.kpayRecorded && ['CREATED', 'PENDING', 'PROCESSING', 'INITIATION_UNKNOWN'].includes(r.kpayStatus)) {
      throw new ErreurMetier('Un paiement KPay est encore en attente. Vérifiez son statut avant tout autre encaissement.')
    }
    await tx.update(reservation).set({ montantPaye: r.montantPaye + montant }).where(eq(reservation.id, r.id))
    await tx.insert(mouvementCaisse).values({
      type: 'entree',
      categorie: nature,
      montant,
      modePaiement: donnees.mode,
      reservationId: r.id,
      dateMouvement: jourLocal(),
      createdBy: session.userId
    })
    return { success: true }
  })
  await db.run(sql`PRAGMA foreign_keys = ON`) // la transaction ouvre une nouvelle connexion
  return resultat
})

// Annulation : l'acompte est remboursé (sortie de caisse) ou conservé, au choix de la réceptionniste
enregistrer('reservation:annuler', async (id, options) => {
  const rembourser = Boolean(options?.rembourser)
  if (!session) throw new ErreurMetier('Session expirée : reconnectez-vous.')
  if (verrousInitialisationKpay.has(Number(id))) throw new ErreurMetier('Une initiation KPay est en cours. Attendez son résultat avant d’annuler la réservation.')

  const resultat = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(reservation).where(eq(reservation.id, Number(id)))
    if (!r) throw new ErreurMetier('Réservation introuvable.')
    if (r.kpayExternalId && !r.kpayRecorded && ['CREATED', 'PENDING', 'PROCESSING', 'INITIATION_UNKNOWN'].includes(r.kpayStatus)) {
      throw new ErreurMetier('Un paiement KPay est encore en cours ou à vérifier. Contrôlez son statut avant d’annuler la réservation.')
    }
    if (!['confirmee', 'en_attente'].includes(r.statut)) {
      throw new ErreurMetier('Seule une réservation non commencée peut être annulée.')
    }
    await tx
      .update(reservation)
      .set({ statut: 'annulee', ...(rembourser ? { montantPaye: 0 } : {}) })
      .where(eq(reservation.id, r.id))
    if (rembourser && r.montantPaye > 0) {
      if (r.montantPaye > (await soldeCaisse(tx))) {
        throw new ErreurMetier(`Solde de caisse insuffisant pour rembourser ${r.montantPaye.toLocaleString('fr-FR')} XAF.`)
      }
      await tx.insert(mouvementCaisse).values({
        type: 'sortie',
        categorie: 'remboursement_acompte',
        montant: r.montantPaye,
        reservationId: r.id,
        motif: `Annulation de la réservation n°${r.id}`,
        dateMouvement: jourLocal(),
        createdBy: session.userId
      })
    }
    return { success: true }
  })
  await db.run(sql`PRAGMA foreign_keys = ON`)
  return resultat
})

// ============================================================
//  ARRIVÉE ET DÉPART (réservation et chambre changent ensemble, ou pas du tout)
// ============================================================

const REFUS_ARRIVEE = {
  occupee: 'Cette chambre est encore occupée par un autre séjour.',
  nettoyage: 'Cette chambre est en cours de nettoyage.',
  maintenance: 'Cette chambre est hors service.'
}

enregistrer('reservation:arrivee', async (id) => {
  const resultat = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(reservation).where(eq(reservation.id, Number(id)))
    if (!r) throw new ErreurMetier('Réservation introuvable.')
    if (r.statut !== 'confirmee') throw new ErreurMetier("L'arrivée n'est possible que pour une réservation confirmée.")

    const [ch] = await tx.select().from(chambre).where(eq(chambre.id, r.chambreId))
    if (!ch) throw new ErreurMetier('Chambre introuvable.')
    if (REFUS_ARRIVEE[ch.statut]) throw new ErreurMetier(REFUS_ARRIVEE[ch.statut])

    await tx.update(reservation).set({ statut: 'en_sejour' }).where(eq(reservation.id, r.id))
    await tx
      .update(chambre)
      .set({ statut: 'occupee', statutDepuis: new Date().toISOString() })
      .where(eq(chambre.id, ch.id))
    return { success: true, numeroChambre: ch.numero }
  })
  await db.run(sql`PRAGMA foreign_keys = ON`)
  return resultat
})

// Le personnel confirme le départ : l'état de la chambre suit la préférence de l'hôtel.
// Un solde restant est conservé comme « Paiement en attente » dans l'affichage de la réservation.
enregistrer('reservation:depart', async (id) => {
  const resultat = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(reservation).where(eq(reservation.id, Number(id)))
    if (!r) throw new ErreurMetier('Réservation introuvable.')
    if (r.statut !== 'en_sejour') throw new ErreurMetier("Le départ n'est possible que pour un séjour en cours.")

    const [utilisateur] = session?.userId
      ? await tx.select({ hotelId: user.hotelId }).from(user).where(eq(user.id, session.userId))
      : []
    const [hotelActif] = utilisateur
      ? await tx
          .select({ statutChambreApresDepart: hotel.statutChambreApresDepart })
          .from(hotel)
          .where(eq(hotel.id, utilisateur.hotelId))
      : []
    const statutChambre = ['disponible', 'nettoyage'].includes(hotelActif?.statutChambreApresDepart)
      ? hotelActif.statutChambreApresDepart
      : 'nettoyage'

    await tx.update(reservation).set({ statut: 'terminee' }).where(eq(reservation.id, r.id))
    await tx
      .update(chambre)
      .set({ statut: statutChambre, statutDepuis: new Date().toISOString() })
      .where(eq(chambre.id, r.chambreId))
    return { success: true }
  })
  await db.run(sql`PRAGMA foreign_keys = ON`)
  return resultat
})

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

  const username = texte(d?.username).toLowerCase()
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new ErreurMetier('Le nom d’utilisateur doit compter 3 à 30 caractères (lettres, chiffres, point, tiret ou tiret bas).')
  }
  const email = texte(d?.email).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErreurMetier('Adresse e-mail invalide.')

  const motDePasse = String(d?.motDePasse ?? '')
  if (motDePasse.length < 8) throw new ErreurMetier('Le mot de passe doit contenir au moins 8 caractères.')

  return {
    nom, ville, adresse: texte(d?.adresse), tel: texte(d?.tel),
    etagesHauts, chambresParEtage, chambresRez, tarif, arrivee, depart,
    prenom, nomFamille, username, email, motDePasse
  }
}

// Crée l'hôtel, sa catégorie « Standard », toutes ses chambres et le compte administrateur, en une seule transaction
enregistrer(
  'hotel:creerComplet',
  async (donnees) => {
    if (await hotelExiste()) throw new ErreurMetier('Un hôtel existe déjà sur cet ordinateur.')
    const p = validerCreation(donnees)
    const identifiantExistant = await db.select({ id: user.id }).from(user).where(eq(user.username, p.username)).limit(1)
    if (identifiantExistant.length) throw new ErreurMetier('Ce nom d’utilisateur est déjà utilisé.')
    const empreinte = await hacherMotDePasse(p.motDePasse)
    const codeSecours = genererCodeSecours()
    const empreinteCodeSecours = await hacherMotDePasse(normaliserCodeSecours(codeSecours))
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
          username: p.username,
          email: p.email,
          firstName: p.prenom,
          lastName: p.nomFamille,
          role: 'administrateur',
          passwordHash: empreinte,
          recoveryCodeHash: empreinteCodeSecours
        })
        .returning()
      return u
    })

    // La transaction ouvre une nouvelle connexion : on réactive les clés étrangères
    await db.run(sql`PRAGMA foreign_keys = ON`)

    session = { userId: admin.id }
    return { ...utilisateurPublic(admin), recoveryCode: codeSecours }
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

enregistrer('auth:changerAcces', async (motDePasseActuel, nouvelIdentifiant, nouveauMotDePasse = '') => {
  if (!session) throw new ErreurMetier('Session expirée : reconnectez-vous.')
  const [compte] = await db.select().from(user).where(eq(user.id, session.userId))
  if (!compte || !(await verifierMotDePasse(motDePasseActuel, compte.passwordHash))) {
    throw new ErreurMetier('Le mot de passe actuel est incorrect.')
  }
  const username = String(nouvelIdentifiant ?? '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new ErreurMetier('Le nom d’utilisateur doit compter 3 à 30 caractères (lettres, chiffres, point, tiret ou tiret bas).')
  }
  const existe = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1)
  if (existe.length && existe[0].id !== compte.id) throw new ErreurMetier('Ce nom d’utilisateur est déjà utilisé.')
  const motDePasse = String(nouveauMotDePasse ?? '')
  if (motDePasse && motDePasse.length < 8) throw new ErreurMetier('Le nouveau mot de passe doit contenir au moins 8 caractères.')
  const passwordHash = motDePasse ? await hacherMotDePasse(motDePasse) : compte.passwordHash
  const [maj] = await db.update(user).set({ username, passwordHash }).where(eq(user.id, compte.id)).returning()
  return utilisateurPublic(maj)
})

enregistrer('auth:genererCodeSecours', async (motDePasseActuel) => {
  if (!session) throw new ErreurMetier('Session expirée : reconnectez-vous.')
  const [compte] = await db.select().from(user).where(eq(user.id, session.userId))
  if (!compte || !(await verifierMotDePasse(motDePasseActuel, compte.passwordHash))) {
    throw new ErreurMetier('Le mot de passe actuel est incorrect.')
  }
  const recoveryCode = genererCodeSecours()
  const recoveryCodeHash = await hacherMotDePasse(normaliserCodeSecours(recoveryCode))
  await db.update(user).set({ recoveryCodeHash }).where(eq(user.id, compte.id))
  return { recoveryCode }
})

enregistrer(
  'auth:recupererAcces',
  async (code, nouvelIdentifiant, nouveauMotDePasse) => {
    const codeNormalise = normaliserCodeSecours(code)
    const username = String(nouvelIdentifiant ?? '').trim().toLowerCase()
    const motDePasse = String(nouveauMotDePasse ?? '')
    if (!codeNormalise || !username || !motDePasse) {
      throw new ErreurMetier('Renseignez le code de secours, le nom d’utilisateur souhaité et un nouveau mot de passe.')
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new ErreurMetier('Le nom d’utilisateur doit compter 3 à 30 caractères (lettres, chiffres, point, tiret ou tiret bas).')
    }
    if (motDePasse.length < 8) throw new ErreurMetier('Le nouveau mot de passe doit contenir au moins 8 caractères.')
    const comptes = await db.select().from(user)
    let compte = null
    for (const candidat of comptes) {
      if (candidat.recoveryCodeHash && await verifierMotDePasse(codeNormalise, candidat.recoveryCodeHash)) {
        compte = candidat
        break
      }
    }
    if (!compte || !compte.isActive) {
      await new Promise((resolve) => setTimeout(resolve, 700))
      throw new ErreurMetier('Code de secours invalide ou déjà utilisé.')
    }
    const existe = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1)
    if (existe.length && existe[0].id !== compte.id) throw new ErreurMetier('Ce nom d’utilisateur est déjà utilisé.')
    const recoveryCode = genererCodeSecours()
    const [maj] = await db.update(user).set({
      username,
      passwordHash: await hacherMotDePasse(motDePasse),
      recoveryCodeHash: await hacherMotDePasse(normaliserCodeSecours(recoveryCode))
    }).where(eq(user.id, compte.id)).returning()
    session = { userId: maj.id }
    return { utilisateur: utilisateurPublic(maj), recoveryCode }
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
      ? {
          id: h.id,
          name: h.name,
          ville: h.ville,
          heureArrivee: h.heureArrivee,
          heureDepart: h.heureDepart,
          margeNettoyageMinutes: h.margeNettoyageMinutes
        }
      : null
  }
})

// ============================================================
//  MISES À JOUR (GitHub Releases, dépôt « hypnos-update-history »)
//  La publication se fait au git tag (voir .github/workflows/release.yml).
//  L'état est envoyé à la fenêtre principale : la barre de titre l'affiche.
//  La vérification démarre dès l'ouverture de la fenêtre principale.
// ============================================================

// aucune | verification | disponible | telechargement | prete | erreur
let etatMaj = { etat: 'aucune' }
let majPromise = null // démarrage unique (évite les doubles écouteurs et le double minuteur)
let updater = null
let majCancellationToken = null
let versionMaj = null

// electron-updater est chargé à la demande : jamais en développement, et en parallèle du
// chargement de la fenêtre principale dans l'application installée.
async function chargerUpdater() {
  if (updater) return updater
  const module = await import('electron-updater')
  // Selon la façon dont le paquet est empaqueté, l'objet est à la racine ou dans « default »
  updater = module.autoUpdater ?? module.default?.autoUpdater
  if (!updater) throw new Error("Module de mise à jour introuvable.")
  return updater
}

function diffuserMaj(nouvelEtat) {
  etatMaj = nouvelEtat
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('maj:etat', etatMaj)
  }
}

async function demarrerMisesAJour() {
  // En développement, aucune vérification réelle (l'application n'est pas installée).
  // Pour tester l'affichage de la barre de titre : HYPNOS_MAJ_TEST=1 npm run dev
  if (is.dev) {
    if (process.env['HYPNOS_MAJ_TEST']) {
      setTimeout(() => diffuserMaj({ etat: 'disponible', version: '9.9.9' }), 3000)
    }
    return null
  }

  const u = await chargerUpdater()
  u.autoDownload = false // l'utilisateur décide du téléchargement
  u.autoInstallOnAppQuit = true // installée à la fermeture si déjà téléchargée

  u.on('checking-for-update', () => diffuserMaj({ etat: 'verification' }))
  u.on('update-not-available', () => diffuserMaj({ etat: 'aucune' }))
  u.on('update-available', (info) => {
    versionMaj = info.version
    diffuserMaj({ etat: 'disponible', version: info.version })
  })
  u.on('download-progress', (p) =>
    diffuserMaj({ etat: 'telechargement', pourcent: Math.round(p.percent) })
  )
  u.on('update-downloaded', (info) => diffuserMaj({ etat: 'prete', version: info.version }))
  u.on('update-cancelled', () => {
    majCancellationToken = null
    diffuserMaj({ etat: 'disponible', version: versionMaj })
  })
  u.on('error', (e) => {
    // Hors connexion ou dépôt injoignable : on ne dérange pas l'utilisateur
    console.error('Mise à jour :', e)
    diffuserMaj({ etat: 'erreur' })
  })

  const verifier = () => u.checkForUpdates().catch(() => {})
  verifier()
  setInterval(verifier, 4 * 60 * 60 * 1000) // puis toutes les 4 heures
  return u
}

function initialiserMisesAJour() {
  if (!majPromise) majPromise = demarrerMisesAJour()
  return majPromise
}

enregistrer('maj:etat', async () => etatMaj)

enregistrer('maj:verifier', async () => {
  if (is.dev) return etatMaj
  // Ne relance pas une vérification pendant un téléchargement ou si la mise à jour est prête
  if (etatMaj.etat === 'telechargement' || etatMaj.etat === 'prete') return etatMaj
  const u = await initialiserMisesAJour()
  await u.checkForUpdates()
  return etatMaj
})

enregistrer('maj:telecharger', async () => {
  if (is.dev) throw new ErreurMetier('Les mises à jour sont désactivées en développement.')
  if (etatMaj.etat !== 'disponible') throw new ErreurMetier('Aucune mise à jour à télécharger.')
  const u = await initialiserMisesAJour()
  const { CancellationToken } = await import('builder-util-runtime')
  const token = new CancellationToken()
  majCancellationToken = token
  diffuserMaj({ etat: 'telechargement', pourcent: 0 })
  try {
    await u.downloadUpdate(token)
  } catch (e) {
    if (!token.cancelled) throw e
  } finally {
    if (majCancellationToken === token) majCancellationToken = null
  }
  return { success: true }
})
enregistrer('maj:annuler', async () => {
  if (!majCancellationToken || etatMaj.etat !== 'telechargement') {
    throw new ErreurMetier('Aucun téléchargement de mise à jour à annuler.')
  }
  majCancellationToken.cancel()
  return { success: true }
})

enregistrer('maj:installer', async () => {
  if (is.dev) throw new ErreurMetier('Les mises à jour sont désactivées en développement.')
  if (etatMaj.etat !== 'prete') throw new ErreurMetier("La mise à jour n'est pas encore téléchargée.")
  const u = await initialiserMisesAJour()
  // (silencieux = false, relancer après installation = true)
  setImmediate(() => u.quitAndInstall(false, true))
  return { success: true }
})

// ============================================================
//  CYCLE DE VIE DE L'APPLICATION
// ============================================================

app.whenReady().then(() => {
  journal('Electron prêt')

  // Définit aussi l'identité de l'icône dans la barre des tâches (Windows)
  electronApp.setAppUserModelId('com.hypnos.app')

  // Thème choisi dans les paramètres, appliqué avant l'ouverture de la première fenêtre
  const themeEnregistre = lirePreferences().theme
  if (THEMES.includes(themeEnregistre)) nativeTheme.themeSource = themeEnregistre

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

  // Les migrations démarrent tout de suite, EN PARALLÈLE de l'affichage de l'écran de chargement
  basePromise = initialiserBase().catch((e) => {
    console.error('Base de données :', e)
    return false
  })

  demarrerParcours()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) demarrerParcours()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
