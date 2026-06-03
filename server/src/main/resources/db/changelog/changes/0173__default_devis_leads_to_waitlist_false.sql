-- Politique waitlist : les demandes de devis (landing) ne sont PLUS versees
-- automatiquement dans la waitlist de lancement. Seules les inscriptions via le
-- formulaire /bientot-disponible alimentent la waitlist.
--
-- On bascule donc le toggle add_devis_leads_to_waitlist a FALSE par defaut ET
-- pour les installations existantes. Un SUPER_ADMIN / SUPER_MANAGER peut le
-- reactiver manuellement depuis les Settings si besoin, mais ce n'est plus le
-- comportement par defaut.
ALTER TABLE platform_settings
    ALTER COLUMN add_devis_leads_to_waitlist SET DEFAULT FALSE;

UPDATE platform_settings
    SET add_devis_leads_to_waitlist = FALSE;
