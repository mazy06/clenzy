# Baitly : connecteur fiscal Iopole, premier lot

État au 7 octobre 2026 : adaptateur technique implémenté et testé localement, **désactivé par défaut**. Aucun compte, mandat, accès sandbox ou choix contractuel Iopole n'est réputé acquis. Aucun document n'a été envoyé au partenaire pendant ce développement.

Le choix est ouvert. La règle produit est de développer les fonctions métier en interne et de limiter le partenaire au service réglementaire nécessaire. Le périmètre comptable plus large de Pennylane n'est donc pas un critère de préférence à lui seul. Ne pas transformer cet adaptateur exploratoire en choix produit par défaut. La comparaison est consignée dans le [dossier partenaires](partner-onboarding-dossier.md#comparaison-iopole--pennylane).

## Périmètre livré

Le connecteur raccorde `FrancePdpProvider` à l'API Iopole et à la file durable `einvoice_submissions` pour les factures locales `Invoice` émises. Il contrôle l'organisation, le pays FR, l'identité fiscale de l'émetteur configuré et l'environnement. Le mapping actuel accepte un émetteur Iopole par organisation ; il ne permet pas d'émettre indistinctement pour tous ses propriétaires.

- OAuth `client_credentials`, jeton conservé uniquement en mémoire, hôtes fixes selon l'environnement, délais réseau et redirections interdites.
- Dépôt multipart du CII archivé ; un HTTP 201 conserve la référence partenaire et laisse la transmission **en attente**.
- Relecture canonique des métadonnées et consommation du flux PULL Iopole : numéro, date, type, vendeur, acheteur, montants et devise doivent correspondre au document local.
- Confirmation uniquement après un statut de réception reconnu ; rejet et résultat incertain restent distincts. L'historique peut arriver désordonné ; deux derniers statuts contradictoires ne confirment rien.
- Reprise après redémarrage sans nouveau dépôt : lecture des nouveaux statuts, sauvegarde atomique du lot puis acquittement auprès d'Iopole. Les traitements concurrents réservent leur passage en base ; les appels réseau restent hors transaction.
- Les statuts sont conservés dans `baitly_iopole_statuses`, même s'ils concernent un autre document du client. Une réponse perdue pendant l'acquittement peut être rejouée sans dupliquer la preuve. Un lot plein exige une lecture supplémentaire : aucun succès n'est conclu sur un historique potentiellement tronqué.
- Référence conservée après indisponibilité ; changement de compte, d'environnement, de document ou de référence bloqué pour rapprochement.
- Dans le suivi fiscal, « Référence partenaire » distingue l'accusé du dépôt de « Transmission confirmée ». Cette confirmation ne prouve ni le paiement ni une déclaration de toutes les obligations fiscales.

Le contrôle local du CII vérifie sa cohérence avec la facture, ses lignes et les données d'adressage présentes. La préparation interne ajoutée le 7 octobre exécute aussi les XSD CII D16B, le Schematron EN 16931 v1.3.16 et les règles françaises FNFE v1.4.0.04. Les référentiels, licences et empreintes sont embarqués ; les entités XML et ressources réseau externes sont interdites. Ce contrôle technique ne certifie ni l'identité des parties ni l'acceptation par une PA. Les tests utilisent des documents synthétiques exclusivement locaux, pas des factures admises par le sandbox partenaire.

Dans **Finance > Factures > détail > Document fiscal électronique**, le gestionnaire renseigne les compléments de routage, la nature commerciale et classe les mentions présentes dans la facture. Aucune nouvelle clause ne peut remplacer une clause émise : le serveur exige une reprise exacte du texte existant. Le XML reprend montants, dates, numéro, lignes et identités de la facture source. Le contrôle est séparé de l'archivage explicite ; l'archivage n'envoie pas lui-même de document, mais rend l'archive disponible à la file de transmission si son partenaire est activé.

La migration `0541-invoice-fiscal-documents` crée `baitly_invoice_fiscal_documents`, distincte de `Invoice.xmlContent`. Elle interdit modification et suppression. Empreintes du document et de sa source, version des référentiels, auteur et date sont conservés. Les écritures concurrentes se verrouillent sur la facture ; une répétition identique est idempotente, un autre contenu est refusé. Un document déjà transmis ne peut recevoir une autre archive. Une annulation conserve l'archive consultable mais bloque son nouvel envoi.

## Configuration, sans activation implicite

Préparer un fichier de configuration privé Spring, hors dépôt, ou le gestionnaire de secrets de l'environnement. La configuration minimale inactive est :

```yaml
baitly:
  einvoice:
    iopole:
      enabled: false
      environment: SANDBOX
      customers: {}
```

Champs à renseigner uniquement à partir des accès accordés :

| Propriété | Source attendue |
| --- | --- |
| `client-id`, `client-secret` | Identifiants opérateur fournis par Iopole pour l'environnement choisi |
| `customers.<organizationId>.customer-id` | UUID client Iopole du mandat de cette société |
| `customers.<organizationId>.seller-tax-id` | Identifiant fiscal exact du vendeur archivé sur ses factures |
| `customers.<organizationId>.pull-mode-confirmed` | `true` uniquement si le client Iopole est effectivement configuré en mode PULL |
| `environment` | `SANDBOX` ou `LIVE`, avec des accès distincts |
| `enabled` | Activation explicite après les prérequis et la recette |

Une clé seule ne rend pas le connecteur configuré : un client, son identité d'émetteur et la confirmation du mode PULL sont nécessaires. Leur présence ne constitue pas une validation du mandat par Iopole. Le mode PUSH/webhooks n'est pas implémenté par ce lot. Le routage fiscal pays existant doit désigner `FACTURX_PDP` ; aucune modification automatique des pays ou des sociétés n'est réalisée par ce lot.

Ne pas afficher les secrets dans les logs, les commandes partagées ou les captures. Un changement d'environnement n'autorise pas la reprise d'une référence de l'autre environnement. La migration Liquibase `0540-iopole-status-inbox` crée la boîte de réception et interdit la modification/suppression de ses preuves ; elle doit être appliquée avant activation.

## Prérequis et développements encore nécessaires

1. **Accès et données réelles** : choisir le partenaire, obtenir les accès, mandats, sociétés émettrices, identifiants de routage, adresses structurées et fixtures officiellement admises. Ces éléments ne sont pas encore disponibles dans le dossier Baitly.
2. **Extension de la préparation interne** : le nouveau parcours couvre les factures commerciales FR B2B en EUR, avec TVA positive, unités comptées C62 et échéance explicite. Avoirs, duplicatas, acomptes, remises, taux zéro/exonérations, taxe de séjour et international restent hors périmètre. Le générateur historique partiel et `Invoice.xmlContent` ne servent plus de repli de transmission. Une facture historique aux identités ou mentions manquantes exige une rectification métier ; aucune modification SQL d'une facture émise.
3. **Couverture documentaire** : les copies `BaitlySaleDocument` des ventes PMS, IA et matériel ne sont pas automatiquement converties en factures locales à transmettre. Leur raccordement doit préserver l'émetteur, le numéro et l'absence de double émission.
4. **Avoirs et cas fiscaux** : les nouveaux dépôts d'avoirs sont bloqués tant que le lien avec la facture locale d'origine n'est pas vérifié. La présence d'une référence libre dans le XML ne suffit pas. Compléter ce lien puis tester règles de signe, exonérations, opérations internationales et données structurées avant d'ouvrir cette couverture.
5. **Dépôt dont la réponse est perdue** : sans référence retournée, la file ne renvoie jamais la facture automatiquement. Un parcours sécurisé de recherche/rattachement canonique reste à implémenter avec les capacités accordées par Iopole. Aucun endpoint d'idempotence non documenté n'est supposé.
6. **Cycle fiscal étendu** : suivi des changements postérieurs à la première réception, statuts de paiement à déclarer, e-reporting et autres obligations ne sont pas couverts par cette première confirmation de transmission.

Les connecteurs PSP MA/SA, ZATCA/DGI et les API d'affiliation restent des lots séparés, dépendants de leurs choix et contrats. Iopole n'est pas un PSP et ne remplace pas Stripe.

## Tests isolés effectués

- 103 tests serveur ciblés, sans échec ni test ignoré : client HTTP, configuration Spring inactive/active, cohérence XML, routage, droits, lots PULL et persistance PostgreSQL avec concurrence, rollback et reprises. La migration 0540 est appliquée puis rejouée par Liquibase dans le schéma de test. Rapport : `/private/tmp/baitly-iopole-pull-tests-20261007`.
- 7 tests d'intégration frontend, dont les états dépôt en attente, rejet et transmission confirmée ; contrôle TypeScript Finance réussi. Rapport : `/private/tmp/baitly-iopole-frontend-verified-20261007.xml`.
- 5 tests Python du manifeste/lanceur. Les nouvelles suites sont inscrites dans `financial_recipe.json`.

Ces résultats incluent les tests de régression voisins ; ils ne sont pas 103 nouveaux tests. Les appels Iopole sont simulés. Aucun JAR n'a été rechargé et aucune recette du sandbox partagé n'a été exécutée.

Dernière passe après ajout de la préparation interne : **145 tests serveur dans 24 suites**, dont 39 tests PostgreSQL et l'application/rejeu de la migration 0541, **11 tests d'intégration frontend HTTP**, contrôle TypeScript Finance, compilation Vite et **5 tests Python** réussis, zéro échec/erreur/test ignoré. Les contrôles couvrent EN 16931 et FNFE, les empreintes des référentiels embarqués, l'immutabilité, la concurrence, les droits, le changement d'organisation et la conservation de l'archive après annulation. Rapports : `/private/tmp/baitly-cii-final-tests-20261007` et `/private/tmp/baitly-cii-frontend-20261007.xml`. Ces résultats recouvrent les régressions du lot précédent et ne s'additionnent pas aux 103 tests. La compilation Vite conserve des avertissements de découpage des bundles.

## Recette partenaire différée

Les scénarios restent à exécuter à la fin de l'implémentation, après les prérequis ci-dessus. Ils sont ajoutés à [la recette commerciale](commerce-final-recipe.md#raccordement-iopole-france).

Référentiels de la préparation interne : [EN 16931 v1.3.16](https://github.com/ConnectingEurope/eInvoicing-EN16931/releases/tag/validation-1.3.16), [FNFE RFE v1.4.0.04](https://github.com/fnfempe/France_RFE/releases/tag/v1.4.0.04). La sortie est un **XML CII**, pas un PDF hybride Factur-X/PDF-A3. Les jeux embarqués sont exécutés par Saxon-HE 12.10, sans service distant de validation. Les futures évolutions des normes exigent une mise à jour versionnée et une nouvelle validation ; les archives ne sont pas réécrites.

## Contrat public consulté

- [API Iopole et authentification](https://api.iopole.com/v1/api/).
- [OpenAPI des factures en production](https://api.iopole.com/v1/api/operator/invoicing).
- [OpenAPI des factures en préproduction](https://api.ppd.iopole.fr/v1/api/operator/invoicing).

Le connecteur utilise `POST /v1/invoice`, `GET /v1/invoice/{id}`, `GET /v1/invoice/status/notSeen` et `PUT /v1/invoice/status/{statusId}/markAsSeen`. L'historique distant `status-history`, réservé à la consultation ponctuelle et soumis à un faible quota, n'est jamais utilisé pour le polling. La réponse de création indique un dépôt pour traitement, pas sa réception par le destinataire. Revalider le contrat et les droits effectivement accordés au moment de la recette.
