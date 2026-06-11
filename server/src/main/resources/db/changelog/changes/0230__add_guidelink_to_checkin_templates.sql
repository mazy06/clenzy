-- 0230 : ajoute le lien du livret d'accueil ({guideLink}) au template "Information Check-in".
--
-- Contexte : l'email automatique de check-in (GuestMessagingScheduler) n'insère le lien du
-- livret que si le corps du template contient le tag {guideLink}
-- (GuestMessagingService.templateReferencesGuideLink). Or le template par défaut seedé
-- (changesets 0088 / 0163) ne contient PAS ce tag — le voyageur ne recevait donc jamais le
-- lien du livret dans l'email de bienvenue (seul le bouton de partage hôte le fournissait).
--
-- Ce changeset ajoute un bloc {guideLink} EN FIN de corps (append non destructif : toute
-- personnalisation existante du template est préservée), UNIQUEMENT :
--   - aux templates de type CHECK_IN ;
--   - qui ne contiennent pas déjà {guideLink} (idempotent) ;
--   - des organisations possédant AU MOINS un livret publié, pour que le tag soit toujours
--     résolu en URL (un tag non résolu resterait affiché littéralement "{guideLink}").
--
-- Limite connue : une organisation qui publie son premier livret APRÈS cette migration devra
-- ajouter le tag à son template (éditeur de templates) — il n'y a pas de re-seed automatique.

UPDATE message_templates mt
SET body = body || E'\n\n🏠 **Votre livret d''accueil numérique**\nRetrouvez le code d''accès, les instructions d''arrivée et toutes les infos pratiques de votre séjour :\n[Ouvrir mon livret d''accueil]({guideLink})\n',
    updated_at = NOW()
WHERE mt.type = 'CHECK_IN'
  AND mt.body NOT LIKE '%{guideLink}%'
  AND EXISTS (
    SELECT 1 FROM welcome_guides wg
    WHERE wg.organization_id = mt.organization_id
      AND wg.published = TRUE
  );
