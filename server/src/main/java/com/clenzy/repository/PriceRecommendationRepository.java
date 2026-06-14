package com.clenzy.repository;

import com.clenzy.model.PriceRecommendation;
import com.clenzy.model.PriceRecommendationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PriceRecommendationRepository extends JpaRepository<PriceRecommendation, Long> {

    Optional<PriceRecommendation> findByOrganizationIdAndPropertyIdAndRecoDate(
        Long organizationId, Long propertyId, LocalDate recoDate);

    /**
     * Recommandations d'un bien sur une plage (affichage calendrier). Org-scopé.
     */
    List<PriceRecommendation> findByOrganizationIdAndPropertyIdAndRecoDateBetween(
        Long organizationId, Long propertyId, LocalDate from, LocalDate to);

    /**
     * Recommandations d'un statut donné pour un bien sur une plage — utilisé par le PriceEngine
     * (CLZ-P0-16) pour lire les suggestions {@code ACCEPTED} comme niveau {@code AI_SUGGESTION}.
     */
    List<PriceRecommendation> findByOrganizationIdAndPropertyIdAndStatusAndRecoDateBetween(
        Long organizationId, Long propertyId, PriceRecommendationStatus status,
        LocalDate from, LocalDate to);

    /**
     * Transition de statut atomique (CAS, audit #8) : ne modifie la ligne que si elle est encore
     * dans {@code expectedStatus} et appartient à l'org. Renvoie le nombre de lignes affectées
     * (1 = transition réussie, 0 = course perdue / état déjà changé). Évite tout check-then-act.
     */
    @Modifying
    @Query("UPDATE PriceRecommendation r SET r.status = :newStatus, r.updatedAt = CURRENT_TIMESTAMP "
        + "WHERE r.id = :id AND r.organizationId = :orgId AND r.status = :expectedStatus")
    int transitionStatus(@Param("id") Long id,
                         @Param("orgId") Long orgId,
                         @Param("expectedStatus") PriceRecommendationStatus expectedStatus,
                         @Param("newStatus") PriceRecommendationStatus newStatus);
}
