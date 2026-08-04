package com.clenzy.repository;

import com.clenzy.model.PaymentDispute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PaymentDisputeRepository extends JpaRepository<PaymentDispute, Long> {

    Optional<PaymentDispute> findByProviderDisputeId(String providerDisputeId);

    Optional<PaymentDispute> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Transition CAS OPEN → SUBMITTED (jamais de check-then-act — règle audit n°8). */
    @Modifying
    @Query("UPDATE PaymentDispute d SET d.status = com.clenzy.model.PaymentDispute.Status.SUBMITTED, "
            + "d.evidenceSubmittedAt = :at WHERE d.id = :id AND d.organizationId = :orgId "
            + "AND d.status = com.clenzy.model.PaymentDispute.Status.OPEN")
    int markSubmitted(@Param("id") Long id, @Param("orgId") Long orgId, @Param("at") Instant at);

    /** Issue du fournisseur (webhook closed) — quel que soit l'état intermédiaire. */
    @Modifying
    @Query("UPDATE PaymentDispute d SET d.status = :status, d.outcome = :outcome, d.outcomeAt = :at "
            + "WHERE d.providerDisputeId = :providerDisputeId "
            + "AND d.status <> com.clenzy.model.PaymentDispute.Status.WON "
            + "AND d.status <> com.clenzy.model.PaymentDispute.Status.LOST")
    int markClosed(@Param("providerDisputeId") String providerDisputeId,
                   @Param("status") PaymentDispute.Status status,
                   @Param("outcome") String outcome,
                   @Param("at") Instant at);
}
