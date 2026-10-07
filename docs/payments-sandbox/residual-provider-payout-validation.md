# Baitly : reversement du solde après remboursement

État au 6 octobre 2026 : **reversement résiduel validé de bout en bout dans le sandbox**. La mission 332 a été replanifiée, démarrée et terminée depuis Baitly avec Jean Martin et des images de simulation explicitement autorisées. Stripe confirme un transfert unique de **30 EUR**, `livemode=false`, vers son compte de test distinct ; Baitly affiche « envoyé ». Le remboursement de 5 EUR, l'avoir et le journal historique restent intacts. La réception bancaire n'est pas attestée. Le défaut distinct de persistance des pièces a ensuite été corrigé et recetté sur la mission de démonstration 352, sans transfert supplémentaire.

## Périmètre

Le parcours prestataire accepte désormais une mission EUR terminée dont l'encaissement unitaire Stripe et l'unique remboursement externe partiel sont rapprochés. Il applique les règles communes à tous les métiers du catalogue et aux bénéficiaires individuels ou organisations déjà désignés.

L'assiette est le montant encaissé moins le remboursement confirmé. Pour 35 EUR encaissés et 5 EUR remboursés, elle vaut 30 EUR. Le taux de commission configuré pour la catégorie s'applique à ces 30 EUR : à 10 %, le transfert serait de 27 EUR et la commission de 3 EUR. Une commission absente ou désactivée reste nulle, selon la règle existante.

La mission doit toujours être terminée, justifiée par une photo AFTER persistée, et son bénéficiaire doit disposer d'un compte de versement prêt. Le contrôle du solde Stripe disponible reste requis. Une somme conservée après remboursement ne suffit pas à elle seule pour émettre un transfert.

## Contrôles

- Une seule transaction Checkout et un seul remboursement externe confirmé, de la bonne organisation et de la bonne mission, dans la même devise. La session, le prix et la référence de l'encaissement doivent correspondre.
- `externalRefundConfirmed=true`, `reviewRequired=false`, état Stripe succeeded et statut local COMPLETED. Une preuve en attente ou à vérifier bloque l'émission.
- Encaissement comptable et contre-écriture du remboursement présents, montants exacts, paires réciproques équilibrées. Les lots et financements supplémentaires sont exclus.
- Une demande de service liée doit porter le même statut partiel et ne pas disposer d'un autre financement actif.
- Relecture sous verrou à la création du dossier, à sa relance et avant réservation durable de l'émission Stripe. L'observation d'un remboursement externe partage le verrou de mission.
- Un montant préparé avant remboursement ne peut pas être versé après celui-ci. Un ordre FAILED/BLOCKED est recalculé et revalidé ; un transfert déjà envoyé ou incertain reste à rapprocher.
- La relance recharge l'entité après sa transition SQL conditionnelle. Cela corrige un défaut reproduit où l'enregistrement du montant pouvait réécrire l'ancien état BLOCKED.
- Le journal Stripe conserve sa clé d'idempotence et sa réservation unique. Aucun réseau PSP à l'intérieur d'une transaction SQL.
- La résolution des comptes personnels et d'organisation accepte PAID et PARTIALLY_REFUNDED. La migration 0504 ajuste uniquement leurs policies de lecture, en conservant les liens mission, affectation et organisation. Les droits d'écriture ne changent pas. L'éligibilité financière reste vérifiée séparément sous verrou.

## Validation automatisée et chargement préparé

- 768 tests serveur, zéro échec, erreur ou test ignoré, comptés sur les seuls rapports de l'exécution finale. Package Maven Java 21 réussi ; `git diff --check` propre.
- Tests avec repositories JPA et écritures réelles : solde exact, montant ancien refusé, preuve en attente/étrangère/incomplète, lots exclus, seconde restitution, prix modifié, rollback, relecture après attente concurrente et relance conditionnelle persistée.
- Le service d'émission est exercé avec commission de 10 % sur 30 EUR : l'instruction transmise contient 27 EUR, et non 31,50 EUR ou 35 EUR. Le réseau Stripe est simulé dans ce test.
- La migration réelle 0504 est exécutée deux fois dans un PostgreSQL jetable. Avec un rôle non privilégié, les requêtes métier retrouvent uniquement le bénéficiaire affecté à une mission terminée partiellement remboursée. Une connexion révoquée reste non prête ; les missions non terminées, autres statuts, utilisateurs et tenants sont refusés, ainsi que l'écriture sur le compte du prestataire.
- Rapports finaux : `/private/tmp/baitly-residual-payout-vrt5ac0v/surefire-reports`.
- JAR final chargé : `/private/tmp/baitly-residual-payout-runtime.jar`, SHA-256 `b727e54b212286f8b5c843bbdcd0733d83316b8107c14155e5ce11459efd2148`.
- Sauvegarde avant chargement final : `/private/tmp/baitly-before-residual-payout-q6r3n3nk/server.jar`. Empreinte du JAR installé et conservation du même conteneur et de ses variables vérifiées par l'installateur.
- Premier JAR chargé : SHA-256 `056dd8807b26b8b832c8b42fad4b3ce88106387d32590fa7debf5bbea483ac84`. Sauvegarde de son prédécesseur : `/private/tmp/baitly-before-residual-payout-f6ji3mk_/server.jar`. Même conteneur et mêmes variables d'environnement, frontend inchangé.
- Relecture des données locales : toujours 42 transactions, 25 factures, 238 écritures ; les 214 écritures antérieures gardent l'empreinte `29cb7f73bf2ac557bebdd1b32da5d8d5`. L'avoir et le remboursement partiel sont inchangés.

Commande exécutée après l'accord utilisateur couvrant le JAR corrigé et la migration 0504 :

```sh
rtk proxy python3 /private/tmp/baitly-install-residual-payout.py --apply
```

Elle a sauvegardé le JAR actif puis remplacé seulement celui de `clenzy-server-dev`, arrêté et redémarré ce conteneur, sans modifier son identité ni ses variables Stripe. Le frontend est resté actif. La revue automatique avait refusé ce second chargement avant exécution ; l'utilisateur a ensuite donné l'accord explicite demandé. Les deux policies SELECT contiennent désormais PARTIALLY_REFUNDED dans la base locale.

## Recette effectuée et prérequis restants

Le dossier sandbox existant est la mission 332, encaissée 35 EUR puis remboursée 5 EUR, avec avoir FA2026-00023. Après rechargement, Finance affiche bien le statut partiel, les trois montants 35/5/30 EUR et les deux dossiers filtrés totalisant 130 EUR. Le rendu desktop a été contrôlé visuellement : détails lisibles, sans chevauchement.

La mission est encore PENDING et ne possède aucune photo AFTER. Aucun dossier de reversement ni transfert n'existe pour cette mission après le chargement : elle ne déclenche pas une émission prématurée. La fin de mission et sa preuve restent à valider avant émission.

L'utilisateur a connecté Jean Martin (user 3) dans Baitly, puis préféré explicitement un compte Stripe de test distinct à Miftah Al. Depuis Compte > Mes versements > Connecter mon compte, l'option officielle Stripe « Utiliser un compte vierge » a créé `acct_1UNPNvJfs0WxjDsG`. Le callback a rattaché ce compte personnel à Jean Martin et synchronisé sa configuration prestataire legacy. Le compte propriétaire (user 2 / `acct_1UN38qQraKTYknLt`) reste inchangé.

Après finalisation par l'utilisateur dans Stripe, le retour Baitly affiche « Votre compte de versement est prêt ». La lecture Stripe confirme `details_submitted=true`, `charges_enabled=true`, `payouts_enabled=true` et la capacité `transfers=active`, sans exigence en attente ni erreur. La connexion personnelle et la configuration prestataire locale reflètent cet état. Aucun identifiant n'a été inventé ni partagé et aucune activation n'a été forcée en base.

La consultation de la mission 332 avec Jean Martin indique « Démarrage possible le 19/10/2026 13:00 ». Le démarrage anticipé est donc correctement bloqué. L'utilisateur a reconnecté l'administrateur. La tentative de replanification depuis le formulaire a alors révélé un défaut distinct : `scheduledDate` n'appartenait pas au DTO de mise à jour. Le contrôle de disponibilité portait donc encore sur l'ancien créneau et refusait l'enregistrement avec HTTP 409. La transaction a été refusée ; la mission reste à sa date d'origine.

Lecture seule de la configuration tarifaire de l'organisation 2 : `commission_configs=[]`. Pour cette recette, la commission attendue est donc **0 EUR** et le transfert attendu **30 EUR**. Le cas 27 EUR + 3 EUR documenté plus haut est un scénario automatisé à 10 %, et non la configuration de ce dossier.

### Correctif de replanification chargé et validé depuis Baitly

- Le DTO accepte la date UTC ; le service applique le changement avant le contrôle commun de disponibilité. La fenêtre conserve sa durée, sans modifier le paiement ou le bénéficiaire. L'ownership reste contrôlé et seuls les gestionnaires ou le propriétaire autorisé peuvent replanifier une mission non démarrée.
- Une affectation inchangée n'est plus rejouée comme une nouvelle proposition. Une mission démarrée, terminée ou annulée ne peut pas être déplacée par ce formulaire.
- Le formulaire affiche correctement les agents de ménage. Il convertit l'UTC de l'API en heure locale à l'affichage, puis dans l'autre sens à l'envoi. Un rafraîchissement de la requête ne réinitialise plus la saisie. Le motif métier d'un refus apparaît dans l'erreur.
- **213 tests serveur** réussis, dont les contrôles du reversement résiduel, **9 tests interface** réussis sous Europe/Paris, typecheck réussi, `git diff --check` propre. Le premier essai Java avait échoué à initialiser Mockito dans le sandbox ; les mêmes tests ont été relancés avec l'attachement autorisé.
- Rapports serveur : `/private/tmp/baitly-reschedule-validation`. JAR : `/private/tmp/baitly-reschedule-runtime.jar`, SHA-256 `e34a63c56c295b186dba824dbff6994a07df5d9fc52d0a51e63d2afa5527e2d6`.
- Précontrôle et sauvegarde effectués sans arrêt du serveur : `/private/tmp/baitly-before-reschedule-my0nukdf/server.jar`. Après accord explicite, `/private/tmp/baitly-install-reschedule.py --apply` a installé le JAR dans le même conteneur. Sauvegarde effective : `/private/tmp/baitly-before-reschedule-hbfq2ogy/server.jar`. Configuration Stripe conservée, frontend inchangé, santé HTTP 200. Aucune nouvelle migration.
- Vérification visuelle du formulaire dans Baitly : Jean Martin sélectionné, heure 13:00 cohérente avec la fiche. Les tentatives de changement de viewport du navigateur intégré n'ont pas modifié sa largeur effective ; elles ne constituent pas une validation des quatre résolutions.

Recette après chargement : le créneau du 6 octobre à 05:00 Europe/Paris (03:00 UTC) est libre selon le contrôle SQL métier. La saisie clavier native des champs date/heure le transmet correctement ; le remplissage automatisé seul ne déclenchait pas leur mise à jour React. Le refus suivant est désormais explicite : « Le prestataire ne possède pas la capacité déclarée pour cette prestation ». Jean Martin dispose du profil personnel canonique 10, mais aucune ligne de capacité. La déclaration personnelle passe exclusivement par son compte ; le service refuse de la modifier depuis une fiche équipe administrateur.

La transaction de replanification est intégralement annulée : la mission reste PENDING au 19 octobre, affectée à Jean Martin, avec son prix de 35 EUR et son statut PARTIALLY_REFUNDED. Le contrôle après chargement retrouve 42 transactions, 25 factures, 238 écritures, l'avoir unique de -5 EUR et les 214 écritures historiques inchangées. Aucun transfert n'a été émis.

Après reconnexion de Jean Martin par l'utilisateur, « Ménage entre deux séjours » a été déclaré depuis Compte > Mes prestations. La sélection persiste après rechargement ; la base contient `cleaning-turnover` pour son profil personnel 10. Aucun tarif n'a été modifié.

Le contrôle documentaire était négatif : aucune pièce déposée, statut professionnel non renseigné et aucune revue valide pour `FR / ITEM:cleaning-turnover`. L'email est confirmé et les conditions de prestation sont déjà acceptées depuis le 19 août (aucune nouvelle acceptation). Trois fichiers PNG de simulation ont été préparés dans `/private/tmp/baitly-provider-test-documents`, chacun marqué « TEST SANDBOX / FICHIER DE SIMULATION / AUCUNE VALEUR LEGALE ». Ils ne constituent ni immatriculation, ni attestation de vigilance, ni assurance. Aucune pièce d'identité n'est préparée.

L'utilisateur a explicitement autorisé leur dépôt et leur validation uniquement dans Baitly local. Les trois fichiers ont été déposés depuis Compte > Documents avec Jean Martin : documents 8 (immatriculation), 9 (vigilance, échéance 7 octobre 2026) et 10 (assurance). Les noms visibles portent le préfixe `TEST-SANDBOX-`. Après reconnexion de l'administrateur, les trois documents sont passés à « Validée » depuis la fiche prestataire. La revue 1 est en vigueur pour `FR / ITEM:cleaning-turnover`, jusqu'au 7 octobre, avec statut de test OTHER, pièces 8/9/10 et une note explicite indiquant leur absence de valeur légale. Le contrôle métier documentaire retourne true. Cette validation n'atteste aucune conformité professionnelle réelle ; elle concerne exclusivement le compte fictif et cette recette locale. Aucun contrôle global ni permission n'a été modifié.

Le créneau du 6 octobre à 05:00 Europe/Paris était libre mais hors disponibilité déclarée. Baitly l'a refusé explicitement. Le créneau du 5 octobre à 14:00 UTC, soit 16:00 Europe/Paris, est à la fois libre selon `baitly_assignment_conflicts` et disponible selon `baitly_user_declared_available`. La replanification a réussi depuis le formulaire administrateur : la fiche et la base affichent cette date, une fenêtre de trois heures, Jean Martin affecté, prix 35 EUR, état PENDING et paiement PARTIALLY_REFUNDED. La description est marquée TEST SANDBOX et indique 35 EUR encaissés, 5 EUR remboursés, 30 EUR attendus et aucune prestation réelle.

Le contrôle financier après enregistrement confirme les 42 transactions, 25 factures et 238 écritures, l'avoir unique de -5 EUR, les contre-écritures équilibrées et l'empreinte des 214 écritures historiques intacte. Aucun transfert n'est émis avant la clôture opérationnelle.

L'administrateur n'a pas l'action de démarrage réservée à l'intervenant affecté. L'utilisateur a reconnecté Jean Martin et explicitement autorisé les deux images AVANT/APRÈS marquées « TEST SANDBOX / AUCUNE PRESTATION REELLE / AUCUNE VALEUR PROBANTE », préparées dans `/private/tmp/baitly-mission-332-test-photos`. Aucun droit ni contrôle métier n'a été contourné.

### Émission du solde confirmée le 6 octobre

- Démarrage depuis la fiche mission à 04:53:26 UTC, puis clôture explicite depuis le récapitulatif à 04:56:16 UTC. Mission COMPLETED, paiement toujours PARTIALLY_REFUNDED.
- Photos persistées 24 BEFORE et 25 AFTER, respectivement `TEST-SANDBOX-mission-332-AVANT.png` et `TEST-SANDBOX-mission-332-APRES.png`. Une note précise que les validations opérationnelles sont simulées et qu'aucun ménage réel n'a été effectué.
- Dossier prestataire 6 : user 3, montant 30 EUR, commission 0 EUR, état SENT, aucune organisation substituée au bénéficiaire personnel.
- Journal 2 : source INTERVENTION / 332, transition SUBMITTING à 04:56:19 UTC puis TRANSFERRED à 04:56:21 UTC. Un seul dossier et un seul transfert existent pour cette mission.
- Stripe GET confirme `tr_1UNQQJQxlvbxDIrYbI1qzOdw`, `amount=3000`, `currency=eur`, `livemode=false`, destination `acct_1UNPNvJfs0WxjDsG`, paiement destinataire `py_1UNQQJJfs0WxjDsGN5uKHhvS`, aucun montant contre-passé. Les métadonnées désignent bien l'organisation 2, user 3 et la mission 332.
- Le compte Jean Martin, Compte > Mes versements de missions (`/account?tab=payouts`), affiche une seule ligne : 6 octobre, mission 332, 30 EUR, commission nulle, « envoyé ». Rendu desktop contrôlé visuellement.
- Contrôle financier répété après transfert : 42 transactions, 25 factures, 238 écritures ; remboursement unique de 5 EUR, avoir unique de -5 EUR et empreinte des 214 écritures antérieures inchangés. Il s'agit d'un transfert Connect confirmé, pas d'une preuve de réception bancaire.

Deux défauts de temps visibles pendant la recette sont corrigés côté interface : le chronomètre utilisait `new Date()` sur l'UTC sans fuseau, ajoutant deux heures en Europe/Paris ; il utilise maintenant le parseur API partagé. La fiche terminée affiche `completedAt`, la clôture effective, au lieu de la fin prévisionnelle conservée dans `endTime`. La fiche affiche désormais début 06:53 / fin 06:56 le 6 octobre. Neuf tests ciblés sous Europe/Paris réussissent ; aucune donnée historique n'a été réécrite.

**Défaut opérationnel observé :** le récapitulatif avant clôture indiquait 4/4 pièces, puis 0/4 après navigation. La base conserve `validated_rooms=NULL` et les étapes inspection/after_photos seulement. Les photos sont bien persistées et le garde financier actuel ne requiert pas la liste des pièces. La mission transférée n'a pas été rouverte ni modifiée pour masquer ce résultat.

### Persistance des pièces : correctif interface et recette validée

Les quatre sauvegardes de pièces de la mission 332 ont répondu HTTP 500 entre 04:55:05 et 04:55:07 UTC, avec `UnexpectedRollbackException`. L'interface affichait néanmoins les coches et ignorait l'erreur. Les écritures pièces, étapes et progression étaient lancées en parallèle sur une entité disposant déjà de `@Version` et `@DynamicUpdate`. La cause serveur sous-jacente de ces rollbacks n'est pas établie ; aucun contrôle de sécurité ni filtrage tenant n'a été modifié.

Le correctif attend la confirmation de la sauvegarde avant de changer la sélection visible. Un échec conserve la dernière sélection confirmée, affiche une erreur et permet de réessayer. Les mutations d'exécution d'une même intervention partagent une file séquentielle TanStack Query ; les doubles clics pendant la sauvegarde d'une pièce sont ignorés. La clôture attend aussi l'enregistrement des étapes finales, et les anciennes écritures dupliquées pièces/étapes lors de la fermeture de page ont été supprimées.

La recette a aussi reproduit une boucle de resynchronisation : les réponses de progression réinjectaient une ancienne liste d'étapes après le dépôt de la photo APRÈS. Le bouton Terminer restait bloqué ; 313 écritures de progression réussies et trois réponses HTTP 429 ont été observées avant le dernier correctif. L'hydratation photo/étapes est désormais initialisée une seule fois par mission ; les mutations mettent à jour leurs champs locaux. Le dépôt persiste explicitement son étape dans la même file séquentielle. Si cette dernière sauvegarde échoue, la photo reste affichée, l'erreur apparaît et la clôture retente la sauvegarde sans imposer un second dépôt. Le drapeau « toutes les pièces » est dérivé des pièces confirmées et du logement chargé, y compris lorsque celui-ci arrive après la mission.

Validation automatisée finale : 7 tests de persistance des pièces, 3 tests photo/étapes, 3 tests de clôture et 9 tests de temps réussis, soit **22 tests**. Sont couverts l'échec HTTP 500, la reprise, le rechargement, la désélection jusqu'à `[]`, la sérialisation des écritures, le double clic, le chargement tardif du logement, le dépôt AVANT/APRÈS et le refus de clôturer avant la sauvegarde finale. TypeScript et les traductions FR/EN/AR passent également.

Recette locale dédiée : l'administrateur a préparé la mission de démonstration existante **352**, affectée à Jean Martin, au Cottage des Tanneurs. Son titre et sa description indiquent `TEST SANDBOX`, aucune prestation réelle et aucun paiement à lancer. L'utilisateur a reconnecté Jean Martin, puis le démarrage a réussi depuis son écran. Après son accord explicite, les deux images de simulation de `/private/tmp/baitly-mission-352-test-photos` ont été déposées : photo **26 BEFORE**, photo **27 AFTER**.

- Les six sauvegardes de pièces, puis la désélection et la nouvelle sélection de Cuisine, ont toutes répondu HTTP 200. La navigation vers le dashboard puis le retour retrouvent les 6/6 ; le rechargement après désélection retrouve bien 5/6.
- La clôture explicite depuis Baitly a réussi à **05:43:46 UTC**. La sauvegarde finale des étapes a répondu HTTP 200 avant l'appel de clôture. Après rechargement, la fiche affiche Intervention terminée, **6/6 pièces**, une photo AVANT et une photo APRÈS, ainsi que le document de fin de mission.
- La base confirme `COMPLETED`, `validated_rooms=[0,1,2,3,4,5]`, `completed_steps=["inspection","rooms","after_photos"]` et progression 100. Les logs à partir de 05:42 UTC ne montrent plus de boucle d'écriture ; les derniers appels d'étapes et de clôture sont uniques et réussis.
- Aucune somme n'était encaissée pour cette simulation. La clôture a créé le dossier **7 BLOCKED, 0 EUR**, sans transfert dans `payout_transfers`. Le journal **2 / mission 332 / 30 EUR / TRANSFERRED** demeure inchangé. Aucun paiement n'a été lancé.
- Les correctifs sont uniquement frontend. Aucun nouveau JAR, migration ou redémarrage Docker n'a été nécessaire.

Une demande distincte **350**, également marquée `TEST SANDBOX`, a été créée pendant la préparation sur le logement Baitly Sandbox Reversement. Elle reste en attente, sans intervenant ni intervention, avec le motif de replanification « Créneau trop proche ou passé ». Elle n'a pas été utilisée pour cette recette et aucun paiement n'a été lancé.

Le rendu de l'avoir existant a été vérifié sur le PDF stocké : une page, total -5 EUR TTC, référence correcte à la facture d'origine, aucun chevauchement. L'aperçu PDF du navigateur intégré et le fichier généré sont distingués dans la [recette du remboursement partiel](partial-external-refund-validation.md).

## Limites

- Cette tranche concerne le solde d'une prestation encaissée seule. Les remboursements multiples, externes de lots, les reversements propriétaires après annulation de séjour et les autres PSP/devises restent exclus.
- Un remboursement intervenant après la réservation d'un transfert exige toujours un rapprochement et éventuellement une compensation ; aucun transfert déjà émis n'est annulé automatiquement.
- La recette prouve l'émission et le rapprochement d'un transfert Connect sandbox de 30 EUR. Elle ne prouve aucune réception bancaire réelle. Les 768 tests serveur et la recette navigateur sont des preuves distinctes.

Références Stripe : [charges et transferts séparés](https://docs.stripe.com/connect/separate-charges-and-transfers), [contre-passations de transferts](https://docs.stripe.com/api/transfer_reversals).
