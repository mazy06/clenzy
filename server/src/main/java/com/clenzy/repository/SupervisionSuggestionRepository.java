package com.clenzy.repository;

import com.clenzy.model.SupervisionSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SupervisionSuggestionRepository extends JpaRepository<SupervisionSuggestion, Long> {

    /** Suggestions en attente non expirées d'un logement (chrono inversé). */
    List<SupervisionSuggestion> findByOrganizationIdAndPropertyIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
            Long organizationId, Long propertyId, String status, Instant now);

    /** Déduplication : une même proposition en attente existe-t-elle déjà ? */
    boolean existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
            Long organizationId, Long propertyId, String moduleKey, String title, String status);

    /** Chargement ownership-safe (org du requester) pour le rejet. */
    Optional<SupervisionSuggestion> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Transition atomique {@code PENDING → APPLIED} (CAS, jamais check-then-act) :
     * n'affecte la ligne que si elle est encore en attente et dans l'org. Retourne
     * le nombre de lignes modifiées (1 = transition acquise, 0 = déjà résolue/absente).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE SupervisionSuggestion s SET s.status = 'APPLIED', s.appliedAt = :now "
            + "WHERE s.id = :id AND s.organizationId = :orgId AND s.status = 'PENDING'")
    int markApplied(@Param("id") Long id, @Param("orgId") Long orgId, @Param("now") Instant now);
}
