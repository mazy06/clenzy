package com.clenzy.repository;

import com.clenzy.model.SupervisionSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
