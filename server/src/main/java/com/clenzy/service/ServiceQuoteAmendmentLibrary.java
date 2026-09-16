package com.clenzy.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Projection privée de la bibliothèque Baitly ; aucun contenu PDF chargé par la liste. */
@Service
@Transactional(readOnly = true)
public class ServiceQuoteAmendmentLibrary {
    private final ServiceQuoteAmendmentService amendments;
    private final NamedParameterJdbcTemplate jdbc;

    public ServiceQuoteAmendmentLibrary(ServiceQuoteAmendmentService amendments, NamedParameterJdbcTemplate jdbc) {
        this.amendments = amendments; this.jdbc = jdbc;
    }

    public record Entry(Long id, Long quoteId, Long interventionId, BigDecimal originalAmount,
                        BigDecimal proposedAmount, String currency, String reason, Instant decidedAt,
                        String archiveStatus, Instant archivedAt) {}

    // Tables et colonnes vérifiées contre les entités et les changesets 0000/0433/0442/0443.
    // La même clause gouverne le total et les lignes : aucune référence concurrente ne fuit via le compteur.
    private static final String VISIBLE = """
            FROM service_quote_amendments a
            JOIN service_quotes q ON q.id = a.quote_id AND q.organization_id = a.organization_id
                AND q.intervention_id = a.intervention_id
            JOIN interventions i ON i.id = a.intervention_id AND i.organization_id = a.organization_id
            LEFT JOIN properties p ON p.id = i.property_id
            LEFT JOIN users owner_user ON owner_user.id = p.owner_id
            LEFT JOIN service_quote_amendment_archives d ON d.amendment_id = a.id AND d.organization_id = a.organization_id
            WHERE a.status = 'ACCEPTED' AND (
                (:hasTeams AND q.provider_team_id IN (:teamIds))
                OR (q.provider_team_id IS NULL AND q.provider_user_id = :actorId)
                OR (q.organization_id = :orgId AND (:staff OR (:owner AND owner_user.keycloak_id = :subject))))
              AND (:search = '' OR :search IN (a.id::text, a.quote_id::text, a.intervention_id::text)
                   OR position(lower(:search) in lower(a.reason)) > 0)
            """;

    public Page<Entry> list(Long orgId, Jwt jwt, int page, int size, String search) {
        var access = amendments.libraryAccess(orgId, jwt);
        if (page < 0 || size < 1 || size > 50 || (search != null && search.length() > 100)) {
            throw new IllegalArgumentException("Pagination ou recherche d'avenants invalide");
        }
        var params = new MapSqlParameterSource()
                .addValue("teamIds", access.teamIds().isEmpty() ? List.of(-1L) : access.teamIds())
                .addValue("hasTeams", !access.teamIds().isEmpty())
                .addValue("actorId", access.actorId()).addValue("orgId", access.organizationId())
                .addValue("staff", access.staff()).addValue("owner", access.owner()).addValue("subject", access.subject())
                .addValue("search", search == null ? "" : search.strip())
                .addValue("limit", size).addValue("offset", (long) page * size);
        Long count = jdbc.queryForObject("SELECT count(*) " + VISIBLE, params, Long.class);
        var entries = jdbc.query("""
                SELECT a.id, a.quote_id, a.intervention_id, a.original_amount, a.proposed_amount,
                    a.currency, a.reason, a.decided_at, d.archived_at,
                    CASE WHEN d.status = 'READY' THEN 'READY'
                         WHEN d.status = 'PENDING' AND d.attempts > 0 THEN 'RETRYING'
                         ELSE 'PREPARING' END AS archive_status
                """ + VISIBLE + " ORDER BY a.decided_at DESC, a.id DESC LIMIT :limit OFFSET :offset", params,
                (rs, row) -> new Entry(rs.getLong("id"), rs.getLong("quote_id"), rs.getLong("intervention_id"),
                        rs.getBigDecimal("original_amount"), rs.getBigDecimal("proposed_amount"), rs.getString("currency"),
                        rs.getString("reason"), rs.getTimestamp("decided_at").toInstant(), rs.getString("archive_status"),
                        rs.getTimestamp("archived_at") == null ? null : rs.getTimestamp("archived_at").toInstant()));
        return new PageImpl<>(entries, PageRequest.of(page, size), count == null ? 0 : count);
    }
}
