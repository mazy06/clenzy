-- 0285 : mode source de données du booking engine (REAL | MOCK).
-- MOCK = jeu de démo générique servi par les widgets (aucune vraie donnée, aucune réservation/paiement réel).
-- Pas de contrainte CHECK : les valeurs sont garanties par l'enum Java DataSourceMode + validation service
-- (cf. leçon audit 0274 : éviter les CHECK d'enum susceptibles d'être gelés).
ALTER TABLE booking_engine_configs
    ADD COLUMN IF NOT EXISTS data_source_mode VARCHAR(16) NOT NULL DEFAULT 'REAL';
