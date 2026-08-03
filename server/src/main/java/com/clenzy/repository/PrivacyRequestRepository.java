package com.clenzy.repository;

import com.clenzy.model.PrivacyRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PrivacyRequestRepository extends JpaRepository<PrivacyRequest, Long> {

    List<PrivacyRequest> findByOrganizationIdOrderByDueAtAsc(Long organizationId);

    Optional<PrivacyRequest> findByIdAndOrganizationId(Long id, Long organizationId);

    List<PrivacyRequest> findByOrganizationIdAndTypeAndStatus(
            Long organizationId, PrivacyRequest.Type type, PrivacyRequest.Status status);

    /**
     * Verrou d'exécution CAS : RECEIVED → IN_PROGRESS. 0 ligne = demande déjà en
     * cours/traitée/refusée — l'appelant refuse au lieu d'effacer deux fois.
     */
    @Modifying
    @Query("UPDATE PrivacyRequest p SET p.status = 'IN_PROGRESS', p.handledBy = :handledBy " +
           "WHERE p.id = :id AND p.organizationId = :orgId AND p.status = 'RECEIVED'")
    int markInProgress(@Param("id") Long id, @Param("orgId") Long orgId,
                       @Param("handledBy") String handledBy);

    /** Clôture : IN_PROGRESS → COMPLETED avec rapport d'exécution persisté. */
    @Modifying
    @Query("UPDATE PrivacyRequest p SET p.status = 'COMPLETED', p.completedAt = :now, " +
           "p.report = :report WHERE p.id = :id AND p.organizationId = :orgId " +
           "AND p.status = 'IN_PROGRESS'")
    int markCompleted(@Param("id") Long id, @Param("orgId") Long orgId,
                      @Param("now") Instant now, @Param("report") String report);

    /** Refus motivé : RECEIVED → REFUSED (motif dans notes, auteur tracé). */
    @Modifying
    @Query("UPDATE PrivacyRequest p SET p.status = 'REFUSED', p.completedAt = :now, " +
           "p.handledBy = :handledBy, p.notes = :reason " +
           "WHERE p.id = :id AND p.organizationId = :orgId AND p.status = 'RECEIVED'")
    int markRefused(@Param("id") Long id, @Param("orgId") Long orgId,
                    @Param("now") Instant now, @Param("handledBy") String handledBy,
                    @Param("reason") String reason);

    /** Clôture manuelle (ACCESS / RECTIFICATION traités hors système) : RECEIVED → COMPLETED. */
    @Modifying
    @Query("UPDATE PrivacyRequest p SET p.status = 'COMPLETED', p.completedAt = :now, " +
           "p.handledBy = :handledBy WHERE p.id = :id AND p.organizationId = :orgId " +
           "AND p.status = 'RECEIVED'")
    int markCompletedManually(@Param("id") Long id, @Param("orgId") Long orgId,
                              @Param("now") Instant now, @Param("handledBy") String handledBy);
}
