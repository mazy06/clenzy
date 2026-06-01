-- Redesign du template d'email d'invitation a rejoindre une organisation.
--
-- Objectifs :
--   - Subject plus chaud, avec le nom de l'inviteur en premier (incite a ouvrir,
--     reduit la classification spam — un nom humain est plus reconnaissable
--     qu'un message generique "Invitation a rejoindre X").
--   - Body plus conversationnel, qui explique brievement le flow nouveau (le
--     destinataire choisit son mot de passe directement sur app.baitly.fr,
--     plus de redirection Keycloak qui echoue avec "Registration not allowed").
--   - Toujours en plain text — le HTML est applique par EmailWrapperService
--     selon wrapper_style='INVITATION' (cf. pivot 1, migration 0156).

UPDATE system_email_template
SET subject = '{inviterName} t''invite a rejoindre {orgName} sur Baitly',
    body = E'Bonjour,\n\n*{inviterName}* t''invite a rejoindre l''equipe *{orgName}* sur Baitly, l''outil qui simplifie la gestion locative au quotidien.\n\nTu y rejoindras en tant que *{roleName}*.\n\n[CREER MON COMPTE → {invitationLink}]\n\nC''est rapide : tu choisis ton mot de passe directement, et tu es connecte en moins d''une minute. Pas de redirection, tout se passe sur app.clenzy.fr.\n\nCe lien expire le {expiresAt}. Si tu n''attendais pas cette invitation, ignore simplement ce message.'
WHERE template_key = 'invitation_organization' AND organization_id IS NULL;
