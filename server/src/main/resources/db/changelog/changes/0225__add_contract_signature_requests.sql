-- ============================================================================
-- 0225 : Signature électronique interne (SES) du contrat de gestion
-- ----------------------------------------------------------------------------
-- À la création d'un contrat de gestion, le propriétaire reçoit un email avec
-- un lien public /sign/{token} : consultation du mandat PDF + signature simple
-- (nom + consentement). À la signature : preuve enregistrée (IP, user-agent,
-- horodatage, SHA-256 du PDF, nom saisi) et contrat activé (DRAFT → ACTIVE).
--
-- 1. Table contract_signature_requests (une demande par contrat, token UUID)
-- 2. Seed du template email contract_signature_request (wrapper INVITATION)
-- 3. CHECK notifications réaligné : + CONTRACT_SIGNED (liste 0224 + 1 clé)
-- ============================================================================

CREATE TABLE contract_signature_requests (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    contract_id BIGINT NOT NULL REFERENCES management_contracts(id) ON DELETE CASCADE,
    -- Épingle la génération exacte du mandat présentée au signataire : le hash
    -- prouvé est celui du PDF affiché, pas « la dernière génération ».
    document_generation_id BIGINT REFERENCES document_generations(id) ON DELETE SET NULL,
    token UUID NOT NULL UNIQUE,
    signer_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SIGNED', 'CANCELLED')),
    expires_at TIMESTAMP NOT NULL,
    -- Dossier de preuve (SES eIDAS art. 25)
    signed_at TIMESTAMP,
    signed_by_name VARCHAR(255),
    signer_ip VARCHAR(64),
    signer_user_agent VARCHAR(512),
    document_sha256 VARCHAR(64),
    consent_text TEXT,
    -- PDF tamponné (original + page certificat de signature), servi après signature.
    signed_document_path VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_csr_contract ON contract_signature_requests (contract_id);
-- Une seule demande PENDING par contrat (resend réutilise ou remplace).
CREATE UNIQUE INDEX uq_csr_pending_per_contract
    ON contract_signature_requests (contract_id)
    WHERE status = 'PENDING';

-- ─── Template email « lien de signature » (éditable dans Documents & Communication) ──
INSERT INTO system_email_template
    (organization_id, template_key, language, recipient_type, subject, body, is_system, wrapper_style)
SELECT
    NULL, 'contract_signature_request', 'fr', 'OWNER',
    'Votre mandat de gestion {contractNumber} est prêt à signer',
    E'Bonjour {ownerName},\n\nVotre mandat de gestion pour le logement *{propertyName}* est prêt.\n\nIl récapitule les conditions convenues : commission de *{commissionRate}*, à compter du {startDate}.\n\nPour le consulter et le signer électroniquement, cliquez sur le bouton ci-dessous :\n\n[CONSULTER ET SIGNER LE CONTRAT → {signingLink}]\n\nLa signature ne prend qu''une minute : vérifiez le document, saisissez votre nom et validez. Le contrat prendra effet immédiatement après votre signature.\n\nCe lien expire le {expiresAt}. Si vous n''êtes pas à l''origine de cette demande, ignorez simplement ce message.',
    true, 'INVITATION'
WHERE NOT EXISTS (
    SELECT 1 FROM system_email_template
    WHERE template_key = 'contract_signature_request'
      AND language = 'fr'
      AND organization_id IS NULL
);

-- ─── CHECK notifications : liste intégrale 0224 + CONTRACT_SIGNED ───────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_key_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_key_check
CHECK (notification_key IN (
    'INTERVENTION_CREATED',
    'INTERVENTION_UPDATED',
    'INTERVENTION_ASSIGNED_TO_USER',
    'INTERVENTION_ASSIGNED_TO_TEAM',
    'INTERVENTION_STARTED',
    'INTERVENTION_PROGRESS_UPDATED',
    'INTERVENTION_COMPLETED',
    'INTERVENTION_REOPENED',
    'INTERVENTION_STATUS_CHANGED',
    'INTERVENTION_VALIDATED',
    'INTERVENTION_AWAITING_VALIDATION',
    'INTERVENTION_AWAITING_PAYMENT',
    'INTERVENTION_CANCELLED',
    'INTERVENTION_DELETED',
    'INTERVENTION_PHOTOS_ADDED',
    'INTERVENTION_NOTES_UPDATED',
    'INTERVENTION_OVERDUE',
    'INTERVENTION_REMINDER',
    'SERVICE_REQUEST_CREATED',
    'SERVICE_REQUEST_UPDATED',
    'SERVICE_REQUEST_APPROVED',
    'SERVICE_REQUEST_REJECTED',
    'SERVICE_REQUEST_INTERVENTION_CREATED',
    'SERVICE_REQUEST_ASSIGNED',
    'SERVICE_REQUEST_CANCELLED',
    'SERVICE_REQUEST_URGENT',
    'SERVICE_REQUEST_NO_TEAM_AVAILABLE',
    'SERVICE_REQUEST_ESCALATION',
    'SERVICE_REQUEST_TEAM_ASSIGNED',
    'PAYMENT_SESSION_CREATED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_FAILED',
    'PAYMENT_GROUPED_SESSION_CREATED',
    'PAYMENT_GROUPED_CONFIRMED',
    'PAYMENT_GROUPED_FAILED',
    'PAYMENT_DEFERRED_REMINDER',
    'PAYMENT_DEFERRED_OVERDUE',
    'PAYMENT_REFUND_INITIATED',
    'PAYMENT_REFUND_COMPLETED',
    'ICAL_IMPORT_SUCCESS',
    'ICAL_IMPORT_PARTIAL',
    'ICAL_IMPORT_FAILED',
    'ICAL_SYNC_COMPLETED',
    'ICAL_FEED_DELETED',
    'ICAL_AUTO_INTERVENTIONS_TOGGLED',
    'CHANNEX_SYNC_ERROR',
    'CHANNEX_SYNC_RECOVERED',
    'CHANNEX_PRICE_DRIFT_DETECTED',
    'AI_MODEL_EOL',
    'TEAM_CREATED',
    'TEAM_UPDATED',
    'TEAM_DELETED',
    'TEAM_MEMBER_ADDED',
    'TEAM_MEMBER_REMOVED',
    'TEAM_ASSIGNED_INTERVENTION',
    'TEAM_ROLE_CHANGED',
    'TEAM_MEMBER_JOINED',
    'PORTFOLIO_CREATED',
    'PORTFOLIO_CLIENT_ADDED',
    'PORTFOLIO_CLIENT_REMOVED',
    'PORTFOLIO_TEAM_MEMBER_ADDED',
    'PORTFOLIO_TEAM_MEMBER_REMOVED',
    'PORTFOLIO_UPDATED',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'USER_ROLE_CHANGED',
    'USER_DEACTIVATED',
    'GDPR_DATA_EXPORTED',
    'GDPR_USER_ANONYMIZED',
    'GDPR_CONSENTS_UPDATED',
    'PERMISSION_ROLE_UPDATED',
    'PERMISSION_CACHE_INVALIDATED',
    'PROPERTY_CREATED',
    'PROPERTY_UPDATED',
    'PROPERTY_DELETED',
    'PROPERTY_STATUS_CHANGED',
    'CONTACT_MESSAGE_RECEIVED',
    'CONTACT_MESSAGE_SENT',
    'CONTACT_MESSAGE_REPLIED',
    'CONTACT_MESSAGE_ARCHIVED',
    'CONTACT_FORM_RECEIVED',
    'CONTACT_FORM_STATUS_CHANGED',
    'DOCUMENT_GENERATED',
    'DOCUMENT_GENERATION_FAILED',
    'DOCUMENT_TEMPLATE_UPLOADED',
    'DOCUMENT_SENT_BY_EMAIL',
    'CONTRACT_SIGNED',
    'RECONCILIATION_COMPLETED',
    'RECONCILIATION_DIVERGENCE_HIGH',
    'RECONCILIATION_FAILED',
    'KPI_THRESHOLD_BREACH',
    'KPI_CRITICAL_FAILURE',
    'INCIDENT_OPENED',
    'INCIDENT_RESOLVED',
    'GUEST_MESSAGE_SENT',
    'GUEST_MESSAGE_FAILED',
    'GUEST_PRICING_PUSHED',
    'GUEST_NO_EMAIL_FOR_CHECKIN',
    'ACCESS_CODE_ROTATED',
    'GUEST_DOOR_UNLOCKED',
    'NOISE_ALERT_WARNING',
    'NOISE_ALERT_CRITICAL',
    'NOISE_ALERT_RESOLVED',
    'NOISE_ALERT_CONFIG_CHANGED',
    'CONVERSATION_NEW_MESSAGE',
    'CONVERSATION_ASSIGNED',
    'ONLINE_CHECKIN_STARTED',
    'ONLINE_CHECKIN_COMPLETED',
    'REVIEW_RECEIVED',
    'REVIEW_NEGATIVE_ALERT',
    'PAYOUT_BATCH_GENERATED',
    'PAYOUT_PENDING_APPROVAL',
    'PAYOUT_APPROVED',
    'PAYOUT_EXECUTED',
    'PAYOUT_FAILED',
    'PAYOUT_CONFIG_SUBMITTED',
    'PAYOUT_CONFIG_VERIFIED',
    'RESERVATION_CREATED',
    'RESERVATION_UPDATED',
    'RESERVATION_CANCELLED',
    'BRIEFING_READY',
    'VISION_USAGE_THRESHOLD_REACHED',
    'IOT_SMOKE_DETECTED',
    'IOT_MOTION_DETECTED'
));
