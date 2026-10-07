package com.clenzy.repository;

import com.clenzy.model.BankPayoutObservation;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface BankPayoutObservationRepository extends JpaRepository<BankPayoutObservation, Long> {
    boolean existsByEventId(String eventId);

    @Modifying
    @Query(value = """
        INSERT INTO stripe_bank_payout_events(event_id,account_id,payout_id,livemode,status,
            payout_created,event_created,arrival_date,failure_code,sources,recorded_at)
        VALUES(:event,:account,:payout,:live,:status,:payoutCreated,:eventCreated,:arrival,:failure,
            CAST(:sources AS jsonb),CURRENT_TIMESTAMP) ON CONFLICT(event_id) DO NOTHING
        """, nativeQuery = true)
    int append(@Param("event") String event, @Param("account") String account, @Param("payout") String payout,
            @Param("live") boolean live, @Param("status") String status, @Param("payoutCreated") Instant payoutCreated,
            @Param("eventCreated") Instant eventCreated, @Param("arrival") Instant arrival,
            @Param("failure") String failure, @Param("sources") String sources);

    interface BankPayoutView {
        String getPayoutId();
        String getStatus();
        Instant getArrivalDate();
        String getFailureCode();
        Instant getEventCreated();
    }

    /** Sources prouvées seulement ; même compte, mode, devise et montant, y compris pour un webhook précoce. */
    @Query(value = """
        WITH matched AS (
            SELECT DISTINCT e.account_id,e.payout_id,e.livemode
            FROM stripe_bank_payout_events e JOIN payout_transfers t
              ON t.destination = e.account_id AND t.stripe_livemode = e.livemode
            WHERE t.organization_id = :org AND t.id = :transfer AND t.state = 'TRANSFERRED'
              AND t.destination_payment IS NOT NULL
              AND e.sources @> jsonb_build_array(jsonb_build_object('source',t.destination_payment,
                  'amountMinor',(t.amount * 100)::bigint,'currency',lower(t.currency)))
        )
        SELECT DISTINCT ON (e.payout_id) e.payout_id AS "payoutId",e.status AS "status",
            e.arrival_date AS "arrivalDate",e.failure_code AS "failureCode",e.event_created AS "eventCreated"
        FROM stripe_bank_payout_events e JOIN matched m
          ON e.account_id = m.account_id AND e.payout_id = m.payout_id AND e.livemode = m.livemode
        ORDER BY e.payout_id,
          CASE e.status WHEN 'FAILED' THEN 5 WHEN 'CANCELED' THEN 4 WHEN 'PAID' THEN 3
            WHEN 'IN_TRANSIT' THEN 2 ELSE 1 END DESC, e.event_created DESC,e.id DESC
        """, nativeQuery = true)
    List<BankPayoutView> findForTransfer(@Param("org") Long org, @Param("transfer") Long transfer);
}
