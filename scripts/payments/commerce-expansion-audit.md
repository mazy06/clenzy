# Baitly · Extension du circuit commercial

Campagne du 7 octobre 2026. Socle précédent : `f1f9c83c2`, sans push. La recette Baitly/PSP partagée reste différée jusqu’à la fin du code et des tests isolés.

## Décisions conservées

- **Développement interne prioritaire** : conserver les fonctions métier et financières dans Baitly. Déléguer uniquement les opérations contraintes par un agrément/habilitation non détenu ou un accès tiers indispensable, après qualification de leur périmètre. Une suite comptable plus riche n'est pas un motif pour externaliser les développements prévus. Voir [la règle persistante](../../primer.md#developpement-interne-et-recours-aux-partenaires).
- Trois sociétés d’exploitation : France, Maroc, Arabie saoudite. La holding n’est pas supposée facturer les abonnements.
- PMS **HT**, grilles locales Essentiel/Pro à 29/49 EUR, 290/490 MAD et 109/189 SAR par logement avant dégressivité. Le pays de facturation du client choisit grille et vendeur. Tous ses logements comptent dans les mêmes tranches marginales ; la fiscalité des locations dépend séparément du pays du bien.
- Aucun PSP MA/SA choisi : pas de repli silencieux sur Stripe France, ni d’identité ou d’immatriculation inventée.
- Packs IA et matériel : conservation des montants TTC du catalogue ponctuel existant ; catégorie fiscale à configurer avant vente. La décision HT concernant le PMS ne change pas silencieusement les autres catalogues.

## Les sept lots

| Ordre | Fonctionnalités et protections implémentées |
| --- | --- |
| 1. Crédits IA | Portefeuille et réservations PostgreSQL, concurrence, expiration, réponse tardive, journal atomique. Retrait/gel proportionnel après remboursement/litige, dette pour consommation passée, rétablissement limité après échec. Les anciennes dotations annuelles sans couverture prouvée restent en attente ; rapprochement seulement avec une période payée unique du même tenant. Interface : disponible, réservé, régularisation et historique. |
| 2. Maintenance | Acompte lié au devis approuvé, preuve avant déduction, deux encaissements conservés. Remboursements cumulés, avoirs et reversement net au centime. La préparation groupée donne aux soldes après acompte des liens individuels ; le serveur refuse de créer un nouveau lot incompatible. |
| 3. Booking | Calcul et plan de paiement communs public/intégré/ancien direct. Devise des remises fixes, nuits offertes, frais/taxes exclus, paniers multi-séjours, quotas réservés puis consommés. Expiration canonique, reprise et paiement tardif après annulation. L’acompte consomme le quota, y compris lors du rejeu réparateur d’un ancien état. |
| 4. PMS | Grilles serveur versionnées, volume/fidélité, taxes/vendeur figés, inscription et commande idempotentes, renouvellement, impayés, portail de paiement. Modification formule/quantité à la prochaine échéance, sans débit immédiat/prorata ni perte de fidélité. Droits et dotations liés aux factures financées ; protection contre les preuves anciennes. Web/mobile raccordés. |
| 5. Upsells/affiliation | Prix et partage figés, comptabilisation atomique, suivi opérationnel distinct, remboursements et corrections append-only. Import partenaire distinct de réception prouvée, devises séparées. Reversements avec montant accepté et compte bénéficiaire vérifiés, récupération après remboursement, confirmation tardive couverte, annulation des seules préparations jamais émises. |
| 6. Matériel | Stock explicite, dernier article concurrent, intention liée à l’acheteur, reprise après réponse perdue. Une session non rattachée est retrouvée à partir de l’unique encaissement journalisé et vérifiée avant confirmation. Abandon uniquement sur preuve PSP ; file différée pour ne pas bloquer les commandes suivantes. Expédition/retour journalisés. Remboursement distinct du retour physique ; remise en stock contrôlée et idempotente. |
| 7. Documents/fiscalité | Copies canoniques des factures/avoirs PSP PMS/IA/matériel, snapshots immuables, lignes HT/taxes/TTC, PDF et export JSON autorisé. Avoir lié à un remboursement existant sans second mouvement d’argent. Numérotation locale par organisation/émetteur/année, transactionnelle. File de transmission fiscale durable ; connecteur absent = attente, jamais exemption présumée. Suivi des transmissions dans les paramètres. |

### Pièces des vendeurs et partenaires

Les factures/avoirs du vendeur effectif d’un upsell et les relevés/corrections d’affiliation sont rattachables à leurs preuves financières. Fichier, empreinte, numéro, émetteur déclaré, référence légale/mandat et auteur sont conservés sans modification. Montant et devise sont contrôlés. Une pièce ne confirme pas un paiement.

Ce parcours **archive une pièce fournie** ; il ne crée pas une facture Baitly au nom d’un propriétaire ou d’un gestionnaire dont le mandat n’est pas configuré. Le prix total de l’activité affiliée reste distinct de la commission reçue par Baitly.

### Historiques et accès

Un ancien dossier combinant acompte individuel et solde dans un lot reste à rapprocher ; ses preuves ne sont pas réécrites. Les historiques sans encaissement, identité fiscale ou attribution prouvés restent bloqués explicitement. Les anciens documents conservent leur numéro.

Le compte personnel d’un bénéficiaire commercial peut appartenir à une autre organisation, uniquement avec un lien de vente/commission prouvé. Les fichiers, exports et transmissions exigent la gestion de l’organisation ; l’acheteur matériel reste limité à ses commandes.

## Dépendances externes restantes

1. **PSP MA/SA** : choix, contrats, capacités de récurrence/transfert, comptes et webhooks. Les adaptateurs seront à réaliser contre les contrats réels.
2. **Identités et taxes** : informations légales, immatriculations et catégories fiscales des produits. Le dernier contrôle en lecture seule du sandbox Baitly indiquait Stripe Tax `pending`, sans immatriculation active ; aucune configuration fictive n’a été ajoutée.
3. **Transmission fiscale** : partenaires FR/MA/SA, accès et homologations. La file technique ne vaut pas conformité fiscale acquise.
4. **Émission au nom des vendeurs d’upsells** : mandats et identité fiscale nécessaires pour automatiser l’émission. Les pièces émises par le vendeur sont déjà rattachables.
5. **Affiliation automatisée** : accès contractuels aux rapports partenaires ; les taux ne sont pas déduits d’une page publique.

Ces dépendances ne sont pas présentées comme de simples tests manquants.

État confirmé le 7 octobre 2026 : aucune donnée fiscale réelle n'est encore attribuée ; Stripe est retenu uniquement pour la France. Aucun PSP MA/SA n'est décidé. Les accès d'affiliation Viator, Klook et **GetYourGuide** sont en discussion, pas encore accordés. Le [dossier de raccordement](partner-onboarding-dossier.md) précise les données attendues, les candidats à qualifier et les accès distincts à demander. Les recommandations Tap/Chari/Iopole ne sont pas des sélections contractuelles et n'activent aucune configuration.

## Diagnostic avant mise en service

Un panneau dans **Paramètres > Paiements**, réservé au staff plateforme, expose les prérequis techniques des trois sociétés. L'affichage initial lit uniquement la configuration locale. La vérification Stripe, déclenchée explicitement, utilise les GET du compte canonique et de Stripe Tax hors transaction. Les états « à compléter », « non vérifié », « indisponible » et « exemption déclarée » restent distincts. Aucun secret, identifiant fiscal ou contenu d'erreur PSP n'est retourné par ce diagnostic.

Le contrôle Stripe France porte sur le pays, le dossier transmis et l'encaissement activé ; le contrôle Tax porte sur la configuration active et au moins une immatriculation active. Il **ne certifie pas** l'identité légale ni la couverture de chaque vente. MA/SA restent à raccorder, même si des adaptateurs d'encaissement locaux existent. Les catégories produit sont partagées et leur présence n'est pas une validation de classification fiscale.

Les réglages ne présument plus Stripe configuré sans clé serveur ni un fournisseur local configuré sur la seule présence de sa fiche. Le libellé « Autorisé » distingue l'activation interne d'un circuit testé ; le mode test demandé à un fournisseur local n'est pas présenté comme une preuve PSP. L'ajout d'une première configuration est désormais répercuté dans la liste immédiatement. Les contrôles d'accès restent portés par le serveur.

## Validation et recette différée

Le manifeste `scripts/payments/financial_recipe.json` pilote tests serveur/PostgreSQL, contrôles TypeScript et intégrations frontend HTTP. Le lanceur refuse toute suite absente, vide ou ignorée et produit des rapports propres à chaque exécution. Les tests PostgreSQL ciblés appliquent/rejouent les migrations et couvrent concurrence, rollback, droits croisés et immutabilité.

Résultats locaux du 7 octobre 2026 :

- **2 852 tests serveur réussis**, zéro échec/erreur/test ignoré, dans la sélection financière et commerciale. Rapports : `/private/tmp/baitly-seven-points-final-b-20261007`.
- **55 tests de reprise matériel et persistance réexécutés** après l’ultime déplacement de la lecture sous verrou, tous réussis. Ils sont déjà inclus dans les 2 852, pas additionnés. Rapports : `/private/tmp/baitly-commerce-recovery-final-20261007`.
- **159 tests web dans 30 suites**, dont intégrations HTTP, et **7 tests mobiles d’abonnement** réussis. Les deux contrôles TypeScript web et le contrôle TypeScript mobile passent. Dernière passe web après correction des modales : `/private/tmp/baitly-seven-points-frontend-final-20261007` ; rapport mobile : `/private/tmp/baitly-seven-points-mobile-20261007.json`.
- **36 tests Python** des lanceurs/garde-fous réussis. YAML du workflow financier lu et filtres push/PR contrôlés ; déclenchement étendu aux surfaces commerce, aux promotions et aux tarifs. La CI distante n’a pas été exécutée.

Les contrôles frontend ont également révélé un fond de modale Radix qui ne transmettait pas sa référence sous React 18 ; la référence est désormais transmise sans changement de présentation. Les tests mobiles attendent le chargement effectif de la proposition, plutôt qu’un délai fixe trop court.

La liste finale est [`commerce-final-recipe.md`](commerce-final-recipe.md). Aucune case Baitly/PSP n’est cochée sur la seule base de mocks ou de tests isolés. Aucun nouveau JAR n’a été chargé sur le serveur partagé pendant cette phase.

Complément du 7 octobre 2026 (diagnostic et outillage) :

- **48 tests serveur ciblés réussis**, dont 13 nouveaux tests du diagnostic, de son routage HTTP et des droits Spring ; le reste couvre les achats IA et matériel. Rapports : `/private/tmp/baitly-readiness-backend-20261007`. Les appels PSP sont simulés ; aucune recette partagée n'a été lancée.
- **163 tests frontend dans 31 suites réussis**, dont 4 nouveaux scénarios HTTP du diagnostic : consultation locale, demande explicite au PSP, échec après résultat positif, changement d'organisation. Deux contrôles TypeScript réussis. Rapports : `/private/tmp/baitly-readiness-front-suite-20261007`.
- Le projet TypeScript de recette inclut désormais **toutes les suites du manifeste**, et le lanceur refuse une suite oubliée ou une exclusion. Cela a révélé des options de sélecteur de test non reconnues et une fixture de transfert incomplète, corrigées sans modifier les assertions métier. **37 tests Python réussis**.
- Aucune migration supplémentaire, aucun redémarrage du serveur partagé et aucune configuration fiscale fictive pour cette étape. Le rendu responsive et la validation Baitly/Stripe sont inscrits dans la recette différée.

## Premier raccordement technique Iopole, 7 octobre 2026

Le client OAuth/multipart Iopole et ses lectures canoniques sont branchés à la file fiscale française existante. Le dépôt reste en attente jusqu'à réception vérifiée. Une reprise avec référence consomme le flux PULL : lecture, sauvegarde transactionnelle puis acquittement, sans nouveau dépôt. Les lots pleins sont drainés avant confirmation ; l'historique distant n'est pas utilisé pour le polling. Sans référence après une réponse perdue, le renvoi automatique reste interdit. L'organisation, l'émetteur, l'environnement, le document et les montants sont contrôlés. La référence partenaire est distinguée de la confirmation dans les trois langues.

**Limites explicites** : désactivé par défaut, accès/mandats non obtenus, ancien générateur CII incomplet bloqué avant envoi. La préparation interne décrite ci-dessous remplace ce générateur pour un périmètre FR B2B défini. Le lien avec `BaitlySaleDocument`, le rapprochement des dépôts sans référence et le cycle fiscal au-delà de la première réception restent à traiter. Ce lot ne termine ni l'intégration fiscale française ni les autres connecteurs. Voir le [détail technique et les prérequis](iopole-connector.md).

Validation ciblée : **103 tests serveur**, **7 tests frontend**, contrôle TypeScript Finance et **5 tests Python** réussis, sans échec ni test ignoré. Le partenaire est simulé ; les suites PostgreSQL utilisent une base isolée et appliquent/rejouent la migration `0540-iopole-status-inbox`. Rapports serveur : `/private/tmp/baitly-iopole-pull-tests-20261007`, frontend : `/private/tmp/baitly-iopole-frontend-verified-20261007.xml`. Les nouveaux tests sont inclus dans le manifeste de recette. Aucun rechargement du serveur partagé ni recette partenaire ; les scénarios sont ajoutés à la liste différée.

Le choix de fournisseur reste ouvert. La clarification du porteur du projet limite la comparaison Iopole/Pennylane au service réglementaire nécessaire : comptabilité logicielle, rapprochements et logique financière restent des développements internes prioritaires. L'adaptateur Iopole reste inactif ; il ne constitue pas une décision commerciale ni une exclusion de Pennylane.

## Préparation fiscale interne, 7 octobre 2026

Finance > Factures propose la préparation, le contrôle puis l'archivage explicite d'un XML CII. Le calcul et la validation restent locaux : XSD D16B, règles EN 16931 v1.3.16 et règles françaises FNFE RFE v1.4.0.04 embarquées avec leurs licences et empreintes. Aucun appel partenaire n'est nécessaire pour préparer le document. Il s'agit d'un XML CII, pas d'un PDF hybride Factur-X.

Le périmètre couvre les factures FR B2B en EUR, avec TVA positive, unités comptées et échéance explicite. L'utilisateur complète les données structurées et classe les mentions déjà émises ; les clauses ne peuvent pas être inventées ou réécrites. Les identités absentes, montants incohérents, avoirs, acomptes, remises, exonérations, taxes de séjour et opérations internationales restent bloqués ou hors périmètre. Les copies commerciales `BaitlySaleDocument` ne sont pas encore raccordées à cette préparation.

La migration `0541-invoice-fiscal-documents` conserve séparément l'archive, ses empreintes, les versions de validation et son auteur, avec interdiction de modification/suppression. Aucun PDF ni XML historique de la facture n'est remplacé. La répétition identique est idempotente ; le changement de source, de préparation ou d'organisation est refusé. Une annulation conserve le document consultable mais empêche un nouveau dépôt. L'archivage ne déclenche pas directement de transmission ; la file existante peut l'utiliser uniquement si le partenaire est configuré et activé.

Validation finale de ce lot : **145 tests serveur dans 24 suites**, dont 39 tests PostgreSQL avec migrations appliquées/rejouées, **11 tests frontend d'intégration HTTP**, contrôle TypeScript Finance, compilation Vite et **5 tests Python** réussis, zéro échec/erreur/test ignoré. Ces chiffres incluent des régressions déjà comptées dans les lots précédents ; ils ne s'additionnent pas aux totaux de campagne. Rapports : `/private/tmp/baitly-cii-final-tests-20261007` et `/private/tmp/baitly-cii-frontend-20261007.xml`. La vérification inclut les empreintes des référentiels embarqués, les écritures concurrentes, les droits et l'isolation entre organisations. Vite signale des imports à la fois statiques/dynamiques et des chunks volumineux ; la compilation aboutit.

Les scénarios d'écran et de transmission réelle sont ajoutés à la [recette finale différée](commerce-final-recipe.md#raccordement-iopole-france). Aucun JAR chargé sur le serveur partagé, aucune activation partenaire et aucune donnée légale réelle inventée. Les contrôles techniques ne certifient pas l'identité des parties ni l'acceptation par une plateforme agréée.

## Audit Documents, Conformité et Finance, 7 octobre 2026

Demande : prévoir une vraie étape de vérification fiscale et éviter les fonctionnalités parallèles entre Documents & communication, Finance et Paramètres. **Analyse du code et des tests existants**, sans modification du fonctionnement ni recette sur le serveur partagé. Les constats ci-dessous ne prouvent pas qu'un incident a déjà touché des documents réels.

### Répartition constatée

| Écran | Ce qu'il traite actuellement | Limite constatée |
| --- | --- | --- |
| Documents > Catalogue / Modèles PDF | Catalogue de parcours et édition/activation des modèles | Deux vues des modèles, mais usages différents ; pas deux sources à créer |
| Documents > Conformité | Présence de variables dans les modèles, score moyen, compteur de PDF verrouillés, recherche de `DocumentGeneration` par numéro | Ne contrôle pas les valeurs d'une facture ; aucun dossier fiscal unifié ni étape préalable à son émission |
| Documents > Historique | Messages et PDF générés, téléchargements, intégrité SHA-256 | L'intégrité du fichier est distincte de sa validité fiscale ; les transmissions et les copies commerciales sont ailleurs |
| Finance > Factures | Factures `Invoice`, émission, envoi, règlement, annulation/avoir, duplicata | Préparation CII disponible seulement après émission ; bouton Émettre sans passage par cette vérification |
| Détail Finance > Document fiscal électronique | Vérification CII EN 16931/FR, archive immuable, téléchargement | Socle réutilisable ; contrôle réussi non archivé transitoire, pas de journal complet des contrôles négatifs ni approbation avant émission |
| Paramètres > Fiscal | Profils par juridiction, identité/TVA/mentions, suivi des transmissions | Le suivi opérationnel est rangé parmi les réglages, sans lien direct vers le dossier à corriger |
| Rapports > Fiscal | Synthèse TVA des `Invoice` | Périmètre documentaire différent des ventes `BaitlySaleDocument` ; filtres d'avoirs/duplicatas à corriger |
| Ventes PMS / IA / matériel | Copies canoniques PSP et avoirs dans `BaitlySaleDocument` | Ne doivent pas être réémis ou renumérotés pour rejoindre Conformité |
| Logement > Conformité et agent Conformité | Enregistrement du logement, police, mandats, taxe de séjour, autres obligations opérationnelles | Objets distincts à conserver ; futures alertes fiscales à relier au dossier, sans troisième commande de validation |

### Constats prioritaires et preuves

1. **P1, deux représentations de facture peuvent diverger.** Le [pipeline PDF](../../server/src/main/java/com/clenzy/service/DocumentGenerationPipeline.java) alloue un numéro dans `document_number_sequences`, remplit le modèle depuis le contexte métier puis verrouille le PDF. Ensuite, [le pont vers Invoice](../../server/src/main/java/com/clenzy/service/InvoiceGeneratorService.java), méthode `createIssuedFromDocumentGeneration`, alloue un autre numéro et reconstruit les données. Le test `whenInvoiceCreatedFromDocumentGeneration_thenNumberingHappensViaInvoiceSequence` confirme volontairement cette séparation. L'échec du pont est journalisé sans invalider le PDF. Il faut une seule facture de référence, pas seulement masquer une liste dans l'interface.
2. **P1, contrôle complet trop tardif.** Des précontrôles existent déjà : règles fiscales disponibles et identité du vendeur lors de la numérotation. En revanche, `issueInvoice`, le pont Documents et [AutoInvoiceService](../../server/src/main/java/com/clenzy/service/AutoInvoiceService.java) ne passent pas par un contrôle commun des données complètes et une décision vérifiable. Le [nouveau générateur CII](../../server/src/main/java/com/clenzy/fiscal/einvoicing/francepdp/BaitlyInvoiceCiiBuilder.java) accepte seulement des factures déjà émises. Il ne remplace donc pas un contrôle avant émission.
3. **P1, « conforme » est plus large que le contrôle réellement effectué.** [DocumentComplianceService.checkTemplateCompliance](../../server/src/main/java/com/clenzy/service/DocumentComplianceService.java) recherche des noms de variables. `anyMatch` peut valider l'identité vendeur avec son nom seul ; un référentiel vide produit 100 %. Des avertissements n'empêchent pas le résultat positif. Les valeurs effectives, les montants et le XML ne sont pas examinés. Renommer en contrôle du modèle, traiter les règles absentes comme non vérifiées et distinguer variables alternatives et champs cumulativement obligatoires.
4. **P1, indicateurs de TVA à fiabiliser.** [FiscalReportingService](../../server/src/main/java/com/clenzy/service/FiscalReportingService.java) conserve `ISSUED`, `PAID`, `CREDIT_NOTE`, sans exclure `duplicateOfId`, mais exclut `SENT`, `OVERDUE` et l'original passé `CANCELLED`. Un original 120 annulé avec un avoir -120 dans la même période peut laisser -120 dans ce calcul ; une copie `ISSUED` peut doubler un montant. Reprendre le calcul depuis les événements documentaires canoniques, selon périodes, émetteurs et juridictions. Ne pas remplacer les chiffres fiscaux par la devise d'affichage de l'utilisateur.
5. **P2, contrôles exécutés à l'ouverture et succès trompeur.** [ComplianceDashboard](../../client/src/modules/documents/ComplianceDashboard.tsx) lance des POST pour tous les modèles au montage, ajoute des délais artificiels, absorbe les erreurs en `null`, puis affiche « vérification terminée » selon le nombre de tentatives. La moyenne [des rapports](../../server/src/main/java/com/clenzy/repository/TemplateComplianceReportRepository.java) porte sur tout l'historique ; chaque réouverture modifie sa pondération. Afficher le dernier résultat valable par version/pays ; distinguer succès, échec de contrôle et erreur technique.
6. **P2, pays réglé dans deux écrans.** Le sélecteur de Conformité écrit dans le profil fiscal. Il ne s'agit pas d'un filtre de consultation et le contrôle automatique déjà effectué n'est pas relancé sur la nouvelle juridiction. Le rapport de modèle ne stocke ni pays, ni version du référentiel, ni empreinte du modèle. Garder les réglages dans Paramètres ; Conformité filtre par organisation, émetteur, pays et type d'opération.
7. **P2, droits incohérents et contexte à rendre explicite.** [DocumentsPage](../../client/src/modules/documents/DocumentsPage.tsx) ne masque aucun onglet selon le rôle. Le [controller Documents](../../server/src/main/java/com/clenzy/controller/DocumentController.java) réserve statistiques, contrôle et intégrité à `SUPER_ADMIN`, mais accepte `SUPER_MANAGER` pour la recherche. Le nouveau parcours fiscal utilise les droits de gestion d'organisation. Les clés de cache Documents ne portent pas l'organisation/pays. Harmoniser les capacités côté API et UI, distinguer modèles globaux et dossiers d'organisation, tester les changements de session et de société ; ne pas élargir simplement tous les endpoints aux utilisateurs authentifiés.
8. **P2, garanties d'archivage différentes selon le fichier.** Le PDF de Documents est verrouillé avec hash et le CII possède sa propre archive immuable. [InvoiceQueryService](../../server/src/main/java/com/clenzy/service/InvoiceQueryService.java) régénère en revanche le PDF Finance via `InvoicePdfService` lors du téléchargement. Conserver une version émise commune PDF/XML et son contrôle ; le téléchargement doit servir cette version. L'intégrité ne remplace pas la vérification fiscale, ni inversement.
9. **P2, contrôle d'archive et transmission séparés sans navigation commune.** Réutiliser `BaitlyInvoiceFiscalDocuments`, ses validateurs et la file `EInvoiceSubmission`. Le tableau [BaitlyFiscalSubmissions](../../client/src/modules/settings/BaitlyFiscalSubmissions.tsx) n'exploite pas l'`invoiceId` pourtant fourni par son endpoint. Le déplacer dans Conformité avec accès au même dossier, en gardant un raccourci depuis Paramètres et Finance.
10. **P2, clauses historiques incompatibles avec le produit actuel.** [FranceComplianceStrategy](../../server/src/main/java/com/clenzy/compliance/country/FranceComplianceStrategy.java) injecte encore « prélèvement SEPA mensuel ou virement annuel » dans les devis. Cela contredit le circuit PSP retenu. Corriger les règles des nouveaux documents et identifier les anciens, sans réécrire les clauses de documents émis.
11. **P2, trois familles documentaires à relier sans les fusionner aveuglément.** `Invoice`, `DocumentGeneration` et `BaitlySaleDocument` ne désignent pas toujours trois factures : ils peuvent représenter une facture, son rendu ou la copie d'un document émis ailleurs. Référencer leur origine et l'émetteur réel. Les avoirs Documents (`correctsId`), Finance (`originalInvoiceId`) et PSP exigent un lien canonique ; un correctif PDF ne déclenche pas un remboursement ni une seconde émission.

### Circuit cible recommandé

Une **vérification automatique systématique** précède l'émission et une validation finale porte sur les fichiers définitifs. Une **revue humaine tracée** intervient selon la politique d'émission, pour les exceptions et données à compléter. Ne pas imposer un clic par facture pour les flux automatisés autorisés, ni permettre un bouton « Valider » qui neutralise une erreur bloquante. Une étape humaine n'est pas présentée comme une certification externe.

1. Préparer le dossier : source commerciale, vendeur/mandat, acheteur, pays d'opération, pays d'émetteur, devise, type B2B/B2C, lignes, taxes, acompte/remise, dates et mentions. Les documents non fiscaux utilisent leurs propres règles.
2. Contrôler le brouillon : données présentes et cohérentes, règles applicables versionnées, contrôles du modèle si utilisé. Distinguer **à compléter**, **contrôlé**, **revue requise**, **hors périmètre du moteur** et **non applicable justifié**.
3. Conserver le résultat avec organisation, auteur ou service automatique, date, empreinte de la source, version du modèle et référentiel. Une modification invalide le résultat ; le serveur revérifie avant d'autoriser l'émission. Un résultat en mémoire de l'écran ne fait pas autorité.
4. Émettre une seule fois : un numéro canonique, une version figée, un PDF et un XML issus des mêmes données. Exécuter le contrôle final des fichiers exacts avant diffusion. Prévoir reprise transactionnelle des erreurs de rendu, sans second numéro/document et sans exposer un document provisoire comme émis.
5. Archiver, puis transmettre lorsque le circuit applicable le permet. Le contrôle local, le dépôt et la réception partenaire sont des états distincts. Les pays exigeant une autorisation préalable nécessitent une orchestration adaptée ; la séquence française n'est pas présumée universelle.
6. Suivre le règlement et les événements fiscaux séparément. Un paiement confirmé reste enregistré même si sa facture doit être complétée ; le traitement documentaire en attente doit être durable et visible.
7. Rectifier via les documents et événements liés : avoir, remboursement, duplicata, nouvelle émission si requise, sans modification de la pièce originale et sans additionner les copies aux ventes.

### Organisation des écrans, sans double commande métier

| Destination | Responsabilité unique proposée |
| --- | --- |
| Documents > Conformité | Centre des dossiers à vérifier, anomalies, archives et transmissions. Liste compacte à gauche, même détail partagé à droite. Filtres par étape, société, émetteur, pays et type. Pas de nouveau menu racine. |
| Documents > Modèles PDF | Édition, versions, aperçu et qualité du modèle. Afficher le contrôle du modèle ici ; Conformité en reprend seulement les anomalies pertinentes et un lien. |
| Documents > Historique | Chronologie de génération, validation et envoi avec accès au dossier canonique. « Email envoyé » reste distinct de « Facture reçue par le partenaire ». |
| Finance > Factures | Travail financier : facture, avoir, règlement et justificatifs. Montrer l'étape fiscale et ouvrir le même détail/action de vérification, avec les mêmes endpoints. |
| Paramètres > Fiscal / Paiements / Intégrations | Identités, juridictions, règles et connexions. Retirer de ces réglages la seconde liste opérationnelle de transmissions ; conserver un lien contextuel. |
| Rapports > Fiscal | Agrégats et exports des documents de référence par période et émetteur. Une anomalie pointe sur Conformité ; le rapport ne devient pas un éditeur ni une preuve de déclaration déposée. |
| Constellation / notifications | Alerte dédupliquée renvoyant au dossier, résolue par l'état réel du contrôle. Aucun bouton parallèle qui « valide » uniquement la carte. |

Garder des axes séparés dans les données et dans le détail : **document** (brouillon/émis/avoir), **vérification** (à vérifier/bloqué/validé), **transmission** (à préparer/déposé/reçu/rejeté/inconnu), **communication** et **paiement**. Un seul badge « Conforme » ne résume pas ces cinq états.

### Ordre d'implémentation proposé

1. **Facture de référence et historique** : sécuriser le lien PDF/Invoice, rendre la numérotation et les montants uniques, servir le fichier émis. Identifier les divergences existantes sans renumérotation ni suppression automatique.
2. **Vérification commune avant émission** : réutiliser les règles existantes, ajouter le contrôle du brouillon, un rapport durable et les décisions humaines/politiques automatiques ; brancher génération manuelle, automatique et templates. Étendre ensuite avoirs, acomptes, exonérations et copies commerciales selon leur nature.
3. **Centre Conformité** : déplacer le suivi de transmission, partager le panneau avec Finance et créer les liens depuis Historique, Rapports et notifications. Le parcours fiscal nouvellement développé est intégré, pas réécrit dans un autre service.
4. **Nettoyage des doublons et faux états** : réglages pays centralisés, résultats par version, erreurs visibles, droits cohérents, caches contextuels, fin des contrôles au simple montage et des clauses SEPA par défaut.
5. **Synthèse fiscale et rectifications** : couvrir originaux/avoirs/duplicatas, statuts envoyé/en retard, rattachement des copies PMS/IA/matériel et segmentation émetteur/pays/devise.
6. **Tests et recette** : intégration PostgreSQL de tous les points d'entrée, HTTP frontend du dossier partagé, E2E du parcours complet puis recette Baitly/partenaire finale. Les anciens tests de deux numéros différents devront être remplacés par une assertion d'identité PDF/Invoice/XML. Aucune validation humaine ou transmission réelle n'est simulée comme réussie dans la recette partagée.

Les cas détaillés à automatiser puis vérifier dans Baitly sont ajoutés à [la recette finale](commerce-final-recipe.md#verification-documentaire-unifiee). Les constats ci-dessus décrivent l'état au moment de l'audit ; l'implémentation qui a suivi est indiquée ci-dessous. La recette partagée reste différée.

## Unification documentaire et conversion HTML, 7 octobre 2026

Le dossier de vérification et l'archive canonique sont désormais partagés entre Finance et Documents. Les modèles, contrôles métier, fichiers émis et transmissions restent des étapes distinctes. Les corrections et suites de la campagne sont reprises dans le manifeste de recette ; aucun contrôle isolé ne vaut réception par un partenaire fiscal.

L'inventaire des sources et des chemins de génération est décrit dans [BAITLY-HTML-PDF.md](../../docs/BAITLY-HTML-PDF.md). Les 18 modèles ODT embarqués disposent de versions HTML ; un bon de commande HTML comble le type manquant. Les 10 modèles ODT actifs de la base locale ont été vérifiés en lecture seule. Les imports sont désormais HTML et le moteur de production commun utilise Chromium ; les anciens modèles passent par un lecteur de compatibilité, sans écrasement des personnalisations ni des archives.

Les titres et en-têtes des nouveaux PDF utilisent l'émetteur du dossier : organisation/conciergerie, prestataire pour son devis, ou Baitly pour la plateforme. La résolution prend l'organisation explicite des traitements asynchrones ; elle ne reprend pas l'identité de l'utilisateur qui télécharge. Les profils fiscaux restent propres à chaque pays. Les identités canoniques des factures et les PDF déjà émis ne sont pas réécrits.

Les scénarios de comparaison visuelle, d'identité et de téléchargement historique sont ajoutés à la recette finale. Aucun redémarrage ni chargement de JAR sur le serveur partagé pour cette conversion.

Validation locale de ce lot : **389 tests serveur distincts**, **11 tests d'intégration frontend**, contrôle TypeScript et contrôle des différences réussis. Le moteur Chromium réel a rendu les 19 modèles HTML, une facture et un tableau multipage ; les 10 modèles enregistrés ont été contrôlés sans écrire dans la base. Les traces sont `/private/tmp/baitly-html-issuer-final.log`, `/private/tmp/baitly-provider-identity-tests.log` et `/private/tmp/baitly-html-issuer-client.log`. Ces chiffres recouvrent des régressions des lots précédents et ne s'additionnent pas aux totaux de campagne.

## Références consultées pendant la campagne

- [Stripe : disponibilité des comptes](https://stripe.com/global)
- [Stripe : abonnements](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe : échéanciers](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
- [Viator : distinction affiliate/merchant](https://docs.viator.com/partner-api)
- [GetYourGuide : commissions ajustées](https://partner.getyourguide.support/hc/en-us/articles/15449195331101-Why-haven-t-I-received-my-payment)
- [Klook : suivi des conversions](https://www.klook.com/en-US/blog/partner/tracking-your-performance/)
