# Dépendances Baitly : correctifs compatibles du 24 octobre 2026

Les quinze avis npm de sévérité élevée observés après la correction DOMPurify
ne désignent pas quinze causes indépendantes. Plusieurs sont les conséquences
du même avis Zod dans la chaîne CopilotKit/AG-UI/A2UI.

## Résolutions corrigées

| Dépendance | Avant | Après | Compatibilité conservée |
| --- | --- | --- | --- |
| Vite | 7.3.5 | 7.3.7 | Branche 7, pas de migration Vite 8 ; minimum direct relevé. |
| Undici | 7.30.0 | 7.30.1 | Branche 7, plage du parent conservée. |
| body-parser | 2.3.0 | 2.4.0 | Branche 2, plage du parent conservée. |
| qs | 6.16.0 | 6.16.1 | Minimum transitif demandé par body-parser 2.4.0. |
| Zod direct | 4.3.6 | 4.6.7 | Branche 4 des formulaires Baitly ; minimum direct relevé. |

Sources éditeurs : [Vite 7.3.7](https://github.com/vitejs/vite/releases/tag/v7.3.7),
[Undici 7.30.1](https://github.com/nodejs/undici/releases/tag/v7.30.1),
[body-parser 2.4.0](https://github.com/expressjs/body-parser/releases/tag/v2.4.0)
et [avis Zod corrigé à partir de 4.6.6](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

Seules cinq résolutions changent. Les métadonnées npm sans rapport, les autres
versions, CopilotKit et les consommateurs Zod 3 restent inchangés. Aucun nouvel
override, alias, patch local ou audit fix --force. L'override brace-expansion
préexistant est conservé.

## Douze avis élevés restent ouverts

Audit du lockfile après correction : **12 high, 4 moderate, 7 low, 0 critical**,
contre 15 high avant. Les avis Vite, Undici et body-parser sont retirés. Le Zod 4
direct est corrigé mais cela ne corrige pas les copies Zod 3 transitives.

Les cinq copies restent en 3.25.76 sous @a2ui/web_core, @ag-ui/client,
@ag-ui/proto, @copilotkit/a2ui-renderer et @copilotkit/shared. Leurs dépendances
imposent des plages ^3.25.76, ^3.25.75 ou ^3.23.3. La dernière version Zod 3
publiée consultée est 3.25.76 ; l'avis indique un correctif en 4.6.6, sans
correctif Zod 3 annoncé. Même @copilotkit/shared 1.79.1, dernière version
consultée, dépend encore de ^3.23.3.

Les douze entrées sont zod et ses onze dépendants : @a2ui/web_core,
@ag-ui/client, @ag-ui/encoder, @ag-ui/proto, @copilotkit/a2ui-renderer,
@copilotkit/core, @copilotkit/mcp-apps-renderer, @copilotkit/react-core,
@copilotkit/runtime-client-gql, @copilotkit/shared et @copilotkit/web-inspector.
Elles restent comptées dans les audits ; aucune exclusion de l'avis.

Forcer Zod 4 à la place de Zod 3 ou accepter le retour CopilotKit 1.54.1 proposé
par npm sortirait du périmètre « sans rupture de compatibilité ». Attendre un
correctif compatible des éditeurs ou préparer une migration distincte avec
contrats assistant/AG-UI et revue de compatibilité. Ne pas considérer ces avis
comme corrigés, inexploitables ou acceptés pour le lancement.

## Validation et campagne finale

Le lockfile est installé avec npm ci. La CI conserve son seuil d'audit critique
existant ; son succès ne prouve donc pas l'absence d'avis élevés. Les deux
audits avant/après et les contraintes transitives sont consignés dans les TODO.

Les six nouveaux tests utilisent les vrais schémas métier et zodResolver :
défauts/filtrage de contact, erreurs de champs, mot de passe/rôle d'organisation,
erreurs imbriquées d'équipe, montants de caution et confirmation de taxe.
Les tests existants complètent avec les prestations distantes, le fournisseur
SSE AG-UI (interruption/reprise incluses) et son réducteur d'événements.
Les trente cas sont strictement typecheckés et exécutés en CI avec rapport XML.
Les tests consentement/confidentialité et les builds PMS/SDK/site restent requis.

Aucun fournisseur réel, déploiement ou test staging dans cette vague. La campagne
staging finale vérifiera formulaires, assistant/interruption/reprise, contenu,
SDK et consentement après intégration des candidates cumulatives. Les douze
avis Zod 3 et les avis moderate/low restent un chantier distinct.

Validation locale de cette candidate : trente contrats typecheckés et réussis, cinquante-neuf tests de confidentialité/consentement/transport réussis, builds PMS, SDK et site réussis avec Vite 7.3.7. La validation CI et la recette staging sont enregistrées séparément dans les TODO.
