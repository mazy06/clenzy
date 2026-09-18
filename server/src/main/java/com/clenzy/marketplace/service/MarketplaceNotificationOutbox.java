package com.clenzy.marketplace.service;

import com.clenzy.service.TokenEncryptionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

/** Intentions chiffrées, sans appel réseau dans la transaction métier. */
@Service
public class MarketplaceNotificationOutbox {
    private final JdbcTemplate jdbc;
    private final TokenEncryptionService encryption;
    public MarketplaceNotificationOutbox(JdbcTemplate jdbc, TokenEncryptionService encryption) {
        this.jdbc = jdbc; this.encryption = encryption;
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(Long providerId, String kind, String payload, String expectedStatus, String actor) {
        jdbc.update("INSERT INTO marketplace_notification_deliveries(provider_id,kind,encrypted_payload,expected_status,actor) VALUES (?,?,?,?,?)",
            providerId, kind, payload == null ? null : encryption.encrypt(payload), expectedStatus, actor);
    }

    public record Claim(UUID id, Long providerId, String kind, String payload, String expectedStatus, UUID token) {
        @Override public String toString() { return "MarketplaceDelivery[id=" + id + "]"; }
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(UUID id) {
        return jdbc.query("""
            UPDATE marketplace_notification_deliveries SET status='RUNNING', claim_token=gen_random_uuid(),
              attempts=attempts+1, updated_at=CURRENT_TIMESTAMP, next_attempt_at=CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            WHERE id=? AND status IN ('PENDING','RUNNING') AND next_attempt_at<=CURRENT_TIMESTAMP
            RETURNING id,provider_id,kind,encrypted_payload,expected_status,claim_token
            """, (rs,n) -> new Claim(rs.getObject(1,UUID.class),rs.getLong(2),rs.getString(3),
                rs.getString(4)==null ? null : encryption.decrypt(rs.getString(4)),rs.getString(5),rs.getObject(6,UUID.class)),id)
            .stream().findFirst().orElse(null);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finish(Claim claim, String status) {
        if (!List.of("PENDING","SENT","CANCELLED").contains(status)) throw new IllegalArgumentException("État d'envoi invalide");
        int updated = jdbc.update("""
            UPDATE marketplace_notification_deliveries SET status=?, claim_token=NULL, updated_at=CURRENT_TIMESTAMP,
              encrypted_payload=CASE WHEN ?='PENDING' THEN encrypted_payload ELSE NULL END,
              sent_at=CASE WHEN ?='SENT' THEN CURRENT_TIMESTAMP ELSE NULL END,
              next_attempt_at=CURRENT_TIMESTAMP + INTERVAL '15 minutes' * LEAST(attempts,96)
            WHERE id=? AND claim_token=? AND status='RUNNING'
            """,status,status,status,claim.id(),claim.token());
        if (updated == 1 && status.equals("SENT") && claim.kind().equals("DECISION")) {
            jdbc.update("UPDATE marketplace_providers SET decision_sent_at=CURRENT_TIMESTAMP WHERE id=? AND status=? "
                + "AND decision_message IS NOT DISTINCT FROM ?",claim.providerId(),claim.expectedStatus(),claim.payload());
        }
    }
    @Transactional(readOnly=true)
    public List<UUID> due() {
        return jdbc.queryForList("SELECT id FROM marketplace_notification_deliveries WHERE status IN ('PENDING','RUNNING') "
            + "AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY next_attempt_at,id LIMIT 30",UUID.class);
    }

    public record State(UUID id, String kind, String status, int attempts, java.time.LocalDateTime createdAt,
                        java.time.LocalDateTime nextAttemptAt, java.time.LocalDateTime sentAt, String expectedStatus, String actor) {}
    @Transactional(readOnly=true)
    public List<State> states(Long providerId) {
        return jdbc.query("SELECT id,kind,status,attempts,created_at,next_attempt_at,sent_at,expected_status,actor "
            + "FROM marketplace_notification_deliveries WHERE provider_id=? ORDER BY created_at DESC,id LIMIT 100",
            (rs,n) -> new State(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getInt(4),
                rs.getTimestamp(5).toLocalDateTime(),rs.getTimestamp(6).toLocalDateTime(),
                rs.getTimestamp(7)==null ? null : rs.getTimestamp(7).toLocalDateTime(),rs.getString(8),rs.getString(9)),providerId);
    }
}
