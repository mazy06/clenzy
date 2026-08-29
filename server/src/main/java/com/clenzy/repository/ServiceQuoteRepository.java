package com.clenzy.repository;

import com.clenzy.model.ServiceQuote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ServiceQuoteRepository extends JpaRepository<ServiceQuote, Long> {

    List<ServiceQuote> findByInterventionIdAndOrganizationIdOrderByAmountAsc(
            Long interventionId, Long organizationId);

    Optional<ServiceQuote> findByIdAndOrganizationId(Long id, Long organizationId);

    /** « Mes devis » — les plus recents d'abord, toujours borne a l'organisation. */
    List<ServiceQuote> findByProviderUserIdAndOrganizationIdOrderByCreatedAtDesc(
            Long providerUserId, Long organizationId);

    /** Transition CAS RECEIVED → APPROVED (l'unique partiel DB verrouille le doublon). */
    @Modifying
    @Query("UPDATE ServiceQuote q SET q.status = com.clenzy.model.ServiceQuote.Status.APPROVED, "
            + "q.approvedBy = :approvedBy, q.approvedAt = :at "
            + "WHERE q.id = :id AND q.organizationId = :orgId "
            + "AND q.status = com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int markApproved(@Param("id") Long id, @Param("orgId") Long orgId,
                     @Param("approvedBy") String approvedBy, @Param("at") Instant at);

    /** Les devis concurrents de la même intervention sont écartés à l'approbation. */
    @Modifying
    @Query("UPDATE ServiceQuote q SET q.status = com.clenzy.model.ServiceQuote.Status.REJECTED "
            + "WHERE q.interventionId = :interventionId AND q.organizationId = :orgId "
            + "AND q.id <> :approvedId AND q.status = com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int rejectSiblings(@Param("interventionId") Long interventionId,
                       @Param("orgId") Long orgId,
                       @Param("approvedId") Long approvedId);
}
