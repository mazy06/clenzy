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
    List<ServiceQuote> findByServiceRequestIdAndOrganizationIdOrderByCreatedAtDesc(Long requestId,Long organizationId);
    @Modifying(flushAutomatically=true)
    @Query("UPDATE ServiceQuote q SET q.status=com.clenzy.model.ServiceQuote.Status.REJECTED WHERE q.serviceRequestId=:requestId AND q.organizationId=:orgId AND q.id<>:winner AND q.status=com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int rejectNeedSiblings(@Param("requestId") Long requestId,@Param("orgId") Long orgId,@Param("winner") Long winner);
    @Query(value = "SELECT EXISTS (SELECT 1 FROM service_quotes WHERE intervention_id = :id "
            + "AND organization_id = :orgId AND status = 'APPROVED')", nativeQuery = true)
    boolean hasApprovedAgreement(@Param("id") Long interventionId, @Param("orgId") Long organizationId);

    @Query(value = "SELECT * FROM service_quotes WHERE marketplace_request_id = :requestId AND organization_id = :orgId", nativeQuery = true)
    Optional<ServiceQuote> findMarketplaceQuote(@Param("requestId") Long requestId, @Param("orgId") Long orgId);

    @Modifying(flushAutomatically = true)
    @Query("UPDATE ServiceQuote q SET q.interventionId = :interventionId WHERE q.id = :id AND q.organizationId = :orgId AND q.status = com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int linkMarketplaceMission(@Param("id") Long id, @Param("orgId") Long orgId, @Param("interventionId") Long interventionId);

    @Modifying
    @Query("UPDATE ServiceQuote q SET q.documentRef = :reference WHERE q.id = :id")
    int attachDocument(@Param("id") Long id, @Param("reference") String reference);

    @Query(value = "SELECT * FROM service_quotes WHERE intervention_id = :interventionId "
            + "AND organization_id = :orgId ORDER BY amount ASC", nativeQuery = true)
    List<ServiceQuote> findByInterventionIdAndOrganizationIdOrderByAmountAsc(
            @Param("interventionId") Long interventionId, @Param("orgId") Long organizationId);

    Optional<ServiceQuote> findByIdAndOrganizationId(Long id, Long organizationId);

    /** « Mes devis » — les plus recents d'abord, toujours borne a l'organisation. */
    List<ServiceQuote> findByProviderUserIdAndOrganizationIdOrderByCreatedAtDesc(
            Long providerUserId, Long organizationId);

    /** Transition CAS RECEIVED → APPROVED (l'unique partiel DB verrouille le doublon). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ServiceQuote q SET q.status = com.clenzy.model.ServiceQuote.Status.APPROVED, "
            + "q.approvedBy = :approvedBy, q.approvedAt = :at "
            + "WHERE q.id = :id AND q.organizationId = :orgId "
            + "AND q.status = com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int markApproved(@Param("id") Long id, @Param("orgId") Long orgId,
                     @Param("approvedBy") String approvedBy, @Param("at") Instant at);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ServiceQuote q SET q.status = com.clenzy.model.ServiceQuote.Status.REJECTED "
            + "WHERE q.id = :id AND q.organizationId = :orgId "
            + "AND q.status = com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int markRejected(@Param("id") Long id, @Param("orgId") Long orgId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ServiceQuote q WHERE q.id = :id AND q.organizationId = :orgId "
            + "AND q.status <> com.clenzy.model.ServiceQuote.Status.APPROVED")
    int deleteUnapproved(@Param("id") Long id, @Param("orgId") Long orgId);

    /** Les devis concurrents de la même intervention sont écartés à l'approbation. */
    @Modifying
    @Query("UPDATE ServiceQuote q SET q.status = com.clenzy.model.ServiceQuote.Status.REJECTED "
            + "WHERE q.interventionId = :interventionId AND q.organizationId = :orgId "
            + "AND q.id <> :approvedId AND q.status = com.clenzy.model.ServiceQuote.Status.RECEIVED")
    int rejectSiblings(@Param("interventionId") Long interventionId,
                       @Param("orgId") Long orgId,
                       @Param("approvedId") Long approvedId);
}
