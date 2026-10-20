# Baitly : campagnes ciblées du CRM (lot 5)

## Parcours et périmètre

La section « Campagnes ciblées » du module Prospection réutilise les contacts du CRM de l’organisation courante. Ce lot couvre les campagnes email, avec lancement explicite par lots de 10 destinataires, sans planificateur ni envoi automatique en arrière-plan. Chaque segment est limité à 2 000 contacts, avec pagination des destinataires.

Le parcours comporte trois étapes : définir le segment, choisir ou modifier un modèle réutilisable, puis vérifier les destinataires autorisés et les exclusions motivées. La préparation crée une campagne et fige les messages sans envoyer d’email. Le lancement exige une confirmation distincte ; les destinataires encore en attente peuvent être annulés.

Filtres : propriétaires ou prestataires, ville, statut de relation, catégorie, provenance, spécialité et métier pour les prestataires. Le métier réutilise les codes du recrutement du lot 4 et la dernière candidature non ambiguë correspondant aux coordonnées actuelles du contact. Une candidature marquée `needs_review` n’est pas utilisée pour ce filtre. Les modèles sont propres à l’organisation et au type de contact ; les variables autorisées sont `{{name}}`, `{{city}}` et `{{organization}}`.

Les interfaces et messages de service sont disponibles en français, anglais et arabe. Le texte du modèle est rédigé par l’utilisateur, sans traduction automatique.

## Droits et autorisations de contact

La lecture et la gestion réutilisent les droits du CRM existant. L’envoi exige aussi `baitly-crm:campaign-send` et la gestion effective de l’organisation, contrôlées côté serveur. La migration attribue ce droit aux rôles `HOST`, `SUPER_MANAGER` et `SUPER_ADMIN`, sans le donner aux techniciens.

La finalité est `MANAGEMENT` pour les propriétaires et `PROVIDER_RECRUITMENT` pour les prestataires. Une simple demande de réponse (`REQUESTED_CONTACT`) ne permet jamais une campagne. Le consentement doit être actuel, documenté, lié au canal email et à l’identité courante ; l’intérêt légitime B2B ne concerne que les contacts professionnels. Les contacts archivés, rejetés, sans adresse valide, avec adresse active en doublon ou autorisation absente/expirée/révoquée sont exclus.

Les oppositions sont recherchées sur l’historique de la même destination, organisation, finalité et canal. L’adresse, le type de contact et les autorisations sont vérifiés de nouveau immédiatement avant chaque tentative : une modification après préparation ne redirige pas le message vers la nouvelle adresse.

## Envoi et traçabilité

La préparation conserve un instantané du segment, du modèle, du destinataire et du message personnalisé. Les UUID de requête rendent les préparations et réponses rejouables sans duplication. Les contraintes composites de base empêchent les références entre organisations.

Le service utilise le transport SMTP existant d’`EmailService`. La réservation d’un destinataire est transactionnelle et sérialisée par organisation ; l’appel SMTP se fait hors transaction de base. L’acteur, la date de tentative et l’identifiant fourni par le transport sont conservés.

`ACCEPTED` signifie que le relais SMTP a accepté le message, sans constituer une preuve de livraison. Une exception de transport ou une tentative bloquée depuis plus de 15 minutes devient `UNKNOWN`, sans nouvelle tentative automatique. Le rapprochement des tentatives bloquées se fait lors de la consultation des détails ou d’un lancement suivant, même après une annulation. Le suivi n’annonce ni ouverture ni livraison finale.

## Réponses et désinscription

Chaque message comporte un lien vers `/campagnes/reponse`. Le jeton aléatoire est transmis dans le fragment de l’URL du site public, puis dans le corps des requêtes POST à l’API. Seul son SHA-256 est conservé en base ; il n’est pas exposé dans les détails privés de la campagne, ni stocké dans le navigateur. La consultation publique ne retourne que le nom de l’organisation.

Le destinataire peut manifester son intérêt, poser une question, refuser ou se désinscrire. Les réponses via ce lien rejoignent automatiquement l’historique CRM. Les réponses reçues par email ou téléphone sont consignables manuellement ; ce lot ne connecte pas une boîte de réception entrante. Une réponse ne crée jamais une nouvelle autorisation de campagne. Le refus et la désinscription enregistrent une opposition pour l’organisation, la finalité et l’adresse concernées, y compris si le contact a changé d’adresse depuis l’envoi.

L’API publique réutilise le limiteur Redis à échec fermé, le champ piège et la protection Turnstile configurable. Les réponses ordinaires sont limitées à 20 par lien, avec reprise idempotente ; les demandes d’arrêt restent possibles. L’en-tête `List-Unsubscribe` utilise un endpoint POST dédié et idempotent, sans action sur GET pour éviter les désinscriptions par scanners de liens.

Une adresse `Reply-To` n’est utilisée que si l’email du JWT est vérifié. Sinon, le lien de réponse reste disponible.

## Livraison et configuration

La migration Liquibase `0572__baitly_crm_campaigns.sql`, inscrite dans le master, crée les modèles, campagnes, destinataires, réponses et le droit d’envoi. Elle dépend du CRM et des migrations des lots précédents. Les noms des tables existantes ont été vérifiés contre les entités et changesets antérieurs.

Deux propriétés configurent les liens sortants :

- `baitly.crm.public-site-origin` : `https://baitly.fr` par défaut.
- `baitly.crm.public-api-origin` : `https://app.baitly.fr` par défaut.

Les environnements de recette doivent définir leurs propres origines publiques HTTPS. Les origines sont validées et ne peuvent contenir identifiants, chemin, paramètres ou fragment. Le SMTP existant doit être configuré pour pouvoir lancer une campagne.

Le déploiement doit inclure le serveur, le PMS et le site public via le CI/CD habituel. La page de réponse est exclue de l’indexation et du sitemap. Aucun changement manuel de production ni redémarrage Docker n’a été effectué.

## Vérification

Les tests couvrent les règles d’éligibilité, l’isolation entre organisations, les droits, le rejeu des migrations PostgreSQL, les instantanés, les tentatives concurrentes, la revérification des accords, les résultats SMTP incertains, les liens publics, les retraits et l’échappement HTML. Le SMTP est simulé ; aucun contact réel n’a été sollicité.

Les composants du parcours sont également vérifiés avec les tests frontend et un contrôle navigateur hors ligne aux largeurs 375, 768, 1 024 et 1 440 pixels, en clair, sombre et arabe, sans lancer de serveur de preview.

Résultats locaux du 19 octobre 2026 : 98 tests frontend réussis, 133 tests backend réussis dans la passe principale, puis 38 tests backend réussis sur les classes finales compilées avec Java 21, incluant le nouveau cas de rapprochement après annulation (12 scénarios PostgreSQL au total). Les vérifications TypeScript PMS/site/discovery, les builds PMS et site et les 36 vues navigateur ont également passé. L’instance PostgreSQL native temporaire a été arrêtée après les tests.

### Correctif de démarrage du 19 octobre 2026

Le journal de développement a révélé que `0568` échouait sur une base où `role_permissions` ne possède pas de contrainte unique sur `(role_id, permission_id)`. Le baseline SQL contient cette contrainte, mais l’entité `RolePermission` ne la déclare pas : les anciens schémas issus d’Hibernate peuvent donc ne pas l’avoir. Les fixtures initiales créaient la contrainte, ce qui masquait cette incompatibilité.

Les insertions des droits de `0568` et `0572` vérifient désormais explicitement l’absence de la paire via `NOT EXISTS`, avec `ON CONFLICT DO NOTHING` sans cible. Elles fonctionnent avec ou sans cette contrainte, ne dupliquent pas les associations et préservent les droits désactivés. Aucun ajout de contrainte globale ni nettoyage de données historiques n’est nécessaire pour ce correctif.

Validation : 15 tests PostgreSQL réussis, dont la migration CRM paramétrée avec et sans contrainte, le rejeu des insertions de droits et les campagnes sur un schéma sans cette contrainte. L’instance native temporaire a été arrêtée après les tests.

Dans le journal fourni, `0568` échoue avant son enregistrement et Liquibase relâche le verrou. Après reconstruction de l’image backend et relance par l’utilisateur du seul conteneur `clenzy-server-dev`, la migration corrigée sera reprise au démarrage. Ne pas modifier manuellement `databasechangelog`. Ces migrations ne doivent pas être remplacées à l’aveugle sur un autre environnement où elles seraient déjà enregistrées avec leur ancien checksum.
