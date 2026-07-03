-- ============================================================================
-- 0310 : Backfill des colonnes issues de la derive ddl-auto (chantier baseline)
-- ============================================================================
-- Avant le gel du schema (Phase 5b-bis, 2026-05-21, ddl-auto=validate),
-- Hibernate ddl-auto=update ajoutait des colonnes directement depuis les
-- entites, sans changeset. Ces colonnes existent donc dans TOUS les
-- environnements reels mais dans AUCUN changeset : un replay sur base vierge
-- (0000-baseline -> fin) produisait un schema incomplet et la validation
-- Hibernate au boot echouait.
--
-- Ce changeset les recree DEFENSIVEMENT (IF NOT EXISTS) :
--   - environnements existants : no-op strict (les colonnes sont deja la) ;
--   - base vierge : complete le schema en fin de replay (les tables sont
--     encore vides a ce stade, les NOT NULL passent sans backfill).
-- Types repris du schema Hibernate genere par les entites actuelles.
-- Preuve : LiquibaseVirginReplayIT (replay integral + ddl-auto=validate).

-- Reservations (colonnes paiement/tarification ajoutees par ddl-auto)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cleaning_fee numeric(10,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'EUR' NOT NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid_at timestamp;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_email varchar(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_sent_at timestamp;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_status varchar(20);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_revenue numeric(10,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS stripe_session_id varchar(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tourist_tax_amount numeric(10,2);

-- Audit des changements de tarifs
ALTER TABLE rate_audit_log ADD COLUMN IF NOT EXISTS channel_name varchar(50);
ALTER TABLE rate_audit_log ADD COLUMN IF NOT EXISTS new_price numeric(10,2);
ALTER TABLE rate_audit_log ADD COLUMN IF NOT EXISTS previous_price numeric(10,2);
ALTER TABLE rate_audit_log ADD COLUMN IF NOT EXISTS rule_name varchar(100);

-- Overrides tarifaires : devise
ALTER TABLE rate_overrides ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'EUR';

-- Connexions channel : id de propriete externe
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS external_property_id varchar(255);

-- Calendrier (table repartitionnee par 0050 sans ces colonnes entite)
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS changeover_day boolean;
ALTER TABLE calendar_days ADD COLUMN IF NOT EXISTS max_stay integer;
