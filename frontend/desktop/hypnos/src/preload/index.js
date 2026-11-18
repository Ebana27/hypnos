import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Tables autorisées. Doit rester identique aux clés de TABLES dans main/index.js.
const TABLES = [
  'clients',
  'demande',
  'reservation',
  'hotel',
  'utilisateur',
  'service',
  'consommation',
  'chambre',
  'typedechambre',
  'facture',
  'mouvementcaisse'
]

function verifierTable(table) {
  if (!TABLES.includes(table)) throw new Error(`Table inconnue : « ${table} ».`)
}

// Appel IPC qui renvoie le message d'erreur en français, sans le préfixe
// technique « Error invoking remote method '...' » ajouté par Electron.
async function appeler(canal, ...args) {
  try {
    return await ipcRenderer.invoke(canal, ...args)
  } catch (e) {
    const message = String(e?.message ?? e).replace(
      /^Error invoking remote method '[^']+': (Error: )?/,
      ''
    )
    throw new Error(message)
  }
}

// API exposée à toute l'application
const api = {
  // -------- Fenêtre --------
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onloadingDone: () => ipcRenderer.send('onloading:done'),
  finishonloading: () => ipcRenderer.send('onloading:done'),
  loginDone: () => ipcRenderer.send('login:done'),
  setupDone: () => ipcRenderer.send('setup:done'),

  // -------- Accès --------
  connexion: (identifiant, motDePasse) => appeler('auth:connexion', identifiant, motDePasse),
  creerHotel: (donnees) => appeler('hotel:creerComplet', donnees),
  sessionCourante: () => appeler('session:courante'),

  // -------- Mises à jour --------
  // États possibles : aucune | verification | disponible | telechargement | prete | erreur
  maj: {
    etat: () => appeler('maj:etat'),
    verifier: () => appeler('maj:verifier'),
    telecharger: () => appeler('maj:telecharger'),
    installer: () => appeler('maj:installer'),
    // Renvoie une fonction de désinscription (à appeler dans le nettoyage de useEffect)
    surChangement: (rappel) => {
      const ecouteur = (_event, etat) => rappel(etat)
      ipcRenderer.on('maj:etat', ecouteur)
      return () => ipcRenderer.removeListener('maj:etat', ecouteur)
    }
  },

  // -------- CRUD générique --------
  getAll: async (table) => {
    verifierTable(table)
    return appeler(`${table}:getAll`)
  },
  getById: async (table, id) => {
    verifierTable(table)
    return appeler(`${table}:getById`, id)
  },
  create: async (table, data) => {
    verifierTable(table)
    return appeler(`${table}:create`, data)
  },
  update: async (table, id, data) => {
    verifierTable(table)
    return appeler(`${table}:update`, id, data)
  },
  remove: async (table, id) => {
    verifierTable(table)
    return appeler(`${table}:delete`, id)
  },

  // -------- Actions métier (transaction côté serveur) --------
  encaisser: (id, donnees) => appeler('reservation:encaisser', id, donnees),
  annuler: (id, options) => appeler('reservation:annuler', id, options),
  arrivee: (id) => appeler('reservation:arrivee', id),
  depart: (id) => appeler('reservation:depart', id),

  // -------- Apparence : 'system' | 'light' | 'dark' --------
  apparence: {
    obtenir: () => appeler('apparence:obtenir'),
    definir: (theme) => appeler('apparence:definir', theme)
  },

  // -------- Pièces justificatives de la caisse --------
  caisse: {
    choisirPiece: () => appeler('caisse:choisirPiece'),
    ouvrirPiece: (nom) => appeler('caisse:ouvrirPiece', nom)
  },

  // -------- Anciens noms (à supprimer quand les pages utiliseront le CRUD générique) --------
  getClients: () => api.getAll('clients'),
  createClient: (data) => api.create('clients', data),
  getClientById: (id) => api.getById('clients', id),
  updateClient: (id, data) => api.update('clients', id, data),
  deleteClient: (id) => api.remove('clients', id),

  getChambres: () => api.getAll('chambre'),
  getReservations: () => api.getAll('reservation')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('windowControls', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.electronAPI = api
  window.api = api
  window.windowControls = api
}