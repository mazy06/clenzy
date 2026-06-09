-- Ouverture de la porte depuis le livret d'accueil (serrures connectées pilotables à distance).
-- Opt-in par logement : le bouton « Ouvrir la porte » guest n'apparaît que si activé.
ALTER TABLE check_in_instructions
    ADD COLUMN IF NOT EXISTS guest_unlock_enabled BOOLEAN NOT NULL DEFAULT FALSE;
