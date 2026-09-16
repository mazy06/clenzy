package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.util.StringUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** File interne : conserve le même lien lors des reprises, jamais accessible via l'API. */
@Component
public class MarketplaceActivationDeliveries {
    private final JdbcTemplate jdbc;
    private final TokenEncryptionService encryption;
    private final Clock clock;

    public MarketplaceActivationDeliveries(JdbcTemplate jdbc, TokenEncryptionService encryption, Clock clock) {
        this.jdbc = jdbc;
        this.encryption = encryption;
        this.clock = clock;
    }

    /** Le provider est une entité gérée : le jeton et la file sont validés avec son rattachement. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(MarketplaceProvider provider) {
        String token = MarketplaceUploadTokens.generate();
        String hash = MarketplaceUploadTokens.hash(token);
        LocalDateTime expiry = LocalDateTime.now(clock).plusDays(7);
        jdbc.update("""
                INSERT INTO marketplace_activation_deliveries
                (provider_id, user_id, email_hash, token_hash, encrypted_token, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, provider.getId(), provider.getUserId(), StringUtils.computeEmailHash(provider.getEmail()),
                hash, encryption.encrypt(token), Timestamp.valueOf(expiry));
        provider.setActivationTokenHash(hash);
        provider.setActivationTokenExpiresAt(expiry);
    }

    public record Claim(Long providerId, Long userId, String emailHash, String tokenHash,
                        String encryptedToken, String claimToken) {
        @Override public String toString() { return "ActivationDelivery[providerId=" + providerId + "]"; }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(Long id) {
        return jdbc.query("""
                UPDATE marketplace_activation_deliveries d
                SET status = 'RUNNING', attempts = attempts + 1, claim_token = gen_random_uuid(),
                    updated_at = CURRENT_TIMESTAMP, next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                WHERE provider_id = ? AND status IN ('PENDING', 'RUNNING')
                  AND next_attempt_at <= CURRENT_TIMESTAMP AND expires_at > CURRENT_TIMESTAMP
                  AND EXISTS (SELECT 1 FROM marketplace_providers p WHERE p.id = d.provider_id
                    AND p.user_id = d.user_id AND p.email_hash = d.email_hash
                    AND p.activation_token_hash = d.token_hash AND p.activation_token_expires_at > CURRENT_TIMESTAMP
                    AND p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL)
                RETURNING provider_id, user_id, email_hash, token_hash, encrypted_token, claim_token::text
                """, (rs, row) -> new Claim(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4),
                rs.getString(5), rs.getString(6)), id).stream().findFirst().orElse(null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(Claim claim, boolean sent) {
        jdbc.update("""
                UPDATE marketplace_activation_deliveries
                SET status = CASE WHEN ? THEN 'SENT' ELSE 'PENDING' END,
                    encrypted_token = CASE WHEN ? THEN NULL ELSE encrypted_token END,
                    sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,
                    claim_token = NULL, updated_at = CURRENT_TIMESTAMP,
                    next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes' * LEAST(attempts, 24)
                WHERE provider_id = ? AND status = 'RUNNING' AND claim_token = CAST(? AS UUID)
                """, sent, sent, sent, claim.providerId(), claim.claimToken());
    }

    /** Purge aussi les jetons consommés pendant une tentative dont la réponse a été perdue. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void discardInvalid() {
        jdbc.update("""
                UPDATE marketplace_activation_deliveries d
                SET status = CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE 'CANCELLED' END,
                    encrypted_token = NULL, claim_token = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE status IN ('PENDING', 'RUNNING') AND (expires_at <= CURRENT_TIMESTAMP OR NOT EXISTS (
                    SELECT 1 FROM marketplace_providers p WHERE p.id = d.provider_id
                    AND p.user_id = d.user_id AND p.email_hash = d.email_hash
                    AND p.activation_token_hash = d.token_hash AND p.activation_token_expires_at > CURRENT_TIMESTAMP))
                """);
    }

    @Transactional(readOnly = true)
    public List<Long> due() {
        return jdbc.queryForList("""
                SELECT d.provider_id FROM marketplace_activation_deliveries d
                JOIN marketplace_providers p ON p.id = d.provider_id
                WHERE d.status IN ('PENDING', 'RUNNING') AND d.next_attempt_at <= CURRENT_TIMESTAMP
                  AND d.expires_at > CURRENT_TIMESTAMP AND p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL
                ORDER BY d.next_attempt_at, d.provider_id LIMIT 20
                """, Long.class);
    }

    /** Diagnostic sans destinataire, empreinte, jeton ni preuve de prise du worker. */
    public record State(String status, int attempts, LocalDateTime updatedAt,
                        LocalDateTime nextAttemptAt, LocalDateTime sentAt, LocalDateTime expiresAt,
                        boolean linkAvailable) {}

    @Transactional(readOnly = true)
    public Optional<State> state(Long id) {
        return jdbc.query("""
                SELECT d.status, d.attempts, d.updated_at, d.next_attempt_at, d.sent_at, d.expires_at,
                    (p.user_id = d.user_id AND p.email_hash = d.email_hash
                     AND p.activation_token_hash = d.token_hash
                     AND p.activation_token_expires_at > CURRENT_TIMESTAMP
                     AND d.expires_at > CURRENT_TIMESTAMP) IS TRUE AS link_available,
                    d.expires_at <= CURRENT_TIMESTAMP AS expired,
                    p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL AS eligible,
                    d.next_attempt_at <= CURRENT_TIMESTAMP AS due
                FROM marketplace_activation_deliveries d JOIN marketplace_providers p ON p.id = d.provider_id
                WHERE d.provider_id = ?
                """, (rs, row) -> {
            String status = rs.getString("status");
            boolean active = status.equals("PENDING") || status.equals("RUNNING");
            boolean available = rs.getBoolean("link_available");
            if (active) {
                if (rs.getBoolean("expired")) status = "EXPIRED";
                else if (!available) status = "CANCELLED";
                else if (!rs.getBoolean("eligible")) status = "PAUSED";
                else if (status.equals("RUNNING") && rs.getBoolean("due")) status = "RETRY";
                else if (status.equals("PENDING") && rs.getInt("attempts") > 0) status = "RETRY";
            }
            var sentAt = rs.getTimestamp("sent_at");
            boolean scheduled = status.equals("PENDING") || status.equals("RETRY");
            return new State(status, rs.getInt("attempts"), rs.getTimestamp("updated_at").toLocalDateTime(),
                    scheduled ? rs.getTimestamp("next_attempt_at").toLocalDateTime() : null,
                    sentAt == null ? null : sentAt.toLocalDateTime(), rs.getTimestamp("expires_at").toLocalDateTime(), available);
        }, id).stream().findFirst();
    }
}
