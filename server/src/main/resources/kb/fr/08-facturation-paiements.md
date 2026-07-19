# Facturation et paiements (Stripe, factures, commissions, reversements)

## Où gérer la facturation et les paiements dans Baitly ?

La page Facturation du menu regroupe tout l'argent de votre activité : onglets Paiements, Factures, Reversements, Dépenses, Versements prestataires, Rapports & Exports et Exports comptables. L'historique des paiements liste chaque transaction avec son statut (payé, en attente, échoué, remboursé), des totaux (encaissé, en attente, remboursé) et des filtres par période, statut ou hôte. La page Factures présente vos factures (ou notes) avec leurs statistiques et permet de les émettre, les marquer payées ou télécharger le PDF. Les contrats de gestion, qui déterminent qui encaisse et quelle commission s'applique, ont leur propre page Contrats de gestion. Les fournisseurs de paiement se configurent dans Paramètres, onglet Paiement (réservé aux administrateurs).

## Comment mes voyageurs paient-ils une réservation directe ?

Sur le moteur de réservation direct, le voyageur paie en ligne par carte via un paiement sécurisé (Stripe). La réservation est créée en attente puis confirmée automatiquement au paiement : facture générée, email de confirmation envoyé, dates bloquées sur les canaux. Vous pouvez aussi encaisser sans passer par le site : lors de la création manuelle d'une réservation, choisissez « Créer & envoyer le lien de paiement » — le voyageur reçoit par email un lien de paiement sécurisé, et les dates se bloquent définitivement une fois le paiement effectué. Pour un paiement différé (acompte à la réservation puis solde plus tard), des rappels automatiques existent : en cas de solde différé en échec ou en retard, un nouveau lien de paiement peut être régénéré et envoyé automatiquement au voyageur.

## Comment fonctionnent les factures (numérotation, statuts, avoirs) ?

Les factures Baitly suivent un cycle : Brouillon, Émise, Payée, Annulée. La numérotation est séquentielle et sans trou, conforme aux exigences fiscales françaises : une fois émise, une facture est inviolable — elle ne peut plus être modifiée. Pour corriger une facture émise, on crée un avoir (note de crédit) qui l'annule ou la rectifie comptablement. Chaque facture porte les mentions légales, les coordonnées vendeur et acheteur, et les montants HT, TVA et TTC. Le PDF est téléchargeable depuis la page Factures. Une facture est générée automatiquement quand une réservation directe est payée. Des relances peuvent être émises pour les factures arrivées à échéance. Il existe aussi des factures de commission, émises par la conciergerie vers le propriétaire dans le cadre d'un contrat de gestion.

## Pourquoi ma réservation Airbnb ou Booking est-elle marquée « payée » ?

Les réservations importées d'une plateforme (Airbnb, Booking.com, Vrbo...) ont déjà été encaissées par cette plateforme : le voyageur a payé sur le canal, et le canal vous reverse le montant selon ses propres règles. Baitly ne touche pas à ce flux d'argent : la réservation est donc affichée comme payée dès son import, et une facture correspondante est générée automatiquement pour votre comptabilité. Ne tentez pas de ré-encaisser un séjour OTA via un lien de paiement : seul le montant dû en direct (par exemple une option vendue en plus, ou la taxe de séjour si le canal ne la collecte pas) peut faire l'objet d'un encaissement complémentaire.

## Qui encaisse l'argent ? Contrats de gestion et commission

La page Contrats de gestion définit, pour chaque logement, le contrat entre propriétaire et conciergerie : type de gestion, taux de commission (pourcentage total retenu sur les revenus), période, séjour minimum, préavis, renouvellement automatique, ménage et maintenance inclus. Le mode d'encaissement du contrat pilote la répartition automatique des revenus : encaissement direct par la plateforme, encaissement par le propriétaire, encaissement par la conciergerie, ou partage co-hôte sur les canaux OTA. Un aperçu montre la répartition entre propriétaire, plateforme et conciergerie. À la création, un lien de signature électronique est envoyé au propriétaire par email ; une fois le contrat activé, la répartition s'applique automatiquement aux paiements. Sans contrat, les paiements sont répartis en deux parts (propriétaire et plateforme). Les reversements aux propriétaires suivent un cycle en attente, approuvé, payé, avec un calendrier de reversement configurable et des relevés propriétaires.

## Comment gérer remboursements et caution ?

Un paiement encaissé peut être remboursé ; il apparaît alors avec le statut « remboursé » dans l'historique des paiements et le total remboursé est suivi sur la période. Côté caution, Baitly utilise une empreinte bancaire (pré-autorisation) plutôt qu'un débit : aucun montant n'est prélevé tant qu'il n'y a pas de dommage. Des automatisations peuvent libérer la caution automatiquement après le départ du voyageur, ou la relâcher après une annulation — dans les deux cas sans débit. Pour votre comptabilité, la page Facturation propose des exports : rapports comptables, exports CSV et export FEC (fichier des écritures comptables pour l'administration fiscale française) ; une synchronisation avec l'outil comptable Pennylane est également disponible.

## Questions fréquentes

**Puis-je modifier une facture déjà émise ?**
Non. Une facture émise est inviolable ; corrigez-la en créant un avoir, puis émettez une nouvelle facture si nécessaire.

**Comment encaisser un voyageur qui réserve par téléphone ?**
Créez la réservation manuellement et choisissez l'envoi d'un lien de paiement : le voyageur paie en ligne et la réservation se confirme automatiquement.

**Pourquoi je ne vois pas d'argent encaissé pour mes réservations Airbnb ?**
Le voyageur a payé Airbnb, qui vous reverse directement le montant. Baitly marque la réservation payée et génère la facture, mais n'encaisse pas ce flux.

**Où est définie ma commission de conciergerie ?**
Dans le contrat de gestion du logement : le taux de commission et le mode d'encaissement y déterminent la répartition automatique entre propriétaire, conciergerie et plateforme.

**La caution est-elle débitée au voyageur ?**
Non, c'est une empreinte bancaire. Elle est libérée automatiquement après le départ (ou après annulation) si rien n'est retenu.
