package com.clenzy.service;

import com.clenzy.model.ListingQualityScore;
import com.clenzy.model.Property;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.ListingQualityScoreRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Score qualité d'annonce v1 (vague M-A) — DÉTERMINISTE, zéro coût LLM :
 * photos (35 pts), description (25), équipements (20), note moyenne (20).
 * Le breakdown persiste chaque contributeur ; la v2 (vision) s'y ajoutera
 * comme un contributeur de plus, sans changer le modèle.
 */
@Service
public class ListingQualityService {

    private static final Logger log = LoggerFactory.getLogger(ListingQualityService.class);

    static final int TARGET_PHOTOS = 10;

    private final ListingQualityScoreRepository scoreRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final GuestReviewRepository guestReviewRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final Clock clock;

    public ListingQualityService(ListingQualityScoreRepository scoreRepository,
                                 PropertyRepository propertyRepository,
                                 PropertyPhotoRepository propertyPhotoRepository,
                                 GuestReviewRepository guestReviewRepository,
                                 com.fasterxml.jackson.databind.ObjectMapper objectMapper,
                                 Clock clock) {
        this.scoreRepository = scoreRepository;
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.guestReviewRepository = guestReviewRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Calcule et persiste le score du logement (upsert org+logement). Retourne null si
     * le logement est introuvable ou hors org (findById contourne le filtre — règle n°3).
     */
    @Transactional
    public ListingQualityScore computeAndStore(Long orgId, Long propertyId) {
        final Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || property.getOrganizationId() == null
                || !property.getOrganizationId().equals(orgId)) {
            return null;
        }

        final int photosCount = propertyPhotoRepository.countByPropertyId(propertyId);
        final int photosPoints = Math.min(photosCount, TARGET_PHOTOS) * 35 / TARGET_PHOTOS;

        final int descriptionLength = property.getDescription() != null
                ? property.getDescription().strip().length() : 0;
        final int descriptionPoints = descriptionLength >= 600 ? 25
                : descriptionLength >= 300 ? 15
                : descriptionLength >= 100 ? 8 : 0;

        final int amenitiesCount = countAmenities(property.getAmenities());
        final int amenitiesPoints = amenitiesCount >= 10 ? 20
                : amenitiesCount >= 5 ? 12
                : amenitiesCount >= 1 ? 6 : 0;

        final Double avgRating = guestReviewRepository.averageRatingByPropertyId(propertyId, orgId);
        // Sans avis : mi-score neutre (l'absence d'avis n'est pas une faute de l'annonce).
        final int ratingPoints = avgRating == null ? 10
                : (int) Math.round(Math.max(0, Math.min(5, avgRating)) / 5.0 * 20);

        final int score = photosPoints + descriptionPoints + amenitiesPoints + ratingPoints;

        final Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("photosCount", photosCount);
        breakdown.put("photosPoints", photosPoints);
        breakdown.put("descriptionLength", descriptionLength);
        breakdown.put("descriptionPoints", descriptionPoints);
        breakdown.put("amenitiesCount", amenitiesCount);
        breakdown.put("amenitiesPoints", amenitiesPoints);
        breakdown.put("avgRating", avgRating);
        breakdown.put("ratingPoints", ratingPoints);

        final ListingQualityScore entity = scoreRepository
                .findByPropertyIdAndOrganizationId(propertyId, orgId)
                .orElseGet(() -> {
                    final ListingQualityScore fresh = new ListingQualityScore();
                    fresh.setOrganizationId(orgId);
                    fresh.setPropertyId(propertyId);
                    return fresh;
                });
        entity.setScore(score);
        try {
            entity.setBreakdown(objectMapper.writeValueAsString(breakdown));
        } catch (Exception e) {
            entity.setBreakdown("{}");
            log.debug("Breakdown score annonce non sérialisé (property={}): {}",
                    propertyId, e.getMessage());
        }
        entity.setComputedAt(LocalDateTime.now(clock));
        return scoreRepository.save(entity);
    }

    /** Les deux contributeurs les plus faibles (pour le motif de la carte). */
    public static String weakestAxes(int photosPoints, int descriptionPoints,
                                     int amenitiesPoints, int ratingPoints) {
        record Axis(String label, int points, int max) {}
        return java.util.stream.Stream.of(
                        new Axis("photos", photosPoints, 35),
                        new Axis("description", descriptionPoints, 25),
                        new Axis("équipements", amenitiesPoints, 20),
                        new Axis("avis", ratingPoints, 20))
                .sorted(java.util.Comparator.comparingDouble(a -> (double) a.points() / a.max()))
                .limit(2)
                .map(Axis::label)
                .reduce((a, b) -> a + " et " + b)
                .orElse("");
    }

    private static int countAmenities(String amenities) {
        if (amenities == null || amenities.isBlank()) {
            return 0;
        }
        // Champ TEXT historique : CSV ou JSON array — on compte les éléments non vides.
        final String stripped = amenities.strip();
        final String inner = stripped.startsWith("[")
                ? stripped.replaceAll("[\\[\\]\"]", "") : stripped;
        return (int) java.util.Arrays.stream(inner.split(","))
                .map(String::strip).filter(s -> !s.isEmpty()).count();
    }
}
