package com.clenzy.service.payout;

import com.clenzy.payment.StripeGateway;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.List;

/** Alertes calculées sur les preuves persistées : pas de notification obsolète ni d'appel PSP en HTTP. */
@Service @Transactional(readOnly=true)
public class PayoutMonitoringService {
    public record Alert(long transferId, String description, String code) {}
    public record Monitoring(boolean recoveryEnabled, boolean providerConfigured, Page<Alert> alerts) {}
    private final EntityManager em;
    private final StripeGateway stripe;
    private final Clock clock;
    private final boolean enabled;
    public PayoutMonitoringService(EntityManager em, StripeGateway stripe, Clock clock,
            @Value("${baitly.payout-monitoring.enabled:false}") boolean enabled) {
        this.em=em; this.stripe=stripe; this.clock=clock; this.enabled=enabled;
    }

    // Le filtre d'organisation est explicite, même lorsque le staff possède un bypass RLS.
    // Une source retrouvée dans un état antérieur rattache aussi le payout.failed reçu sans sources.
    static final String ALERTS = """
        WITH observations AS (
          SELECT t.id,t.description,t.created_at,
            CASE
              WHEN t.state='RECONCILIATION_REQUIRED' THEN 'RECONCILIATION_REQUIRED'
              WHEN t.state='SUBMITTING' AND t.updated_at < :stalled THEN 'TRANSFER_STALLED'
              WHEN t.state='TRANSFERRED' AND (%s) THEN 'FUNDING_DISPUTED'
              WHEN t.state='TRANSFERRED' AND (%s) THEN 'REFUND_RECOVERY_REQUIRED'
              WHEN bank.failed THEN 'BANK_FAILED'
              WHEN bank.late THEN 'BANK_LATE'
              WHEN t.state='TRANSFERRED' AND NOT COALESCE(bank.paid,false) AND t.updated_at < :unconfirmed THEN 'BANK_UNCONFIRMED'
              WHEN :enabled AND j.failures>0 THEN 'RECOVERY_FAILED'
              WHEN :enabled AND t.state='TRANSFERRED' AND t.updated_at < :stale
                   AND (j.id IS NULL OR j.last_completed_at IS NULL OR j.last_completed_at < :stale) THEN 'RECOVERY_LATE'
              ELSE NULL
            END AS code
          FROM payout_transfers t
          LEFT JOIN payout_recovery_jobs j ON j.account_id=t.destination AND j.livemode=t.stripe_livemode
          LEFT JOIN LATERAL (
            SELECT bool_or(b.status IN ('FAILED','CANCELED')) AS failed,
                   bool_or(b.status='PAID') AS paid,
                   bool_or(b.status IN ('PENDING','IN_TRANSIT') AND b.arrival_date < :late) AS late
            FROM (
              SELECT DISTINCT ON(e.payout_id) e.status,e.arrival_date
              FROM stripe_bank_payout_events e
              WHERE t.state='TRANSFERRED' AND e.account_id=t.destination AND e.livemode=t.stripe_livemode
                AND EXISTS (SELECT 1 FROM stripe_bank_payout_events proof
                  WHERE proof.account_id=e.account_id AND proof.livemode=e.livemode AND proof.payout_id=e.payout_id
                    AND proof.sources @> jsonb_build_array(jsonb_build_object('source',t.destination_payment,
                      'amountMinor',(t.amount*100)::bigint,'currency',lower(t.currency))))
              ORDER BY e.payout_id,CASE e.status WHEN 'FAILED' THEN 5 WHEN 'CANCELED' THEN 4
                WHEN 'PAID' THEN 3 WHEN 'IN_TRANSIT' THEN 2 ELSE 1 END DESC,e.event_created DESC,e.id DESC
            ) b
          ) bank ON true
          WHERE t.organization_id=:org AND t.provider='STRIPE'
        ) SELECT id,description,code,created_at FROM observations WHERE code IS NOT NULL
        """.formatted(BaitlyPayoutFundingRisk.DISPUTED, BaitlyPayoutFundingRisk.REFUND_RECOVERY);

    public Monitoring read(Long organizationId, int page) {
        if (organizationId==null || page<0 || page>100000) throw new IllegalArgumentException("Organisation ou page invalide.");
        var now=clock.instant();
        var params = java.util.Map.<String,Object>of("org",organizationId,"enabled",enabled,
                "stalled",now.minusSeconds(1800),"late",now.minusSeconds(172800),
                "unconfirmed",now.minusSeconds(604800),"stale",now.minusSeconds(86400));
        var count=em.createNativeQuery("SELECT count(*) FROM ("+ALERTS+") a");
        var rows=em.createNativeQuery(ALERTS+" ORDER BY CASE code WHEN 'RECONCILIATION_REQUIRED' THEN 0 WHEN 'FUNDING_DISPUTED' THEN 1 WHEN 'REFUND_RECOVERY_REQUIRED' THEN 1 WHEN 'BANK_FAILED' THEN 2 ELSE 3 END,created_at,id");
        params.forEach((key,value) -> { count.setParameter(key,value); rows.setParameter(key,value); });
        long total=((Number)count.getSingleResult()).longValue();
        @SuppressWarnings("unchecked") List<Object[]> data=rows.setFirstResult(page*6).setMaxResults(6).getResultList();
        return new Monitoring(enabled,stripe.isConfigured(),new PageImpl<>(data.stream()
                .map(row -> new Alert(((Number)row[0]).longValue(),(String)row[1],(String)row[2])).toList(),PageRequest.of(page,6),total));
    }
}
