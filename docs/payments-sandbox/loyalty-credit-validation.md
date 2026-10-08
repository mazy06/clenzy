# Baitly : crédit fidélité et preuve d'encaissement

## Portée du correctif du 6 octobre 2026

Le checkout public pouvait réduire la charge avec `creditApplied`, tandis que le consumer `RESERVATION` exigeait encore le prix intégral. La voie historique consommait le crédit après la confirmation sans vérifier le résultat. Le journal et le financement propriétaire ne distinguaient pas cette part non encaissée.

Le nouveau parcours EUR à paiement intégral lie l'intention de crédit au compte, au code du séjour et au montant en centimes, dans les métadonnées serveur de la transaction. Une absence de crédit est également figée au premier checkout : réouvrir la même tentative ne change pas le montant attendu. Le lien de paiement PMS reprend le montant réduit et sa preuve.

La confirmation conserve le verrou du séjour et vérifie le reçu PSP avant la consommation atomique du crédit. Un rejeu ne débite pas deux fois. Un solde insuffisant, une devise différente, un compte modifié, une restitution préalable ou une intention absente empêchent la confirmation métier et ses effets ; l'encaissement PSP demeure à rapprocher, il n'est ni effacé ni déclaré intégralement réglé.

Le prix initial et le crédit restent séparés. Pour un séjour de 100 EUR avec 20 EUR de crédit, `amountPaid`, le journal et le split enregistrent 80 EUR, avec un solde dû nul une fois les deux composantes vérifiées. Le financement propriétaire est limité aux 80 EUR encaissés et exige aussi une consommation exacte du crédit. Une simple réduction inscrite sur le séjour ne suffit pas.

## Solde et parrainage

- Gains, gratifications, consommations et restitutions prennent le même verrou de compte et utilisent des mises à jour atomiques, sans réécrire une entité chargée auparavant.
- Une écriture rejouée doit conserver son compte et son montant ; une même référence portant d'autres données est refusée.
- Une restitution exige la consommation historique exacte. Elle ne crée pas un nouveau compte et ne restitue pas le crédit à l'adresse alternative d'un lien de paiement.
- La création d'un code de parrainage ne peut plus remettre un ancien solde après une dépense concurrente.
- Les gains de fidélité et de parrainage recontrôlent le séjour sous verrou. Un séjour non payé, annulé, remboursé ou non terminé ne crée plus de crédit à cette étape.
- Le gain de fidélité est calculé sur la part en numéraire du séjour, sans regagner des points sur le crédit déjà utilisé.

## Vérification automatisée

`BaitlyGuestCreditPostgresTest` utilise les véritables migrations 0266 et 0268, exécutées deux fois dans un schéma temporaire, puis la validation Hibernate et les vrais repositories. Les scénarios comprennent création concurrente, gains simultanés, double dépense, rejeu, rollback, restitution concurrente, devise, autre organisation et création de code après lecture d'un solde ancien.

`BaitlyReservationPaymentProofPostgresTest` exerce la vraie confirmation orchestrée et la voie historique, avec persistance des montants et contrôle du montant envoyé au journal. Les services de documents et le réseau PSP sont simulés. Les tests de checkout, lien de paiement, financement propriétaire et récompenses complètent ces contrôles.

La passe complète `tmp/baitly-financial-recipe-credit-01/summary.json` est **passed** : **2 042 tests serveur (298 suites JUnit), 77 tests interface**, zéro échec, erreur ou test ignoré. Les contrôles TypeScript application/tests et les **36 tests Python** du lanceur passent. Les tests HTTP frontend utilisent des fixtures locales ; ce ne sont pas des parcours navigateur sur le PMS partagé.

## Complément du 7 octobre

Les récompenses EARN/GRANT existantes sont traitées comme des remises offertes. Facturation cash, avoirs, restitution de points consommés et reprise des récompenses déjà gagnées sont maintenant implémentés, y compris le disponible nul après reprise de points déjà dépensés. Les migrations 0266/0268/0514 sont exercées. Voir les [preuves et limites du complément](refund-completion-validation.md). Les nombres ci-dessus décrivent la campagne historique du 6 octobre.

Les crédits achetés, la réservation/expiration de points à ouverture du checkout, les anciennes intentions absentes et les acomptes directs historiques restent hors périmètre. Une insuffisance concurrente reste à rapprocher. Les factures historiques incohérentes ne sont pas réécrites.

La [campagne finale](final-circuit-recipe-checklist.md) reste reportée après les travaux de code.
