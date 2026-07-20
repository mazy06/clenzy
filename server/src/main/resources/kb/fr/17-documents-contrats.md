# Documents et contrats dans Baitly

## Comment générer des documents PDF (devis, factures, bons d'intervention) ?

Le module « Documents & Communications », accessible depuis le menu du même nom, centralise la génération de documents PDF de votre organisation. Baitly gère huit types de documents : devis, facture, bon d'intervention, validation de fin de mission, justificatif de paiement, justificatif de remboursement, autorisation de travaux et mandat de gestion. La plupart sont générés automatiquement au fil du cycle métier : un devis est produit quand une demande de service est approuvée, une autorisation de travaux quand le devis est accepté, une facture et un justificatif de paiement quand le paiement est confirmé, un bon d'intervention quand l'intervention démarre, une validation de fin de mission quand elle se termine. Chaque document généré peut être envoyé automatiquement par email à son destinataire (client, technicien) avec le PDF en pièce jointe. Vous pouvez aussi générer un document manuellement via le bouton « Générer un document ». L'onglet « Historique » liste toutes les générations avec la date, le numéro légal, le type, le fichier et le statut, et permet de télécharger chaque PDF.

## Comment fonctionnent les modèles (templates) de documents ?

L'onglet « Templates documents » du module Documents & Communications gère vos modèles. Un modèle est un fichier au format ODT (traitement de texte) contenant des balises dynamiques qui sont remplacées à la génération : informations de l'entreprise, du client, du technicien, de la propriété, de l'intervention, du paiement, etc. L'onglet « Variables & Tags » liste toutes les balises disponibles, classées par catégorie. Vous uploadez un modèle, Baitly détecte automatiquement ses balises, puis vous l'activez : un seul modèle actif par type de document. Le module gère aussi les modèles de messages (email, WhatsApp) pour la communication voyageurs, dans des onglets dédiés. Chaque modèle de document peut définir le sujet et le corps de l'email d'envoi.

## Les factures et devis sont-ils conformes à la réglementation ?

Oui. Les factures et devis reçoivent une numérotation légale séquentielle sans trous (par exemple FAC-2025-00001, DEV-2025-00001). Une fois générés, ils sont verrouillés et leur intégrité est garantie par une empreinte numérique : un bouton de vérification permet à tout moment de confirmer que le document n'a pas été altéré. L'onglet « Conformité » du module Documents affiche les statistiques (documents générés, documents verrouillés, factures verrouillées, score moyen de conformité), vérifie que vos modèles contiennent bien les mentions légales obligatoires pour leur type, signale les mentions manquantes, et permet de rechercher un document par son numéro légal. En cas d'erreur sur une facture, on ne la modifie pas : on émet un document correctif (avoir) qui lui est lié. L'accès à la conformité est réservé aux administrateurs.

## Comment créer un contrat de gestion (mandat) avec un propriétaire ?

Le menu « Contrats de gestion » gère les contrats entre propriétaires et votre conciergerie. Un contrat fixe le mode d'encaissement, le taux de commission et pilote la répartition automatique des revenus entre le propriétaire, la plateforme et la conciergerie (un aperçu de la répartition s'affiche pendant la saisie). Cliquez sur « Nouveau contrat », choisissez la propriété et le propriétaire, le type de contrat, le taux de commission, la période (une date de fin vide signifie une durée indéterminée), et les options : renouvellement automatique, ménage inclus, maintenance incluse, séjour minimum en nuits, préavis en jours. Un contrat passe par des statuts : vous pouvez l'activer, le suspendre ou le résilier (la résiliation est irréversible). Si un logement est exploité sans contrat de gestion actif, Baitly l'affiche avec un badge « Contrat manquant » et applique la répartition par défaut de l'organisation jusqu'à ce qu'un contrat soit établi.

## Comment fonctionne la signature électronique des contrats ?

À la création d'un contrat de gestion, un lien de signature est automatiquement envoyé par email au propriétaire. Le propriétaire ouvre ce lien sécurisé et signe le document en ligne, sans créer de compte. La signature est horodatée et accompagnée d'éléments de preuve (identité déclarée, empreinte du document), et un certificat de signature est apposé au PDF final. Dans la liste des contrats, le statut de signature est visible : « En attente de signature » tant que le propriétaire n'a pas signé, « Lien de signature expiré » si le délai est dépassé. Dans ce cas, utilisez l'action « Renvoyer le lien de signature » (le propriétaire doit avoir une adresse email renseignée). Des connexions à des prestataires de signature externes peuvent être configurées dans Paramètres, onglet Intégrations, selon votre offre.

## Questions fréquentes

**Puis-je modifier une facture déjà générée ?**
Non : les factures sont verrouillées après génération pour garantir leur conformité. Pour corriger une erreur, générez un document correctif (avoir) lié à la facture d'origine.

**Où retrouver tous les documents envoyés à un client ?**
Dans le menu Documents & Communications, onglet Historique : il liste les documents générés et les messages envoyés, avec destinataire, canal, statut, et le téléchargement du PDF.

**Le propriétaire doit-il avoir un compte Baitly pour signer son mandat ?**
Non. Il reçoit un lien de signature par email et signe en ligne directement. Si le lien a expiré, renvoyez-le depuis la fiche du contrat.

**Que se passe-t-il si un logement n'a pas de contrat de gestion ?**
Un bandeau et un badge « Contrat manquant » le signalent, et la répartition des revenus applique le réglage par défaut de l'organisation jusqu'à l'activation d'un contrat.

**Qui décide de la répartition des revenus d'une réservation ?**
Le contrat de gestion actif de la propriété : son mode d'encaissement et son taux de commission déterminent automatiquement les parts propriétaire, plateforme et conciergerie.
