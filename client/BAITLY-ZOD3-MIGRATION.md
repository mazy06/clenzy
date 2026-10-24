# Migration dédiée Zod 3 : contrats assistant Baitly

État au 24 octobre 2026 : **préparation et caractérisation**, pas de bascule.
Les douze avis élevés restent ouverts. La référence #516 conservait les
lockfiles et imports de production de #515 ; les changements du candidat
suivant sont décrits séparément ci-dessous.

## Périmètre réel

| Surface | État verrouillé | Contrat à conserver |
| --- | --- | --- |
| `/agui-spike` | `@copilotkit/react-core` 1.77.1, import `/v2` et CSS | Chat, historique, streaming, outils, approbation/refus. Route lazy et permission `reservations:view`. |
| Transport frontend transitif | AG-UI client et proto 1.0.2 | POST/SSE, identités thread/run/message/tool, arguments progressifs, état partagé et annulation. |
| `copilot-runtime` | Runtime 1.61.2, AG-UI client 0.0.57, **lockfile séparé** | `/api/copilotkit`, découverte, auth par requête, CORS/cookies. Les tests frontend ne prouvent pas sa compatibilité. |
| Java | `AgUiController`, `AgUiEvent`, `AgentSseEventToAgUi` | Tenant/RBAC, outils serveur, pending, reprise explicite, wrapper `{displayHint,isError,data}`. |
| Superviseur natif | `AgUiSupervisionProvider`, sans SDK CopilotKit | Observateur SSE et validations. Il ne couvre pas tous les renderers du spike. |
| Formulaires | Zod direct 4.6.7 et `zodResolver` | Défauts, erreurs, confirmations, règles monétaires. |

Le frontend contient cinq copies Zod 3.25.76 sous A2UI web_core, AG-UI
client/proto et CopilotKit a2ui-renderer/shared. Le relais Node contient aussi
Zod 3.25.76. Les douze entrées de l’audit frontend ne constituent pas un audit
du relais : son audit indépendant et ses suites sont détaillés dans le document du candidat.

L’[avis éditeur](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
indique un correctif à partir de 4.6.6. Les dernières versions parentes vérifiées
lors de #515 imposaient encore Zod 3. Pas d’override global, alias, patch de
node_modules, downgrade ou suppression de fonction pour rendre l’audit vert.
Les avis ne sont pas déclarés inexploitables.

## Trajectoire et critères de sortie

Étape suivante préparée : [candidat de transport Zod 4](BAITLY-ZOD4-TRANSPORT-CANDIDATE.md),
inactif, 27 nouveaux cas de comparaison et de sécurité. Il ne remplace pas
encore le chat React ni le relais. L’audit séparé du relais est désormais
produit : 19 high, 7 moderate, 9 low et un critique proxy-addr corrigé par la
résolution compatible 2.0.8 ; aucun critique après, autres avis ouverts.

Préparer un adaptateur Baitly du protocole puis comparer un candidat corrigé
aux contrats. Deux voies admissibles : versions amont réellement corrigées ou
remplacement interne de l’intégration **complète** du spike. Rediriger vers le
superviseur natif perdrait des fonctions et n’est pas une migration acceptable.
Le candidat et sa bascule restent à réaliser : aucun remplacement qualifié
n’est livré ici. Ne pas imposer Zod 4 aux consommateurs Zod 3 ; revoir `record`,
raffinements, erreurs, JSON Schema et interfaces là où ils sont utilisés.

| Vague | Travail et dépendances | Critère de sortie |
| --- | --- | --- |
| 1. Référence | Inventaire des deux lockfiles ; caractérisation du vrai transport. | Tests frontend strictement typecheckés et XML, aucun changement de production. Frontend réalisé ; relais encore à qualifier. |
| 2. Candidat | Seam Baitly autour des API SDK ; préserver chat et neuf familles de renderers ; candidat sur branche isolée. | Contrats équivalents, aucun `any` ajouté pour masquer une rupture, imports SDK concentrés dans l’adaptateur. Aucun double run de comparaison. |
| 3. Intégration | Qualifier ensemble frontend/relais/Java ; découverte, auth, streaming et reprise ; auditer les deux locks, complet et sans dev. | Aucun chemin vulnérable lié à cet avis dans les deux graphes, sans exclusion. RBAC/tenant inchangés, tests conservés et builds PMS/SDK/site réussis. |
| 4. Promotion | Campagne staging finale regroupée, puis PR habituelle vers production. | Matrice fonctionnelle/confidentialité validée en staging. Aucun test staging dans cette préparation. |

## Référence exécutable

`src/modules/supervision/agui/baitlySdkMigration.test.ts` importe le vrai
`HttpAgent` transitif. SDK et schémas non mockés ; seul HTTP est injecté, avec
des fixtures synthétiques, sans serveur/fournisseur réel. Cette suite ne monte
pas CopilotChat et ne prouve pas le rendu React, la découverte runtime ou les cookies.

Neuf cas couvrent :

- fragments SSE LF coupés au milieu de l’UTF-8, français/arabe, identités,
  snapshot et patch d’état ;
- arguments progressifs d’outils et wrapper backend consommé par le vrai
  `parseToolResult`, sans exécution d’outil côté client ;
- interruption puis validation et refus explicites, contexte du fil et
  `resume` racine, aucune confirmation automatique ;
- en-têtes distincts entre agents et POST/Accept SSE (pas encore le test de
  la factory par requête du relais) ;
- 401, coupure après fragment et annulation : un seul envoi, aucune fin
  réussie inventée après coupure ;
- **défaut existant CRLF** du SDK 1.0.2 explicitement reproduit. Le test attend
  actuellement l’erreur pour caractériser la référence, sans qualifier CRLF
  comme fonctionnel. Avec le candidat, transformer l’assertion en succès
  équivalent à LF, sans ignorer ou supprimer ce cas.

CI frontend : cette suite et les trente contrats antérieurs sont obligatoires,
avec XML `baitly-dependency-compatibility`. Localement : 39 cas réussis, zéro
échec/erreur/ignoré et typecheck strict réussi. CI distante de cette préparation
à relever après publication ; la CI #515 ne qualifie pas ces nouveaux tests.

## Conditions avant retrait des dépendances

- Préserver messages, envoi, arrêt, navigation et états pending/erreur. Tester
  les neuf hints : list, details, chart_bar, kpi_summary, data_table, availability,
  quote, summary, navigation ; priorité backend, repli, non-JSON et `isError`.
- Conserver `clenzy-supervisor`, routes et formats Java ; aucun renommage
  d’identifiant auth/infrastructure. Ne pas changer l’exécution serveur des outils.
- Comparer des fixtures synthétiques, jamais deux moteurs sur une demande
  réelle. Aucun retry aveugle, confirmation ou rejeu après reconnexion. Un
  effet ambigu attend une preuve serveur ; une validation reste explicite.
- Qualifier auth actualisée/cookies HttpOnly par requête, deux utilisateurs et
  tenants, rôles refusés, expiration et CORS. Aucun token dans stockage navigateur
  ou traces. Aucune donnée client dans les fixtures/artefacts.
- Vérifier JSON Schema et consommateurs avant suppression. Calibrer les bornes
  trames/collections/profondeur sur les usages réels avant parsing, sans limite
  arbitraire tronquant les outils. Erreur visible sans logs d’args, prompts,
  résultats, cookies ou localisation. Le log Java actuel de `resumeEntry` brut
  est un point de confidentialité à traiter avant qualification du candidat.
- Qualifier le relais AG-UI 0.0.57 séparément et le contrat useInterrupt/runtime/Java.
  Conserver les tests Java de sécurité/traduction ; compléter avec fixtures
  partagées générées côté Java, sans inventer un format client divergent.

Repli : SHA précédent via CI/CD, sans migration de données. Il conserve le
risque Zod 3 connu, sans acceptation de sécurité. Annuler le flux avant bascule,
préserver le pending serveur et reprendre seulement après décision explicite.
Aucune suppression du relais infra avant absence démontrée de consommateurs.

## Campagne staging finale réservée

Regrouper : rôles/tenants autorisés et refusés, plusieurs tours, neuf rendus,
approbation/refus, pending restauré, expiration de session, arrêt et coupure
réseau sans double effet, français/anglais/arabe, confidentialité Sentry/PostHog
et retrait du consentement. Contrôler les deux audits et SHA réellement livrés.
Clôturer les douze avis seulement après correction démontrée et validation ;
FR10/FR11 restent ouverts.
