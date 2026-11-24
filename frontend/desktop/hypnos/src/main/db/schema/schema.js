// ===========================================================================
//  Hypnos — DATABASE 2 (backoffice local) — schéma Drizzle / SQLite
// ===========================================================================

import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const now = () => new Date().toISOString();

const timestamps = {
  createdAt: text('created_at').notNull().$defaultFn(now),
  updatedAt: text('updated_at').notNull().$defaultFn(now).$onUpdateFn(now),
};

// ---------------------------------------------------------------------------
//  Hôtel et comptes
// ---------------------------------------------------------------------------

export const hotel = sqliteTable(
  'hotel',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remoteId: integer('remote_id').unique(),
    name: text('name', { length: 150 }).notNull(),
    adresse: text('adresse', { length: 255 }).notNull(),
    ville: text('ville', { length: 100 }).notNull(),
    tel: text('tel', { length: 30 }).notNull(),
    email: text('email', { length: 255 }).notNull(),
    nombreEtages: integer('nombre_etages').notNull(),
    nombreChambres: integer('nombre_chambres').notNull(),
    heureArrivee: text('heure_arrivee').notNull().default('15:00:00'),
    heureDepart: text('heure_depart').notNull().default('11:00:00'),
    // Délai prévu pour nettoyer une chambre après un départ (notifications de nettoyage en retard)
    margeNettoyageMinutes: integer('marge_nettoyage_minutes').notNull().default(60),
    // État appliqué à la chambre quand le personnel confirme le départ du client
    statutChambreApresDepart: text('statut_chambre_apres_depart', {
      enum: ['disponible', 'nettoyage']
    })
      .notNull()
      .default('nettoyage'),
  },
  (t) => [
    check('hotel_etages_min', sql`${t.nombreEtages} >= 1`),
    check('hotel_chambres_min', sql`${t.nombreChambres} >= 0`),
  ],
);

export const user = sqliteTable('user', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  remoteId: integer('remote_id').unique(),
  hotelId: integer('hotel_id')
    .notNull()
    .references(() => hotel.id, { onDelete: 'restrict' }),
  username: text('username', { length: 150 }).notNull().unique(),
  passwordHash: text('password_hash').notNull().default(''),
  recoveryCodeHash: text('recovery_code_hash'),
  email: text('email', { length: 255 }).notNull().unique(),
  firstName: text('first_name', { length: 150 }).notNull().default(''),
  lastName: text('last_name', { length: 150 }).notNull().default(''),
  role: text('role', { length: 30 }).notNull().default('receptionniste'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// ---------------------------------------------------------------------------
//  Chambres
// ---------------------------------------------------------------------------

export const typeDeChambre = sqliteTable(
  'type_de_chambre',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remoteId: integer('remote_id').unique(),
    label: text('label', { length: 100 }).notNull().unique(),
    prix: integer('prix').notNull(), // tarif par nuit (XAF)
    prixHoraire: integer('prix_horaire').notNull().default(0),
    reglePassage: text('regle_passage', { enum: ['prorata', 'heure_commencee'] }).notNull().default('prorata'),
    capacite: integer('capacite').notNull(),
  },
  (t) => [
    check('type_prix_min', sql`${t.prix} >= 0`),
    check('type_prix_horaire_min', sql`${t.prixHoraire} >= 0`),
    check('type_capacite_min', sql`${t.capacite} >= 1`),
  ],
);

export const chambre = sqliteTable(
  'chambre',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remoteId: integer('remote_id').unique(),
    typeId: integer('type_id')
      .notNull()
      .references(() => typeDeChambre.id, { onDelete: 'restrict' }),
    numero: text('numero', { length: 20 }).notNull().unique(),
    etage: integer('etage').notNull(),
    // « nettoyage » : simple valeur de texte, SQLite n'a pas de contrainte sur l'énumération (aucune migration)
    statut: text('statut', { enum: ['disponible', 'occupee', 'nettoyage', 'maintenance'] })
      .notNull()
      .default('disponible'),
    // Date (ISO) du dernier changement de statut : sert au « nettoyage depuis N min »
    statutDepuis: text('statut_depuis'),
    climatisation: integer('climatisation', { mode: 'boolean' }).notNull().default(false),
    television: integer('television', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('chambre_statut_idx').on(t.statut),
    check('chambre_etage_min', sql`${t.etage} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
//  Clients, demandes, réservations
// ---------------------------------------------------------------------------

export const client = sqliteTable(
  'client',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remoteId: integer('remote_id').unique(),
    nom: text('nom', { length: 100 }).notNull(),
    prenom: text('prenom', { length: 100 }).notNull(),
    tel: text('tel', { length: 30 }).notNull(),
    email: text('email', { length: 255 }).notNull(),
    document: text('document', { length: 255 }).notNull().default(''),
    preference: text('preference', { length: 255 }).notNull().default(''),
    allergies: text('allergies', { length: 1000 }).notNull().default(''),
    infoGenerales: text('info_generales', { length: 2000 }).notNull().default(''),
    vip: integer('vip', { mode: 'boolean' }).notNull().default(false),
    sexe: text('sexe', { enum: ['M', 'F'] }).notNull(),
    loyalty: integer('loyalty', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index('client_nom_prenom_idx').on(t.nom, t.prenom)],
);

export const demande = sqliteTable(
  'demande',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remoteId: integer('remote_id').notNull().unique(),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'restrict' }),
    chambreDemandeeId: integer('chambre_demandee_id').references(() => chambre.id, {
      onDelete: 'set null',
    }),
    dateDebut: text('date_debut').notNull(),
    dateFin: text('date_fin').notNull(),
    nombreDePersonne: integer('nombre_de_personne').notNull(),
    statut: text('statut', { enum: ['en_attente', 'acceptee', 'refusee'] })
      .notNull()
      .default('en_attente'),
    dateDecision: text('date_decision'),
    motifRefus: text('motif_refus', { length: 255 }).notNull().default(''),
    ...timestamps,
  },
  (t) => [
    index('demande_statut_date_idx').on(t.statut, t.dateDebut),
    check('demande_fin_apres_debut', sql`${t.dateFin} > ${t.dateDebut}`),
    check('demande_min_une_personne', sql`${t.nombreDePersonne} >= 1`),
  ],
);

export const reservation = sqliteTable(
  'reservation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    remoteId: integer('remote_id').unique(),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'restrict' }),
    chambreId: integer('chambre_id')
      .notNull()
      .references(() => chambre.id, { onDelete: 'restrict' }),
    demandeId: integer('demande_id')
      .unique()
      .references(() => demande.id, { onDelete: 'set null' }),
    createdBy: integer('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    dateDebut: text('date_debut').notNull(),
    dateFin: text('date_fin').notNull(),
    typeSejour: text('type_sejour', { enum: ['nuit', 'heure'] }).notNull().default('nuit'),
    modeTarif: text('mode_tarif', { enum: ['nuit', 'heure'] }).notNull().default('nuit'),
    regleArrondi: text('regle_arrondi', { enum: ['prorata', 'heure_commencee'] }).notNull().default('prorata'),
    tarifApplique: integer('tarif_applique').notNull().default(0),
    nombreAdultes: integer('nombre_adultes').notNull().default(1),
    nombreEnfants: integer('nombre_enfants').notNull().default(0),
    typeGroupe: text('type_groupe', { enum: ['seul', 'groupe'] }).notNull().default('seul'),
    demandesSpeciales: text('demandes_speciales', { length: 2000 }).notNull().default(''),
    conditionsPaiement: text('conditions_paiement', { length: 500 }).notNull().default(''),
    modePaiement: text('mode_paiement', { enum: ['especes', 'carte', 'mtn_money', 'airtel_money'] }).notNull().default('especes'),
    numeroPaiement: text('numero_paiement', { length: 30 }).notNull().default(''),
    kpayExternalId: text('kpay_external_id'),
    kpayStatus: text('kpay_status'),
    kpayMode: text('kpay_mode'),
    kpayAmount: integer('kpay_amount'),
    kpayRecorded: integer('kpay_recorded', { mode: 'boolean' }).notNull().default(false),
    statut: text('statut', {
      enum: ['en_attente', 'confirmee', 'en_sejour', 'terminee', 'annulee']
    })
      .notNull()
      .default('confirmee'),
    canal: text('canal', {
      enum: ['direct', 'telephone', 'booking', 'entreprise', 'site']
    })
      .notNull()
      .default('direct'),
    montantPaye: integer('montant_paye').notNull().default(0),
    nombreDePersonne: integer('nombre_de_personne').notNull(),
    // statut: text('statut', { enum: ['confirmee', 'terminee', 'annulee'] })
    //   .notNull()
    //   .default('confirmee'),
    // ...timestamps,
  },
  (t) => [
    index('reservation_statut_date_idx').on(t.statut, t.dateDebut),
    index('reservation_chambre_dates_idx').on(t.chambreId, t.dateDebut, t.dateFin),
    check('reservation_fin_apres_debut', sql`${t.dateFin} > ${t.dateDebut}`),
    check('reservation_min_une_personne', sql`${t.nombreDePersonne} >= 1`),
    check('reservation_adultes_min', sql`${t.nombreAdultes} >= 1`),
    check('reservation_enfants_min', sql`${t.nombreEnfants} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
//  Services et consommations
// ---------------------------------------------------------------------------

export const service = sqliteTable(
  'service',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nom: text('nom', { length: 100 }).notNull().unique(),
    categorie: text('categorie', { enum: ['bar', 'cave', 'restaurant', 'autre'] })
      .notNull()
      .default('autre'),
    prixUnitaire: integer('prix_unitaire'),
    actif: integer('actif', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [check('service_prix_min', sql`${t.prixUnitaire} IS NULL OR ${t.prixUnitaire} >= 0`)],
);

export const consommation = sqliteTable(
  'consommation',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id, { onDelete: 'restrict' }),
    serviceId: integer('service_id')
      .notNull()
      .references(() => service.id, { onDelete: 'restrict' }),
    reservationId: integer('reservation_id').references(() => reservation.id, {
      onDelete: 'set null',
    }),
    createdBy: integer('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    statut: text('statut', { enum: ['a_consommer', 'consomme'] })
      .notNull()
      .default('a_consommer'),
    quantite: integer('quantite').notNull().default(1),
    montant: integer('montant'),
    ...timestamps,
  },
  (t) => [
    index('consommation_client_statut_idx').on(t.clientId, t.statut),
    index('consommation_reservation_idx').on(t.reservationId),
    check('consommation_quantite_min', sql`${t.quantite} >= 1`),
  ],
);

// ---------------------------------------------------------------------------
//  Facturation
// ---------------------------------------------------------------------------

export const facture = sqliteTable(
  'facture',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: text('numero', { length: 30 }).notNull().unique(),
    reservationId: integer('reservation_id')
      .notNull()
      .references(() => reservation.id, { onDelete: 'restrict' }),
    createdBy: integer('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    montantHebergement: integer('montant_hebergement').notNull(),
    montantServices: integer('montant_services').notNull().default(0),
    total: integer('total').notNull(),
    statut: text('statut', { enum: ['emise', 'payee', 'annulee'] })
      .notNull()
      .default('emise'),
    dateEmission: text('date_emission').notNull().$defaultFn(now),
  },
  (t) => [
    index('facture_reservation_idx').on(t.reservationId),
    check('facture_total_coherent', sql`${t.total} = ${t.montantHebergement} + ${t.montantServices}`),
  ],
);

// ---------------------------------------------------------------------------
//  Caisse (journal non modifiable : une erreur se corrige par une écriture inverse)
// ---------------------------------------------------------------------------

export const MODES_PAIEMENT = ['especes', 'carte', 'mtn_money', 'airtel_money'];

export const mouvementCaisse = sqliteTable(
  'mouvement_caisse',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ['entree', 'sortie'] }).notNull(),
    categorie: text('categorie', {
      enum: [
        'acompte', 'paiement_client', 'service', 'don', 'renforcement_patron', 'autre_entree',
        'achat', 'depense', 'retrait', 'remboursement_acompte', 'autre_sortie',
      ],
    }).notNull(),
    montant: integer('montant').notNull(),
    modePaiement: text('mode_paiement', { enum: MODES_PAIEMENT }),
    serviceId: integer('service_id').references(() => service.id, { onDelete: 'set null' }),
    reservationId: integer('reservation_id').references(() => reservation.id, { onDelete: 'set null' }),
    motif: text('motif', { length: 255 }).notNull().default(''),
    pieceChemin: text('piece_chemin'), // saisie du fichier : étape 5b
    dateMouvement: text('date_mouvement').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (t) => [
    index('mouvement_date_idx').on(t.dateMouvement),
    index('mouvement_reservation_idx').on(t.reservationId),
    check('mouvement_montant_min', sql`${t.montant} > 0`),
  ],
);
