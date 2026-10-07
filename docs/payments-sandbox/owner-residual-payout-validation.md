# Solde propriétaire après remboursement de séjour

Recette locale Baitly du 6 octobre 2026, exclusivement sur le sandbox Stripe dédié. Cette validation couvre le transfert au compte Connect ; elle ne confirme aucun crédit bancaire réel et ne clôture pas les autres points du circuit.

## Parcours vérifié depuis Baitly

Le séjour fictif **551**, référence **DIR-WY5N4R**, concerne le logement **Baitly Sandbox Reversement** (84), le propriétaire 2 et la période du 28 au 30 septembre 2026. Le client est identifié « TEST SANDBOX Solde propriétaire » ; son adresse utilise le domaine réservé `example.invalid`.

1. Création de la réservation depuis le PMS, puis création du lien depuis Finance.
2. Paiement de **100 EUR** dans le Checkout du sandbox Baitly.
3. Annulation depuis le parcours public, avec remboursement confirmé de **50 EUR**.
4. Facture de séjour **FA2026-00028**, 100 EUR, et avoir lié **FA2026-00029**, −50 EUR.
5. Calcul dans Finance du reversement **15**, sur la période terminée : **50 EUR** conservés, commission 0, dépenses 0, net 50 EUR.
6. Approbation du dossier, sans transfert implicite.
7. Première émission refusée avant tout transfert : solde Stripe disponible insuffisant. Le dossier conserve le motif et propose une relance.
8. Préparation séparée de fonds fictifs disponibles dans Stripe, puis relance du **même dossier** depuis Finance.
9. Baitly affiche **« Transféré au PSP »**, 50 EUR, et le suivi distingue explicitement l'absence de confirmation bancaire.

Le contrat du logement est en brouillon : aucune commission n'a été artificiellement activée. Le scénario avec commission HT, TVA et facture est vérifié automatiquement, pas par cette recette UI.

## Preuves concordantes

| Élément | Référence | Résultat |
| --- | --- | --- |
| Encaissement | Transaction 57, `pi_3UNVS0QxlvbxDIrY0bHpusbU` | COMPLETED, 100 EUR |
| Remboursement | Transaction 58, `re_3UNVS0QxlvbxDIrY02FDfl9e` | COMPLETED / Stripe succeeded, 50 EUR |
| Facture / avoir | Documents 31 / 32 | PAID 100 EUR / CREDIT_NOTE −50 EUR ; lien au paiement remboursé conservé |
| Reversement | Dossier 15 | PAID, net 50 EUR, une relance |
| Journal de transfert | Ligne 3, source OWNER_PAYOUT / 15 | TRANSFERRED, 50 EUR, `stripe_livemode=false` |
| Preuve Stripe | `tr_1UNWwvQxlvbxDIrYeJAYogUn` | 5 000 centimes EUR, non inversé, destination `acct_1UN38qQraKTYknLt` |

La lecture finale retrouve une seule transaction d'encaissement, une seule de remboursement, une facture, un avoir et une ligne de transfert pour cette recette. L'ancien reversement 14 de 100 EUR reste en échec : aucune relance de cet historique n'a été effectuée.

Le solde sandbox était à −87,93 EUR disponibles, avec des encaissements encore en attente. Une charge technique distincte de **200 EUR fictifs**, `pi_3UNWucQxlvbxDIrY0D9bA07t`, a utilisé `pm_card_bypassPendingInternational`. Elle ne finance aucune réservation dans les données métier Baitly. Le solde disponible est passé à 108,82 EUR avant la relance. Cette préparation suit les [moyens officiels de test Stripe](https://docs.stripe.com/testing). Elle ne constitue pas une recette d'encaissement PMS et ne modifie aucune preuve financière locale.

La politique d'annulation temporaire MODERATE, limitée à ce logement fictif, a été retirée après confirmation du remboursement. Aucun statut financier, facture, avoir ou transfert n'a été fabriqué par SQL.

## Contrat financier corrigé

- Seul un remboursement partiel canonique, confirmé et lié à l'encaissement d'origine autorise le calcul sur le solde. Les preuves ambiguës, les acomptes, crédits et remboursements multiples non alloués restent exclus.
- La date de sortie prévue doit être atteinte : une annulation n'accélère pas le reversement.
- La commission est calculée sur le montant conservé. Sa facture et sa TVA déterminent la retenue TTC ; le prix initial du séjour n'est pas réécrit.
- L'avoir de remboursement et la facture initiale doivent correspondre aux preuves utilisées.
- Le dossier, les financements, le bénéficiaire et les documents sont relus sous verrou avant émission.
- Une facture de commission retenue n'est soldée qu'après preuve du transfert. Une notification tardive de remboursement déjà confirmé ne réémet pas de restitution.

## Vérification automatisée et chargement

La suite financière a exécuté **781 tests serveur**, répartis en 93 suites JUnit, sans échec, erreur ni test ignoré, sur PostgreSQL isolé. Le scénario documentaire réel y vérifie notamment : 100 EUR encaissés − 40 EUR remboursés = 60 EUR ; commission 12 EUR HT + 2,40 EUR de TVA ; net propriétaire **45,60 EUR**. Les contrôles d'ownership, de devise, de montant, d'unicité et de concurrence sont inclus.

La première création de réservation de recette a révélé une autre erreur : l'automatisation ouvrait une transaction indépendante avant que la réservation soit validée en base, provoquant une violation de clé étrangère. Son lancement se fait désormais après commit, avec relecture de la réservation dans une nouvelle transaction. Une annulation de transaction ne déclenche aucune automatisation ; une erreur d'automatisation ne fait plus disparaître un séjour déjà enregistré. **165 tests ciblés** passent, dont cinq tests de frontières transactionnelles. Ces chiffres correspondent à des exécutions différentes et ne sont pas additionnés.

Ce correctif a été chargé puis vérifié par la création effective du séjour 551. JAR de cette recette : `1cbfe3225196fc67b9f67898fce667812774d0fcd1b799eeb1ec9cfddc8ef03a`. Sauvegarde précédente : `/private/tmp/baitly-before-booking-automation-vpk5edad/server.jar`. Aucun nouveau changeset Liquibase.

## Points distincts restant ouverts

Commission non nulle à exercer dans l'interface avec un contrat réellement actif, versement bancaire et incident bancaire, remboursements partiels par part de lot, paiements PSP des dépenses/réassorts, réception externe OTA, bénéficiaire société et rapprochement des historiques ambigus. Le suivi général reste la référence : [audit du circuit](../../scripts/payments/AUDIT-CIRCUIT-2026-10-05.md).
