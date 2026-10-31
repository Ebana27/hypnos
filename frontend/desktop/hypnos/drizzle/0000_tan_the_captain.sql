CREATE TABLE `chambre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`type_id` integer NOT NULL,
	`numero` text(20) NOT NULL,
	`etage` integer NOT NULL,
	`statut` text DEFAULT 'disponible' NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `type_de_chambre`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chambre_etage_min" CHECK("chambre"."etage" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chambre_remote_id_unique` ON `chambre` (`remote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chambre_numero_unique` ON `chambre` (`numero`);--> statement-breakpoint
CREATE INDEX `chambre_statut_idx` ON `chambre` (`statut`);--> statement-breakpoint
CREATE TABLE `client` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`nom` text(100) NOT NULL,
	`prenom` text(100) NOT NULL,
	`tel` text(30) NOT NULL,
	`email` text(255) NOT NULL,
	`document` text(255) DEFAULT '' NOT NULL,
	`preference` text(255) DEFAULT '' NOT NULL,
	`sexe` text NOT NULL,
	`loyalty` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_remote_id_unique` ON `client` (`remote_id`);--> statement-breakpoint
CREATE INDEX `client_nom_prenom_idx` ON `client` (`nom`,`prenom`);--> statement-breakpoint
CREATE TABLE `consommation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	`reservation_id` integer,
	`created_by` integer NOT NULL,
	`statut` text DEFAULT 'a_consommer' NOT NULL,
	`quantite` integer DEFAULT 1 NOT NULL,
	`montant` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "consommation_quantite_min" CHECK("consommation"."quantite" >= 1)
);
--> statement-breakpoint
CREATE INDEX `consommation_client_statut_idx` ON `consommation` (`client_id`,`statut`);--> statement-breakpoint
CREATE INDEX `consommation_reservation_idx` ON `consommation` (`reservation_id`);--> statement-breakpoint
CREATE TABLE `demande` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`chambre_demandee_id` integer,
	`date_debut` text NOT NULL,
	`date_fin` text NOT NULL,
	`nombre_de_personne` integer NOT NULL,
	`statut` text DEFAULT 'en_attente' NOT NULL,
	`date_decision` text,
	`motif_refus` text(255) DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`chambre_demandee_id`) REFERENCES `chambre`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "demande_fin_apres_debut" CHECK("demande"."date_fin" > "demande"."date_debut"),
	CONSTRAINT "demande_min_une_personne" CHECK("demande"."nombre_de_personne" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demande_remote_id_unique` ON `demande` (`remote_id`);--> statement-breakpoint
CREATE INDEX `demande_statut_date_idx` ON `demande` (`statut`,`date_debut`);--> statement-breakpoint
CREATE TABLE `facture` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` text(30) NOT NULL,
	`reservation_id` integer NOT NULL,
	`created_by` integer NOT NULL,
	`montant_hebergement` integer NOT NULL,
	`montant_services` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`statut` text DEFAULT 'emise' NOT NULL,
	`date_emission` text NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "facture_total_coherent" CHECK("facture"."total" = "facture"."montant_hebergement" + "facture"."montant_services")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facture_numero_unique` ON `facture` (`numero`);--> statement-breakpoint
CREATE INDEX `facture_reservation_idx` ON `facture` (`reservation_id`);--> statement-breakpoint
CREATE TABLE `hotel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`name` text(150) NOT NULL,
	`adresse` text(255) NOT NULL,
	`ville` text(100) NOT NULL,
	`tel` text(30) NOT NULL,
	`email` text(255) NOT NULL,
	`nombre_etages` integer NOT NULL,
	`nombre_chambres` integer NOT NULL,
	`heure_arrivee` text DEFAULT '15:00:00' NOT NULL,
	`heure_depart` text DEFAULT '11:00:00' NOT NULL,
	CONSTRAINT "hotel_etages_min" CHECK("hotel"."nombre_etages" >= 1),
	CONSTRAINT "hotel_chambres_min" CHECK("hotel"."nombre_chambres" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hotel_remote_id_unique` ON `hotel` (`remote_id`);--> statement-breakpoint
CREATE TABLE `reservation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`client_id` integer NOT NULL,
	`chambre_id` integer NOT NULL,
	`demande_id` integer,
	`created_by` integer NOT NULL,
	`date_debut` text NOT NULL,
	`date_fin` text NOT NULL,
	`nombre_de_personne` integer NOT NULL,
	`statut` text DEFAULT 'confirmee' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`chambre_id`) REFERENCES `chambre`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`demande_id`) REFERENCES `demande`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "reservation_fin_apres_debut" CHECK("reservation"."date_fin" > "reservation"."date_debut"),
	CONSTRAINT "reservation_min_une_personne" CHECK("reservation"."nombre_de_personne" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservation_remote_id_unique` ON `reservation` (`remote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reservation_demande_id_unique` ON `reservation` (`demande_id`);--> statement-breakpoint
CREATE INDEX `reservation_statut_date_idx` ON `reservation` (`statut`,`date_debut`);--> statement-breakpoint
CREATE INDEX `reservation_chambre_dates_idx` ON `reservation` (`chambre_id`,`date_debut`,`date_fin`);--> statement-breakpoint
CREATE TABLE `service` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nom` text(100) NOT NULL,
	`categorie` text DEFAULT 'autre' NOT NULL,
	`prix_unitaire` integer,
	`actif` integer DEFAULT true NOT NULL,
	CONSTRAINT "service_prix_min" CHECK("service"."prix_unitaire" IS NULL OR "service"."prix_unitaire" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_nom_unique` ON `service` (`nom`);--> statement-breakpoint
CREATE TABLE `type_de_chambre` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`label` text(100) NOT NULL,
	`prix` integer NOT NULL,
	`capacite` integer NOT NULL,
	CONSTRAINT "type_prix_min" CHECK("type_de_chambre"."prix" >= 0),
	CONSTRAINT "type_capacite_min" CHECK("type_de_chambre"."capacite" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `type_de_chambre_remote_id_unique` ON `type_de_chambre` (`remote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `type_de_chambre_label_unique` ON `type_de_chambre` (`label`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`remote_id` integer,
	`hotel_id` integer NOT NULL,
	`username` text(150) NOT NULL,
	`email` text(255) NOT NULL,
	`first_name` text(150) DEFAULT '' NOT NULL,
	`last_name` text(150) DEFAULT '' NOT NULL,
	`role` text(30) DEFAULT 'receptionniste' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotel`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_remote_id_unique` ON `user` (`remote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);