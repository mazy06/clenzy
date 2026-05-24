package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service Reviews OTA via Channex Reviews App (paid).
 *
 * <p>Permet de consommer les reviews Airbnb / Booking / Expedia via 1 seule API,
 * + le scoring agrege par property et per-OTA. Les reviews ne sont pas persistees
 * en local (pour l'instant) : on fait du pass-through. La persistance pourra
 * etre ajoutee plus tard (table {@code ota_reviews}) pour l'analytics historique.</p>
 *
 * <p><b>Pre-requis</b> : Reviews App achetee + activee cote dashboard Channex.</p>
 */
@Service
public class ChannexReviewsService {

    private static final Logger log = LoggerFactory.getLogger(ChannexReviewsService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;

    public ChannexReviewsService(ChannexClient channexClient,
                                   ChannexPropertyMappingRepository mappingRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
    }

    /**
     * Liste paginee des reviews pour une property (ou toutes properties de l'org).
     *
     * @param clenzyPropertyId optionnel : null = toutes properties de l'org
     */
    public Optional<JsonNode> listReviews(Long clenzyPropertyId, Long orgId, int page, int limit) {
        String channexPropertyId = null;
        if (clenzyPropertyId != null) {
            Optional<ChannexPropertyMapping> mapping = mappingRepository
                .findByClenzyPropertyId(clenzyPropertyId, orgId);
            if (mapping.isEmpty()) {
                log.warn("ChannexReviews: pas de mapping pour property={}, skip", clenzyPropertyId);
                return Optional.empty();
            }
            channexPropertyId = mapping.get().getChannexPropertyId();
        }
        return channexClient.fetchReviews(channexPropertyId, page, limit);
    }

    /** Detail d'une review. */
    public Optional<JsonNode> getReview(String reviewId) {
        return channexClient.fetchReview(reviewId);
    }

    /** Reponse host a une review. */
    public Optional<JsonNode> replyToReview(String reviewId, String replyText) {
        if (replyText == null || replyText.isBlank()) {
            log.warn("ChannexReviews: reply vide ignore reviewId={}", reviewId);
            return Optional.empty();
        }
        return channexClient.replyToReview(reviewId, replyText);
    }

    /** Score agrege d'une property (overall + count). */
    public Optional<JsonNode> getPropertyScore(Long clenzyPropertyId, Long orgId) {
        Optional<ChannexPropertyMapping> mapping = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (mapping.isEmpty()) return Optional.empty();
        return channexClient.fetchPropertyScore(mapping.get().getChannexPropertyId());
    }

    /** Score detaille par OTA. */
    public Optional<JsonNode> getPropertyScoreDetailed(Long clenzyPropertyId, Long orgId) {
        Optional<ChannexPropertyMapping> mapping = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (mapping.isEmpty()) return Optional.empty();
        return channexClient.fetchPropertyScoreDetailed(mapping.get().getChannexPropertyId());
    }
}
