package com.clenzy.service.payout;

import com.clenzy.model.PayoutRecoveryJob;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Petites transactions indépendantes ; jamais d'appel PSP sous verrou SQL. */
@Service @Transactional(propagation = Propagation.REQUIRES_NEW)
public class PayoutRecoveryStore {
    private final EntityManager em;
    public PayoutRecoveryStore(EntityManager em) { this.em = em; }

    static final String SEED = """
        INSERT INTO payout_recovery_jobs(account_id,livemode,earliest_at)
        SELECT destination,stripe_livemode,min(created_at) - interval '1 day'
        FROM payout_transfers WHERE provider='STRIPE' AND state='TRANSFERRED'
          AND stripe_livemode IS NOT NULL AND destination LIKE 'acct\\_%' ESCAPE '\\'
        GROUP BY destination,stripe_livemode
        ON CONFLICT(account_id,livemode) DO UPDATE
        SET earliest_at=LEAST(payout_recovery_jobs.earliest_at,EXCLUDED.earliest_at)
        """;
    static final String CLAIM = """
        UPDATE payout_recovery_jobs SET lease_token=:token,lease_until=:leaseUntil,last_attempt_at=:now,
            window_end=COALESCE(window_end,:now)
        WHERE id=(SELECT id FROM payout_recovery_jobs WHERE next_attempt_at <= :now
            AND (lease_until IS NULL OR lease_until < :now)
            ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING *
        """;
    static final String STALLED = """
        WITH stalled AS (
          SELECT id FROM payout_transfers WHERE state='SUBMITTING' AND updated_at < :cutoff
          ORDER BY updated_at,id FOR UPDATE SKIP LOCKED LIMIT 100
        ), changed AS (
          UPDATE payout_transfers t SET state='RECONCILIATION_REQUIRED',updated_at=:now
          FROM stalled s WHERE t.id=s.id AND t.state='SUBMITTING'
          RETURNING t.id,t.organization_id,t.external_reference
        )
        INSERT INTO payout_transfer_events(organization_id,transfer_id,state,external_reference,created_at,origin)
        SELECT organization_id,id,'RECONCILIATION_REQUIRED',external_reference,:now,'AUTOMATIC' FROM changed
        """;
    public void seed() { em.createNativeQuery(SEED).executeUpdate(); }
    public int flagStalled(Instant now) {
        return em.createNativeQuery(STALLED).setParameter("cutoff", now.minusSeconds(1800))
                .setParameter("now", now).executeUpdate();
    }
    public Optional<PayoutRecoveryJob> claim(Instant now) {
        var rows = em.createNativeQuery(CLAIM, PayoutRecoveryJob.class).setParameter("token",UUID.randomUUID().toString())
                .setParameter("now",now).setParameter("leaseUntil",now.plusSeconds(600)).getResultList();
        return rows.isEmpty() ? Optional.empty() : Optional.of((PayoutRecoveryJob) rows.getFirst());
    }
    public void checkpoint(PayoutRecoveryJob job, String after, boolean complete, Instant now) {
        int changed = em.createNativeQuery("""
            UPDATE payout_recovery_jobs SET after_payout_id=:after, window_end=:windowEnd,
              last_completed_at=CASE WHEN :complete THEN :now ELSE last_completed_at END,
              next_attempt_at=:next,failures=0,error_code=null,lease_token=null,lease_until=null
            WHERE id=:id AND lease_token=:token AND lease_until >= :now
            """).setParameter("after", complete ? null : after).setParameter("windowEnd",complete ? null : job.getWindowEnd())
                .setParameter("complete",complete).setParameter("now",now).setParameter("next",now.plusSeconds(complete ? 21600 : 1))
                .setParameter("id",job.getId()).setParameter("token",job.getLeaseToken()).executeUpdate();
        if (changed != 1) throw new IllegalStateException("Bail de rattrapage expiré.");
    }
    public boolean renew(PayoutRecoveryJob job, Instant now) {
        return em.createNativeQuery("UPDATE payout_recovery_jobs SET lease_until=:until WHERE id=:id AND lease_token=:token AND lease_until >= :now")
                .setParameter("until",now.plusSeconds(600)).setParameter("now",now)
                .setParameter("id",job.getId()).setParameter("token",job.getLeaseToken()).executeUpdate() == 1;
    }
    public void failed(PayoutRecoveryJob job, Instant now) {
        // Pas de message d'exception PSP dans la base : il peut contenir des données privées.
        em.createNativeQuery("""
            UPDATE payout_recovery_jobs SET failures=LEAST(failures+1,100),error_code='PSP_READ_FAILED',
              next_attempt_at=:next,lease_token=null,lease_until=null
            WHERE id=:id AND lease_token=:token AND lease_until >= :now
            """).setParameter("next",now.plusSeconds(Math.min(21600L, 300L << Math.min(job.getFailures(),6))))
                .setParameter("now",now).setParameter("id",job.getId()).setParameter("token",job.getLeaseToken()).executeUpdate();
    }
}
