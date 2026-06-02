-- 0170 : Desinscription Brevo (webhook) sur waitlist_signups.
-- Colonne unsubscribed_at : horodate la desinscription / hard bounce / plainte
-- recue via le webhook Brevo (POST /api/public/webhooks/brevo). Respect de
-- l'opt-out RGPD : on enregistre l'etat cote Clenzy (Brevo a deja desinscrit le
-- contact). La re-inscription waitlist etant idempotente, aucun re-push n'a lieu.
ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP;
