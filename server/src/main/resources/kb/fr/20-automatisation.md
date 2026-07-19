# Automatisation dans Baitly

## Comment créer une règle d'automatisation ?

Le menu « Automatisations » centralise vos règles d'automatisation. Une règle associe un déclencheur à une action. Deux familles de déclencheurs existent. Les déclencheurs de cycle de vie de la réservation, planifiés avec un décalage en jours et une heure d'envoi : réservation confirmée, check-in qui approche, jour du check-in, jour du check-out, après le check-out, rappel d'avis. Et les déclencheurs événementiels, exécutés immédiatement : nouvelle réservation, réservation annulée, alerte bruit, paiement échoué, batterie de serrure critique, facture impayée, reversement en attente, relevé mensuel propriétaire, capteur hors ligne, disparité de prix entre canaux. Chaque règle peut être restreinte par des conditions cumulatives : propriétés ciblées, nombre de nuits minimum ou maximum, langue du voyageur. Vous activez ou désactivez chaque règle d'un clic, et un bouton « Activer les règles recommandées » installe en un clic un jeu de règles de départ. Chaque règle conserve un historique d'exécutions (réservation, voyageur, date, statut, erreur éventuelle).

## Comment envoyer des messages automatiques aux voyageurs ?

Les messages automatiques se configurent comme des règles d'automatisation avec une action de messagerie : envoyer un message (à partir d'un modèle de votre choix), envoyer le livret d'accueil, envoyer le lien de check-in en ligne, ou demander un avis après le séjour. Pour chaque règle de message, vous choisissez le canal d'envoi : email ou WhatsApp (le SMS n'est pas actif ; une regle configuree en SMS bascule sur l'email). Exemple courant : « Check-in qui approche, J-2 à 10h, envoyer le message de bienvenue par email » ou « Après le check-out, demander un avis ». Les modèles de messages se gèrent dans le module Documents & Communications (onglets Templates messages, Templates WhatsApp, Templates email) avec des variables remplacées automatiquement (nom du voyageur, dates, logement…). D'autres actions automatiques complètent la palette : créer une demande de ménage à chaque départ, annuler le ménage lié quand une réservation est annulée, créer une intervention de maintenance, notifier l'équipe, révoquer un code d'accès après le départ (avec un délai de grâce), relancer une facture impayée, envoyer le relevé mensuel au propriétaire, ou avertir un voyageur en cas d'alerte bruit.

## Comment fonctionnent les ajustements tarifaires automatiques (yield) ?

Le yield ajuste vos prix selon le remplissage. Il se configure dans la partie tarification (onglet Yield). Vous créez des règles d'occupation du type « si l'occupation est inférieure à 40 % à 30 jours, baisser de 5 % » ou « si l'occupation dépasse 85 %, augmenter », avec un plafonnement de l'ajustement par jour. Trois modes d'exécution existent : Simulation (rapport de ce qui aurait changé, aucune écriture tarifaire), Suggestion (les ajustements deviennent des propositions à approuver, recalculées au moment de l'application) et Automatique (application directe). Garde-fou essentiel : chaque bien doit avoir un prix plancher et un prix plafond ; sans ces deux bornes, le yield ignore le bien. Un interrupteur général active ou coupe le yield automatique, et un journal des ajustements trace chaque modification (nuit concernée, prix avant/après, occupation constatée, mode). Les suggestions tarifaires apparaissent aussi sous forme de cartes à valider, avec un aperçu sur deux mois et une simulation d'impact avant application.

## Cartes à valider ou application automatique : comment régler l'autonomie ?

Baitly emploie des agents spécialisés (Communication, Revenue, Opérations, Finance, Avis & Réputation) qui détectent des situations et proposent des actions. Par défaut, elles arrivent sous forme de cartes à valider : vous acceptez ou ignorez. Dans les réglages d'automatisation, vous pouvez passer certaines actions sûres en application automatique, avec deux niveaux : « Appliquer et notifier » ou « Appliquer en silence ». Les actions automatisables incluent : planifier un ménage manquant avant un départ, remplacer un prestataire de ménage désisté, préparer un brouillon de réponse à un avis négatif (la publication reste toujours à valider), ajuster les tarifs de créneaux creux (dans le cadre du yield, ampleur limitée), bloquer le calendrier après une escalade bruit avérée (plage courte, au plus un blocage par logement par semaine), libérer ou rembourser une caution après départ ou annulation (uniquement sans anomalie ouverte), et relancer un paiement échoué (première relance seulement, 72 h minimum entre deux relances). Chaque action affiche son taux d'acceptation sur 30 jours, et Baitly recommande le passage en automatique après plusieurs approbations consécutives. Le niveau de l'agent (Suggérer / Agir puis notifier / Auto) plafonne ce qui est possible, et des enveloppes de sécurité s'appliquent (pourcentage maximum par segment, durée maximale de blocage, délai après départ).

## Quelles relances automatiques Baitly gère-t-il ?

Plusieurs relances fonctionnent sans intervention manuelle. Relance de panier abandonné : un voyageur qui n'a pas finalisé sa réservation sur votre site de réservation en ligne peut être relancé automatiquement. Relance de paiement différé ou échoué : quand un solde programmé échoue, un nouveau lien de paiement est régénéré et envoyé au voyageur (en automatique pour la première relance si vous l'avez activé, à valider ensuite). Relance de facture impayée : une règle d'automatisation sur le déclencheur « Facture impayée » envoie la relance ou notifie votre équipe. À cela s'ajoutent les campagnes promotionnelles automatiques (« Promos & Vouchers ») : des campagnes de remise applicables automatiquement aux nuitées dans le moteur de réservation, selon les conditions que vous définissez. L'onglet « Automatisations système » du hub, en lecture seule, récapitule par ailleurs les automatisations gérées ailleurs dans le produit, avec leur statut réel, pour une visibilité d'ensemble.

## Questions fréquentes

**Une action d'argent peut-elle être entièrement automatique ?**
Les libérations et remboursements de caution ne concernent que la levée d'une empreinte bancaire (aucun débit) et exigent l'absence d'anomalie ouverte. Les suggestions de blocage de calendrier et de remboursement issues des règles restent toujours des propositions à valider par défaut.

**Comment tester une règle de yield sans toucher mes prix ?**
Utilisez le mode Simulation : Baitly produit un rapport de ce qui aurait changé, sans aucune écriture tarifaire. Passez ensuite en Suggestion, puis en Automatique quand vous êtes en confiance.

**Pourquoi le yield ignore-t-il un de mes logements ?**
Le plancher et le plafond de prix sont obligatoires pour chaque bien : sans les deux bornes, le yield saute le logement. Renseignez-les dans les garde-fous par bien.

**Puis-je limiter un message automatique à certains logements ?**
Oui : chaque règle accepte des conditions — propriétés ciblées, nombre de nuits minimum/maximum du séjour, langue du voyageur.

**Comment savoir ce qu'une règle a réellement fait ?**
Ouvrez la règle et consultez son historique d'exécutions (réservation, voyageur, date, statut, erreur éventuelle). Pour le yield, le journal des ajustements trace chaque prix modifié avant/après.
