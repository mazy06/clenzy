package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Demandes de devis. Lectures PLATEFORME : la table relie deux organisations,
 * aucun filtre tenant ne peut la borner. Chaque requete porte donc elle-meme le
 * cote qu'elle sert.
 */
@Repository
public interface MarketplaceQuoteRequestRepository extends JpaRepository<MarketplaceQuoteRequest, Long> {
    @Modifying(flushAutomatically=true)
    @Query("UPDATE MarketplaceQuoteRequest q SET q.status=com.clenzy.marketplace.model.QuoteRequestStatus.WITHDRAWN, q.updatedAt=:now, q.decisionReason='Un autre devis a été accepté' WHERE q.serviceRequestId=:need AND q.id<>:winner AND q.status IN (com.clenzy.marketplace.model.QuoteRequestStatus.SENT,com.clenzy.marketplace.model.QuoteRequestStatus.QUOTED)")
    int withdrawOtherOffers(@Param("need") Long need,@Param("winner") Long winner,@Param("now") LocalDateTime now);
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE MarketplaceQuoteRequest q SET q.providerTeamId = :teamId WHERE q.id = :id AND q.providerId = :providerId AND q.providerTeamId IS NULL AND q.status = com.clenzy.marketplace.model.QuoteRequestStatus.SENT")
    int selectTeam(@Param("id") Long id, @Param("providerId") Long providerId, @Param("teamId") Long teamId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM MarketplaceQuoteRequest q WHERE q.id = :id")
    java.util.Optional<MarketplaceQuoteRequest> findForDiscussion(@Param("id") Long id);

    @Query(value = "SELECT id FROM marketplace_quote_requests WHERE discussion_published_status IS DISTINCT FROM status AND (discussion_retry_at IS NULL OR discussion_retry_at <= CURRENT_TIMESTAMP) ORDER BY updated_at LIMIT 50", nativeQuery = true)
    List<Long> findPendingDiscussions();

    @org.springframework.transaction.annotation.Transactional
    @Modifying
    @Query(value = "UPDATE marketplace_quote_requests SET discussion_retry_at = CURRENT_TIMESTAMP + INTERVAL '1 minute' WHERE id = :id", nativeQuery = true)
    void deferDiscussion(@Param("id") Long id);

    /** Cote DEMANDEUR : ce que mon organisation a envoye. */
    Page<MarketplaceQuoteRequest> findByRequesterOrganizationIdOrderByCreatedAtDesc(
        Long requesterOrganizationId, Pageable pageable);

    Page<MarketplaceQuoteRequest> findByRequesterOrganizationIdAndStatusInOrderByCreatedAtDesc(
        Long requesterOrganizationId, List<QuoteRequestStatus> statuses, Pageable pageable);

    @Query(value = "SELECT q.* FROM marketplace_quote_requests q WHERE q.requester_organization_id = :orgId AND q.status IN :statuses "
        + "AND (:staff = true OR (q.property_id IS NULL AND q.requested_by_user_id = :userId) OR EXISTS "
        + "(SELECT 1 FROM properties p JOIN users u ON u.id=p.owner_id WHERE p.id=q.property_id "
        + "AND p.organization_id=:orgId AND u.keycloak_id=:subject)) ORDER BY q.created_at DESC,q.id DESC",
        countQuery = "SELECT count(*) FROM marketplace_quote_requests q WHERE q.requester_organization_id = :orgId AND q.status IN :statuses "
        + "AND (:staff = true OR (q.property_id IS NULL AND q.requested_by_user_id = :userId) OR EXISTS "
        + "(SELECT 1 FROM properties p JOIN users u ON u.id=p.owner_id WHERE p.id=q.property_id "
        + "AND p.organization_id=:orgId AND u.keycloak_id=:subject))", nativeQuery = true)
    Page<MarketplaceQuoteRequest> findAccessibleForRequester(Long orgId, Long userId, String subject,
        boolean staff, List<String> statuses, Pageable pageable);

    /** Filtre l'appartenance avant pagination et comptage, sans accès hérité d'une ancienne équipe. */
    @Query("SELECT q FROM MarketplaceQuoteRequest q WHERE q.providerId = :providerId "
        + "AND (q.providerTeamId IS NULL OR q.providerTeamId IN :teamIds) "
        + "AND q.status IN :statuses ORDER BY q.createdAt DESC, q.id DESC")
    Page<MarketplaceQuoteRequest> findAccessibleForProvider(
        @Param("providerId") Long providerId, @Param("teamIds") List<Long> teamIds,
        @Param("statuses") List<QuoteRequestStatus> statuses, Pageable pageable);

    @Query("SELECT COUNT(q) FROM MarketplaceQuoteRequest q WHERE q.providerId = :providerId "
        + "AND (q.providerTeamId IS NULL OR q.providerTeamId IN :teamIds) AND q.status = :status")
    long countAccessibleForProvider(@Param("providerId") Long providerId,
        @Param("teamIds") List<Long> teamIds, @Param("status") QuoteRequestStatus status);

    /**
     * Chiffrage par le prestataire — transition CONDITIONNELLE.
     *
     * <p>La ligne n'est modifiee que si elle est encore {@code SENT}. Deux
     * envois concurrents se serialisent sur le verrou de ligne : un seul obtient
     * 1, l'autre 0 et abandonne. Un verifier-puis-agir laisserait au contraire
     * le second ecraser le devis du premier (regle n°8 de l'audit).</p>
     *
     * @return 1 si le devis a ete pose, 0 si la demande n'etait plus ouverte
     */
    @Modifying(clearAutomatically = true)
    @Query("""
        UPDATE MarketplaceQuoteRequest q
           SET q.status = com.clenzy.marketplace.model.QuoteRequestStatus.QUOTED,
               q.quotedAmount = :amount, q.quotedCurrency = :currency,
               q.quoteMessage = :message, q.quoteValidUntil = :validUntil,
               q.quotedAt = :now, q.updatedAt = :now
         WHERE q.id = :id
           AND q.providerId = :providerId
           AND q.status = com.clenzy.marketplace.model.QuoteRequestStatus.SENT
        """)
    int quoteIfStillOpen(@Param("id") Long id,
                         @Param("providerId") Long providerId,
                         @Param("amount") BigDecimal amount,
                         @Param("currency") String currency,
                         @Param("message") String message,
                         @Param("validUntil") LocalDate validUntil,
                         @Param("now") LocalDateTime now);

    /**
     * Decision du demandeur — transition CONDITIONNELLE depuis {@code QUOTED}.
     *
     * <p>Un double clic sur « Accepter » creerait sinon deux interventions.</p>
     */
    @Modifying(clearAutomatically = true)
    @Query("""
        UPDATE MarketplaceQuoteRequest q
           SET q.status = :target, q.decidedAt = :now,
               q.decisionReason = :reason, q.updatedAt = :now
         WHERE q.id = :id
           AND q.requesterOrganizationId = :orgId
           AND q.status = com.clenzy.marketplace.model.QuoteRequestStatus.QUOTED
        """)
    int decideIfStillQuoted(@Param("id") Long id,
                            @Param("orgId") Long organizationId,
                            @Param("target") QuoteRequestStatus target,
                            @Param("reason") String reason,
                            @Param("now") LocalDateTime now);

    /** Transition conditionnelle depuis {@code SENT} : retrait ou refus de suite. */
    @Modifying(clearAutomatically = true)
    @Query("""
        UPDATE MarketplaceQuoteRequest q
           SET q.status = :target, q.decidedAt = :now,
               q.decisionReason = :reason, q.updatedAt = :now
         WHERE q.id = :id AND q.status = com.clenzy.marketplace.model.QuoteRequestStatus.SENT
        """)
    int closeIfStillSent(@Param("id") Long id,
                         @Param("target") QuoteRequestStatus target,
                         @Param("reason") String reason,
                         @Param("now") LocalDateTime now);

    /** Rattache une seule mission à une demande acceptée, dans la transaction de décision. */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE MarketplaceQuoteRequest q SET q.interventionId = :interventionId, "
         + "q.updatedAt = :now WHERE q.id = :id AND q.interventionId IS NULL "
         + "AND q.status = com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED")
    int attachIntervention(@Param("id") Long id,
                           @Param("interventionId") Long interventionId,
                           @Param("now") LocalDateTime now);
}
