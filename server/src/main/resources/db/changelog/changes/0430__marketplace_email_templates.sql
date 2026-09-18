-- Les courriels de la place de marche deviennent des GABARITS EDITABLES.
--
-- CE QUI N'ALLAIT PAS : je les avais ecrits en HTML, en dur, dans le service
-- Java. Ils partaient correctement, mais ils etaient invisibles de l'ecran
-- « Documents & communication » — donc impossibles a relire, a corriger ou a
-- adapter sans passer par un deploiement. Tous les autres courriels du produit
-- vivent dans `system_email_template` ; ceux-ci n'avaient aucune raison d'y
-- faire exception.
--
-- FORME : corps en texte, avec le mini-markdown du produit (*gras*, paragraphes
-- separes par une ligne vide) et les variables entre accolades. L'habillage
-- HTML — en-tete, pied, boutons — est applique a l'envoi par EmailWrapperService.
--
-- STYLE D'HABILLAGE : `INVITATION` pour les trois courriels porteurs d'un
-- bouton, car c'est le seul style ou la syntaxe [TEXTE → URL] est convertie.
-- `INTERNAL_FORM` pour la notification a l'equipe, qui n'en a pas.

INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body, is_system, wrapper_style)
VALUES
(NULL, 'marketplace_application_internal', 'fr', 'INTERNAL_TEAM',
 'Candidature prestataire : {displayName}',
 'Une candidature prestataire attend d''être instruite.

*{displayName}* — {city}
{offerCount} prestation(s) déclarée(s)
Contact : {email}

Ouvrez la place de marché dans Baitly pour examiner la fiche n° {providerId}.',
 true, 'INTERNAL_FORM'),

(NULL, 'marketplace_email_confirmation', 'fr', 'INVITED_USER',
 'Confirmez votre adresse — candidature Baitly',
 'Bonjour {displayName},

Nous avons bien reçu votre candidature à la place de marché Baitly.

Confirmez cette adresse pour que notre équipe puisse instruire votre dossier.

[CONFIRMER MON ADRESSE → {confirmationLink}]

Si vous n''êtes pas à l''origine de cette candidature, ignorez ce message : sans confirmation, le dossier ne sera pas traité.',
 true, 'INVITATION'),

(NULL, 'marketplace_decision_accepted', 'fr', 'INVITED_USER',
 'Votre candidature Baitly est acceptée',
 'Bonjour {displayName},

Votre candidature est acceptée. Bienvenue sur la place de marché Baitly.

{decisionMessage}

Vous allez recevoir un second message pour définir votre mot de passe et accéder à votre espace.',
 true, 'INVITATION'),

(NULL, 'marketplace_decision_rejected', 'fr', 'INVITED_USER',
 'Votre candidature Baitly',
 'Bonjour {displayName},

Nous ne donnons pas suite à votre candidature pour le moment.

{decisionMessage}

Vous pouvez déposer une nouvelle candidature une fois ces points corrigés.',
 true, 'INVITATION'),

(NULL, 'marketplace_account_activation', 'fr', 'INVITED_USER',
 'Votre espace Baitly est prêt',
 'Bonjour {displayName},

Votre candidature est acceptée et votre espace Baitly est prêt. Il ne manque que votre mot de passe.

[DÉFINIR MON MOT DE PASSE → {activationLink}]

Ce lien est valable *sept jours* et ne fonctionne qu''une fois. Passé ce délai, écrivez-nous et nous vous en enverrons un nouveau.',
 true, 'INVITATION')
ON CONFLICT DO NOTHING;
