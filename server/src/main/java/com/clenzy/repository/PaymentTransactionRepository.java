package com.clenzy.repository;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    /** Capacité d'une prestation encaissée seule, revalidée sous verrou avant émission. */
    @Query(value = """
        SELECT i.id FROM interventions i
        JOIN payment_transactions t ON t.organization_id=i.organization_id AND t.source_id=i.id
          AND t.source_type='INTERVENTION' AND t.payment_type='CHECKOUT'
        WHERE i.organization_id=:org AND i.id IN (:ids)
          AND i.payment_status IN ('PAID','PARTIALLY_REFUNDED')
          AND t.status='COMPLETED' AND t.provider_type='STRIPE' AND t.currency='EUR'
          AND COALESCE(i.currency,'EUR')=t.currency AND i.estimated_cost=t.amount AND t.amount>0
          AND t.provider_tx_id LIKE 'cs_%' AND i.stripe_session_id=t.provider_tx_id
          AND COALESCE(t.disputed_amount,0)=0
          AND NOT EXISTS (SELECT 1 FROM interventions other WHERE other.organization_id=i.organization_id
            AND other.stripe_session_id=i.stripe_session_id AND other.id<>i.id)
          AND NOT EXISTS (SELECT 1 FROM intervention_payment_allocations a
            WHERE a.organization_id=t.organization_id AND a.transaction_id=t.id)
          AND NOT EXISTS (SELECT 1 FROM service_quote_cancellations c
            WHERE c.organization_id=i.organization_id AND c.intervention_id=i.id)
        """, nativeQuery = true)
    List<Long> findStandaloneRefundCandidateMissionIds(@Param("org") Long org, @Param("ids") List<Long> ids);

    /** Une allocation confirmée expose son propre budget ; la décision vérifie ensuite tout le lot. */
    @Query(value = """
        SELECT DISTINCT i.id FROM interventions i
        JOIN intervention_payment_allocations a ON a.organization_id=i.organization_id AND a.intervention_id=i.id
        JOIN payment_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
        WHERE i.organization_id=:org AND i.id IN (:ids)
          AND i.payment_status IN ('PAID','PARTIALLY_REFUNDED') AND a.confirmed_at IS NOT NULL
          AND t.status='COMPLETED' AND t.provider_type='STRIPE' AND t.currency='EUR' AND a.currency='EUR'
          AND i.currency='EUR' AND i.estimated_cost=a.amount AND a.amount>0
          AND t.provider_tx_id LIKE 'cs_%' AND i.stripe_session_id=t.provider_tx_id AND COALESCE(t.disputed_amount,0)=0
          AND (SELECT count(*) FROM intervention_payment_allocations b JOIN payment_transactions p ON p.id=b.transaction_id
            AND p.organization_id=b.organization_id WHERE b.organization_id=i.organization_id AND b.intervention_id=i.id
            AND p.status<>'CANCELLED')=1
          AND NOT EXISTS (SELECT 1 FROM intervention_payment_allocations b JOIN service_quote_cancellations c
            ON c.organization_id=b.organization_id AND c.intervention_id=b.intervention_id WHERE b.transaction_id=t.id)
        """, nativeQuery=true)
    List<Long> findAllocatedRefundCandidateMissionIds(@Param("org") Long org, @Param("ids") List<Long> ids);

    @Query("select p from PaymentTransaction p where p.organizationId=:org and p.sourceType='INTERVENTION' "
            + "and p.paymentType=com.clenzy.model.TransactionType.CHECKOUT and p.sourceId in :ids")
    List<PaymentTransaction> findStandaloneRefundAttempts(@Param("org") Long org, @Param("ids") List<Long> ids);

    default List<Long> findStandaloneRefundableMissionIds(Long org, List<Long> ids) {
        return retainRefundCandidates(org, findStandaloneRefundCandidateMissionIds(org, ids), 1L);
    }

    default List<Long> findAllocatedRefundableMissionIds(Long org, List<Long> ids) {
        return retainRefundCandidates(org, findAllocatedRefundCandidateMissionIds(org, ids), 0L);
    }

    /** Lecture bornée à la page : ne jamais confondre FAILED et preuve de non-encaissement. */
    private List<Long> retainRefundCandidates(Long org, List<Long> candidates, long expectedReceipts) {
        if (candidates.isEmpty()) return List.of();
        var counts = findStandaloneRefundAttempts(org, candidates).stream()
                .filter(com.clenzy.model.BaitlyCheckoutEvidence::requiresReconciliation)
                .collect(java.util.stream.Collectors.groupingBy(PaymentTransaction::getSourceId,
                        java.util.stream.Collectors.counting()));
        return candidates.stream().distinct().filter(id -> counts.getOrDefault(id, 0L) == expectedReceipts).toList();
    }

    /** Une part de lot contesté reste bloquée tant que le litige n'est pas réparti. */
    @Query(value = """
        SELECT DISTINCT CASE WHEN t.source_type IN ('RESERVATION','BOOKING_CHECKOUT','BOOKING_BALANCE')
          THEN 'RESERVATION' ELSE t.source_type END, t.source_id
        FROM payment_transactions t WHERE t.organization_id=:org AND t.disputed_amount>0 AND t.source_id IN (:ids)
        UNION
        SELECT DISTINCT 'INTERVENTION', a.intervention_id FROM intervention_payment_allocations a
        JOIN payment_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
        WHERE a.organization_id=:org AND t.disputed_amount>0 AND a.intervention_id IN (:ids)
        UNION
        SELECT DISTINCT 'INTERVENTION', r.converted_intervention_id FROM service_requests r
        JOIN payment_transactions t ON t.source_type='SERVICE_REQUEST' AND t.source_id=r.id AND t.organization_id=r.organization_id
        WHERE r.organization_id=:org AND t.disputed_amount>0 AND r.converted_intervention_id IN (:ids)
        """,nativeQuery=true)
    java.util.List<Object[]> findDisputedSources(@Param("org") Long org,@Param("ids") java.util.List<Long> ids);
    @Query("select t from PaymentTransaction t where t.sourceType='BOOKING_CANCELLATION' "
         + "and t.paymentType=com.clenzy.model.TransactionType.REFUND "
         + "and t.status=com.clenzy.model.TransactionStatus.PROCESSING order by t.updatedAt, t.id")
    List<PaymentTransaction> findPendingBookingCancellationRefunds(Pageable pageable);

    @Query("select t from PaymentTransaction t where t.organizationId = :orgId "
         + "and t.sourceId in :reservationIds and t.sourceType in :sourceTypes order by t.id")
    List<PaymentTransaction> findReservationFunding(@Param("orgId") Long orgId,
            @Param("reservationIds") List<Long> reservationIds,
            @Param("sourceTypes") java.util.Set<String> sourceTypes);


    /** Inclut les membres secondaires des lots ; un échec confirmé ne bloque plus l'accord. */
    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM payment_transactions p
          WHERE p.organization_id = :orgId AND (p.status <> 'FAILED' OR ((p.source_type = 'INTERVENTION_BATCH' AND COALESCE(p.metadata->>'batchRetryAllowed','false') <> 'true') OR (p.source_type = 'INTERVENTION' AND COALESCE(p.metadata->>'standaloneRetryAllowed','false') <> 'true')))
            AND (
              (p.source_type IN ('INTERVENTION','INTERVENTION_BATCH') AND (
                p.source_id = :missionId OR CAST(:missionId AS text) = ANY(
                  string_to_array(regexp_replace(p.metadata ->> 'interventionIds', '\\s', '', 'g'), ','))))
              OR (p.source_type IN ('DEFERRED_INTERVENTIONS_HOST', 'DEFERRED_INTERVENTIONS_PROPERTY')
                AND CAST(:missionId AS text) = ANY(
                  string_to_array(regexp_replace(p.metadata ->> 'intervention_ids', '\\s', '', 'g'), ',')))
            )
        )
        """, nativeQuery = true)
    boolean hasRecordedInterventionPayment(@Param("orgId") Long orgId, @Param("missionId") Long missionId);

    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM payment_transactions p
          WHERE p.organization_id = :orgId AND (p.status IN ('PENDING','PROCESSING') OR ((p.source_type = 'INTERVENTION_BATCH' AND p.status = 'FAILED' AND COALESCE(p.metadata->>'batchRetryAllowed','false') <> 'true') OR (p.source_type = 'INTERVENTION' AND p.status = 'FAILED' AND COALESCE(p.metadata->>'standaloneRetryAllowed','false') <> 'true')))
            AND (
              (p.source_type IN ('INTERVENTION','INTERVENTION_BATCH') AND (
                p.source_id = :missionId OR CAST(:missionId AS text) = ANY(
                  string_to_array(regexp_replace(p.metadata ->> 'interventionIds', '\\s', '', 'g'), ','))))
              OR (p.source_type IN ('DEFERRED_INTERVENTIONS_HOST', 'DEFERRED_INTERVENTIONS_PROPERTY')
                AND CAST(:missionId AS text) = ANY(
                  string_to_array(regexp_replace(p.metadata ->> 'intervention_ids', '\\s', '', 'g'), ',')))
            )
        )
        """, nativeQuery = true)
    boolean hasOpenInterventionPayment(@Param("orgId") Long orgId, @Param("missionId") Long missionId);

    Optional<PaymentTransaction> findByTransactionRef(String transactionRef);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PaymentTransaction t where t.organizationId=:org and t.transactionRef=:ref")
    Optional<PaymentTransaction> lockByReference(@Param("org") Long org, @Param("ref") String ref);

    @Query("select t from PaymentTransaction t where t.paymentType=com.clenzy.model.TransactionType.REFUND "
            + "and t.providerType=com.clenzy.model.PaymentProviderType.STRIPE "
            + "and t.idempotencyKey like 'REFUND-%' "
            + "and t.status=com.clenzy.model.TransactionStatus.PROCESSING order by t.updatedAt, t.id")
    List<PaymentTransaction> findPendingStripeRefunds(Pageable pageable);

    Optional<PaymentTransaction> findByIdempotencyKey(String idempotencyKey);

    /**
     * Transaction identifiée par sa référence chez le fournisseur.
     *
     * <p>Seule voie pour rattacher à une organisation un événement qui ne porte
     * que l'identifiant Stripe — litige, session expirée. L'organisation vient
     * ainsi de NOTRE base, jamais du message reçu.</p>
     */
    Optional<PaymentTransaction> findByProviderTxId(String providerTxId);

    /**
     * Passe la transaction en COMPLETED par UPDATE conditionnel (compare-and-set).
     *
     * <p>Audit 2026-07 (P6-05) : la transition etait un check-then-act — SELECT sans verrou,
     * test du statut, puis {@code save} inconditionnel. Sous READ COMMITTED, deux rejeux
     * concurrents du meme webhook lisaient tous deux PROCESSING et publiaient chacun un
     * evenement PAYMENT_COMPLETED dans l'outbox. Avec le CAS, un seul appel modifie une
     * ligne ; les autres obtiennent 0 et n'ont rien a publier.</p>
     *
     * @return 1 si la transition a eu lieu, 0 si la transaction etait deja COMPLETED
     *         ou n'existe pas
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PaymentTransaction t SET t.status = com.clenzy.model.TransactionStatus.COMPLETED "
         + "WHERE t.transactionRef = :transactionRef "
         + "AND t.status <> com.clenzy.model.TransactionStatus.COMPLETED")
    int markCompleted(@Param("transactionRef") String transactionRef);

    /**
     * Passe la transaction en FAILED par UPDATE conditionnel, <b>sans jamais degrader</b>
     * une transaction deja COMPLETED.
     *
     * <p>Audit 2026-07 (P6-12) : {@code failTransaction} n'avait aucune garde d'etat. Le rejeu
     * d'un webhook d'echec signe, apres un succes, faisait repasser en FAILED une transaction
     * encaissee et publiait PAYMENT_FAILED — desynchronisant le ledger de l'entite metier
     * restee PAID, avec relances de recouvrement a la cle.</p>
     *
     * @return 1 si la transition a eu lieu, 0 si la transaction etait COMPLETED (transition
     *         refusee), deja FAILED, ou inexistante
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PaymentTransaction t SET t.status = com.clenzy.model.TransactionStatus.FAILED, "
         + "t.errorMessage = :errorMessage "
         + "WHERE t.transactionRef = :transactionRef "
         + "AND t.status <> com.clenzy.model.TransactionStatus.COMPLETED "
         + "AND t.status <> com.clenzy.model.TransactionStatus.FAILED")
    int markFailed(@Param("transactionRef") String transactionRef,
                   @Param("errorMessage") String errorMessage);

    List<PaymentTransaction> findByOrganizationIdAndSourceTypeAndSourceId(
        Long organizationId, String sourceType, Long sourceId);

    Page<PaymentTransaction> findByOrganizationId(Long organizationId, Pageable pageable);

    Page<PaymentTransaction> findByOrganizationIdAndStatus(
        Long organizationId, TransactionStatus status, Pageable pageable);

    Page<PaymentTransaction> findByOrganizationIdAndProviderType(
        Long organizationId, PaymentProviderType providerType, Pageable pageable);

    List<PaymentTransaction> findByOrganizationIdAndStatus(
        Long organizationId, TransactionStatus status);
}
