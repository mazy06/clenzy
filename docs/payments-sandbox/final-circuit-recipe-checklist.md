# Recette finale du circuit financier Baitly

## Ordre demandé

Le 6 octobre 2026, l'utilisateur demande de terminer les travaux de code avant d'effectuer la recette sandbox complète. Les tests unitaires, d'intégration et PostgreSQL isolés continuent pendant l'implémentation. Les nouvelles opérations de recette sur le sandbox partagé sont reportées à cette campagne finale.

Les validations précédentes restent des preuves historiques, pas une certification de la dernière version. La production et les paiements réels sont exclus.

## Préparation de la campagne

- [ ] Clôturer ou expliciter chaque limite de code dans l'audit financier.
- [ ] Exécuter les suites financières serveur, interface et migrations isolées ; construire le livrable exact.
- [ ] Utiliser le [lanceur partagé local/CI](../../scripts/payments/automated-financial-recipe.md) avec un nouveau dossier de rapports ; vérifier zéro test ignoré et conserver le manifeste exact. Les tests interface/HTTP isolés ne remplacent pas les parcours navigateur ci-dessous.
- [ ] Sauvegarder le JAR local, charger ce livrable en conservant la configuration Stripe Baitly, vérifier la santé et les sessions.
- [ ] Vérifier le compte plateforme, le mode test, la version des webhooks et l'unicité du relais local.
- [ ] Préparer les bénéficiaires personnels et société et les fixtures clairement marquées TEST SANDBOX ; aucune signature ni configuration légale fictive.
- [ ] Photographier l'état initial des transactions, transferts, factures, avoirs et écritures historiques par lectures seules.

## Parcours à valider depuis Baitly

- [ ] Encaissement de séjour simple, acompte puis solde, annulation et retour public.
- [ ] Crédit fidélité et checkout direct : paiement PSP réduit, consommation du crédit confirmée une seule fois, insuffisance concurrente, restitution après annulation et financement limité à l'argent réellement encaissé. Le consumer RESERVATION et le financement cash sont désormais raccordés et testés en isolation : [preuves et limites](loyalty-credit-validation.md). Remise offerte EARN/GRANT et avoirs cash sont implémentés ; les crédits achetés restent hors périmètre ; ne pas considérer la déduction affichée au checkout comme une preuve de consommation du crédit.
- [ ] Fidélité et parrainage : gains seulement après séjour payé et terminé, refus après annulation entre scan et exécution, création du code sans restauration d’un ancien solde ; vérifier séparément la reprise de points déjà gagnés lors d’un remboursement ultérieur.
- [ ] Réservation : montants payé/dû persistés ; événement avant encaissement ignoré ; double livraison sans double confirmation ; organisation/devise/montant incohérents refusés ; ancien solde refusé après annulation, remboursement ou modification du prix.
- [ ] Notification d'échec de séjour après encaissement/acompte/remboursement : statut et montants conservés. Succès concurrent ou remplacement de session après la première lecture : relecture sous verrou, aucun écrasement par l'ancien événement. Confirmation directe d'un séjour annulé : rapprochement requis, aucune nouvelle écriture.
- [ ] Encaissement d'intervention, de demande marketplace et de facture ; reprise/expiration, refus, authentification forte et absence de double paiement.
- [ ] Paiement groupé de plusieurs prestations et bénéficiaires ; allocation exacte, droits et devise par ligne.
- [ ] Reversement propriétaire avec commission non nulle, retenues de dépenses et documents liés.
- [ ] Reversements de prestataires individuels et sociétés ; catégories autres que ménage, relance sûre et bénéficiaire immuable.
- [ ] Dépenses et réassorts : bénéficiaire, justificatif, montant et absence de double règlement.
- [ ] Migration 0511 et achats fournisseurs : joindre une facture, choisir explicitement l'un des deux parcours, vérifier le verrouillage du choix et les doublons avec l'ancien écran de dépenses. [Code et tests](ota-supplier-reservation-validation.md).
- [ ] Invitation fournisseur existant et nouveau : expiration/renouvellement, email vérifié correspondant, activation Keycloak sans abonnement, acceptation explicite, espace personnel et profil rechargé. Aucun accès à l'organisation cliente ; tester un fournisseur initialement sans organisation.
- [ ] Fournisseur invité : connexion du compte de versement, préparation unique de la dépense, approbation/retenue financée, transfert nominatif et réception bancaire. Un compte non prêt bloque le paiement ; inviter ou accepter ne paie pas.
- [ ] Fournisseur externe : site HTTPS, paiement réalisé hors Baitly, pièce distincte de la facture et TTC exact. Rejeu sans doublon, téléchargement protégé, aucune proposition ultérieure de paiement PSP pour cette facture. Ce parcours reste documentaire, sans retenue propriétaire automatique.
- [ ] Migration 0509 et dépenses société : choix explicite sans transfert, confirmation distincte nommant la société, aucun repli vers le représentant personnel ; compte non prêt ou rattachement modifié bloquants. Deux opérateurs concurrents ne peuvent ni changer le bénéficiaire après réservation du transfert ni émettre deux fois. [Tests isolés](expense-company-validation.md).
- [ ] Remboursements intégraux, partiels, successifs, externes et de lots ; avoirs et contre-écritures exacts.
- [ ] Remboursements externes successifs d'une intervention déjà transférée : somme de la charge et toutes les restitutions vérifiées, ordre local stable malgré les webhooks désordonnés, avoir distinct et part prestataire calculée sur le net et la commission historiques. Reprise après attente de la récupération précédente, sans nouvelle restitution client.
- [ ] Preuve externe de lot affectée à une prestation depuis Finance : motif et auteur conservés, deux affectations concurrentes incompatibles refusées, relecture Stripe avant comptabilisation. Série de 5,01 EUR puis 29,99 EUR sur une part de 35 EUR d'un lot de 80 EUR, autre part de 45 EUR inchangée, avoirs exacts. Affectation seule sans mouvement ; reprise après incident sans doublon ; restitution demandée ensuite depuis Baitly sans réémettre la preuve externe. Répartir aussi une preuve de 50 EUR entre deux prestations (20 et 30 EUR), puis vérifier les deux avoirs, les soldes et une seule référence Stripe. Répartir les preuves dans un ordre inverse à leur observation et vérifier la reprise dans le bon ordre.
- [ ] Remboursements externes de séjour PMS EUR sans crédit ni reversement engagé : 5,01 EUR puis 4,99 EUR puis solde, relecture de toutes les restitutions, contre-écritures, avoirs, statut et financement résiduel exacts. Rejeu et interruption sans doublon. Tester ensuite le séjour déjà reversé : base nette figée, instruction de récupération distincte, avoir de commission et maintien du transfert historique. Tester le crédit offert consommé et les récompenses déjà dépensées : restitution des points, reprise des gains et aucun cash inventé. [Compléments implémentés](refund-completion-validation.md).
- [ ] Refus externe avant comptabilisation : historique conservé, aucun avoir/événement de succès, budget non consommé. Incident après comptabilisation : un rejeu ou une erreur réseau ne clôt pas l'incident avant vérification complète ; versement du solde toujours bloqué.
- [ ] Notification tardive d'échec d'un remboursement : historique conservé, incident visible, aucune nouvelle récupération du bénéficiaire ni nouveau remboursement avant résolution.
- [ ] Remboursement après reversement, avec et sans commission ; récupération, échec, reprise et maintien du solde réellement conservé.
- [ ] Commission prestataire : base du transfert historique conservée, remboursement de 5,01 EUR puis 4,99 EUR sur 35 EUR (30 EUR transférés, 5 EUR de commission) ; récupérations de 4,29 EUR puis 4,28 EUR, parts de commission de 0,72 EUR puis 0,71 EUR ; restitution finale des 25 EUR restants avec récupération des 21,43 EUR de net restants.
- [ ] Cas au centime couvert uniquement par la commission : remboursement client confirmé, état « Aucune récupération nécessaire », aucun appel de reprise Stripe à zéro ni référence de récupération inventée ; reprise de la série et total final exact.
- [ ] Migrations 0512 à 0515 : affectations immuables et isolées, net par séjour figé, écritures de fidélité liées à leur source et avoirs de commission séparés. Vérifier chargement, rejeux et parcours multi-séjours.
- [ ] Migration 0508 et restitution avec commission dans Finance : ventilation visible, preuve du transfert initial conservée, bénéficiaire limité à sa propre part ; recharge et rejeux sans doublons.
- [ ] Versement bancaire automatique : rapprochement du montant net, frais/reprises non attribuables, événement tardif, échec et rattrapage sans webhook.
- [ ] Litiges gagnés/perdus après encaissement et après transfert, blocages de financement et rattrapage.
- [ ] Après un versement bancaire confirmé, litige de la source et récupération non aboutie restent visibles dans Finance. Résoudre le litige ne masque pas une absence de preuve bancaire distincte. Aucun prélèvement automatique du bénéficiaire pour un litige n'est présumé.
- [ ] OTA : paiement voyageur, collecteur et réception des fonds distincts ; aucune disponibilité Stripe présumée et commission documentée.
- [ ] Migration 0510 : rapprochement documentaire d'un versement OTA avec relevé et justificatif bancaire distincts, ventilation de plusieurs séjours, frais/remboursements/net exacts, propriétaire ou gestionnaire explicitement désigné. Des propriétaires différents interdisent la réception sur le compte d'un seul propriétaire.
- [ ] OTA : montant cumulé plafonné, même référence bancaire concurrente refusée, correction motivée conservant l'historique puis nouveau rapprochement. Le rapprochement documentaire ne paie pas automatiquement une commission et ne crée aucun fonds disponible chez Stripe.
- [ ] Deux imports OTA simultanés : une seule facture de commission ; statut émis tant qu'aucun règlement/retenue prouvé n'existe. Ne pas convertir les anciennes factures en masse sans preuve.
- [ ] Rejeux, événements désordonnés, interruptions et concurrence : aucune double émission, aucun doublon de facture/avoir ou journal.
- [ ] Cloisonnement entre organisations et bénéficiaires, écran Finance et compte bénéficiaire, affichage mobile et erreurs compréhensibles.
- [ ] Dépense : confirmation explicite, une seule émission au double clic, refus métier visible, ancienne éligibilité désactivée si sa relecture échoue, statut conservé après recharge.
- [ ] Rapprochement : changement de référence invalide la vérification et le consentement ; double clic confirme une seule fois ; HTTP 409 redemande une vérification sans envoyer de transfert.

## Extension commerciale du 7 octobre 2026

Exécuter ensuite les [scénarios détaillés des sept lots](../../scripts/payments/commerce-final-recipe.md),
en conservant le même relevé de preuves. Leur implémentation et leurs limites sont décrites dans
l'[audit commercial](../../scripts/payments/commerce-expansion-audit.md).

- [ ] Portefeuille IA : achat, réservation concurrente, consommation, expiration, remboursement/litige, dette et anciennes dotations à rapprocher.
- [ ] Maintenance : acompte puis solde, préparation groupée avec liens individuels, remboursements cumulés et reversement net.
- [ ] Booking et promotions : parcours public/intégré/direct, devise, nuits offertes, panier, quotas et paiements tardifs.
- [ ] Abonnements PMS : grilles locales HT dégressives, pays de facturation, renouvellement, impayés, changement à échéance, droits et mobile.
- [ ] Upsells et affiliation : réalisation, corrections, pièces vendeur, commissions réellement reçues, transferts et récupération après remboursement.
- [ ] Matériel : stock concurrent, reprise d'une session non rattachée, expédition, retour physique et remboursement distincts.
- [ ] Documents : émetteur, séries, copies/PDF/exports, avoirs liés aux restitutions et transmission fiscale durable.

Les PSP MA/SA, identités/immatriculations, connecteurs fiscaux, mandats d'émission au nom des
vendeurs et accès contractuels aux rapports partenaires restent des prérequis externes. Un
connecteur absent n'est ni une exemption ni une recette réussie. Aucun scénario de cette section
n'est validé par les seuls tests isolés.

## Conditions de clôture

### Documents & Communications : refonte du 7 octobre 2026

- [ ] Parcourir les quatre espaces Modèles, Messages, Historique et Conformité. Vérifier aussi les anciens liens vers modèles de documents, WhatsApp, variables et avenants : ils doivent ouvrir la vue fusionnée correspondante.
- [ ] Contrôler la liste compacte, les images, la pagination et les actions du détail à 375, 768, 1024 et 1440 px. Sur téléphone : ouverture du détail, retour à la ligne sélectionnée, absence de débordement horizontal.
- [ ] Tester les icônes de statut au survol, au clavier et au toucher ; leurs explications doivent rester accessibles. Vérifier les thèmes clair/sombre et le français, l’anglais et l’arabe.
- [ ] Importer un modèle HTML de test, consulter directement son aperçu fictif et filigrané dans la bibliothèque, changer de page et vérifier l’absence de commandes de téléchargement/impression. Tester séparément le téléchargement du modèle source HTML et la redirection des anciens liens de détail. Vérifier séparément la qualité du modèle et la revue fiscale de la facture émise.
- [ ] Modifier un message de test, comparer son aperçu au rendu de l’éditeur et vérifier la validation Meta propre à chaque langue WhatsApp. Aucun envoi réel n’est nécessaire pour contrôler la présentation.
- [ ] Depuis l’historique, ouvrir l’aperçu archivé et le dossier Conformité correspondant ; contrôler les avenants prêts/en préparation, les erreurs de téléchargement et le renvoi d’un message fictif échoué.
- [ ] Vérifier le changement d’organisation, les droits du membre et de l’administrateur, les états vides et les pannes API sans réaffichage de données privées en cache.

Les tests interface et HTTP isolés couvrent la navigation historique, la sélection mobile,
les infobulles, le cloisonnement, les statuts Meta, les archives, les imports et la revue fiscale.
Les 33 tests ciblés et le contrôle `tsconfig.documents-tests.json` passent. Les nouvelles
suites sont incluses dans `scripts/payments/financial_recipe.json`. Le build global a été
validé le 7 octobre 2026 : `npm run build` (prébuild SDK, `tsc -b`, Vite et service worker),
code de sortie 0 en 109 secondes, avec Node 22.16.0 et une limite de heap de 4 Gio.
Les trois avertissements CSS provenaient d’exemples de classes dans un commentaire
de `PropertyCard.tsx`, interprétés par Tailwind ; le commentaire a été corrigé.
Les avertissements non bloquants restants concernent les exports du SDK, les imports
statiques/dynamiques communs et la taille de certains bundles.
La vérification navigateur a commencé sur la bibliothèque et les messages ; elle reste à
compléter : le serveur local a signalé des timeouts Hikari/base de données, puis la session
ne chargeait plus ses permissions. Ne pas considérer cette recette visuelle comme entièrement validée.

Contrôle du démarrage local après reconstruction : l’injection du client HTTP de
`BaitlyPdfEngine` était ambiguë entre les clients général, Channex et Cloudflare, ce qui
empêchait le serveur de démarrer. Le client général est maintenant explicitement qualifié.
Le nouveau test de contexte Spring reproduit la présence des trois clients et vérifie le
client effectivement utilisé ; il rejoint la recette automatisée. Le packaging serveur et
les 65 tests ciblés passent, y compris les deux conversions réelles via Gotenberg local
(`-Dbaitly.test.pdf-url=http://localhost:8083`), sans test ignoré dans ce relevé consolidé.
Le JAR corrigé a été chargé par l’utilisateur : huit contrôles de santé HTTP 200 entre 16 et 64 ms (médiane 23 ms). Le lecteur PDF canvas a été vérifié dans le navigateur aux largeurs 375, 768, 1024 et 1440 px. Les nouveaux rendus fictifs et le service d’aperçu email nécessitent encore le chargement du nouveau JAR.

Pour chaque scénario, conserver les références Baitly/Stripe, les montants avant/après, les états et les limites. Ne jamais remplacer un parcours incomplet par une modification SQL des données métier. Une simple réponse HTTP 200 ou un retour de Checkout ne prouve pas un encaissement, un rapprochement comptable ou une réception bancaire. Les scénarios indisponibles dans le sandbox doivent rester explicitement non validés.

### Aperçus PDF et emails harmonisés

- [ ] Charger le nouveau JAR ; vérifier les aperçus fictifs dans la bibliothèque et dans Parcours & usages, y compris après changement d’organisation.
- [ ] Parcourir les emails voyageurs et système : même enveloppe que dans leurs éditeurs, variables remplacées par les exemples, aucun lien actif, ressource distante ni envoi.
- [ ] Vérifier les modèles absents, les erreurs HTTP et la régénération ; alterner entre email et PDF sans aperçu périmé.
- [ ] Vérifier français, anglais, arabe, clavier, téléphone et documents multipages ; conserver les archives émises inchangées.

Les nouveaux tests de génération et d’interface sont intégrés au manifeste de recette. Les conversions Chromium isolées et les tests HTTP ne constituent pas la validation du nouveau JAR dans le serveur partagé.

Livrable du 7 octobre, 21:58 : packaging final réussi, 42 tests documentaires et 37 conversions Chromium ; suite PDF/email de 100 tests et 19 tests interface réussie, zéro test ignoré. Build frontend complet validé. Sauvegarde et livrable figé sous `/private/tmp/baitly-document-preview-release` ; script de chargement manuel `/private/tmp/baitly-install-document-previews.py --apply`, non exécuté par l’agent.

### Mise en page adaptative des trois bibliothèques

- [x] Retirer les bandeaux introductifs des vues Bibliothèque de documents, Parcours & usages et Variables des modèles ; placer filtres et compteurs dans le header partagé.
- [x] Mesurer la hauteur disponible et les lignes pour calculer la pagination automatiquement, avec le même comportement sur les trois vues. Conserver la sélection lors du redimensionnement et revenir au début après filtrage.
- [x] Vérifier les formats 375, 768, 1024 et 1440 px : aucun débordement de page ; filtres accessibles depuis le header, directement ou dans son menu selon la largeur ; détail et retour accessibles sur téléphone.
- [ ] Refaire ces contrôles avec les aperçus PDF/email du nouveau JAR, en français, anglais, arabe et thème sombre pendant la recette finale.

Contrôle du 7 octobre : 17 tests interface réussis dans quatre suites, dont le nouveau test de dimensionnement et de filtrage des variables ; contrôle TypeScript incluant les tests réussi. À 1440 × 800, les listes affichent huit lignes ; à 768 × 900, dix lignes. Le nombre dépend de la place réelle, sans constante différente pour les variables. Ces changements d’interface ne nécessitent aucun redémarrage du serveur.

Build frontend complet validé après ces changements : prébuild SDK, TypeScript, Vite et PWA, sortie 0. Les avertissements existants de découpage des bundles restent non bloquants.

### Header partagé : largeur disponible et ancrage

Le header mesure désormais sa zone disponible, y compris les changements de sidebar,
et cumule les marges des enveloppes pleine largeur pour rejoindre les bords de l’écran.
Les groupes trop larges se replient ; la recherche reste accessible sous forme d’icône
quand le libellé manque de place. Le choix d’un filtre survit au déplacement entre
le menu et la barre. L’icône décorative du titre s’efface sur les petites largeurs.

- [x] Documents vérifié à 320, 375, 768, 1024, 1440, 1920 et 2560 px, sans débordement horizontal ; sidebar ouverte/repliée, filtre conservé au redimensionnement.
- [x] Planning vérifié à 1440 px : dates, recherche et actions visibles, header de bord à bord.
- [x] 25 tests ciblés réussis, dont les changements de conteneur sans resize de fenêtre, les contrôles longs, le changement de vue et les marges imbriquées. Vérification TypeScript réussie.
- [x] Build frontend complet réussi après la correction du header (SDK, TypeScript, Vite, PWA), sortie 0. Avertissements non bloquants de taille/découpage des bundles existants.
- [ ] Reprendre le parcours en anglais et arabe, thème sombre, pendant la recette finale.
