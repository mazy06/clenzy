package com.clenzy.marketplace.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** La file est créée dans la transaction de modération ; chaque prise est ensuite atomique. */
@Component
public class MarketplaceProvisioningJobs {
    private final JdbcTemplate jdbc;
    public MarketplaceProvisioningJobs(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public void enqueue(Long id) {
        jdbc.update("INSERT INTO marketplace_provisioning_jobs (provider_id) VALUES (?) ON CONFLICT DO NOTHING", id);
    }

    /** Interne uniquement : cette preuve n'est pas incluse dans le diagnostic public du job. */
    @Transactional(readOnly = true)
    public String operationKey(Long id) {
        return jdbc.queryForObject("SELECT operation_key::text FROM marketplace_provisioning_jobs WHERE provider_id = ?", String.class, id);
    }

    public record Claim(String token, String operationKey) {}

    /** Réservé au parcours propriétaire vérifié ; ne remplace jamais un worker encore actif. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claimReconciliation(Long id, String subject) {
        return jdbc.query("""
                UPDATE marketplace_provisioning_jobs j
                SET status = 'RUNNING', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP,
                    claim_token = gen_random_uuid(), retried_at = CURRENT_TIMESTAMP, retried_by = ?
                WHERE provider_id = ?
                  AND (status IN ('PENDING', 'RETRY', 'FAILED')
                       OR (status = 'RUNNING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
                  AND EXISTS (SELECT 1 FROM marketplace_providers p WHERE p.id = j.provider_id
                              AND p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL AND p.user_id IS NULL)
                RETURNING claim_token::text, operation_key::text
                """, (rs, row) -> new Claim(rs.getString(1), rs.getString(2)), subject, id)
            .stream().findFirst().orElse(null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(Long id) {
        return jdbc.query("""
                UPDATE marketplace_provisioning_jobs j
                SET status = 'RUNNING', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP,
                    claim_token = gen_random_uuid()
                WHERE provider_id = ? AND status IN ('PENDING', 'RETRY')
                  AND attempts < 5 AND next_attempt_at <= CURRENT_TIMESTAMP
                  AND EXISTS (SELECT 1 FROM marketplace_providers p WHERE p.id = j.provider_id
                              AND p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL)
                RETURNING claim_token::text, operation_key::text
                """, (rs, row) -> new Claim(rs.getString(1), rs.getString(2)), id).stream().findFirst().orElse(null);
    }

    /** Le verrou reste détenu jusqu'au commit des écritures locales de cette tentative. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void requireClaim(Long id, String token) {
        var rows = jdbc.queryForList("""
                SELECT provider_id FROM marketplace_provisioning_jobs
                WHERE provider_id = ? AND status = 'RUNNING' AND claim_token = CAST(? AS UUID) FOR UPDATE
                """, Long.class, id, token);
        if (rows.isEmpty()) throw new IllegalStateException("Cette tentative de provisionnement a été remplacée");
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean retry(Long id, String actor) {
        return jdbc.update("""
                UPDATE marketplace_provisioning_jobs j
                SET status = 'PENDING', attempts = 0, claim_token = NULL,
                    next_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                    retried_at = CURRENT_TIMESTAMP, retried_by = ?
                WHERE provider_id = ?
                  AND (status = 'FAILED' OR (status = 'RUNNING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
                  AND EXISTS (SELECT 1 FROM marketplace_providers p WHERE p.id = j.provider_id
                              AND p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL)
                """, actor, id) == 1;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(Long id, String token, MarketplaceOnboardingService.Outcome outcome) {
        boolean failed = outcome == MarketplaceOnboardingService.Outcome.FAILED;
        jdbc.update("""
                UPDATE marketplace_provisioning_jobs SET
                    status = CASE WHEN ? THEN CASE WHEN attempts < 5 THEN 'RETRY' ELSE 'FAILED' END ELSE 'SUCCEEDED' END,
                    next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes',
                    updated_at = CURRENT_TIMESTAMP, last_outcome = ?
                WHERE provider_id = ? AND status = 'RUNNING' AND claim_token = CAST(? AS UUID)
                """, failed, outcome.name(), id, token);
    }

    @Transactional(readOnly = true)
    public List<Long> due() {
        return jdbc.queryForList("""
                SELECT j.provider_id FROM marketplace_provisioning_jobs j
                JOIN marketplace_providers p ON p.id = j.provider_id
                WHERE j.status IN ('PENDING', 'RETRY') AND j.attempts < 5
                  AND j.next_attempt_at <= CURRENT_TIMESTAMP
                  AND p.status = 'ACTIVE' AND p.email_confirmed_at IS NOT NULL
                ORDER BY j.next_attempt_at, j.provider_id LIMIT 20
                """, Long.class);
    }

    public record State(String status, int attempts, LocalDateTime updatedAt, String lastOutcome, boolean requiresReview) {}

    @Transactional(readOnly = true)
    public Optional<State> state(Long id) {
        return jdbc.query("""
                SELECT status, attempts, updated_at, last_outcome,
                    (status = 'FAILED' OR (status = 'RUNNING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'))
                FROM marketplace_provisioning_jobs WHERE provider_id = ?
                """,
                (rs, row) -> new State(rs.getString(1), rs.getInt(2), rs.getTimestamp(3).toLocalDateTime(), rs.getString(4), rs.getBoolean(5)), id)
                .stream().findFirst();
    }
}
