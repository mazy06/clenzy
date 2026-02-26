-- Ajouter le type d'organisation aux inscriptions en attente
-- Permet de stocker le choix de l'utilisateur (INDIVIDUAL, CONCIERGE, CLEANING_COMPANY)
-- entre le paiement Stripe et la creation du compte.
ALTER TABLE pending_inscriptions ADD COLUMN IF NOT EXISTS organization_type VARCHAR(30) DEFAULT 'INDIVIDUAL';
