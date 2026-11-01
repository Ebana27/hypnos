ALTER TABLE `reservation` ADD `canal` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservation` ADD `montant_paye` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservation` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `reservation` DROP COLUMN `updated_at`;