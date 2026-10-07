# Baitly : remboursement après annulation voyageur

État au 6 octobre 2026 : les remboursements intégral et partiel sont validés sur le sandbox Baitly. Le correctif du retour public après Checkout est désormais chargé et validé dans le navigateur.

## Comportement livré

- Annulation du calendrier et décision financière enregistrées ensemble, sous verrou de réservation.
- Politique et montant figés ; répéter l'annulation retrouve le même dossier.
- Un worker reprend le dossier après commit. La clé Stripe reste identique après erreur réseau. Sans preuve au-delà de 23 heures, rapprochement sans réémission automatique.
- Les notifications signées déclenchent une relecture canonique. Montant, devise, session, organisation et référence Baitly doivent correspondre.
- Le statut REFUNDED ou PARTIALLY_REFUNDED et les contre-écritures sont validés ensemble après succès PSP. Attente et échec ne suffisent pas.
- Journal historique conservé, répartitions contre-passées au prorata avec arrondi cumulatif.
- Suivi public sans réannulation ; les KPI utilisent le remboursement partiel confirmé sans créer une dette.
- Garde-fou commun contre deux décisions concurrentes entre remboursement gestionnaire et annulation voyageur.

## Recette réalisée

Plateforme vérifiée par API : `acct_1U6AEiQxlvbxDIrY`, « environnement de test Baitly », `livemode=false`. Voyageurs et moyens de paiement fictifs.

| Contrôle | Intégral | Partiel |
| --- | --- | --- |
| Réservation | 547 / RES-TT3MA8 | 548 / RES-M9RQHV |
| Logement | Appartement Gambetta | Baitly Sandbox Reversement |
| Séjour | 23 au 25 novembre 2026 | 26 au 28 novembre 2026 |
| Création | Formulaire public, navigateur | API publique Baitly, fixture locale dédiée |
| Règlement | Checkout Stripe, navigateur | Checkout Stripe, navigateur |
| Encaissement confirmé | 220 EUR, transaction 42 | 200 EUR, transaction 44 |
| Politique | FLEXIBLE, 100 % | STRICT, 50 % |
| Annulation | Page publique, navigateur | Page publique, navigateur |
| Remboursement | 220 EUR, transaction 43 | 100 EUR, transaction 45 |
| Preuve Stripe | re_3UNLAeQxlvbxDIrY0IQxO6Je, succeeded | re_3UNLOuQxlvbxDIrY0pBtsCOG, succeeded |
| État Baitly | cancelled / REFUNDED | cancelled / PARTIALLY_REFUNDED |
| Journal de remboursement | 3 débits et 3 crédits équilibrés | 3 débits et 3 crédits équilibrés |
| Calendrier | aucune date encore affectée | aucune date encore affectée |

Les totaux des contre-écritures couvrent l'encaissement et ses répartitions internes : 438,02 EUR de chaque côté pour l'intégral, 199 EUR pour le partiel. Les remboursements rendus à la carte sont bien 220 et 100 EUR.

Le suivi public affiche « Remboursement confirmé » avec le montant exact. Répéter chaque annulation renvoie `already_cancelled` et le même remboursement sans nouvelle écriture. Le rejeu signé de l'événement Checkout intégral, avant puis après remboursement, reçoit HTTP 200 sans doublon ni rétablissement du statut payé.

La politique STRICT temporaire du logement fictif a été retirée et sa visibilité initiale restaurée. Les dossiers financiers sont conservés pour audit. Aucun statut financier n'a été forcé en SQL.

## Corrections chargées et vérifiées

Le contrôleur public appelait une surcharge de reserve / reserveBatch héritant du readOnly de la classe. Les vrais points d'entrée sont maintenant transactionnels en écriture. Les deux variantes de Checkout suspendent la transaction appelante avant le PSP. Les tests passent par un proxy Spring et un gestionnaire JDBC. Le formulaire affiche ses erreurs dans l'étape voyageur, conserve les champs et empêche une seconde soumission pendant l'attente.

JAR actif : `08618c3a6e96c414c9ad0a4fcaa15473c85795e12346072ab1b2aba432f7b589`. Les 12 classes pertinentes correspondent au livrable testé. Il provient de l'image reconstruite par l'utilisateur, sans montage de l'ancien server/target. Les deux nouvelles réservations ont été créées sans erreur de transaction en lecture seule.

La reconstruction par le Compose de base avait repris l'ancienne configuration Stripe. Le lanceur précédemment autorisé a rétabli le sandbox Baitly sans changement d'image ; identité canonique et santé locale vérifiées.

`stripe listen --latest` a dérivé vers 2026-09-30.endive, incompatible avec les handlers typés du SDK Java 33.4.0 (Dahlia). Les premiers événements du paiement intégral ont reçu HTTP 503. Le relais utilise maintenant le défaut du compte, 2026-07-29.dahlia. L'événement canonique original a été rejoué sans modifier son contenu pour terminer la transaction 42. Le scénario partiel confirme ensuite automatiquement paiement et remboursement via le relais avec HTTP 200. Aucune version globale du compte ou de la production n'a été changée.

Voir scripts/payments/README.md pour les commandes à jour. Le lanceur suivant recharge uniquement la configuration du serveur, pas du nouveau code :

```sh
rtk proxy python3 scripts/payments/stripe_sandbox_local.py --reload-server
```

Sans cette option, il reste en lecture seule. Ne pas utiliser l'ancienne surcharge docker-compose.stripe-local.yml qui monte un JAR obsolète de server/target.

## Retour public après Checkout : correctif et tests

Sans retour externe, Checkout utilisait la page PMS des interventions. Les nouvelles sessions utilisent `/booking/:apiKey/confirmation`, sur l'origine configurée par le serveur, pour le succès et l'interruption. Les retours externes restent soumis au contrôle HTTPS et aux domaines autorisés.

La page publique relit la réservation. `flow=return` ne valide jamais un paiement ; `flow=cancel` n'annule jamais le séjour. Les états en attente, acompte, confirmé et annulé restent distincts. Suivi automatique borné puis vérification manuelle. Aucune coordonnée personnelle n'est affichée. Français, anglais et arabe.

Validation : **236 tests serveur et 21 tests interface, aucun échec**. TypeScript et build Vite réussis. Affichage réel contrôlé à 375, 768, 1024 et 1440 pixels sans débordement horizontal. Le test visuel utilise le dossier annulé 548 ; les redirections d'une nouvelle session sont validées ci-dessous avec le dossier 549.

JAR isolé : `/private/tmp/baitly-booking-return-runtime.jar`.
SHA-256 : `b5435f263f99739727537924007cc3afc9d16506929d58652d7746b61dc067ee`.

L'ancien JAR reste sauvegardé dans /private/tmp/baitly-before-booking-return-_ldr7fws/server.jar. Le lanceur temporaire baitly-install-booking-return.py était lié à son empreinte : il n'est plus nécessaire ni adapté au JAR reconstruit ensuite. Les sessions créées avant le correctif gardent leurs anciennes URL.


## Retour public validé après rechargement utilisateur

Le 6 octobre, le JAR reconstruit par l'utilisateur (`fc79302607b42774459a7322e9e32ff04e3ddbf5750c559996d05f3a7a469a7b`) contient les six classes PublicBookingService identiques au correctif testé. La commande d'installation s'est arrêtée avant mutation sur la différence de configuration Stripe. Après vérification du code, seul le lanceur de configuration sandbox autorisé a été exécuté ; aucun remplacement du JAR n'était nécessaire.

La réservation fictive **549 / RES-JGZHHF**, créée par l'API publique locale, a produit une nouvelle session de test dont les URL canoniques Stripe pointent vers la page publique Baitly :

- interruption : `/booking/:apiKey/confirmation?reservation=RES-JGZHHF&flow=cancel` ;
- succès : même page avec `flow=return`.

Les deux redirections ont été exercées dans le navigateur : d'abord « Paiement non terminé », sans annulation du séjour, puis « Votre séjour est confirmé » après le règlement fictif de **220 EUR** dans la même session. Transaction **46 / TX-d9e0da37-99b**, COMPLETED ; réservation confirmed / PAID. Aucun accès au PMS ni connexion administrateur n'est demandé au voyageur.

Session de preuve : `cs_test_a1sj6XEri5t0NcsiHWyIHs3JZYUgH2Izld2a7kW8exiKemmialgnLIRZwD`. Le scénario est clôturé par l'annulation publique et un remboursement de 220 EUR : transaction 47 COMPLETED, Stripe `re_3UNLsFQxlvbxDIrY12YKmkij` succeeded. Réservation cancelled / REFUNDED, six contre-écritures équilibrées et aucune date encore affectée au séjour. L'historique est conservé.

## Périmètre restant

Le parcours automatique validé exige un encaissement plateforme Stripe EUR unique sous RESERVATION, correspondant au montant monétaire du séjour et à un journal équilibré. Une réservation déjà affectée à un reversement propriétaire n'est pas remboursée automatiquement ici.

Restent à rapprocher ou à étendre : paiements OTA, autres PSP/devises, historiques sans preuve, acomptes et soldes sur plusieurs sessions, journal incompatible avec crédits fidélité, remboursements externes ou gestes commerciaux antérieurs, reversements engagés, encaissement reçu après annulation impayée. Un échec tardif reste visible sans supprimer l'historique.

L'annulation des transferts Connect déjà versés et les contre-passations après échec tardif ne sont pas certifiées par cette recette. Les avoirs des factures de réservation sont raccordés dans la [tranche documentaire suivante](booking-credit-notes-validation.md), qui conserve les tests de régression des avoirs d'intervention.
