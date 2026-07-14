-- Constellation : rattache une entree de journal a un message envoye.
-- Pose uniquement pour les envois de message guest (SEND_MESSAGE et derives) afin de
-- pouvoir previsualiser a la demande le contenu du message (endpoint
-- /guest-messaging/preview/{logId}). NULL pour toutes les autres activites.
ALTER TABLE supervision_activity
    ADD COLUMN IF NOT EXISTS message_log_id BIGINT;

COMMENT ON COLUMN supervision_activity.message_log_id IS
    'Reference optionnelle vers guest_message_log (envois de message uniquement). NULL sinon';
