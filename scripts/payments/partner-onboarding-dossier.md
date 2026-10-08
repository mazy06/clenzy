# Baitly et le raccordement des partenaires

État confirmé par le porteur du projet le 7 octobre 2026 : aucune identité fiscale réelle n'est encore attribuée aux sociétés d'exploitation. Stripe est retenu pour la France. Les PSP marocain et saoudien restent à choisir. Viator, Klook et **GetYourGuide** sont les partenaires d'affiliation en discussion ; leurs accès API ne sont pas encore accordés.

Ce dossier prépare les raccordements. Il ne vaut ni choix contractuel, ni création de compte, ni activation en production. La recette partagée reste dans [la liste finale](commerce-final-recipe.md).

## Principe de sélection des partenaires

Décision explicite du porteur du projet : **développement interne prioritaire, externalisation limitée aux contraintes d'agrément ou d'habilitation et aux accès tiers indispensables**. La règle persistante est inscrite dans [le primer](../../primer.md#developpement-interne-et-recours-aux-partenaires).

Baitly conserve sa logique de facturation, comptabilité logicielle, tarification, commissions, abonnements, rapprochement, reporting et ses interfaces. Le périmètre à déléguer est vérifié pays par pays, puis réduit au service nécessaire : la présence d'un agrément chez un partenaire ne justifie pas de lui déléguer l'ensemble du circuit. Les opérations confirmées à l'extérieur restent appuyées sur des preuves canoniques.

Pour chaque raccordement, documenter ce qui exige le partenaire, ce qui reste interne, les données échangées et la possibilité de le remplacer. Comparer la qualité de ce service et son coût, sans favoriser une suite plus large pour ses fonctions que Baitly entend développer.

## État des dépendances

| Périmètre | État confirmé | Condition pour avancer |
| --- | --- | --- |
| Sociétés France, Maroc, Arabie saoudite | Données légales et fiscales non attribuées | Recevoir les pièces officielles de chaque société et les obligations validées pour ses ventes |
| Stripe France | PSP retenu ; sandbox utilisé pendant la campagne | Compléter les informations de la société française avant activation réelle ; terminer la recette différée |
| PSP Maroc | Aucun choix | Qualifier le modèle marketplace et les abonnements, puis choisir et obtenir les accès |
| PSP Arabie saoudite | Aucun choix | Même qualification, avec société et bénéficiaires saoudiens |
| Partenaire fiscal France | Aucun accès confirmé | Choisir une plateforme agréée et obtenir le contrat/API pour éditeur |
| Transmission fiscale Maroc et Arabie saoudite | Aucun accès confirmé | Définir le périmètre applicable avec les sociétés et obtenir les accès techniques correspondants |
| Viator, Klook, GetYourGuide | Discussions commerciales en cours | Obtenir séparément les droits catalogue, attribution et relevés de commissions |

La holding n'est pas présumée être le vendeur. Pour le PMS, le pays de facturation du client détermine la société d'exploitation et la grille locale HT. La fiscalité des locations suit séparément le pays du bien. Une organisation multi-pays ne justifie pas un transfert automatique de toutes les recettes vers la société française.

## Données à renseigner lorsque les sociétés seront constituées

Pour chaque société : raison sociale exacte, forme juridique, adresse enregistrée, pays, immatriculation commerciale, identifiants fiscaux effectivement attribués, registrations de taxes applicables et dates d'effet. Conserver les justificatifs et l'identité de l'émetteur avec les documents de vente.

Pour le PSP et les partenaires : représentant habilité, bénéficiaires effectifs demandés par leur onboarding, compte bancaire de règlement, adresse professionnelle propriétaire des accès, droits des collaborateurs et justificatifs demandés. Les pièces et secrets sont transmis par les parcours sécurisés des fournisseurs, jamais enregistrés dans ce dossier.

Faire confirmer le traitement de chaque famille : abonnement PMS, crédits IA, vente de matériel, prestations/upsells propres et commissions d'affiliation. Une taxe configurée pour le PMS ne valide pas les autres ventes. Aucune exonération, registration ou date d'effet ne doit être déduite de l'absence de données.

## PSP à qualifier en priorité

### Arabie saoudite avec Tap Payments

**Candidat recommandé pour la qualification**, pas PSP sélectionné. Tap documente l'onboarding de vendeurs, les comptes de marketplace et le partage des encaissements. L'accès marketplace dépend d'une validation commerciale ; les clés d'onboarding et de paiement sont distinctes. [Documentation marketplace](https://developers.tap.company/docs/marketplace-getting-started).

Le partage différé est documenté : il faut confirmer les conditions contractuelles qui permettent de conserver puis distribuer les fonds du scénario Baitly. La responsabilité des remboursements/litiges et la reprise de fonds déjà répartis doivent être explicites. [Partage des paiements](https://developers.tap.company/docs/marketplace-split-payments).

La récurrence est documentée, mais nécessite l'activation de l'enregistrement des cartes et un accord de paiement. Cela ne prouve pas l'activation de cette capacité sur un futur compte Baitly ni sa combinaison avec le modèle marketplace. [Paiements récurrents](https://developers.tap.company/docs/recurring-payments).

Accès à demander : validation du cas d'usage saoudien, clés sandbox des deux périmètres, bénéficiaires de test autorisés, activation de la récurrence, événements signés et rapports de règlement. Utiliser les fixtures admises par Tap ; l'onboarding saoudien peut contrôler des données réelles même en test. [Onboarding des vendeurs](https://developers.tap.company/docs/onboarding-retailers).

### Maroc avec Chari Money

**Candidat recommandé pour la qualification**, pas PSP sélectionné. Chari présente une offre marketplace avec comptes vendeurs, KYC/KYB, commissions réparties et reversements. [Offre marketplace](https://www.baas.ma/en/marketplace-payment-morocco).

Sa FAQ limite l'onboarding aux entités enregistrées au Maroc. Le fournisseur indique que les partenariats et nouveaux cas d'usage sont soumis à des validations réglementaires ; la marque blanche peut impliquer un statut d'agent principal. Le rôle exact de Baitly doit donc être confirmé avant de retenir cette solution. [Conditions de partenariat](https://www.baas.ma/fr/faq).

La documentation publique propose une demande d'accès sandbox, des clés par environnement et des webhooks. La présence de cartes tokenisées ne suffit pas à confirmer des abonnements débités sans intervention du client. [Documentation et demande sandbox](https://www.baas.ma/fr/api-docs).

Accès à demander : acceptation de la société Baitly Maroc et du modèle de collecte pour tiers, modules marketplace et règlement bancaire, conditions d'abonnement, clés sandbox et jeu de bénéficiaires autorisés. Ne pas engager un adaptateur de production avant d'avoir les contrats API et les capacités activées.

### Questions communes avant sélection

| Capacité Baitly | Réponse ou preuve attendue du PSP |
| --- | --- |
| Abonnements PMS | Paiement initial authentifié, renouvellement, montant variable selon logements, changement de carte, résiliation, impayé et reprise |
| Collecte pour tiers | Vendeur contractuel, bénéficiaires admis, KYC/KYB, autorisation de collecter, commissions et répartition |
| Acompte et solde | Deux paiements rattachables au même dossier, sans double débit après reprise |
| Reversement | Allocation différée, disponibilité des fonds, délais/plafonds, transfert et arrivée bancaire distingués |
| Remboursement | Partiel et total, avant/après répartition, reprise d'un transfert, solde négatif et frais conservés |
| Litiges | Responsable, réserve, pièces, événements et conséquences sur les bénéficiaires |
| Robustesse API | Idempotence, lecture canonique, signatures, événements dupliqués/désordonnés, pagination et rapprochement |
| Commercial et règlementaire | Société contractante, autorisations applicables au montage, coûts, devises, pays, responsabilité et réversibilité |

La comparaison doit séparer les ventes propres de Baitly des fonds collectés pour un propriétaire ou prestataire. Une passerelle de paiement simple ne couvre pas nécessairement les deux.

## Accès fiscaux à préparer

**France : qualifier Iopole comme candidat pour éditeur.** Iopole apparaît dans la liste DGFiP des opérateurs satisfaisant aux conditions incluant les tests d'interopérabilité, consultée le 7 octobre 2026. Ce statut du fournisseur ne constitue pas l'activation du dossier Baitly. Demander l'accès développeur/sandbox, les conditions multi-émetteurs, les mandats, les formats de facture/avoir, l'e-reporting et les retours de statut. [Liste officielle DGFiP](https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees), [API Iopole](https://api.iopole.com/v1/api/).

**Arabie saoudite : qualifier d'abord le parcours développeur ZATCA.** Le sandbox et les outils développeur permettent de préparer une intégration ; les certificats de test ne sont pas les certificats de production. Le choix entre intégration directe et prestataire dépend ensuite du périmètre de la société, de l'exploitation et de l'assistance attendue. L'annuaire ZATCA des solutions est indicatif et non obligatoire. [Portail ZATCA](https://www.zatca.gov.sa/en/E-Invoicing/Pages/default.aspx), [sandbox](https://sandbox.zatca.gov.sa/), [annuaire officiel](https://zatca.gov.sa/en/e-invoicing/solutionproviders/pages/solutionprovidersdirectory.aspx).

**Maroc : obtenir le périmètre fiscal et le canal officiel avant le connecteur.** Aucune spécification publique d'API DGI utilisable pour ce raccordement n'a été vérifiée pendant cette recherche. Cela ne prouve pas l'absence d'obligation ni de dispositif. Obtenir de la société et de son conseil local les exigences applicables, puis les documents techniques du canal retenu. Le connecteur absent reste « à compléter » ; aucun endpoint ou accusé d'acceptation n'est inventé.

## Affiliation en cours de discussion

| Partenaire | Parcours documenté | À obtenir dans la négociation |
| --- | --- | --- |
| Viator | Le parcours Affiliate Basic prévoit une clé depuis les outils du compte partenaire et une redirection vers Viator pour conclure la vente | Niveau d'accès accordé, attribution par référence Baitly, catalogue, relevés, corrections/annulations et preuve du versement |
| GetYourGuide | Basic : 100 000 visites mensuelles ou 50 000 téléchargements ; Reading : 1 million de visites mensuelles et 300 réservations mensuelles pour les partenaires déjà Basic ; Masterbill : accord spécifique | Niveau accessible à Baitly, éventuelles conditions négociées, référence d'attribution, relevés et paiement des commissions |
| Klook | Le programme propose notamment datafeed/API et marque blanche | Produits accessibles, droits de contenu, tracking, commissions, corrections, exports/API de relevés et conditions de paiement |

Sources : [Viator Affiliate Basic](https://partnerresources.viator.com/travel-commerce/affiliate/basic-access/golden-path/), [niveaux GetYourGuide](https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements), [programme Klook](https://affiliate.klook.com/home).

Pour GetYourGuide, Basic et Reading ne permettent pas de créer des réservations ; Masterbill change le rôle de Baitly en marchand et requiert un contrat spécifique. Conserver le parcours d'affiliation tant que ce changement commercial n'est pas décidé. Une clé catalogue ne vaut jamais accès aux rapports financiers.

En attendant les droits API, le circuit de justificatifs/imports prévu dans Baitly reste distinct d'une réception de commission : il faut prouver le versement avant de distribuer des fonds. Ne pas enregistrer le prix total de l'activité comme revenu de Baitly.

## Brief prêt pour les demandes partenaires

À utiliser dans les échanges existants, sans créer de demande en doublon :

> Baitly est un PMS pour propriétaires et gestionnaires de locations courte durée, avec trois sociétés d'exploitation prévues en France, au Maroc et en Arabie saoudite. Nous développons la logique métier et les parcours en interne. Nous recherchons une API pour les seules opérations nécessitant votre habilitation ou votre accès au réseau concerné. Les flux incluent les abonnements au logiciel, les achats propres à la plateforme et les fonds destinés à des propriétaires/prestataires. Les identifiants des sociétés sont en cours de constitution. Merci de confirmer l'éligibilité de ce montage, le périmètre externalisable minimal, les capacités activables, le parcours sandbox, les documents exigés et les conditions commerciales avant intégration.

Pour les PSP, joindre la matrice de capacités ci-dessus. Pour les partenaires fiscaux, demander le traitement multi-émetteurs et les mandats. Pour Viator/Klook/GetYourGuide, préciser le parcours affilié envisagé et demander séparément le catalogue, l'attribution et les relevés de commissions.

## Ordre de raccordement

Premier lot technique commencé : [connecteur Iopole France](iopole-connector.md), désactivé et testé par simulation HTTP/PostgreSQL. Il ne vaut pas sélection contractuelle. Baitly prépare, contrôle et archive désormais le CII en interne pour les factures FR B2B en EUR avec TVA positive ; les autres cas documentaires restent à compléter. Les accès, le mandat, les identités réelles et les fixtures admises restent nécessaires avant une recette partenaire. Les autres partenaires ne sont pas déclarés raccordés.

1. Recevoir les identités des sociétés et désigner l'adresse professionnelle propriétaire des comptes.
2. Qualifier Tap/Chari et les partenaires fiscaux, puis confirmer les choix et les périmètres contractuels.
3. Obtenir des accès sandbox séparés, leurs permissions et leurs fixtures officielles ; stocker les secrets hors dépôt.
4. Implémenter les adaptateurs contre les contrats API effectivement accordés. Ajouter les tests backend/frontend et les scénarios de reprise, remboursement et rapprochement.
5. Exécuter la recette finale partagée, avec preuve par scénario. Les scénarios sans accès restent explicitement non exécutés.
6. Activer les environnements réels uniquement avec les sociétés, registrations, mandats et validations exigés. Un sandbox réussi ne les remplace pas.

## Comparaison Iopole / Pennylane

**Aucun choix définitif n'est effectué.** La clarification du 7 octobre 2026 fixe le périmètre de comparaison : obtenir le service réglementaire nécessaire en conservant le développement métier dans Baitly. Une couverture fonctionnelle plus large n'est pas, à elle seule, un avantage pour ce besoin.

- Iopole présente une offre destinée aux éditeurs, pilotable par API et intégrable en marque blanche/grise. Cela motive une exploration technique pour conserver le parcours Baitly. [Offre Iopole](https://go.iopole.com/fr-fr/pappers-iopole-r%C3%A9forme-facturation-electronique).
- Pennylane documente les factures clients/fournisseurs, écritures, analytique et rapports comptables dans sa Company API, ainsi que des API cabinets/groupes distinctes. La documentation indique un accès standard Company API à partir de l'offre Essentiel ; les conditions d'un partenariat éditeur doivent être confirmées séparément. [Périmètres API](https://pennylane.readme.io/docs/what-apis-are-available).
- Pennylane permet aussi de consulter l'activation PA par société/établissement et propose un programme de partenariat technologique. Il ne faut donc pas écarter Pennylane au motif qu'il s'agirait uniquement d'un logiciel comptable. [Activation PA](https://pennylane.readme.io/reference/getparegistrations), [partenariat](https://www.pennylane.com/fr/partenaires/partenaire-technologique).

Avant décision, comparer le service de transmission réglementaire pour la société Baitly France et pour les organisations/propriétaires clients. Vérifier les droits d'intégration, parcours/mandats par société, fonctions accessibles par API, éventuels abonnements imposés, tarification partenaire et réversibilité. La comptabilité logicielle et les rapprochements restent des développements internes prioritaires. Ne pas extrapoler la couverture française au Maroc et à l'Arabie saoudite. Aucun de ces accès ne remplace automatiquement le circuit PSP de collecte et reversement pour tiers.

La recommandation antérieure de privilégier Pennylane pour externaliser aussi la comptabilité est remplacée par cette règle. Iopole et Pennylane restent des candidats pour le seul périmètre nécessaire ; aucun n'est sélectionné. Le choix doit permettre de garder l'interface, le modèle métier et les données de Baitly indépendants du partenaire.
