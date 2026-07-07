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

    /** Suggestions en attente non expirées de TOUTE l'organisation (vue portefeuille). */
    List<SupervisionSuggestion> findByOrganizationIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
            Long organizationId, String status, Instant now);

    /** Nb de suggestions passées à un statut (ex. APPLIED) depuis un instant (reporting). */
    long countByOrganizationIdAndStatusAndAppliedAtAfter(
            Long organizationId, String status, Instant since);

    /** Nb de suggestions dans un statut créées depuis un instant (reporting). */
    long countByOrganizationIdAndStatusAndCreatedAtAfter(
            Long organizationId, String status, Instant since);

    /** Nb de suggestions en attente non expirées de l'org (compteur, sans charger la liste). */
    long countByOrganizationIdAndStatusAndExpiresAtAfter(
            Long organizationId, String status, Instant now);

    /**
     * Nb de suggestions en attente non expirées PAR logement (pastilles planning) :
     * une seule requête agrégée, {@code [propertyId, count]} par ligne.
     */
    @Query("SELECT s.propertyId, COUNT(s) FROM SupervisionSuggestion s "
            + "WHERE s.organizationId = :orgId AND s.status = :status AND s.expiresAt > :now "
            + "GROUP BY s.propertyId")
    List<Object[]> countPendingByProperty(@Param("orgId") Long orgId,
                                          @Param("status") String status,
                                          @Param("now") Instant now);

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

    /**
     * Compensation d'une action a EFFET EXTERNE (Stripe) echouee : la transition
     * {@code PENDING → APPLIED} a ete committee AVANT l'appel externe (jamais d'appel
     * Stripe en transaction DB) — si l'effet echoue, la suggestion redevient PENDING
     * (CAS, meme garantie anti-course que {@link #markApplied}).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE SupervisionSuggestion s SET s.status = 'PENDING', s.appliedAt = NULL "
            + "WHERE s.id = :id AND s.organizationId = :orgId AND s.status = 'APPLIED'")
    int revertApplied(@Param("id") Long id, @Param("orgId") Long orgId);
}
