-- Qui supporte les frais preleves par l'OTA, et leur trace sur le reversement.
--
-- Sur un sejour OTA, la conciergerie n'encaisse jamais le brut : Airbnb ou
-- Booking.com retiennent leur commission a la source. Le reversement, lui, se
-- calculait sur le brut — il faisait donc porter ces frais a la conciergerie,
-- sans que rien ne l'ecrive nulle part. `ota_fee_borne_by` rend le choix
-- explicite au contrat.
--
-- AGENCY est le defaut, et c'est deliberé : un contrat deja signe ne doit pas
-- changer de camp parce qu'on a ajoute une colonne. Les reversements existants
-- gardent exactement les montants qu'ils avaient.

ALTER TABLE management_contracts
    ADD COLUMN IF NOT EXISTS ota_fee_borne_by VARCHAR(20) NOT NULL DEFAULT 'AGENCY';

-- Les frais OTA deduits d'un reversement, quand le contrat les met a la charge
-- du proprietaire. Colonne a part plutot que brut diminue : l'ecran
-- d'approbation reconstitue le calcul poste par poste, et
-- `net = brut - frais OTA - commission - depenses` doit tomber juste. Un brut
-- deja ampute ferait mentir la ligne « revenu des sejours » face aux sejours
-- qu'elle detaille.
--
-- DEFAULT 0 et non NULL : c'est un montant, pas une inconnue. Les reversements
-- anterieurs n'ont deduit aucun frais OTA — zero est leur valeur exacte.

ALTER TABLE owner_payouts
    ADD COLUMN IF NOT EXISTS ota_fees NUMERIC(10,2) NOT NULL DEFAULT 0;
