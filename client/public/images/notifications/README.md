# Vignettes des notifications Baitly

Bibliothèque locale générée avec l’outil intégré Imagegen, mode génération, le 1er octobre 2026.
31 images dans ce dossier, complétées par les 42 images HITL partagées.
La dernière passe ajoute 23 scènes distinctes et remplace l’image ambiguë d’échec d’envoi.

## Choix sémantique

La vignette dépend de l’événement précis, puis de l’action HITL pour les événements de supervision.
Une catégorie ou un agent n’est qu’un repli.

- Demande sans prestataire : recherche d’une personne, distincte d’une équipe assignée.
- Créneaux creux : calendrier et pourcentage ; hausse : flèche ascendante.
- Promotion désactivée : étiquette et interrupteur ; écart de tarif : comparaison et alerte.
- Paiement confirmé, échec, remboursement et relance disposent de scènes distinctes.
- Réservation annulée, prestation annulée, refusée ou urgente ont leurs propres visuels.
- Incident ouvert/rétabli, synchronisation réussie/échouée et bruit/retour au calme sont séparés.
- Réservation sans logement associé ne réutilise plus l’image d’une surréservation.

Les 152 clés serveur sont couvertes. Les événements d’une même famille peuvent conserver
une image neutre commune (création/modification d’un logement, par exemple).
Le titre et les faits restent la source d’information ; aucun code, montant ou date
n’est inventé dans l’image. Une coche n’est associée qu’à une réussite explicite.

## Historique et cohérence HITL

Le même sélecteur structuré choisit l’image dans la carte, la modale et sa notification.
Les anciennes notifications récupèrent leur type d’action, scanner et sens tarifaire
depuis leur carte, par lecture groupée et vérification d’organisation. Les faits déjà
émis restent prioritaires ; aucune réécriture en base. Une carte supprimée ou inaccessible
ne fournit aucun fait. Cette amélioration de l’historique nécessite la nouvelle version serveur.

PRICE_DROP utilise le champ direction (up/down). YIELD_PRICE_ADJUST utilise le signe du
pourcentage. On ne déduit pas le sens d’un titre traduit.
Les réassorts gardent leur photo d’article, avec leur bibliothèque spécifique.

## Correspondances explicites

| Notification | Vignette |
| --- | --- |
| PROPERTY_CREATED | [Logement et portefeuille](property.webp) |
| PROPERTY_UPDATED | [Logement et portefeuille](property.webp) |
| PROPERTY_DELETED | [Logement et portefeuille](property.webp) |
| PROPERTY_STATUS_CHANGED | [Logement et portefeuille](property.webp) |
| PORTFOLIO_CREATED | [Logement et portefeuille](property.webp) |
| PORTFOLIO_CLIENT_ADDED | [Logement et portefeuille](property.webp) |
| PORTFOLIO_CLIENT_REMOVED | [Logement et portefeuille](property.webp) |
| PORTFOLIO_UPDATED | [Logement et portefeuille](property.webp) |
| TEAM_CREATED | [Gestion d’équipe](team-directory.webp) |
| TEAM_UPDATED | [Gestion d’équipe](team-directory.webp) |
| TEAM_DELETED | [Gestion d’équipe](team-directory.webp) |
| TEAM_MEMBER_ADDED | [Gestion d’équipe](team-directory.webp) |
| TEAM_MEMBER_REMOVED | [Gestion d’équipe](team-directory.webp) |
| TEAM_ROLE_CHANGED | [Gestion d’équipe](team-directory.webp) |
| TEAM_MEMBER_JOINED | [Gestion d’équipe](team-directory.webp) |
| PORTFOLIO_TEAM_MEMBER_ADDED | [Gestion d’équipe](team-directory.webp) |
| PORTFOLIO_TEAM_MEMBER_REMOVED | [Gestion d’équipe](team-directory.webp) |
| INTERVENTION_ASSIGNED_TO_USER | [Équipe affectée](team-assigned.webp) |
| INTERVENTION_ASSIGNED_TO_TEAM | [Équipe affectée](team-assigned.webp) |
| SERVICE_REQUEST_ASSIGNED | [Équipe affectée](team-assigned.webp) |
| SERVICE_REQUEST_TEAM_ASSIGNED | [Équipe affectée](team-assigned.webp) |
| SERVICE_REQUEST_NO_TEAM_AVAILABLE | [Recherche de prestataire](../hitl/provider-search.webp) |
| TEAM_ASSIGNED_INTERVENTION | [Équipe affectée](team-assigned.webp) |
| CONVERSATION_ASSIGNED | [Équipe affectée](team-assigned.webp) |
| USER_CREATED | [Profil et compte utilisateur](user-profile.webp) |
| USER_UPDATED | [Profil et compte utilisateur](user-profile.webp) |
| USER_DELETED | [Profil et compte utilisateur](user-profile.webp) |
| USER_ROLE_CHANGED | [Profil et compte utilisateur](user-profile.webp) |
| USER_DEACTIVATED | [Profil et compte utilisateur](user-profile.webp) |
| MARKETPLACE_APPLICATION_RECEIVED | [Profil et compte utilisateur](user-profile.webp) |
| GDPR_DATA_EXPORTED | [Protection des données](../hitl/privacy.webp) |
| GDPR_USER_ANONYMIZED | [Protection des données](../hitl/privacy.webp) |
| GDPR_CONSENTS_UPDATED | [Protection des données](../hitl/privacy.webp) |
| PERMISSION_ROLE_UPDATED | [Sécurité et fraude](../hitl/security.webp) |
| PERMISSION_CACHE_INVALIDATED | [Sécurité et fraude](../hitl/security.webp) |
| BOOKING_FRAUD_REVIEW | [Sécurité et fraude](../hitl/security.webp) |
| IOT_MOTION_DETECTED | [Sécurité et fraude](../hitl/security.webp) |
| CONTACT_MESSAGE_SENT | [Message envoyé](message-sent.webp) |
| GUEST_MESSAGE_SENT | [Message envoyé](message-sent.webp) |
| CONTACT_MESSAGE_REPLIED | [Message envoyé](message-sent.webp) |
| DOCUMENT_SENT_BY_EMAIL | [Message envoyé](message-sent.webp) |
| CONTACT_MESSAGE_RECEIVED | [Message reçu](message-received.webp) |
| CONVERSATION_NEW_MESSAGE | [Message reçu](message-received.webp) |
| GUEST_MESSAGE_FAILED | [Échec d’envoi du message](message-delivery.webp) |
| MARKETPLACE_INVITATION_FAILED | [Échec d’envoi du message](message-delivery.webp) |
| DOCUMENT_GENERATED | [Documents et formulaires](document.webp) |
| DOCUMENT_GENERATION_FAILED | [Échec de génération du document](document-error.webp) |
| DOCUMENT_TEMPLATE_UPLOADED | [Documents et formulaires](document.webp) |
| CONTACT_FORM_RECEIVED | [Documents et formulaires](document.webp) |
| CONTACT_FORM_STATUS_CHANGED | [Documents et formulaires](document.webp) |
| CONTACT_MESSAGE_ARCHIVED | [Documents et formulaires](document.webp) |
| MARKETPLACE_APPLICATION_DOCUMENTS_ADDED | [Documents et formulaires](document.webp) |
| CONCIERGE_ESCALATION | [Communication voyageurs](../hitl/conversation.webp) |
| ACCESS_CODE_ROTATED | [Digicode et code d’accès](access-code.webp) |
| SMART_LOCK_CODE_ROTATED_MANUALLY | [Digicode et code d’accès](access-code.webp) |
| SMART_LOCK_CODE_GENERATION_FAILED | [Problème de code d’accès](access-problem.webp) |
| SMART_LOCK_CODE_DELIVERY_FAILED | [Problème de code d’accès](access-problem.webp) |
| GUEST_DOOR_UNLOCKED | [Ouverture de porte](door-access.webp) |
| RESERVATION_CREATED | [Réservation](reservation.webp) |
| RESERVATION_UPDATED | [Réservation](reservation.webp) |
| RESERVATION_CANCELLED | [Réservation annulée](reservation-cancelled.webp) |
| BOOKING_INQUIRY_RECEIVED | [Réservation](reservation.webp) |
| CHANNEX_AIRBNB_REQUEST | [Réservation](reservation.webp) |
| SERVICE_REQUEST_CREATED | [Demande de service](service-request.webp) |
| SERVICE_REQUEST_UPDATED | [Demande de service](service-request.webp) |
| SERVICE_REQUEST_APPROVED | [Demande de service](service-request.webp) |
| SERVICE_REQUEST_REJECTED | [Demande refusée](request-rejected.webp) |
| SERVICE_REQUEST_CANCELLED | [Prestation annulée](request-cancelled.webp) |
| SERVICE_REQUEST_URGENT | [Demande urgente ou escaladée](request-urgent.webp) |
| SERVICE_REQUEST_ESCALATION | [Demande urgente ou escaladée](request-urgent.webp) |
| ISSUE_REPORTED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| ISSUE_CONVERTED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| SERVICE_REQUEST_INTERVENTION_CREATED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_CREATED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_UPDATED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_STARTED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_PROGRESS_UPDATED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_REOPENED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_STATUS_CHANGED | [Entretien préventif du logement](../hitl/property-maintenance.webp) |
| INTERVENTION_CANCELLED | [Prestation annulée](request-cancelled.webp) |
| INTERVENTION_DELETED | [Prestation annulée](request-cancelled.webp) |
| INTERVENTION_COMPLETED | [Intervention terminée](intervention-completed.webp) |
| INTERVENTION_VALIDATED | [Intervention terminée](intervention-completed.webp) |
| INTERVENTION_AWAITING_VALIDATION | [Contrôle des interventions](../hitl/work-review.webp) |
| INTERVENTION_PHOTOS_ADDED | [Contrôle des interventions](../hitl/work-review.webp) |
| INTERVENTION_NOTES_UPDATED | [Contrôle des interventions](../hitl/work-review.webp) |
| INTERVENTION_OVERDUE | [Intervention en retard](intervention-overdue.webp) |
| INTERVENTION_REMINDER | [Affectation des interventions](../hitl/assignment.webp) |
| PAYMENT_SESSION_CREATED | [Paiement et relance](../hitl/payment.webp) |
| PAYMENT_CONFIRMED | [Paiement confirmé](payment-confirmed.webp) |
| PAYMENT_FAILED | [Paiement échoué](payment-failed.webp) |
| PAYMENT_GROUPED_SESSION_CREATED | [Paiement et relance](../hitl/payment.webp) |
| PAYMENT_GROUPED_CONFIRMED | [Paiement confirmé](payment-confirmed.webp) |
| PAYMENT_GROUPED_FAILED | [Paiement échoué](payment-failed.webp) |
| PAYMENT_DEFERRED_REMINDER | [Relance de paiement](../hitl/payment-reminder.webp) |
| PAYMENT_DEFERRED_OVERDUE | [Relance de paiement](../hitl/payment-reminder.webp) |
| PAYMENT_REFUND_INITIATED | [Remboursement](../hitl/refund.webp) |
| PAYMENT_REFUND_COMPLETED | [Remboursement](../hitl/refund.webp) |
| INTERVENTION_AWAITING_PAYMENT | [Paiement et relance](../hitl/payment.webp) |
| PAYOUT_FAILED | [Paiement échoué](payment-failed.webp) |
| PAYOUT_SENT | [Reversement prestataire / conciergerie](../hitl/service-transfer.webp) |
| PAYOUT_BLOCKED_ONBOARDING | [Reversement bloqué](payout-blocked.webp) |
| PAYOUT_BATCH_GENERATED | [Reversement propriétaire](../hitl/owner-transfer.webp) |
| PAYOUT_PENDING_APPROVAL | [Reversement propriétaire](../hitl/owner-transfer.webp) |
| PAYOUT_APPROVED | [Reversement propriétaire](../hitl/owner-transfer.webp) |
| PAYOUT_EXECUTED | [Reversement propriétaire](../hitl/owner-transfer.webp) |
| PAYOUT_CONFIG_SUBMITTED | [Reversement propriétaire](../hitl/owner-transfer.webp) |
| PAYOUT_CONFIG_VERIFIED | [Reversement propriétaire](../hitl/owner-transfer.webp) |
| PAYMENT_INCIDENT_OPENED | [Litige de paiement](../hitl/dispute.webp) |
| CONTRACT_SIGNED | [Mandat de gestion](../hitl/management-contract.webp) |
| ICAL_IMPORT_SUCCESS | [Synchronisation des canaux](../hitl/channel-sync.webp) |
| ICAL_IMPORT_PARTIAL | [Synchronisation à réparer](../hitl/sync-problem.webp) |
| ICAL_IMPORT_FAILED | [Synchronisation à réparer](../hitl/sync-problem.webp) |
| ICAL_SYNC_COMPLETED | [Synchronisation des canaux](../hitl/channel-sync.webp) |
| ICAL_FEED_DELETED | [Synchronisation des canaux](../hitl/channel-sync.webp) |
| CHANNEX_SYNC_ERROR | [Synchronisation à réparer](../hitl/sync-problem.webp) |
| CHANNEX_SYNC_RECOVERED | [Synchronisation des canaux](../hitl/channel-sync.webp) |
| CHANNEX_SYNC_WARNING | [Synchronisation à réparer](../hitl/sync-problem.webp) |
| CHANNEX_CHANNEL_EVENT | [Publication et qualité des annonces](../hitl/distribution.webp) |
| CHANNEX_UNMAPPED_BOOKING | [Réservation sans logement associé](booking-unmapped.webp) |
| CHANNEX_PRICE_DRIFT_DETECTED | [Écart ou erreur de tarif](../hitl/pricing-alert.webp) |
| CHANNEX_RATE_ERROR | [Écart ou erreur de tarif](../hitl/pricing-alert.webp) |
| GUEST_PRICING_PUSHED | [Tarification et revenus](../hitl/pricing.webp) |
| CHANNEX_RESTRICTION_DRIFT_DETECTED | [Gestion du calendrier](../hitl/calendar.webp) |
| ICAL_AUTO_INTERVENTIONS_TOGGLED | [Automatisation et assistant](automation.webp) |
| AI_MODEL_EOL | [Automatisation et assistant](automation.webp) |
| KB_INDEX_RETUNE | [Automatisation et assistant](automation.webp) |
| SUPERVISION_AUTO_APPLIED | [Automatisation et assistant](automation.webp) |
| SUPERVISION_AUTO_RULE_SUGGESTED | [Automatisation et assistant](automation.webp) |
| AUTOMATION_STAFF_ALERT | [Automatisation et assistant](automation.webp) |
| VISION_USAGE_THRESHOLD_REACHED | [Automatisation et assistant](automation.webp) |
| RECONCILIATION_COMPLETED | [État des services techniques](system-health.webp) |
| RECONCILIATION_DIVERGENCE_HIGH | [Incident technique](system-incident.webp) |
| RECONCILIATION_FAILED | [Incident technique](system-incident.webp) |
| KPI_THRESHOLD_BREACH | [Incident technique](system-incident.webp) |
| KPI_CRITICAL_FAILURE | [Incident technique](system-incident.webp) |
| INCIDENT_OPENED | [Incident technique](system-incident.webp) |
| INCIDENT_RESOLVED | [Service rétabli](system-restored.webp) |
| WEBHOOK_DELIVERY_FAILED | [Incident technique](system-incident.webp) |
| OPS_ALERT | [Incident technique](system-incident.webp) |
| BRIEFING_READY | [Rapport au propriétaire](../hitl/owner-report.webp) |
| GUEST_NO_EMAIL_FOR_CHECKIN | [Fiche voyageur et déclaration](../hitl/traveler-form.webp) |
| ONLINE_CHECKIN_STARTED | [Fiche voyageur et déclaration](../hitl/traveler-form.webp) |
| ONLINE_CHECKIN_COMPLETED | [Fiche voyageur et déclaration](../hitl/traveler-form.webp) |
| NOISE_ALERT_WARNING | [Nuisances sonores](../hitl/noise.webp) |
| NOISE_ALERT_CRITICAL | [Nuisances sonores](../hitl/noise.webp) |
| NOISE_ALERT_RESOLVED | [Retour au calme](noise-resolved.webp) |
| NOISE_ALERT_CONFIG_CHANGED | [Nuisances sonores](../hitl/noise.webp) |
| REVIEW_RECEIVED | [Avis voyageurs](../hitl/reviews.webp) |
| REVIEW_NEGATIVE_ALERT | [Avis négatif à traiter](review-negative.webp) |
| IOT_SMOKE_DETECTED | [Détection de fumée](smoke-alert.webp) |

SUPERVISION_SUGGESTION sélectionne l’action liée, puis un repli lié à l’agent.

## Fichiers et validation

Images WebP 320 × 320, chargées à la demande avec dimensions réservées.
La liste les affiche à 48 px, le détail à 64 px. Les erreurs de chargement préservent la place.

- [Prompts exacts](prompts.json), [sources originales et poids](sources.json).
- [Correspondances](../../../src/modules/notifications/notificationVisual.ts).
- [Sélecteur HITL partagé](../../../src/modules/supervision/core/actionIllustration.ts).
- [Tests](../../../src/modules/notifications/__tests__/notificationVisual.test.tsx).

Les PNG originaux restent à leur emplacement de génération. Seuls le redimensionnement
et la conversion WebP ont été appliqués. Les tests couvrent les couples de situations
opposées, la cohérence HITL/notification, les ressources locales et les replis.

Validation de cette passe : 142 tests frontend et 53 tests serveur réussis ; TypeScript
et build Vite réussis. Écran existant contrôlé à 375, 768, 1024 et 1440 px :
images chargées, dimensions réservées, aucun débordement horizontal.
Les notifications automatiques nouvelles conservent aussi leur carte ou type d’action.
