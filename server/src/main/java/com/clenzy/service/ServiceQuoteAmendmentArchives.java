package com.clenzy.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

/** File et archives privées Baitly. Les lecteurs HTTP doivent d'abord vérifier les droits du devis. */
@Service
@Transactional(propagation = Propagation.REQUIRES_NEW)
public class ServiceQuoteAmendmentArchives {
    private final JdbcTemplate jdbc;

    public ServiceQuoteAmendmentArchives(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /** Rejoint la décision : sans enregistrement durable, l'acceptation doit échouer. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void request(Long id, Long orgId) {
        int inserted = jdbc.update("""
                INSERT INTO service_quote_amendment_archives(amendment_id, organization_id)
                SELECT id, organization_id FROM service_quote_amendments
                WHERE id = ? AND organization_id = ? AND status = 'ACCEPTED'
                ON CONFLICT (amendment_id) DO NOTHING
                """, id, orgId);
        if (inserted == 0 && !Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM service_quote_amendment_archives
                WHERE amendment_id = ? AND organization_id = ?)
                """, Boolean.class, id, orgId))) {
            throw new IllegalStateException("Décision acceptée requise pour archiver l'avenant");
        }
    }

    public record Claim(Long id, Long orgId, UUID token) {}

    /** Répare aussi les acceptations d'une ancienne instance pendant un déploiement progressif. */
    public void discoverMissing() {
        jdbc.update("""
                INSERT INTO service_quote_amendment_archives(amendment_id, organization_id)
                SELECT a.id, a.organization_id FROM service_quote_amendments a
                WHERE a.status = 'ACCEPTED' AND NOT EXISTS (
                    SELECT 1 FROM service_quote_amendment_archives d WHERE d.amendment_id = a.id)
                ORDER BY a.id LIMIT 100 ON CONFLICT (amendment_id) DO NOTHING
                """);
    }

    public Claim claimNext() { return claim(null, null); }

    public Claim claimForDownload(Long id, Long orgId) {
        return claim(Objects.requireNonNull(id), Objects.requireNonNull(orgId));
    }

    private Claim claim(Long id, Long orgId) {
        UUID token = UUID.randomUUID();
        var rows = jdbc.query("""
                WITH candidate AS (
                    SELECT amendment_id FROM service_quote_amendment_archives
                    WHERE ((status = 'PENDING' AND retry_at <= now())
                        OR (status = 'RUNNING' AND lease_until <= now()))
                      AND (?::bigint IS NULL OR amendment_id = ?)
                      AND (?::bigint IS NULL OR organization_id = ?)
                    ORDER BY retry_at, amendment_id LIMIT 1 FOR UPDATE SKIP LOCKED
                )
                UPDATE service_quote_amendment_archives a
                SET status = 'RUNNING', lease_token = ?, lease_until = now() + interval '5 minutes',
                    attempts = attempts + 1
                FROM candidate c WHERE a.amendment_id = c.amendment_id
                RETURNING a.amendment_id, a.organization_id
                """, (rs, row) -> new Claim(rs.getLong(1), rs.getLong(2), token), id, id, orgId, orgId, token);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    /** Accès interne du worker uniquement, limité à la décision et au bail réclamés. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public ServiceQuoteAmendmentService.AcceptedDocument snapshot(Claim claim) {
        return jdbc.queryForObject("""
                SELECT a.* FROM service_quote_amendments a
                JOIN service_quote_amendment_archives d ON d.amendment_id = a.id AND d.organization_id = a.organization_id
                WHERE a.id = ? AND a.organization_id = ? AND a.status = 'ACCEPTED'
                  AND d.status = 'RUNNING' AND d.lease_token = ? AND d.lease_until > now()
                """, (rs, row) -> new ServiceQuoteAmendmentService.AcceptedDocument(
                rs.getLong("id"), rs.getLong("organization_id"), rs.getLong("quote_id"), rs.getLong("intervention_id"),
                rs.getBigDecimal("original_amount"), rs.getBigDecimal("proposed_amount"), rs.getString("currency"),
                rs.getString("reason"), rs.getLong("proposed_by"), rs.getTimestamp("created_at").toInstant(),
                rs.getLong("decided_by"), rs.getTimestamp("decided_at").toInstant()), claim.id(), claim.orgId(), claim.token());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public byte[] read(Long id, Long orgId) {
        var rows = jdbc.query("""
                SELECT pdf_content, sha256 FROM service_quote_amendment_archives
                WHERE amendment_id = ? AND organization_id = ? AND status = 'READY'
                """, (rs, row) -> {
            byte[] pdf = rs.getBytes(1);
            if (!hash(pdf).equals(rs.getString(2))) throw new IllegalStateException("Archive d'avenant altérée");
            return pdf;
        }, id, orgId);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public boolean complete(Claim claim, byte[] pdf) {
        if (pdf == null || pdf.length < 5 || pdf.length > 5 * 1024 * 1024
                || !new String(pdf, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) {
            throw new IllegalArgumentException("PDF d'avenant invalide ou trop volumineux");
        }
        return jdbc.update("""
                UPDATE service_quote_amendment_archives
                SET status = 'READY', pdf_content = ?, sha256 = ?, archived_at = now(), lease_token = NULL, lease_until = NULL
                WHERE amendment_id = ? AND organization_id = ? AND status = 'RUNNING' AND lease_token = ? AND lease_until > now()
                """, pdf, hash(pdf), claim.id(), claim.orgId(), claim.token()) == 1;
    }

    public void retry(Claim claim) {
        jdbc.update("""
                UPDATE service_quote_amendment_archives
                SET status = 'PENDING', lease_token = NULL, lease_until = NULL,
                    retry_at = now() + LEAST(1800, 30 * power(2, LEAST(attempts, 6))) * interval '1 second'
                WHERE amendment_id = ? AND organization_id = ? AND status = 'RUNNING' AND lease_token = ?
                """, claim.id(), claim.orgId(), claim.token());
    }

    private static String hash(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
