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

    /**
     * Cooldown anti-re-suggestion : une carte identique a-t-elle été rejetée récemment ?
     * (même org/logement/module/intitulé, statut donné, {@code dismissed_at} après le seuil).
     */
    boolean existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatusAndDismissedAtAfter(
            Long organizationId, Long propertyId, String moduleKey, String title, String status,
            Instant dismissedAfter);

    /** Chargement ownership-safe (org du requester) pour le rejet. */
    Optional<SupervisionSuggestion> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * Cap d'auto-application par fenêtre glissante (Vague 2, CALENDAR_BLOCK) :
     * une carte de ce type a-t-elle déjà été AUTO-appliquée ({@code appliedBy}
     * = {@code auto:gate}) sur ce logement depuis {@code appliedAfter} ?
     */
    boolean existsByOrganizationIdAndPropertyIdAndActionTypeAndStatusAndAppliedByAndAppliedAtAfter(
            Long organizationId, Long propertyId, String actionType, String status,
            String appliedBy, Instant appliedAfter);

    /**
     * Enveloppe PAYMENT_REMINDER (V3, « 1ʳᵉ relance seulement ») : une carte de
     * ce type a-t-elle déjà été appliquée pour cette réservation — quel que soit
     * l'acteur (humain ou auto) ?
     */
    boolean existsByOrganizationIdAndReservationIdAndActionTypeAndStatus(
            Long organizationId, Long reservationId, String actionType, String status);

    /**
     * Enveloppe PAYMENT_REMINDER (V3, anti-rafale 72 h) : une carte relance a-t-elle
     * été créée pour cette réservation depuis {@code createdAfter} (tout statut) ?
     */
    boolean existsByOrganizationIdAndReservationIdAndActionTypeAndCreatedAtAfter(
            Long organizationId, Long reservationId, String actionType, Instant createdAfter);

    /**
     * Règles de Confiance des cartes (V3) : cartes DÉCIDÉES d'un type (APPLIED ou
     * DISMISSED), les plus récentes d'abord (instant de décision), pour le calcul
     * des approbations humaines consécutives. Les lignes historiques sans instant
     * de décision (avant 0334) sont exclues — elles ne peuvent ni compter ni
     * casser une série.
     */
    @Query("SELECT s FROM SupervisionSuggestion s WHERE s.organizationId = :orgId "
            + "AND s.actionType = :actionType AND s.status IN ('APPLIED', 'DISMISSED') "
            + "AND (s.appliedAt IS NOT NULL OR s.dismissedAt IS NOT NULL) "
            + "ORDER BY COALESCE(s.appliedAt, s.dismissedAt) DESC")
    List<SupervisionSuggestion> findDecidedByTypeOrderByDecisionDesc(
            @Param("orgId") Long orgId, @Param("actionType") String actionType,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Transition atomique {@code PENDING → APPLIED} (CAS, jamais check-then-act) :
     * n'affecte la ligne que si elle est encore en attente et dans l'org. Retourne
     * le nombre de lignes modifiées (1 = transition acquise, 0 = déjà résolue/absente).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE SupervisionSuggestion s SET s.status = 'APPLIED', s.appliedAt = :now, "
            + "s.appliedBy = :appliedBy "
            + "WHERE s.id = :id AND s.organizationId = :orgId AND s.status = 'PENDING'")
    int markApplied(@Param("id") Long id, @Param("orgId") Long orgId, @Param("now") Instant now,
                    @Param("appliedBy") String appliedBy);

    /**
     * Compensation d'une action a EFFET EXTERNE (Stripe) echouee : la transition
     * {@code PENDING → APPLIED} a ete committee AVANT l'appel externe (jamais d'appel
     * Stripe en transaction DB) — si l'effet echoue, la suggestion redevient PENDING
     * (CAS, meme garantie anti-course que {@link #markApplied}).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE SupervisionSuggestion s SET s.status = 'PENDING', s.appliedAt = NULL, "
            + "s.appliedBy = NULL "
            + "WHERE s.id = :id AND s.organizationId = :orgId AND s.status = 'APPLIED'")
    int revertApplied(@Param("id") Long id, @Param("orgId") Long orgId);

    /**
     * Agrégat d'acceptation PAR TYPE (Vague 1 autonomie) : nb de suggestions
     * ACTIONNABLES par (module, actionType, statut) créées depuis {@code since}.
     * Une ligne {@code [moduleKey, actionType, status, count]} par combinaison.
     * Alimente le tableau « Acceptation par type » du rapport et l'aide à la
     * décision d'activation des toggles d'auto-application.
     */
    @Query("SELECT s.moduleKey, s.actionType, s.status, COUNT(s) FROM SupervisionSuggestion s "
            + "WHERE s.organizationId = :orgId AND s.actionType IS NOT NULL "
            + "AND s.createdAt > :since "
            + "GROUP BY s.moduleKey, s.actionType, s.status")
    List<Object[]> countActionableByTypeAndStatusSince(@Param("orgId") Long orgId,
                                                       @Param("since") Instant since);
}
