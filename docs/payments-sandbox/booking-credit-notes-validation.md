# Baitly : avoirs après remboursement de séjour

État au 6 octobre 2026 : implémentation, tests automatisés et recette locale terminés. Le JAR testé est chargé dans `clenzy-server-dev` avec la configuration sandbox Baitly conservée.

## Comportement

Le worker documentaire retrouve les remboursements BOOKING_CANCELLATION confirmés, en plus des remboursements intégraux d'intervention. Il crée un avoir sur la facture GUEST du séjour, avec un lien durable vers la facture et la transaction de remboursement. Une facture de commission n'est pas créditée par ce parcours.

La réservation, le remboursement puis la facture sont verrouillés dans cet ordre. L'organisation, la devise, le montant, la session Stripe, l'encaissement d'origine et le statut financier du séjour doivent correspondre. Un dossier en attente, en échec ou signalé à rapprocher ne crée pas d'avoir.

L'intégral inverse exactement les lignes d'origine. Le partiel répartit le montant confirmé au prorata des TTC historiques, avec arrondi cumulatif au centime ; la TVA de chaque part est issue de sa ligne d'origine. Les taux et catégories historiques sont conservés, sans consulter le profil fiscal courant. Une ligne partielle utilise une quantité de -1 et le HT de sa part, ce qui conserve l'égalité quantité × prix unitaire = HT. Les parts nulles sont omises.

La facture d'origine reste payée et inchangée. Un rejeu retrouve le même avoir. Une erreur documentaire annule l'insertion et la consommation du numéro, puis peut être reprise. Une facture reçue après le remboursement devient candidate. Aucun appel Stripe ni mouvement de journal n'est effectué par ce traitement documentaire.

Une demande ou un remboursement en attente ne constituent pas une confirmation. [États et événements des remboursements Stripe](https://docs.stripe.com/refunds).

## Contrôles automatisés

**222 tests réussis, aucun échec, erreur ou test ignoré**, sur 32 suites JUnit produites par cette exécution, dont 57 cas de persistance des avoirs. Java 21, package Maven réussi. Aucun changement frontend.

- Repositories JPA réels : intégral, moitié, un centime, montant presque intégral, taxes multiples, rejeu, facture tardive, rollback du document et de son numéro, concurrence avec le verrou financier.
- Refus des dossiers incohérents : organisations, montants, session, collecteur OTA, crédits fidélité, plusieurs encaissements, mauvais statut, anciennes notes de crédit, double facture et lignes mixtes ambiguës.
- Régression des avoirs d'intervention, confirmations de facture, génération PDF, annulations publiques et remboursements gérés.
- PostgreSQL 15 jetable, indépendant du PMS : migration 0503 existante appliquée deux fois, contraintes et requête de reprise commune exercées. Les commissions seules, factures étrangères, remboursements en attente et dossiers non gérés ne deviennent pas candidats. Le schéma est supprimé et le serveur PostgreSQL de test arrêté à la fin.

Aucune migration supplémentaire. La comparaison avec le JAR précédemment installé ne trouve que deux entrées applicatives modifiées : RefundCreditNoteService et sa classe Candidate. Les ressources, migrations et autres classes sont identiques.

## Livrable installé et recette validée

- JAR : `/private/tmp/baitly-booking-credit-note-runtime.jar`
- SHA-256 : `65d79301d0490d15f67220aaff4c0836579accb1559a23b3a18c7f444b5eb7e8`
- Rapports : `/private/tmp/baitly-booking-credit-note-umb1814j/surefire-reports`
- Sauvegarde du précontrôle : `/private/tmp/baitly-before-booking-credit-note-i4pwlezj/server.jar`
- Sauvegarde lors de l'installation : `/private/tmp/baitly-before-booking-credit-note-soeazjex/server.jar`

Le précontrôle a vérifié le conteneur, l'empreinte du JAR actif et la concordance de la configuration sandbox sans afficher les secrets. L'utilisateur a ensuite autorisé :

```sh
rtk proxy python3 /private/tmp/baitly-install-booking-credit-note.py --apply
```

La commande autorisée a sauvegardé puis remplacé le JAR, et redémarré uniquement ce serveur. L'empreinte du JAR installé correspond au livrable testé ; l'identité du conteneur et sa configuration Stripe sont inchangées. Le contrôle `/actuator/health` est UP. Le frontend et les dépendances sont restés actifs. Une recréation ultérieure depuis une ancienne image ne conserve pas ce remplacement : reconstruire l'image depuis les sources pour le pérenniser.

Le worker a automatiquement créé les trois avoirs des séjours déjà remboursés. La lecture seule du PMS confirme les liens suivants :

| Séjour | Facture d'origine | Remboursement confirmé | Avoir créé | Montants EUR |
| --- | --- | --- | --- | --- |
| 547 / RES-TT3MA8 | FA2026-00013, 220 EUR | transaction 43, 220 EUR | FA2026-00016 | -195,45 HT ; -24,55 TVA ; -220 TTC |
| 548 / RES-M9RQHV | FA2026-00014, 200 EUR | transaction 45, 100 EUR | FA2026-00017 | -90,91 HT ; -9,09 TVA ; -100 TTC |
| 549 / RES-JGZHHF | FA2026-00015, 220 EUR | transaction 47, 220 EUR | FA2026-00018 | -195,45 HT ; -24,55 TVA ; -220 TTC |

Contrôles effectués dans Baitly et sur son serveur local :

- Finance affiche les trois avoirs avec leurs montants et leurs factures d'origine. Le détail de la facture FA2026-00014 expose l'avoir associé FA2026-00017 ; le détail de l'avoir expose sa facture d'origine.
- Les téléchargements de l'avoir partiel, de sa facture d'origine et de l'avoir intégral aboutissent. Les deux PDF d'avoir ont été rendus en images et inspectés : titre AVOIR, références, quantités négatives, taux historiques, HT, TVA et TTC cohérents, sans contenu coupé ni chevauchement.
- L'avoir partiel porte -90,91 EUR HT et -9,09 EUR de TVA, soit -100 EUR. L'intégral conserve deux lignes : hébergement à 10 % (-160 EUR TTC) et ménage à 20 % (-60 EUR TTC), soit -220 EUR.
- Après plusieurs passages du worker, chaque remboursement conserve exactement un avoir, sans erreur documentaire. Les trois factures d'origine restent PAID pour 220, 200 et 220 EUR.
- Les six transactions financières préexistantes (trois encaissements et trois remboursements) sont inchangées. Le journal conserve ses 18 écritures équilibrées : aucune transaction PSP ni contre-écriture supplémentaire n'a été créée par la génération documentaire.

Aucun état financier n'a été forcé par SQL et aucun paiement réel n'a été exécuté pour cette recette.

## Limites

Ce parcours couvre un encaissement plateforme Stripe EUR unique et une annulation gérée Baitly, avec facture correspondant intégralement à l'encaissement. Tout avoir déjà lié ou historique ambigu exige un rapprochement. Les acomptes/soldes répartis sur plusieurs sessions, crédits fidélité, autres devises/PSP, gestes commerciaux successifs, remboursements externes, compensations Connect et corrections après échec tardif restent à étendre. Le traitement fiscal des frais retenus à l'annulation demande une règle dédiée ; ce prorata ne couvre pas toutes les politiques commerciales.
