-- V44: Table d'invitations pour rattachement a une organisation
-- Permet aux ADMIN/MANAGER d'inviter des utilisateurs via email/lien

CREATE TABLE IF NOT EXISTS organization_invitations (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_email   VARCHAR(255) NOT NULL,
    token_hash      VARCHAR(64)  NOT NULL UNIQUE,
    role_invited    VARCHAR(20)  NOT NULL DEFAULT 'MEMBER',
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    invited_by      BIGINT       NOT NULL REFERENCES users(id),
    expires_at      TIMESTAMP    NOT NULL,
    accepted_by_user_id BIGINT   REFERENCES users(id),
    accepted_at     TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitation_org_id  ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitation_token   ON organization_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitation_email   ON organization_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitation_status  ON organization_invitations(status);

-- Contrainte : max 1 invitation PENDING par email + org
CREATE UNIQUE INDEX IF NOT EXISTS uk_invitation_pending_email_org
    ON organization_invitations(organization_id, invited_email)
    WHERE status = 'PENDING';
