package com.clenzy.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Lectures Baitly bornées : les entités et preuves détaillées ne sont chargées que pour la page. */
@Repository
public class BaitlyPaymentHistoryRepository {
    public record Key(String type, long id) {}
    public record Filter(long organizationId, Long hostId, String status, LocalDate from, LocalDate to, String search, List<Long> matchingOwners) {
        public Filter(long organizationId, Long hostId, String status, LocalDate from, LocalDate to, String search) {
            this(organizationId,hostId,status,from,to,search,List.of());
        }
    }
    public record AmountGroup(String key, String artwork, long count, long unavailable, List<List<Object>> totals) {}
    private final NamedParameterJdbcTemplate jdbc;
    private final com.clenzy.config.EncryptedFieldConverter fields;

    public BaitlyPaymentHistoryRepository(NamedParameterJdbcTemplate jdbc, com.clenzy.config.EncryptedFieldConverter fields) { this.jdbc = jdbc; this.fields=fields; }

    // Mêmes dates et statut effectif que PaymentQueryService / ReservationPaymentState.
    // Aucun plafond par source : le LIMIT s'applique à la fusion globale, avec ordre stable.
    static final String SOURCES = """
        WITH sources AS (
          SELECT 'INTERVENTION' AS type, i.id, i.estimated_cost AS amount, coalesce(i.currency,'EUR') AS currency,
                 coalesce(i.payment_status,'PENDING') AS status, false AS ota, 0::numeric AS credit,
                 coalesce(i.paid_at,i.start_time,i.created_at) AS transaction_date,
                 i.status AS mission_status,
                 CASE WHEN p.name IS NOT NULL AND right(i.title,length(' — '||p.name))=' — '||p.name
                      THEN trim(left(i.title,length(i.title)-length(' — '||p.name))) ELSE coalesce(i.title,'—') END AS description,
                 coalesce(p.name,'N/A') AS property_name, '' AS person_name, i.requestor_id AS person_id
            FROM interventions i LEFT JOIN properties p ON p.id=i.property_id
           WHERE i.organization_id=:org AND i.estimated_cost>0
        """;

    private static final String RESERVATIONS = """
          UNION ALL
          SELECT 'RESERVATION', r.id, r.total_price, coalesce(r.currency,'EUR'),
                 CASE WHEN r.payment_status IN ('REFUNDED','PARTIALLY_REFUNDED','CANCELLED','NOT_REQUIRED') THEN r.payment_status
                      WHEN r.payment_collection='UNKNOWN' THEN 'UNKNOWN'
                      WHEN r.payment_collection='CHANNEL' THEN CASE WHEN r.channel_payment_collect='ota' THEN 'PAID' ELSE 'UNKNOWN' END
                      WHEN r.external_uid LIKE 'channex:%' AND r.channex_crs_booking_id IS NULL
                           AND r.channel_payment_collect IS NULL AND coalesce(trim(r.stripe_session_id),'')='' THEN 'UNKNOWN'
                      ELSE coalesce(r.payment_status,'PENDING') END,
                 coalesce(r.payment_collection='CHANNEL',false), coalesce(r.credit_applied,0),
                 coalesce(r.paid_at,r.created_at), NULL,
                 coalesce(nullif(trim(r.source_name),''), CASE lower(r.source)
                   WHEN 'airbnb' THEN 'Airbnb' WHEN 'booking' THEN 'Booking.com' WHEN 'vrbo' THEN 'Vrbo'
                   WHEN 'direct' THEN 'Direct' WHEN 'ical' THEN 'iCal' ELSE 'Reservation' END)
                   || CASE WHEN r.check_out>r.check_in THEN ' · '||(r.check_out-r.check_in)::text||
                        CASE WHEN r.check_out-r.check_in=1 THEN ' nuit' ELSE ' nuits' END ELSE ' #'||r.id::text END,
                 p.name, r.guest_name, NULL::bigint
            FROM reservations r JOIN properties p ON p.id=r.property_id
           WHERE r.organization_id=:org AND r.total_price>0
        """;

    private static final String REQUESTS = """
          UNION ALL
          SELECT 'SERVICE_REQUEST', s.id, s.estimated_cost, 'EUR', coalesce(s.payment_status,'PENDING'), false, 0,
                 s.created_at, NULL,
                 CASE WHEN p.name IS NOT NULL AND right(s.title,length(' — '||p.name))=' — '||p.name
                      THEN trim(left(s.title,length(s.title)-length(' — '||p.name))) ELSE coalesce(s.title,'—') END,
                 coalesce(p.name,'N/A'), '', s.user_id
            FROM service_requests s LEFT JOIN properties p ON p.id=s.property_id
           WHERE s.organization_id=:org AND s.status='AWAITING_PAYMENT' AND s.estimated_cost>0
        """;

    private String filtered(Filter f, MapSqlParameterSource params) {
        params.addValue("org", f.organizationId());
        String owner = f.hostId() == null ? "" : " AND ";
        if (f.hostId() != null) params.addValue("host", f.hostId());
        String sql = SOURCES + (owner.isEmpty() ? "" : owner + "i.requestor_id=:host")
                + RESERVATIONS + (owner.isEmpty() ? "" : owner + "p.owner_id=:host")
                + REQUESTS + (owner.isEmpty() ? "" : owner + "s.user_id=:host")
                + ") , filtered AS (SELECT * FROM sources WHERE 1=1";
        if (f.status() != null) { sql += " AND status=:status"; params.addValue("status", f.status()); }
        if (f.from() != null) { sql += " AND transaction_date>=:from"; params.addValue("from", Timestamp.valueOf(f.from().atStartOfDay())); }
        if (f.to() != null) { sql += " AND transaction_date<:to"; params.addValue("to", Timestamp.valueOf(f.to().plusDays(1).atStartOfDay())); }
        if (f.search() != null && !f.search().isBlank()) {
            // position traite %, _ et antislash comme du texte, sans wildcard implicite.
            sql += " AND (position(:search in lower(description))>0 OR position(:search in lower(property_name))>0 OR position(:search in lower(person_name))>0";
            if (!f.matchingOwners().isEmpty()) { sql += " OR person_id IN (:owners)"; params.addValue("owners",f.matchingOwners()); }
            sql += ")";
            params.addValue("search", f.search().trim().toLowerCase(java.util.Locale.ROOT));
        }
        return sql + ") ";
    }

    /** Déchiffrement des seuls propriétaires référencés par des dossiers déjà autorisés. */
    public Filter prepare(Filter filter) {
        if (filter.search()==null || filter.search().isBlank()) return filter;
        var params=new MapSqlParameterSource();
        var withoutSearch=new Filter(filter.organizationId(),filter.hostId(),filter.status(),filter.from(),filter.to(),null);
        String query=filter.search().trim().toLowerCase(java.util.Locale.ROOT);
        var owners=jdbc.query(filtered(withoutSearch,params)+"SELECT DISTINCT u.id,u.first_name,u.last_name FROM filtered f JOIN users u ON u.id=f.person_id",
                params,(rs,row) -> {
                    String first=fields.convertToEntityAttribute(rs.getString("first_name"));
                    String last=fields.convertToEntityAttribute(rs.getString("last_name"));
                    return ((first==null?"":first)+" "+(last==null?"":last)).trim().toLowerCase(java.util.Locale.ROOT).contains(query) ? rs.getLong("id") : null;
                }).stream().filter(java.util.Objects::nonNull).toList();
        return new Filter(filter.organizationId(),filter.hostId(),filter.status(),filter.from(),filter.to(),filter.search(),owners);
    }

    public List<Key> page(Filter filter, int page, int size) {
        var params = new MapSqlParameterSource().addValue("limit", size).addValue("offset", (long) page * size);
        return jdbc.query(filtered(filter, params) + "SELECT type,id FROM filtered ORDER BY transaction_date DESC NULLS LAST,type,id DESC LIMIT :limit OFFSET :offset",
                params, (rs, row) -> new Key(rs.getString("type"), rs.getLong("id")));
    }

    public long count(Filter filter) {
        var params = new MapSqlParameterSource();
        return jdbc.queryForObject(filtered(filter, params) + "SELECT count(*) FROM filtered", params, Long.class);
    }

    public List<AmountGroup> amounts(Filter filter) {
        var params = new MapSqlParameterSource();
        String sql = filtered(filter, params) + """
            , quotes AS (
              SELECT q.intervention_id, count(*) AS approved,
                     max(q.deposit_amount) AS deposit, max(q.deposit_paid_at) AS paid_at,
                     max(q.deposit_transaction_ref) AS reference,
                     bool_or((q.deposit_paid_at IS NOT NULL OR q.deposit_transaction_ref IS NOT NULL)
                       AND (q.deposit_paid_at IS NULL OR q.deposit_transaction_ref IS NULL
                            OR trim(q.deposit_transaction_ref)='' OR q.deposit_amount IS NULL OR q.deposit_amount<=0)) AS invalid
                FROM service_quotes q JOIN filtered f ON f.type='INTERVENTION' AND f.id=q.intervention_id
               WHERE q.organization_id=:org AND q.status='APPROVED' GROUP BY q.intervention_id
            ), refunds AS (
              SELECT f.type,f.id,
                     coalesce(sum(t.amount) FILTER (WHERE t.status='COMPLETED' AND t.currency=f.currency),0) AS returned,
                     bool_or(t.currency<>f.currency OR t.currency IS NULL OR t.status='PROCESSING'
                             OR t.metadata->'reviewRequired'='true'::jsonb) AS review
                FROM filtered f JOIN payment_transactions t ON t.organization_id=:org AND t.source_id=f.id
                  AND ((f.type='INTERVENTION' AND t.source_type='INTERVENTION')
                    OR (f.type='RESERVATION' AND t.source_type IN ('RESERVATION','BOOKING_CANCELLATION')))
               WHERE t.payment_type='REFUND' AND t.amount>0 GROUP BY f.type,f.id
            ), values_for_totals AS (
              SELECT f.*, coalesce(r.review,false) AS review,
                     CASE WHEN f.status='PARTIALLY_REFUNDED' THEN
                       CASE WHEN r.returned>0 AND f.credit>=0 AND r.returned<=f.amount-f.credit
                            THEN round(f.amount-f.credit-r.returned,2) ELSE NULL END
                       ELSE f.amount END AS net_amount,
                     CASE WHEN f.type='SERVICE_REQUEST' THEN f.amount
                          WHEN f.type='INTERVENTION' AND f.status IN ('PENDING','FAILED') AND f.mission_status<>'CANCELLED'
                            AND coalesce(q.approved,0)<=1 AND NOT coalesce(q.invalid,false)
                            AND coalesce(CASE WHEN q.paid_at IS NOT NULL THEN q.deposit END,0)<=f.amount
                            THEN f.amount-coalesce(CASE WHEN q.paid_at IS NOT NULL THEN q.deposit END,0)
                          WHEN f.status='PARTIALLY_PAID' THEN NULL ELSE f.amount END AS due
                FROM filtered f LEFT JOIN quotes q ON f.type='INTERVENTION' AND q.intervention_id=f.id
                    LEFT JOIN refunds r ON r.type=f.type AND r.id=f.id
               WHERE f.status NOT IN ('CANCELLED','REFUNDED','NOT_REQUIRED','CREDIT_NOTE')
            ), buckets AS (
              SELECT b.key,upper(trim(f.currency)) AS currency,b.amount
                FROM values_for_totals f CROSS JOIN LATERAL (VALUES
                  ('all',true,f.net_amount),
                  ('pending',f.status IN ('PENDING','DRAFT','ISSUED','APPROVED','PROCESSING','SUBMITTING','PARTIALLY_PAID'),f.due),
                  ('done',f.status IN ('PAID','TRANSFERRED','PARTIALLY_REFUNDED'),f.net_amount),
                  ('ota',f.status='PAID' AND f.ota,f.net_amount),
                  ('review',f.review OR f.status IN ('UNKNOWN','FAILED','BLOCKED','OVERDUE','RECONCILIATION_REQUIRED'),f.net_amount)
                ) AS b(key,included,amount) WHERE b.included
            ) SELECT key,currency,count(*) AS count,
                     count(*) FILTER (WHERE amount IS NULL OR currency IS NULL OR currency!~'^[A-Z]{3}$') AS unavailable,
                     sum(round(amount, CASE WHEN currency IN ('BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','UYI','VND','VUV','XAF','XOF','XPF') THEN 0
                                           WHEN currency IN ('BHD','IQD','JOD','KWD','LYD','OMR','TND') THEN 3
                                           WHEN currency IN ('CLF','UYW') THEN 4 ELSE 2 END))
                       FILTER (WHERE amount IS NOT NULL AND currency~'^[A-Z]{3}$') AS total
                FROM buckets GROUP BY key,currency ORDER BY key,currency
            """;
        record Bucket(String key, String currency, long count, long unavailable, BigDecimal total) {}
        var buckets = jdbc.query(sql, params, (rs, row) -> new Bucket(rs.getString("key"), rs.getString("currency"),
                rs.getLong("count"), rs.getLong("unavailable"), rs.getBigDecimal("total")));
        Map<String,String> artworks = new LinkedHashMap<>();
        artworks.put("all","documents"); artworks.put("pending","pending"); artworks.put("done","transfer");
        artworks.put("ota","received"); artworks.put("review","received");
        List<String> currencies = buckets.stream().filter(b -> b.key().equals("all") && b.total()!=null).map(Bucket::currency).toList();
        List<AmountGroup> groups = new ArrayList<>();
        artworks.forEach((key,artwork) -> {
            var matching = buckets.stream().filter(b -> b.key().equals(key)).toList();
            long count = matching.stream().mapToLong(Bucket::count).sum();
            List<List<Object>> totals = new ArrayList<>();
            matching.stream().filter(b -> b.total()!=null).forEach(b -> totals.add(List.of(b.currency(), b.total())));
            if (count==0) currencies.forEach(currency -> totals.add(List.of(currency, BigDecimal.ZERO)));
            groups.add(new AmountGroup(key,artwork,count,matching.stream().mapToLong(Bucket::unavailable).sum(),totals));
        });
        return groups;
    }
}
