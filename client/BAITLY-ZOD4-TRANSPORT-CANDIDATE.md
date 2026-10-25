# Candidat de transport Baitly sur Zod 4

État suivant : [vague technique regroupée](BAITLY-FINAL-TECHNICAL-WAVE.md), qui
intègre le chat natif et retire les SDK. Le présent document décrit la phase
historique antérieure ; ses limites ne sont pas toutes le statut courant.

24 octobre 2026. Étape suivante de la préparation #516 : **candidat inactif**,
sans bascule du chat, retrait de dépendance ou modification de route/permission.
Le chat CopilotKit et le superviseur natif continuent leurs chemins existants.
Les douze avis frontend Zod 3 restent ouverts.

## Ce qui est implémenté

`src/modules/supervision/agui/baitly/` contient le protocole, le lecteur SSE
et `BaitlyAgUiClient`. Le candidat importe uniquement le Zod 4.6.7 direct,
aucun SDK CopilotKit/AG-UI ni copie transitive Zod 3. Aucun import applicatif
actif ne le branche à un moteur ; seules les recettes l’utilisent à ce stade.

- Enveloppes Zod 4 pour les événements émis par Java, préservation des champs
  d’extension, messages et contexte envoyés sans réécriture.
- POST/SSE avec `credentials: include` et lecture des en-têtes à chaque envoi.
  Aucun token persistant, cache d’authentification ou diagnostic du corps HTTP.
- LF, CRLF et CR, UTF-8 fragmenté, commentaires et données multilignes. Le
  défaut CRLF observé sur le SDK 1.0.2 ne se reproduit pas sur le candidat.
- Identifiant de run **attribué par Java**, distinct de celui de la requête :
  `AgentSseEventToAgUi` crée un UUID à chaque démarrage, reprise incluse.
  L’identité du fil est conservée ; la fin doit correspondre au début reçu.
- Validation/refus explicites des interruptions connues, décisions étrangères,
  doublonnées ou contradictoires refusées avant envoi ; aucune auto-validation.
- Une seule requête active, jusqu’à la libération effective du lecteur. Aucun
  retry ; une coupure, réponse 5xx, annulation ou flux invalide après envoi
  laisse le client `uncertain` et bloque les envois suivants sur cette instance.
  EOF n’est pas une preuve de succès. Aucun outil n’est exécuté côté transport.
- Diagnostics à codes fixes, sans corps de réponse, message d’erreur distant,
  cause, problème Zod détaillé, argument d’outil ou jeton.

La limite de taille des trames est un paramètre obligatoire, testé avant
JSON/Zod ; aucune valeur n’est imposée au produit aujourd’hui. La valeur de
1 Mio dans les recettes est synthétique et doit être calibrée sur les sorties
réelles avant activation. Ce n’est pas une limite de durée totale du streaming.

## Preuves locales et limites

27 nouveaux tests, dont comparaisons avec le vrai `HttpAgent` installé :

- mêmes séquences d’événements pour texte français/arabe, état et les neuf
  familles de résultats d’outils ; comparaison du wrapper via `parseToolResult` ;
- approbation/refus et identité de run réattribuée par Java ;
- coupure, EOF incomplet, mauvais run, 5xx, 401, arrêt, concurrence, nettoyage
  différé, entrées invalides, trames excessives et diagnostics sensibles ;
- en-têtes actualisés, cookies HttpOnly demandés au navigateur et absence de
  lecture des corps d’erreur. Aucun serveur, appel fournisseur ou message réel.

Avec les 39 cas antérieurs : **66 tests réussis**, aucun échec/erreur/ignoré,
typecheck strict et build local PMS/SDK réussis. La CI frontend exécute les
six suites et archive le XML. Les séquences SDK de comparaison utilisent LF ; CRLF/CR sont qualifiés
sur le candidat à partir des mêmes événements, pas déclarés fonctionnels sur
l’ancien SDK. Ces tests ne montent pas le chat React.

Ce candidat est un transport, **pas encore le remplacement complet du SDK** :
il n’accumule pas la transcription, n’applique pas les patches d’état, ne monte
pas les renderers et ne réalise pas la découverte runtime. Les événements
Java connus sont validés ; des extensions de protocole non prévues sont
refusées. Il reste à définir leur politique avant activation.

Le blocage `uncertain` est en mémoire, pas un journal durable. Recréer une
instance ne constitue jamais une preuve de réconciliation. Avant de brancher
le candidat, l’adaptateur UI devra restaurer les pending et vérifier le statut
serveur après rechargement, conserver les mêmes IDs et ne jamais rejouer un
effet ambigu. Aucun bouton de remise à zéro ou retry forcé n’est fourni ici.

## Audit séparé du relais et correctif critique compatible

L’audit du lockfile `copilot-runtime`, sans dépendances de développement,
révèle **19 high, 7 moderate, 9 low et 1 critical**, distincts des douze avis
frontend. Le critique vient de proxy-addr 2.0.7, sous les plages compatibles
Express `~2.0.7` et `^2.0.7`.

Seule sa résolution est passée à **2.0.8**, dépendances filles inchangées,
sans override ni changement de configuration `trust proxy`, auth, CORS,
headers ou routage. L’[avis éditeur](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
documente ce correctif de confiance des sous-réseaux IPv6/IPv4.

Installation propre `npm ci --ignore-scripts --no-audit` réussie, contrôle de
syntaxe du serveur et cinq tests de confiance proxy réussis. Les adresses de
recette sont synthétiques/réservées à la documentation ; aucun serveur lancé.
Audit après : **19 high, 7 moderate, 9 low, 0 critical**. Aucun autre avis n’est
clôturé ; l’absence de critique ne signifie pas que le relais est qualifié.
Tests et seuil critique sont maintenant obligatoires dans sa CI.

## Prochaines portes de validation

1. Adaptateur de transcription/UI conservant les fonctions du spike, neuf
   renderers, priorité de hint, erreur/repli et navigation, sans second moteur
   ni suppression du superviseur natif.
2. Fixtures générées par Java et contrat complet découverte/relais/auth,
   rôles/tenants, pending restauré et décisions humaines. Le test d’identité
   Java de cette étape reste synthétique, pas une exécution Java inter-langages.
3. Bornes calibrées, sémantique des extensions de protocole, logs Java de reprise
   sans contenu brut, preuve serveur des effets incertains après rechargement.
4. Qualification de l’ensemble, retrait des anciens SDK seulement après
   équivalence démontrée et audits des deux graphes ; campagne staging finale
   regroupée puis promotion habituelle par PR. Aucun déploiement ici.

## Étape suivante : adaptateur et pending

Le candidat est complété par un adaptateur React inactif et un contrôle durable
des décisions. Voir [le contrat de restauration](BAITLY-CHAT-PENDING-RESTORATION.md).
Les limites ci-dessus décrivent le transport de #517 ; le remplacement du SDK
reste soumis aux portes de qualification, sans activation ni retrait ici.
