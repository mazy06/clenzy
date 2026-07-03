package com.clenzy.repository;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GuestReviewRepository extends JpaRepository<GuestReview, Long> {

    @Query("SELECT r FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    Page<GuestReview> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.channelName = :channel AND r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    Page<GuestReview> findByChannelName(@Param("channel") ChannelName channel, @Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    Page<GuestReview> findAllByOrgId(@Param("orgId") Long orgId, Pageable pageable);

    // ─── Avis PUBLICS (booking engine) : uniquement isPublic = true ───────────────

    /** Distribution [rating, count] des avis publics d'une org (→ moyenne + total + distribution). */
    @Query("SELECT r.rating, COUNT(r) FROM GuestReview r "
            + "WHERE r.organizationId = :orgId AND r.isPublic = true AND r.rating IS NOT NULL GROUP BY r.rating")
    List<Object[]> publicRatingDistributionByOrg(@Param("orgId") Long orgId);

    /** Avis publics récents d'une org (avec texte), pour l'affichage social proof. */
    @Query("SELECT r FROM GuestReview r WHERE r.organizationId = :orgId AND r.isPublic = true "
            + "AND r.reviewText IS NOT NULL ORDER BY r.reviewDate DESC")
    List<GuestReview> findPublicRecentByOrg(@Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId " +
           "AND r.reviewDate BETWEEN :from AND :to ORDER BY r.reviewDate DESC")
    List<GuestReview> findByPropertyIdAndDateRange(@Param("propertyId") Long propertyId,
        @Param("orgId") Long orgId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT r FROM GuestReview r WHERE r.rating < :threshold AND r.hostResponse IS NULL " +
           "AND r.organizationId = :orgId ORDER BY r.reviewDate DESC")
    List<GuestReview> findNegativeWithoutResponse(@Param("threshold") int threshold, @Param("orgId") Long orgId);

    @Query("SELECT AVG(r.rating) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId")
    Double averageRatingByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Batch : moyennes de ratings pour N proprietes en UNE seule query.
     * Utilise par {@code AnalyzePortfolioTool.computeMetrics} pour eviter le N+1
     * (50 proprietes → 1 query au lieu de 50 sequentielles).
     *
     * <p>Retourne {@code [propertyId, avgRating]} pour chaque propriete qui a
     * au moins une review. Les proprietes sans review ne sont pas retournees
     * — le caller doit faire un Map.getOrDefault().</p>
     */
    @Query("SELECT r.propertyId, AVG(r.rating) FROM GuestReview r "
            + "WHERE r.propertyId IN :propertyIds AND r.organizationId = :orgId "
            + "GROUP BY r.propertyId")
    List<Object[]> averageRatingByPropertyIds(@Param("propertyIds") List<Long> propertyIds,
                                                @Param("orgId") Long orgId);

    @Query("SELECT COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId")
    long countByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT r.rating, COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId GROUP BY r.rating")
    List<Object[]> countByPropertyIdGroupByRating(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT r.sentimentLabel, COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId AND r.sentimentLabel IS NOT NULL GROUP BY r.sentimentLabel")
    List<Object[]> countByPropertyIdGroupBySentiment(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    Optional<GuestReview> findByExternalReviewIdAndOrganizationId(String externalReviewId, Long organizationId);

    // ─── Relance d'avis automatique (SendReviewRequestExecutor, F4a) ────────────

    /** Vrai si un avis est deja rattache a la reservation (lien direct). */
    boolean existsByReservationIdAndOrganizationId(Long reservationId, Long organizationId);

    /**
     * Vrai si le logement a recu un avis a partir de la date donnee (repli quand les avis
     * importes des OTA n'ont pas de lien reservation : un avis poste apres le check-out
     * du sejour compte comme recu).
     */
    boolean existsByPropertyIdAndOrganizationIdAndReviewDateGreaterThanEqual(
        Long propertyId, Long organizationId, LocalDate reviewDate);

    @Query("SELECT r FROM GuestReview r WHERE r.id = :id AND r.organizationId = :orgId")
    Optional<GuestReview> findByIdAndOrgId(@Param("id") Long id, @Param("orgId") Long orgId);

    // ─── Public reviews (Booking Engine) ────────────────────────────────────────

    @Query("SELECT r FROM GuestReview r WHERE r.propertyId = :propertyId AND r.organizationId = :orgId " +
           "AND r.isPublic = true ORDER BY r.reviewDate DESC")
    Page<GuestReview> findPublicByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT r FROM GuestReview r WHERE r.organizationId = :orgId " +
           "AND r.isPublic = true ORDER BY r.reviewDate DESC")
    Page<GuestReview> findPublicByOrgId(@Param("orgId") Long orgId, Pageable pageable);

    @Query("SELECT AVG(r.rating) FROM GuestReview r WHERE r.propertyId = :propertyId " +
           "AND r.organizationId = :orgId AND r.isPublic = true")
    Double averagePublicRatingByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(r) FROM GuestReview r WHERE r.propertyId = :propertyId " +
           "AND r.organizationId = :orgId AND r.isPublic = true")
    long countPublicByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    @Query("SELECT AVG(r.rating) FROM GuestReview r WHERE r.organizationId = :orgId AND r.isPublic = true")
    Double averagePublicRatingByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(r) FROM GuestReview r WHERE r.organizationId = :orgId AND r.isPublic = true")
    long countPublicByOrgId(@Param("orgId") Long orgId);

    /**
     * Batch : note moyenne + nombre d'avis PUBLICS par propriété, en UNE seule query (anti N+1).
     * Retourne {@code [propertyId, avgRating, count]} pour chaque propriété ayant au moins un avis
     * public noté — les propriétés sans avis ne sont pas retournées (caller : getOrDefault).
     */
    @Query("SELECT r.propertyId, AVG(r.rating), COUNT(r) FROM GuestReview r "
            + "WHERE r.propertyId IN :propertyIds AND r.organizationId = :orgId "
            + "AND r.isPublic = true AND r.rating IS NOT NULL GROUP BY r.propertyId")
    List<Object[]> publicReviewStatsByPropertyIds(@Param("propertyIds") List<Long> propertyIds,
                                                  @Param("orgId") Long orgId);
}
