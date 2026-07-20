# L'assistant IA de Baitly

## Que peut faire l'assistant IA ?

L'assistant IA de Baitly est accessible depuis le menu « Assistant » de l'application. C'est un copilote conversationnel qui connaît les données de votre organisation : il répond à vos questions sur vos réservations, vos propriétés, votre taux d'occupation, vos revenus, vos interventions de ménage ou de maintenance, et vos indicateurs financiers. Il peut aussi produire des synthèses (résumé du tableau de bord, performance des propriétés, tendances de réservation, prévisions d'occupation, analyse de portefeuille). Au-delà des questions, l'assistant peut agir : lister ou annuler une réservation, bloquer un jour dans le calendrier, créer ou assigner une intervention, simuler un changement de tarif, envoyer un message à un voyageur, ou vous suggérer la page de l'application où réaliser une tâche. Il peut également consulter la météo prévisionnelle d'une ville et les événements locaux, utiles pour anticiper la demande. Les actions sensibles (annulation, envoi de message, blocage de calendrier) vous sont toujours présentées pour confirmation avant exécution.

## Comment poser une question sur mes données ?

Ouvrez l'assistant depuis le menu « Assistant » et écrivez votre question en langage naturel, par exemple « Quel est mon taux d'occupation ce mois-ci ? », « Liste mes réservations de la semaine prochaine » ou « Quelles interventions de ménage sont en attente ? ». L'assistant interroge directement les données de votre organisation et vous répond avec des chiffres réels. Vous pouvez enchaîner les questions dans une même conversation : l'assistant garde le contexte. Un panneau latéral liste vos conversations passées, que vous pouvez reprendre à tout moment. L'assistant dispose aussi d'une mémoire long terme : vous pouvez lui demander de retenir un fait important (« retiens que la villa Azur est fermée en janvier ») et il s'en souviendra dans vos futures conversations. Vous pouvez également lui demander de l'oublier.

## Puis-je envoyer des images à l'assistant ?

Oui. Vous pouvez joindre jusqu'à 3 images par message dans le chat de l'assistant. Chaque image doit faire au maximum 5 Mo, dans les formats JPEG, PNG, GIF ou WebP. Les images trop lourdes sont automatiquement compressées côté navigateur avant l'envoi. L'assistant analyse le contenu des images : vous pouvez par exemple lui montrer une photo d'un logement, d'un dégât ou d'un document et lui poser des questions dessus. L'analyse d'images consomme du budget IA, comme les conversations textuelles.

## Qu'est-ce que la base de connaissances de l'assistant ?

L'assistant peut citer de la documentation grâce à une recherche documentaire intégrée. Deux types de documents sont indexés : les documents globaux Baitly (la documentation produit, accessible à toutes les organisations) et les documents propres à votre organisation (vos procédures internes, vos consignes, vos guides), privés et visibles uniquement par votre équipe. Quand vous posez une question, l'assistant recherche automatiquement les passages pertinents dans cette base et s'en sert pour répondre. Pour gérer ces documents, rendez-vous dans Paramètres, onglet « IA », section « Documentation » : vous y voyez la liste des documents indexés avec leur portée (« Global Baitly » ou « Mon organisation »), vous pouvez en uploader de nouveaux au format Markdown (.md, 2 Mo maximum par fichier) et supprimer ceux qui ne sont plus à jour. L'upload de documents d'organisation est ouvert aux propriétaires et administrateurs ; les documents globaux sont réservés à l'équipe plateforme Baitly.

## Comment fonctionnent les cartes d'action et les niveaux d'autonomie ?

Baitly distingue trois niveaux d'autonomie pour ses agents IA (visibles dans les réglages du superviseur d'agents) : « Suggérer » (les agents proposent, vous décidez), « Agir puis notifier » (ils agissent et vous tiennent informé) et « Auto » (ils gèrent en pleine autonomie). En mode suggestion, les propositions apparaissent sous forme de cartes à valider : par exemple un ajustement tarifaire sur des créneaux creux, une relance de paiement échoué ou la planification d'un ménage manquant. Vous acceptez ou ignorez chaque carte. Dans le chat, quand vous confirmez plusieurs fois la même action, l'assistant peut vous proposer une « règle de confiance » pour ne plus redemander confirmation ; ces règles se gèrent dans les réglages d'autonomie (accepter, ignorer, révoquer). Un plafond mensuel de crédits encadre les actions proactives premium ; au plafond, vous choisissez entre « notifier seulement » ou mettre l'autonomie en pause.

## Que sont les briefings de l'assistant ?

L'assistant peut produire des briefings : des points de situation synthétiques sur votre activité, qui rassemblent en un seul message l'essentiel de ce qui vous attend — réservations à venir, arrivées et départs, opérations du jour (ménages, interventions), et points d'attention nécessitant une décision. Les réglages liés aux briefings se trouvent dans Paramètres, onglet « IA », section « Briefings ». Vous pouvez aussi simplement demander un point de situation dans le chat de l'assistant, par exemple « fais-moi un briefing de ma journée » ou « résume ce qui s'est passé cette semaine ».

## Questions fréquentes

**L'assistant peut-il modifier mes données sans mon accord ?**
Non par défaut : les actions sensibles exigent votre confirmation dans le chat. Une action ne devient automatique que si vous activez explicitement une règle de confiance ou un niveau d'autonomie supérieur dans les réglages.

**Combien d'images puis-je envoyer dans un message ?**
Jusqu'à 3 images par message, de 5 Mo maximum chacune, aux formats JPEG, PNG, GIF ou WebP.

**Comment ajouter mes propres documents à l'assistant ?**
Dans Paramètres, onglet IA, section Documentation : uploadez un fichier Markdown (.md, 2 Mo max). Il sera indexé pour votre organisation uniquement et l'assistant pourra le citer.

**L'assistant connaît-il la météo ?**
Oui, il peut consulter les prévisions météo d'une ville ainsi que les événements locaux, ce qui aide à anticiper la demande et planifier les opérations.

**Mon usage de l'IA est-il limité ?**
Oui, chaque organisation dispose d'un budget mensuel. Vous suivez votre consommation (tokens, coût) dans Paramètres, onglet IA, section Consommation, avec un seuil d'alerte configurable.
