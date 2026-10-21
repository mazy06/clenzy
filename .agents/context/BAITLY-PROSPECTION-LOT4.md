# Baitly : recrutement de prestataires externes

## Parcours organisation

Dans Prospection, ouvrir « Recruter des prestataires ». Les organisations
conciergeries et propriétaires (`CONCIERGE`, `INDIVIDUAL`) peuvent préparer une
page avec un nom public de destinataire, un titre, une ville, un pays facultatif,
les métiers recherchés et les conditions de collaboration. Les métiers reprennent
les codes existants du catalogue : ménage, blanchisserie, clés et accueil,
maintenance, jardin, piscine, photographie et autre service.

La page n'est accessible qu'après publication explicite. Son lien
`https://baitly.fr/recrutement/{uuid}` peut être partagé manuellement avec des
prestataires externes. Une organisation a une page de recrutement dont le lien
reste stable ; elle peut modifier son besoin ou fermer les candidatures.
La publication du profil public de conciergerie du lot 2 n'est pas nécessaire,
ce qui rend le parcours utilisable par un propriétaire individuel.

Le lecteur CRM consulte la publication et son lien ; les modifications exigent
les permissions CRM de lecture et de gestion ainsi que la gestion effective de
l'organisation sélectionnée. Le tenant destinataire ne vient jamais du formulaire.

## Parcours candidat externe

Le candidat consulte le besoin puis renseigne son nom ou activité, ses coordonnées,
sa ville, ses métiers, sa disponibilité, sa présentation et le canal de réponse.
Au moins un métier recherché doit être proposé. La demande explicite d'être
contacté par le destinataire nommé est obligatoire et initialement décochée.
Les champs sont conservés en cas d'erreur. Un nouvel essai identique conserve
la clé d'idempotence ; une modification crée une nouvelle demande.

Le formulaire ne crée ni compte, ni fiche publique de marketplace, ni contrat,
ni collaboration confirmée. L'onboarding et la vérification d'un prestataire
éventuellement retenu restent les parcours existants de Baitly.

## Réutilisation du CRM

Le circuit d'entrée des lots 2 et 3 est partagé : verrou de l'organisation,
normalisation des coordonnées, recherche de doublons par email/téléphone et
identités historiques, prise en compte des archives et refus, instantané de la
demande et absence d'autorisation de campagne implicite.

Une nouvelle fiche est de type `PROVIDER`, catégorie `PROVIDERS`, nature inconnue
et provenance `PUBLIC_FORM`. Une identité existante n'est pas écrasée. Un contact
archivé, de type propriétaire, aux coordonnées différentes ou avec plusieurs
correspondances déclenche la vérification existante.

La demande `APPLICATION` apparaît dans « Demandes reçues » et dans la fiche CRM.
Elle conserve le titre initial du recrutement, les métiers proposés, les
disponibilités, la présentation, les coordonnées de réponse et la provenance UTM
déclarée. L'organisation suit le traitement via `NEW`, `IN_PROGRESS`, `CLOSED`,
et la relation via les statuts existants du contact. Une fermeture de la page ne
supprime pas les candidatures déjà reçues.

## Publication et protections

Le serveur résout l'organisation depuis l'UUID public, revalide la publication
sous verrou et rejette les pages fermées, inconnues ou d'un type d'organisation
non autorisé. La réponse publique expose seulement les champs publiés ; aucun
identifiant privé d'organisation, adresse précise ou email interne n'est publié.

L'anti-abus du lot 2 est réutilisé : compteur Redis partagé, dix entrées publiques
par heure et par IP, refus en cas de panne du compteur, honeypot et captcha si
activé. Le captcha distingue l'action `provider-recruitment`.

Les pages UUID sont servies par une coquille publique dédiée, avec `noindex`,
sans les figer ni les énumérer dans le sitemap. Les candidatures ne sont jamais
insérées dans les artefacts statiques.

Ce lot permet la réception volontaire de candidatures et le partage manuel du
lien. Il ne collecte aucune donnée depuis Leboncoin, PAP ou AlloVoisins et ne
publie ni n'envoie automatiquement de messages sur ces plateformes.

## Livraison

Changeset Liquibase `0571-baitly-provider-recruitment`, après 0570 : table de
publication par organisation et extension de la boîte de réception existante.
Déployer le backend, le site et le PMS par le CI/CD habituel. Aucune modification
manuelle de production ou relance Docker n'est incluse dans cette livraison.

La recette couvre les permissions, la migration PostgreSQL rejouée, l'isolation
des propriétaires et conciergeries, la concurrence, les doublons et refus, les
pages fermées, l'idempotence, les transmissions ciblées, les régressions des
demandes de gestion et les interfaces FR/EN/AR. La recette navigateur hors ligne
utilise des données fictives et ne transmet aucune candidature réelle.

Validation locale : 26 tests backend et 85 tests frontend sélectionnés réussis,
migration réellement appliquée puis rejouée sur PostgreSQL, vérifications TypeScript
du PMS, du site et de la génération des routes, et 18 vues navigateur de recette
sans erreur JavaScript ni débordement. Les builds du site et du PMS sont validés.
