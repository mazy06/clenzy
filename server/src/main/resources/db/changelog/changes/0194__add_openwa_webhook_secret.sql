-- Relais WhatsApp entrant via OpenWA : secret HMAC du webhook entrant.
-- Genere automatiquement a la creation de la session OpenWA, passe a OpenWA
-- (POST /sessions/:id/webhooks {secret}) et utilise pour verifier la signature
-- X-OpenWA-Signature des POST entrants. Chiffre Jasypt (comme openwa_api_key),
-- d'ou VARCHAR(1000) pour accueillir le texte chiffre + base64. Jamais en .env.

ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS openwa_webhook_secret VARCHAR(1000);
