package com.clenzy.service;

import com.clenzy.repository.ContactThreadRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/** Projection Baitly des devis existants. Aucun devis ni PDF n'est copié ou créé à la lecture. */
@Service
@Transactional(readOnly = true)
public class BaitlyQuoteInbox {
    private final NamedParameterJdbcTemplate jdbc;
    private final ServiceQuoteAmendmentService parties;
    private final ContactThreadRepository threads;
    private final QuoteThreadAccessPolicy threadAccess;
    private final Clock clock;

    public BaitlyQuoteInbox(NamedParameterJdbcTemplate jdbc, ServiceQuoteAmendmentService parties,
                            ContactThreadRepository threads, QuoteThreadAccessPolicy threadAccess, Clock clock) {
        this.jdbc = jdbc; this.parties = parties; this.threads = threads; this.threadAccess = threadAccess; this.clock = clock;
    }

    public record Entry(String key, Long quoteId, Long requestId, Long serviceRequestId, Long interventionId,
                        String title, String propertyName, String providerName, String status, String stage,
                        BigDecimal originalAmount, BigDecimal agreedAmount, String currency,
                        LocalDate validUntil, LocalDateTime createdAt, Long documentGenerationId,
                        boolean canDecide, boolean canWithdraw, boolean customerSide, boolean expired, String discussionUrl) {}
    public record Result(List<Entry> items, int page, int size, long totalElements, long totalPages) {}

    // Les accès sont vérifiés AVANT comptage/pagination. L'appartenance à une organisation
    // ne suffit jamais à lire les devis d'un autre propriétaire ou d'un prestataire concurrent.
    private static final String REQUEST_CUSTOMER = """
        (r.requester_organization_id = :orgId AND (:staff OR p.owner_id = :actorId
          OR (r.property_id IS NULL AND r.requested_by_user_id = :actorId)))
        """;
    private static final String REQUEST_ACCESS = "(" + REQUEST_CUSTOMER + """
        OR (:hasTeams AND r.provider_team_id IN (:teamIds))
        OR (mp.user_id = :actorId AND (r.provider_team_id IS NULL
            OR (:hasTeams AND r.provider_team_id IN (:teamIds)))))
        """;
    private static final String QUOTE_CUSTOMER = """
        (q.organization_id = :orgId AND (:staff
          OR (q.assignment_proposal_id IS NOT NULL AND (n.user_id = :actorId OR p.owner_id = :actorId))
          OR (q.assignment_proposal_id IS NULL AND :owner AND p.owner_id = :actorId)))
        """;
    private static final String QUOTE_ACCESS = "(" + QUOTE_CUSTOMER + """
        OR (q.provider_team_id IS NULL AND q.provider_user_id = :actorId)
        OR (:hasTeams AND q.provider_team_id IN (:teamIds)))
        """;

    private static final String FEED = """
        WITH source AS (
          SELECT 'quote-' || q.id AS key, q.id AS quote_id, q.marketplace_request_id AS request_id,
            q.service_request_id, q.intervention_id, coalesce(i.title,n.title,r.title) AS title,
        """ + "CASE WHEN q.intervention_id IS NULL AND q.status<>'APPROVED' AND NOT coalesce(" + QUOTE_CUSTOMER
        + ",false) THEN p.city ELSE p.name END AS property_name, " + """
            q.provider_name, q.status::text AS status,
            q.amount AS original_amount,
            CASE WHEN q.status='APPROVED' THEN coalesce(a.proposed_amount,q.amount) ELSE q.amount END AS agreed_amount,
            q.currency, q.valid_until, q.created_at, q.document_ref,
        """ + "CASE WHEN q.marketplace_request_id IS NOT NULL THEN " + REQUEST_CUSTOMER
        + " ELSE " + QUOTE_CUSTOMER + " END AS can_decide, false AS can_withdraw, " + """
            q.organization_id,
            CASE WHEN q.marketplace_request_id IS NOT NULL THEN 'MARKETPLACE_QUOTE'
                 WHEN q.provider_team_id IS NOT NULL THEN 'SERVICE_QUOTE_TEAM_' || q.provider_team_id
                 ELSE 'SERVICE_QUOTE_USER_' || q.provider_user_id END AS reference_type,
            coalesce(q.marketplace_request_id,q.intervention_id) AS reference_id
          FROM service_quotes q
          LEFT JOIN interventions i ON i.id=q.intervention_id AND i.organization_id=q.organization_id
          LEFT JOIN service_requests n ON n.id=q.service_request_id AND n.organization_id=q.organization_id
          LEFT JOIN marketplace_quote_requests r ON r.id=q.marketplace_request_id AND r.requester_organization_id=q.organization_id
          LEFT JOIN marketplace_providers mp ON mp.id=r.marketplace_provider_id
          LEFT JOIN properties p ON p.id=coalesce(q.property_id,i.property_id,n.property_id,r.property_id)
            AND p.organization_id=q.organization_id
          LEFT JOIN LATERAL (
            SELECT proposed_amount FROM service_quote_amendments a
            WHERE a.quote_id=q.id AND a.organization_id=q.organization_id AND a.status='ACCEPTED'
              AND a.intervention_id=q.intervention_id AND a.currency=q.currency
            ORDER BY a.decided_at DESC,a.id DESC LIMIT 1
          ) a ON true
          WHERE
        """ + "((q.marketplace_request_id IS NULL AND " + QUOTE_ACCESS + ") OR (r.id IS NOT NULL AND " + REQUEST_ACCESS + "))"
        + """
          UNION ALL
          SELECT 'request-' || r.id, NULL::bigint, r.id, r.service_request_id, r.intervention_id,
            r.title,
        """ + "CASE WHEN r.service_request_id IS NOT NULL AND r.status<>'ACCEPTED' AND NOT coalesce(" + REQUEST_CUSTOMER
        + ",false) THEN p.city ELSE p.name END, " + """
            mp.display_name, r.status::text, r.quoted_amount, r.quoted_amount,
            r.quoted_currency, r.quote_valid_until, r.created_at, NULL::text,
        """ + REQUEST_CUSTOMER + ", " + REQUEST_CUSTOMER + " AND r.status='SENT', " + """
            r.requester_organization_id, 'MARKETPLACE_QUOTE', r.id
          FROM marketplace_quote_requests r
          LEFT JOIN properties p ON p.id=r.property_id AND p.organization_id=r.requester_organization_id
          LEFT JOIN marketplace_providers mp ON mp.id=r.marketplace_provider_id
          WHERE
        """ + REQUEST_ACCESS + """
          AND NOT EXISTS (SELECT 1 FROM service_quotes q
            WHERE q.marketplace_request_id=r.id AND q.organization_id=r.requester_organization_id)
        ), classified AS (
          SELECT source.*, (status IN ('RECEIVED','QUOTED') AND valid_until < :today) IS TRUE AS expired,
            CASE WHEN status IN ('APPROVED','ACCEPTED') THEN 'ACCEPTED'
                 WHEN status IN ('RECEIVED','QUOTED') AND (valid_until IS NULL OR valid_until >= :today)
                   THEN CASE WHEN can_decide THEN 'DECIDE' ELSE 'WAITING' END
                 WHEN status='SENT' THEN 'WAITING' ELSE 'CLOSED' END AS stage
          FROM source
        )
        """;

    public Result list(Long orgId, Jwt jwt, String view, int page, int size) {
        if (page < 0 || size < 1 || size > 50 || view == null || !Set.of("ALL","DECIDE","WAITING","ACCEPTED","CLOSED").contains(view))
            throw new IllegalArgumentException("Filtre ou pagination de devis invalide");
        var access = parties.libraryAccess(orgId, jwt);
        var params = new MapSqlParameterSource().addValue("orgId", access.organizationId())
            .addValue("actorId", access.actorId()).addValue("subject", access.subject())
            .addValue("staff", access.staff()).addValue("owner", access.owner())
            .addValue("hasTeams", !access.teamIds().isEmpty())
            .addValue("teamIds", access.teamIds().isEmpty() ? List.of(-1L) : access.teamIds())
            .addValue("today", LocalDate.now(clock)).addValue("view", view)
            .addValue("limit", size).addValue("offset", (long) page * size);
        String filtered = " FROM classified c WHERE (:view='ALL' OR c.stage=:view)";
        Long total = jdbc.queryForObject(FEED + "SELECT count(*)" + filtered, params, Long.class);
        // Une page bornée ; les PDF restent chargés uniquement à leur ouverture.
        var items = jdbc.query(FEED + """
            SELECT c.*, discussion.id AS discussion_id, discussion.archived AS discussion_archived
            FROM classified c
            LEFT JOIN LATERAL (
              SELECT t.id, cp.archived FROM contact_threads t
              JOIN contact_thread_participants cp ON cp.thread_id=t.id AND cp.keycloak_id=:subject
              WHERE t.organization_id=c.organization_id AND t.reference_id=c.reference_id
                AND (t.reference_type=c.reference_type
                  OR (c.quote_id IS NOT NULL AND c.request_id IS NULL AND t.reference_type='SERVICE_QUOTE_INTERVENTION'))
              ORDER BY (t.reference_type=c.reference_type) DESC,t.id DESC LIMIT 1
            ) discussion ON true
            WHERE (:view='ALL' OR c.stage=:view)
            ORDER BY c.created_at DESC,coalesce(c.quote_id,c.request_id) DESC,c.key DESC LIMIT :limit OFFSET :offset
            """, params, (rs, row) -> {
                Long threadId = rs.getObject("discussion_id", Long.class);
                boolean archived = rs.getBoolean("discussion_archived");
                String discussion = threadId == null ? null : threads.findById(threadId)
                    .filter(thread -> threadAccess.canAccess(thread, access.subject()))
                    .map(thread -> "/contact?" + (archived ? "tab=archived&" : "") + "thread=group%3A" + thread.getId()).orElse(null);
                String status = rs.getString("status");
                return new Entry(rs.getString("key"), rs.getObject("quote_id",Long.class),
                    rs.getObject("request_id",Long.class), rs.getObject("service_request_id",Long.class),
                    rs.getObject("intervention_id",Long.class), rs.getString("title"), rs.getString("property_name"),
                    rs.getString("provider_name"), status, rs.getString("stage"), rs.getBigDecimal("original_amount"),
                    rs.getBigDecimal("agreed_amount"), rs.getString("currency"), rs.getObject("valid_until",LocalDate.class),
                    rs.getObject("created_at",LocalDateTime.class), generationId(rs.getString("document_ref")),
                    rs.getBoolean("can_decide") && Set.of("RECEIVED","QUOTED").contains(status) && !rs.getBoolean("expired"),
                    rs.getBoolean("can_withdraw"), rs.getBoolean("can_decide"), rs.getBoolean("expired"), discussion);
            });
        long count = total == null ? 0 : total;
        return new Result(items,page,size,count,(count + size - 1) / size);
    }

    private static Long generationId(String value) {
        try { return value == null ? null : Long.valueOf(value); }
        catch (NumberFormatException ignored) { return null; }
    }
}
