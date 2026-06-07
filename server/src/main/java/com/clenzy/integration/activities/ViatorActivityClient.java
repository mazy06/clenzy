package com.clenzy.integration.activities;

import com.clenzy.dto.ActivityDto;
import com.clenzy.model.ActivityAffiliateConfig;
import com.clenzy.model.ActivityProvider;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Client Viator (TripAdvisor) — Partner API.
 *
 * <p><b>Scaffold</b> : inerte tant qu'aucune cle API n'est configuree (renvoie
 * une liste vide). Le mapping requete/reponse suit la Partner API documentee
 * mais DOIT etre valide contre l'API live avec une vraie cle (pas de sandbox
 * public — cf. integration HomeToGo). Aucune exception n'est propagee : echec =
 * liste vide.</p>
 */
@Component
public class ViatorActivityClient implements ActivityCatalogClient {

    private static final Logger log = LoggerFactory.getLogger(ViatorActivityClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public ViatorActivityClient(
            RestTemplate restTemplate,
            @Value("${clenzy.activities.viator.base-url:https://api.viator.com/partner}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    @Override
    public ActivityProvider provider() {
        return ActivityProvider.VIATOR;
    }

    @Override
    public List<ActivityDto> search(ActivitySearchQuery query, ActivityAffiliateConfig config) {
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            return List.of(); // provider non connecte
        }
        if (query == null || query.latitude() == null || query.longitude() == null) {
            return List.of();
        }
        try {
            String url = UriComponentsBuilder.fromUriString(baseUrl).path("/products/search").toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("exp-api-key", config.getApiKey());
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set("Accept-Language", query.language() != null ? query.language() : "fr");

            Map<String, Object> body = Map.of(
                "filtering", Map.of(
                    "latitude", query.latitude(),
                    "longitude", query.longitude(),
                    "radius", 20),
                "pagination", Map.of(
                    "start", 1,
                    "count", Math.max(1, Math.min(query.limit(), 20))),
                "currency", "EUR");

            ViatorSearchResponse response = restTemplate.postForObject(
                url, new HttpEntity<>(body, headers), ViatorSearchResponse.class);
            return toActivities(response, config.getAffiliateId());
        } catch (Exception e) {
            log.warn("Viator search failed (lat={}, lon={}): {}", query.latitude(), query.longitude(), e.getMessage());
            return List.of();
        }
    }

    private List<ActivityDto> toActivities(ViatorSearchResponse response, String affiliateId) {
        List<ActivityDto> out = new ArrayList<>();
        if (response == null || response.products == null) {
            return out;
        }
        for (ViatorProduct p : response.products) {
            if (p == null) {
                continue;
            }
            String url = p.productUrl;
            if (url != null && affiliateId != null && !affiliateId.isBlank()) {
                url = url + (url.contains("?") ? "&" : "?") + "pid=" + affiliateId;
            }
            String price = (p.pricing != null && p.pricing.summary != null)
                ? formatPrice(p.pricing.summary.fromPrice) : null;
            String currency = p.pricing != null ? p.pricing.currency : null;
            Double rating = p.reviews != null ? p.reviews.combinedAverageRating : null;
            Integer reviewCount = p.reviews != null ? p.reviews.totalReviews : null;
            String image = firstImageUrl(p);
            out.add(new ActivityDto(
                ActivityProvider.VIATOR.name(), p.title, image, price, currency,
                rating, reviewCount, p.duration, url));
        }
        return out;
    }

    private static String firstImageUrl(ViatorProduct p) {
        if (p.images == null || p.images.isEmpty()) {
            return null;
        }
        ViatorImage img = p.images.get(0);
        if (img == null || img.variants == null || img.variants.isEmpty()) {
            return null;
        }
        return img.variants.get(0).url;
    }

    private static String formatPrice(Double v) {
        return v == null ? null : String.valueOf(Math.round(v));
    }

    // ─── DTOs Viator (defensifs — a valider contre l'API live) ────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorSearchResponse {
        public List<ViatorProduct> products;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorProduct {
        public String title;
        public String productUrl;
        public String duration;
        public List<ViatorImage> images;
        public ViatorPricing pricing;
        public ViatorReviews reviews;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorImage {
        public List<ViatorImageVariant> variants;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorImageVariant {
        public String url;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorPricing {
        public String currency;
        public ViatorPriceSummary summary;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorPriceSummary {
        public Double fromPrice;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ViatorReviews {
        public Double combinedAverageRating;
        public Integer totalReviews;
    }
}
