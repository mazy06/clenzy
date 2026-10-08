# Baitly : rapprochements OTA, achats fournisseurs et remboursements de séjours

## Périmètre du 6 octobre 2026

Cette tranche suit la demande de traiter les trois points restants, avec les **deux parcours fournisseur** choisis par l'utilisateur. Elle porte sur le code et les contrôles automatisés isolés. Aucun paiement, email d'activation ou transfert réel n'a été envoyé ; le PMS partagé n'a pas été rechargé. La [recette Baitly/Stripe finale](final-circuit-recipe-checklist.md) reste différée.

## Versements OTA

Le détail d'un paiement collecté par une OTA permet de rattacher un relevé OTA et un justificatif bancaire distincts. L'opérateur indique la référence du versement, sa date, le destinataire et la ventilation de chaque séjour : brut, frais, remboursements et net reçu. Un versement peut couvrir plusieurs séjours de la même organisation, du même canal et de la même devise. Des propriétaires différents imposent le compte gestionnaire.

Le serveur contrôle les montants au centime, les doublons de références et le cumul déjà rapproché de chaque séjour. La référence bancaire ne peut pas être réutilisée pour un autre rapprochement actif, même lors de requêtes concurrentes portant sur des séjours différents. Une même demande rejouée avec des données différentes est refusée.

Une correction annule le rapprochement avec un motif, conserve les pièces et autorise ensuite un nouveau dossier. Elle n'efface pas l'historique. La migration **0510** impose l'immuabilité, l'équilibre des lignes et l'isolation PostgreSQL.

Le résultat est un **rapprochement documentaire confirmé par l'opérateur**, pas une validation automatique du contenu bancaire. Il ne crée ni fonds Stripe, ni transfert propriétaire, ni paiement de facture de commission. Les fonds encaissés hors plateforme restent distincts du financement PSP.

## Fournisseurs sans compte Baitly

Dans Finance, la vue fournisseurs conserve la facture d'achat, le logement, l'identité du fournisseur, les montants et le mode de règlement. La migration **0511** protège l'identité, les pièces et le choix du parcours.

### Invitation et compte de versement

L'administrateur prépare un lien d'invitation à transmettre au fournisseur. Le lien est aléatoire, stocké uniquement sous forme d'empreinte, expire après sept jours et peut être renouvelé avant acceptation. Le renouvellement invalide l'ancien lien. Aucune invitation n'est envoyée automatiquement par cette action.

Le fournisseur existant se connecte et accepte explicitement avec l'adresse vérifiée prévue sur la facture. Un nouveau fournisseur peut demander un lien d'activation Keycloak pour vérifier son email et définir son mot de passe. Cette inscription ne crée pas d'abonnement PMS. Les requêtes sont limitées et reprennent une identité distante uniquement avec la preuve de l'opération serveur correspondante ; un compte préexistant n'est pas réaffecté.

L'acceptation prépare un espace personnel si le fournisseur n'en a pas. Elle ne lui donne aucun accès à l'organisation cliente. Son profil est rechargé avant la configuration de son compte de versement. La connexion PSP conserve les contrôles d'identité, d'organisation et de capacités existants.

L'administrateur peut ensuite préparer une seule dépense nominative correspondant exactement à la facture. Elle rejoint le circuit existant : approbation, retenue financée sur un reversement propriétaire puis transfert PSP explicite. L'invitation et l'acceptation ne paient pas la facture. Les écritures concurrentes depuis l'ancien écran de dépenses ne doivent pas créer une seconde dette pour cette même facture fournisseur.

### Règlement sur le site du fournisseur

L'administrateur choisit une adresse HTTPS publique. Le paiement s'effectue sur le site du fournisseur ; Baitly ne l'exécute pas. Au retour, il joint un justificatif PSP ou bancaire distinct de la facture, sa référence et sa date, pour le TTC exact.

Le dossier affiche « règlement externe documenté ». Il ne devient pas une seconde dépense à payer via Baitly et ne crée pas de solde Stripe. Ce parcours documentaire n'applique pas de retenue propriétaire ni d'écriture comptable automatique. Les deux parcours sont disponibles au choix, mais une même facture ne peut pas passer de l'un à l'autre après la décision enregistrée.

## Remboursements externes de réservations

Une série de remboursements Stripe externes peut désormais être rapprochée d'un séjour PMS en EUR, payé intégralement par un encaissement unique, sans crédit fidélité ni reversement propriétaire engagé. Le traitement relit l'encaissement et toutes les restitutions, verrouille le séjour et contrôle le cumul historique.

Chaque montant confirmé produit ses contre-écritures et un avoir correspondant. Les arrondis utilisent la différence de deux cumuls ; le dernier remboursement épuise exactement les bases historiques. Le statut devient partiellement remboursé ou remboursé. Cette observation n'annule pas le séjour et ne demande aucun nouveau remboursement au PSP.

Le financement propriétaire tient compte du montant remboursé et refuse un dossier encore en revue. Les tests couvrent notamment 5,01 EUR puis 4,99 EUR puis 35 EUR sur un séjour de 45 EUR : 45 EUR de remboursements, trois avoirs et aucune duplication au rejeu. Une panne de l'outbox annule les écritures métier de la transaction.

## Complément du 7 octobre : preuve externe affectée à une prestation du lot

Dans le détail Finance d'une prestation payée en lot, l'administration peut désormais affecter **l'intégralité d'une preuve de remboursement Stripe à une seule prestation**. Le montant et la devise viennent de la preuve déjà observée ; l'opérateur renseigne un motif. L'organisation et l'auteur viennent du contexte authentifié. La référence `re_` reste unique, avec la source du lot d'origine conservée dans l'audit.

L'affectation seule ne comptabilise rien et n'envoie pas d'argent. Elle est immuable, idempotente et sérialisée sous le verrou du paiement. La reprise automatique relit ensuite la charge et toutes les restitutions chez Stripe. Montant, cumul par prestation, financement, journal et éventuel versement prestataire sont contrôlés avant confirmation. Les autres prestations conservent leur solde.

Le rapprochement atomique déclenche les contre-écritures, le statut, l'outbox et les avoirs existants. Les preuves externes sont séparées des décisions Baitly dans le manifeste transmis au service Stripe : reprendre une restitution du solde n'émet jamais de nouveau remboursement pour une preuve externe. Un remboursement de lot encore sans affectation bloque aussi le financement du solde d'une prestation partiellement remboursée.

L'interface distingue confirmation Stripe en attente, affectation enregistrée, rapprochement bloqué et remboursement rapproché. Les tests d'intégration emploient PostgreSQL temporaire et des serveurs HTTP de fixtures. Le chargement du serveur et la recette navigateur restent différés.

**Limite explicite :** une preuve unique couvrant plusieurs prestations n'est pas découpée. Ce cas nécessite un modèle d'affectations multiples et d'avoirs compatible avec la référence PSP unique ; le garde-fou conserve le dossier en rapprochement. Aucun prorata arbitraire n'est introduit.

### Validation du complément

La campagne `tmp/baitly-financial-external-batch-03/summary.json` est **passed** : **2 264 tests serveur, 342 suites JUnit ; 100 tests interface, 12 fichiers ; deux contrôles TypeScript**. Aucun échec, erreur ou test ignoré. Les **36 tests Python** passent également (`/private/tmp/baitly-financial-python-04.log`).

Les 21 nouveaux scénarios de persistance utilisent PostgreSQL temporaire, journal et outbox réels : affectation sans mouvement, relecture après changement de source métier, concurrence entre deux cibles, double soumission, plafonds, autre organisation, preuve incomplète, rollback, solde bloqué tant qu'une preuve demeure sans affectation, avoirs cumulés et récupération de la seule part prestataire après versement. Quatre tests de contrôleur couvrent les rôles, l'organisation active et l'auteur authentifié ; un test du service Stripe vérifie que les preuves externes restent séparées des nouvelles décisions.

Les huit nouveaux tests frontend passent par le véritable client API et un serveur HTTP de fixtures : motif obligatoire, cible explicite, doubles clics, refus métier, attente Stripe, attente comptable, incident et accès bénéficiaire refusé. Ce ne sont ni un contrôle visuel du PMS chargé ni une recette Stripe. Aucune migration nouvelle pour ce complément ; aucun serveur partagé rechargé.

## Vérification automatisée de la tranche du 6 octobre

- Backend : **2 238 tests, 340 suites JUnit**, aucun échec, erreur ou test ignoré. Rapports frais dans `tmp/baitly-financial-recipe-three-points-02/backend/` ; la partie backend de cette campagne est verte. Son statut global est rouge à cause d'un défaut du banc multipart frontend, corrigé séparément.
- Frontend final de cette tranche : **92 tests / 11 fichiers**, aucun échec ni test ignoré, dans `tmp/baitly-financial-recipe-three-points-ui-04/summary.json` (`passed`). Les deux contrôles TypeScript, application et tests Finance, passent dans cette même campagne. Les **36 tests Python** du lanceur passent aussi (`/private/tmp/baitly-financial-python-03.log`). Ces résultats précèdent le complément du 7 octobre.
- Les migrations 0510 et 0511 sont exécutées et rejouées sur des schémas PostgreSQL temporaires, avec assertions RLS sous rôle non propriétaire. Les scénarios vérifient concurrence, rollback, plafonds, références dupliquées et documents immuables.
- Les contrôleurs sont exercés par MockMvc pour les contrats multipart/JSON, erreurs et inscription, et séparément avec la sécurité de méthode pour les rôles. Les services réseau Keycloak et Stripe sont simulés.
- Les tests frontend utilisent les vrais composants, React Query, le client API et un serveur HTTP local éphémère. Ils vérifient les fichiers multipart reçus, les montants, la sélection du bénéficiaire, les erreurs et les reprises. **Ils ne sont pas des tests E2E navigateur du PMS partagé.**

Le lanceur et son manifeste sont dans [la procédure de recette automatisée](../../scripts/payments/automated-financial-recipe.md). Les essais intermédiaires en échec restent conservés ; ils ne sont pas présentés comme des validations réussies.

## État après le complément du 7 octobre

Les trois limites ci-dessous relatives aux lots, aux séjours déjà reversés et aux récompenses ont désormais leur implémentation : voir le [rapport de clôture et ses limites précises](refund-completion-validation.md). Les sections précédentes conservent les preuves historiques des campagnes antérieures.

## Limites de la tranche précédente et compléments

- Lots : ventilation multiple désormais implémentée, avec une preuve PSP unique et des affectations locales.
- Séjour déjà reversé : récupération distincte fondée sur la part nette figée et avoir de commission implémentés. Les anciennes bases multi-séjours absentes restent à rapprocher.
- Crédit offert et récompense acquise : documents, compensation et restitution implémentés selon la nature EARN/GRANT existante. Réservation/expiration du crédit, crédit acheté et acomptes directs historiques restent hors périmètre.
- Achats fournisseurs limités à un logement et EUR. Le règlement externe est documentaire ; sa comptabilisation et son éventuelle répercussion au propriétaire ne sont pas automatisées.
- Activation email Keycloak, création réelle de l'espace fournisseur, connexion Stripe, affichage navigateur et arrivée bancaire doivent être exercés lors de la campagne finale. Les tests isolés ne constituent pas cette validation.
- L'application des nouvelles migrations au PMS partagé, le packaging final et la livraison CI/CD restent distincts de ces contrôles. Aucune opération en production n'est réalisée.

La dernière implémentation doit encore être chargée et exercée dans la campagne finale Baitly/Stripe avant de déclarer la recette complète.
