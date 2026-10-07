# Baitly : rapprochement d'un remboursement externe partiel

État au 6 octobre 2026 : **JAR chargé après autorisation et remboursement partiel rapproché dans le sandbox Baitly**. Aucun nouveau remboursement Stripe n'a été émis pendant cette tranche : la recette reprend la preuve de 5 EUR déjà existante.

## Comportement ajouté

Une intervention encaissée seule en EUR peut maintenant être rapprochée lorsqu'un unique remboursement externe Stripe confirmé représente une fraction de son paiement. La preuve canonique, les contrôles de source, d'organisation et de financement de la tranche précédente restent obligatoires. Les lots, financements ambigus, remboursements multiples et missions déjà reversées restent à rapprocher séparément.

Pour 35 EUR encaissés et 5 EUR remboursés, le paiement initial conserve son montant et son état confirmé. La mission et sa demande de service passent à `PARTIALLY_REFUNDED`. Le journal reçoit les contre-écritures proportionnelles de l'encaissement et de sa répartition historique, sous la référence unique du remboursement externe. Les arrondis cumulés garantissent le total au centime. Un échec annule les effets locaux ; une reprise ne crée pas de seconde restitution chez Stripe.

Le worker documentaire émet un avoir de -5 EUR lié à la facture payée de 35 EUR, avec prorata des lignes et taux de TVA historiques. La facture initiale reste inchangée. L'avoir exige une facture d'origine cohérente ; il ne devient pas acquis par le seul statut de remboursement.

Finance distingue le montant initial, le montant remboursé et le montant conservé. Le KPI des paiements confirmés compte le solde de 30 EUR. Une preuve encore en rapprochement affiche une explication et masque la nouvelle action de remboursement. Le serveur conserve son refus explicite, même à travers le circuit breaker ; un ancien écran ne peut donc pas contourner ce contrôle.

Le widget « À traiter » réserve une place à chaque nature d'action avant de compléter ses 40 lignes, pour que les catégories très chargées ne masquent plus le premier incident financier. L'alerte de remboursement externe renvoie aux paiements et se clôture uniquement après rapprochement confirmé ; le bouton de clôture manuelle est retiré et l'API refuse aussi cette opération.

## Vérifications exécutées

- **686 tests serveur réussis**, zéro échec, erreur ou test ignoré ; package Maven Java 21 réussi. La sélection couvre les remboursements intégraux, partiels, de lots, les annulations, avoirs, webhooks, règles de financement et projections Finance / dashboard.
- Cas partiels de 0,01 EUR, 5 EUR et 44,99 EUR sur 45 EUR, arrondis comptables et TVA, rejeux, seconde preuve distincte laissée à rapprocher, rollback après échec d'outbox et reprise.
- **30 tests d'interface réussis** : montants, état intermédiaire, erreurs API sous forme d'objet, actions masquées, parcours de l'alerte et identification de l'avoir dans les pièces liées.
- Contrôle TypeScript et build Vite réussis ; `git diff --check` ne signale aucune erreur. Le build conserve les avertissements existants de taille de chunks et d'import à la fois statique et dynamique. Sortie isolée : `/private/tmp/baitly-partial-refund-client-final`.
- Contraintes PostgreSQL locales lues sans modification : les tables `interventions` et `service_requests` acceptent déjà ce statut. Aucune migration ajoutée.
- Comparaison des JAR : onze classes applicatives modifiées, aucune ressource ou migration différente.

Rapports serveur finaux : `/private/tmp/baitly-partial-refund-final-636sh9mh/surefire-reports`.

JAR final testé : `/private/tmp/baitly-partial-refund-final-runtime.jar`.

SHA-256 : `c34254920a36f9cd98e1e5196757c3fe60883b39d346914e695a04c2e4d30e19`.

Le précontrôle de l'installateur vérifie le JAR actif de la tranche précédente et la configuration privée Stripe Baitly. Sauvegarde : `/private/tmp/baitly-before-partial-refund-b_irneqn/server.jar`. Aucun conteneur n'a été modifié lors de ce précontrôle.

## Chargement et recette locale

Commande exécutée après l'accord « Oui, charge le JAR et valide le remboursement partiel » :

```sh
rtk proxy python3 /private/tmp/baitly-install-partial-refund.py --apply
```

Elle conserve le conteneur et ses variables, remplace le JAR avec sauvegarde puis redémarre uniquement `clenzy-server-dev`. Le frontend reste actif. Le premier chargement a validé le rapprochement financier ; la recette a ensuite révélé une projection manquante des remboursements de séjour dans les KPI. Le JAR final corrige uniquement le DTO et sa requête par rapport à cette version intermédiaire. Les deux chargements appartiennent à la même recette autorisée. Sauvegardes d'installation : `/private/tmp/baitly-before-partial-refund-14vtl3gs/server.jar`, puis `/private/tmp/baitly-before-partial-refund-vau6f1qr/server.jar`. Tous les composants de santé HTTP répondent UP après le chargement final.

Le worker reprend le dossier existant : mission 332 et demande de service 201, encaissement 51 de 35 EUR, remboursement externe 52 de 5 EUR, facture 25 / FA2026-00022, incident 1042.

- Remboursement 52 COMPLETED, `externalRefundConfirmed=true`, `reviewRequired=false`. Mission et demande de service `PARTIALLY_REFUNDED`.
- Six contre-écritures sous `EXT-re_3UNNxGQxlvbxDIrY0Hb452gk`, équilibrées à 9,95 EUR par sens : 5 EUR d'encaissement et 4,95 EUR de répartition historique. La somme rendue au client reste 5 EUR.
- Avoir 26 / **FA2026-00023**, -5 EUR TTC, -4,17 EUR HT, -0,83 EUR de TVA, lié à la facture 25 et au remboursement 52. La facture initiale reste PAID à 35 EUR.
- Incident 1042 refermé automatiquement. Avant cette reprise, la rubrique « Incidents de règlement » apparaît bien dans « À traiter » avec 5 EUR ; sa modale expose la consigne et le lien vers Finance, sans clôture manuelle.
- Dans Finance, la fiche de l'intervention montre 35 EUR, 5 EUR remboursés et 30 EUR conservés, sans nouvelle action de paiement ou de remboursement. Les documents liés affichent la facture et l'avoir.
- Le bouton « Avoir FA2026-00023 » ouvre la fenêtre portant ce titre et reçoit une URL de document. L'aperçu intégré reste blanc et l'ouverture du lien est bloquée par le navigateur Codex. Lors de la reprise demandée, le fichier PDF déjà stocké sur le serveur local a été copié en lecture seule et rendu avec Poppler : une page lisible, sans chevauchement, avec -4,17 EUR HT, -0,83 EUR de TVA, -5 EUR TTC et référence à FA2026-00022. Le document lui-même est validé ; le lecteur intégré Codex reste une limite distincte. Copie de contrôle : `/private/tmp/baitly-avoir-FA2026-00023.pdf`.
- Deux rejeux signés du véritable événement Stripe `evt_3UNNxGQxlvbxDIrY0gurnCNU` retournent HTTP 200, sans doublon. Une relecture Stripe confirme toujours un seul remboursement de 500 centimes, succeeded.
- Contrôle final : 42 transactions, 25 factures et 238 écritures. Les 214 écritures antérieures gardent l'empreinte `29cb7f73bf2ac557bebdd1b32da5d8d5`. Le remboursement intégral précédent de la mission 329 est inchangé.

La projection des remboursements d'annulation de séjour est également raccordée à l'historique : le crédit client utilisé reste distinct de l'encaissement, et les requêtes séparent les identifiants de séjours et de missions. Après le chargement final, le filtre « Partiellement remboursé » présente deux dossiers : la réservation sandbox 548, 200 EUR dont 100 EUR remboursés, et la mission à 35 EUR dont 5 EUR remboursés. Les KPI « Total des paiements » et « Paiements déclarés payés » affichent chacun **130 EUR**, somme des 100 EUR et 30 EUR conservés ; les montants à régler, payés aux OTA et à vérifier affichent zéro pour ce filtre.

Le détail a été inspecté à 375, 768, 1024 et 1440 pixels. Les montants s'adaptent et le panneau ne présente pas de débordement horizontal ; les dimensions temporaires du navigateur sont réinitialisées.

Scripts de preuve privés : `/private/tmp/baitly-partial-refund-runtime-check.py` et `/private/tmp/baitly-replay-partial-refund.py`. Aucun SQL de modification n'a fabriqué ces états.

## Limites conservées

- Une fraction libre ne peut pas encore être demandée depuis Baitly ; cette tranche rapproche une preuve externe Stripe déjà confirmée.
- Les remboursements externes multiples, de lots, de séjours et d'autres sources restent exclus de ce rapprochement automatique.
- Le reversement du solde après remboursement et la compensation d'un transfert déjà émis demandent un circuit dédié ; aucun transfert Connect n'est annulé ici.
- La découverte d'anciens événements jamais livrés et les autres PSP / devises restent hors de cette tranche.
- La recette locale et les tests ciblés ne constituent pas une validation de production ni de tout le circuit bancaire.

Référence : [remboursements Stripe](https://docs.stripe.com/refunds), consultée le 6 octobre 2026.
