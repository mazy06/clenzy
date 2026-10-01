# Illustrations des actions Baitly

Copies autonomes des images déjà générées pour les cartes HITL et les notifications.
Elles appartiennent au site marketing et sont importées par `site/data/actionArtwork.ts` :
Vite les publie avec une empreinte de contenu. Aucune URL, API ou bibliothèque du PMS
n'est nécessaire pour les afficher. Les originaux du PMS ne sont pas modifiés.

| Fichier | Scénario de l'accueil | Origine de la copie |
| --- | --- | --- |
| message-sent.webp | Message d'accueil préparé | client/public/images/notifications |
| pricing-optimization.webp | Ajustement des nuits creuses | client/public/images/hitl |
| cleaning.webp | Ménage replanifié | client/public/images/hitl |
| traveler-form.webp | Enregistrement du voyageur | client/public/images/hitl |
| channel-sync.webp | Synchronisation des disponibilités | client/public/images/hitl |
| payment-confirmed.webp | Paiement confirmé | client/public/images/notifications |
| late-checkout.webp | Départ tardif vendu | client/public/images/hitl |
| reviews.webp | Avis et réponse | client/public/images/hitl |
| owner-report.webp | Relevé propriétaire | client/public/images/hitl |
| reservation.webp | Réservation directe | client/public/images/notifications |
| access-code.webp | Code d'entrée généré | client/public/images/notifications |

Les images sont décoratives : le texte de chaque carte décrit déjà l'action.
Leur emplacement reste réservé dès le HTML initial, y compris sur mobile.
