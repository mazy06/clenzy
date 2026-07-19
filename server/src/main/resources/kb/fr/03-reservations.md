# Les réservations dans Baitly

## Comment créer une réservation manuelle ?

Ouvrez le menu Réservations puis cliquez sur Nouvelle réservation (vous pouvez aussi créer directement depuis le Planning en sélectionnant un créneau). L'assistant de création se déroule en quatre étapes : Logement & dates (choix de la propriété et des dates du séjour sur un calendrier deux mois), Voyageur (recherche d'un voyageur existant ou création d'une nouvelle fiche client avec prénom, nom, email, téléphone, nationalité, langue et notes), Tarif & prestations (prix de base par nuit, prix personnalisé, réduction en euros ou en pourcentage, ménage au départ avec frais de ménage, taxe de séjour par personne et par nuit, nombre de voyageurs dont enfants mineurs exonérés de taxe de séjour), puis Finalisation avec un récapitulatif (logement, dates, voyageur, total). Deux modes de validation existent : Confirmer maintenant, qui bloque le calendrier immédiatement, génère les codes d'accès et notifie le voyageur ; ou Demander le paiement, qui crée la réservation en attente et envoie un lien de paiement au voyageur, les dates n'étant bloquées qu'une fois le paiement reçu.

## Que signifient les statuts d'une réservation ?

Une réservation passe par plusieurs statuts au cours de son cycle de vie. En attente : la réservation est créée mais pas encore confirmée, par exemple dans l'attente d'un paiement ; les dates ne sont pas encore verrouillées. Confirmée : la réservation est validée, le calendrier est bloqué sur ces dates. Arrivé : le voyageur a fait son check-in, le séjour est en cours. Parti : le voyageur a fait son check-out, le séjour est terminé ; c'est ce départ qui peut déclencher automatiquement la demande de ménage. Annulée : la réservation a été annulée, les dates redeviennent disponibles. Le statut est visible sur la liste des réservations, sur la fiche de la réservation et sur les barres du Planning, avec un code couleur distinct par statut. Vous pouvez filtrer la liste des réservations par statut, par propriété, par source et par période.

## Comment gérer l'arrivée (check-in) et le départ (check-out) ?

Chaque réservation porte une date d'arrivée et une date de départ, ainsi que des heures d'arrivée et de départ. Par défaut, ces heures reprennent les horaires définis sur la fiche du logement, mais elles peuvent être ajustées réservation par réservation. Quand le voyageur arrive, la réservation passe au statut Arrivé ; à son départ, au statut Parti. Le départ est un moment clé pour l'exploitation : si l'automatisation est activée dans votre organisation, une demande de ménage est créée automatiquement à la date du check-out, à l'heure de départ par défaut du logement, puis assignée à une équipe (par affectation directe ou par zone géographique). Lors d'une réservation confirmée, des codes d'accès peuvent être générés et communiqués au voyageur pour les logements équipés de serrures connectées.

## Comment annuler une réservation ou gérer un no-show ?

Depuis la liste des réservations ou la fiche d'une réservation, utilisez l'action Annuler la réservation ; une confirmation vous est demandée avant l'annulation. Une fois annulée, la réservation passe au statut Annulée et les nuits concernées redeviennent disponibles à la vente sur le calendrier. Si un remboursement du voyageur est nécessaire (réservation directe déjà payée), il se gère depuis la partie paiements de la réservation, selon votre politique d'annulation. En cas de no-show (le voyageur ne se présente pas), il n'existe pas de statut dédié : selon votre pratique, laissez la réservation telle quelle (les nuits restent facturées) ou annulez-la pour libérer les dates restantes. Pour les réservations venant d'une plateforme externe (Airbnb, Booking.com), l'annulation doit être traitée sur le canal d'origine ; la synchronisation répercute ensuite la libération des dates dans Baitly.

## Quelle est la différence entre une réservation directe et une réservation OTA ?

Chaque réservation a une source, visible dans la liste et les filtres : Airbnb, Booking.com, Direct ou Autre. Une réservation directe est créée dans Baitly (manuellement ou via votre moteur de réservation en ligne) : vous maîtrisez le paiement, qui peut passer par un lien de paiement envoyé au voyageur. Une réservation OTA provient d'une plateforme externe, importée par synchronisation iCal (lecture seule) ou par channel manager (synchronisation bidirectionnelle des réservations, tarifs et disponibilités). Les réservations OTA sont considérées comme déjà encaissées sur le canal d'origine : Baitly les affiche comme payées et ne redemande pas de paiement au voyageur. Toutes les sources se retrouvent au même endroit : liste des réservations, planning et statistiques, avec un code couleur par canal sur le Planning.

## Qu'est-ce que la fiche voyageur et la fiche de police ?

Chaque réservation est rattachée à une fiche voyageur (fiche client) : nom, prénom, email, téléphone, nationalité, langue et notes. L'annuaire des voyageurs est accessible dans le menu Annuaire, onglet Voyageurs, avec recherche par nom, email ou téléphone. Lors de la création d'une réservation, recherchez un voyageur existant (deux caractères minimum) ou créez une nouvelle fiche à la volée. La fiche voyageur alimente aussi la fiche de police lorsque la réglementation locale l'exige : la réservation affiche le voyageur principal et ses accompagnants, avec un état Transmise ou À transmettre au téléservice, et une action Resoumettre en cas d'échec de transmission.

## Questions fréquentes

**Puis-je créer une réservation sans email du voyageur ?**
Oui pour une confirmation immédiate. En revanche, un email est requis si vous choisissez Demander le paiement, car le lien de paiement est envoyé à cette adresse.

**Pourquoi ma réservation ne se crée pas sur certaines dates ?**
Un conflit est détecté : les dates chevauchent une autre réservation, un ménage, une maintenance ou un blocage. Baitly empêche la création pour éviter tout surbooking.

**Une réservation en attente bloque-t-elle le calendrier ?**
Non. Les dates ne sont verrouillées qu'à la confirmation, c'est-à-dire immédiatement avec Confirmer maintenant, ou à réception du paiement avec Demander le paiement.

**Comment retrouver une réservation précise ?**
Utilisez la recherche et les filtres de la page Réservations : par propriété, statut, source (Airbnb, Booking.com, Direct, Autre) et période.
