-- Retrait de la cle de notification REVIEW_NEGATIVE_ALERT.
-- Son seul emetteur (ReviewAlertService) n'a jamais ete appele ; l'alerte sur un avis
-- sans reponse passe par la carte HITL de la constellation (SUPERVISION_SUGGESTION).
-- La colonne notification_key est un @Enumerated(EnumType.STRING) : une ligne portant
-- une valeur retiree de l'enum ferait echouer le chargement de toute la liste
-- (notifications d'un utilisateur, ses preferences). Aucune ne devrait exister — la cle
-- n'a jamais ete emise ni proposee dans l'ecran des preferences — mais on purge par surete.
DELETE FROM notifications WHERE notification_key = 'REVIEW_NEGATIVE_ALERT';
DELETE FROM notification_preferences WHERE notification_key = 'REVIEW_NEGATIVE_ALERT';
