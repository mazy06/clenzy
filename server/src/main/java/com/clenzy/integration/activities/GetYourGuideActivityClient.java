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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;

/**
 * Client GetYourGuide — Partner API.
 *
 * <p>Le mapping suit la specification OpenAPI publique du programme
 * (<a href="https://github.com/getyourguide/partner-api-spec">partner-api-spec</a>) :
 * {@code GET /{version}/tours}, authentification par en-tete
 * {@code X-ACCESS-TOKEN}, recherche par {@code coordinates[]} = latitude,
 * longitude, rayon. Les noms de champs de reponse viennent du schema
 * {@code Tour} de cette meme spec.</p>
 *
 * <p><b>Non valide contre l'API live</b> : l'acces demande un compte partenaire.
 * La spec etant versionnee et publique, l'ecart attendu porte sur les valeurs,
 * pas sur la structure — mais un premier appel reel reste a faire.</p>
 *
 * <p>Inerte sans cle configuree, et aucune exception propagee : un catalogue
 * indisponible ne doit pas vider le livret des autres providers.</p>
 */
@Component
public class GetYourGuideActivityClient implements ActivityCatalogClient {

    private static final Logger log = LoggerFactory.getLogger(GetYourGuideActivityClient.class);

    /** Version d'API portee par le chemin, cf. {@code /{version}/tours}. */
    private static final String API_VERSION = "1";
    /** Rayon de recherche autour du logement, en kilometres. */
    private static final int RADIUS_KM = 20;
    /**
     * Les URL d'images portent un segment {@code [format_id]} a substituer par
     * un format du catalogue GetYourGuide ; laisse tel quel, le lien est mort.
     */
    private static final String IMAGE_FORMAT_PLACEHOLDER = "[format_id]";
    private static final String IMAGE_FORMAT_ID = "97";

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public GetYourGuideActivityClient(
            RestTemplate restTemplate,
            @Value("${clenzy.activities.getyourguide.base-url:https://api.getyourguide.com}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    @Override
    public ActivityProvider provider() {
        return ActivityProvider.GETYOURGUIDE;
    }

    @Override
    public List<ActivityDto> search(ActivitySearchQuery query, ActivityAffiliateConfig config) {
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            return List.of();
        }
        if (query == null || query.latitude() == null || query.longitude() == null) {
            return List.of();
        }
        try {
            // coordinates[] est un tableau repete : latitude, longitude, rayon.
            String url = UriComponentsBuilder.fromUriString(baseUrl)
                .pathSegment(API_VERSION, "tours")
                .queryParam("cnt_language", query.language() != null ? query.language() : "fr")
                .queryParam("currency", "EUR")
                .queryParam("coordinates[]", query.latitude(), query.longitude(), RADIUS_KM)
                .queryParam("limit", Math.max(1, Math.min(query.limit(), 20)))
                .queryParam("sortfield", "popularity")
                .build()
                .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-ACCESS-TOKEN", config.getApiKey());
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            GygToursResponse response = restTemplate.exchange(
                url, HttpMethod.GET, new HttpEntity<>(headers), GygToursResponse.class).getBody();
            return toActivities(response, config.getAffiliateId());
        } catch (Exception e) {
            log.warn("GetYourGuide search failed (lat={}, lon={}): {}",
                query.latitude(), query.longitude(), e.getMessage());
            return List.of();
        }
    }

    private List<ActivityDto> toActivities(GygToursResponse response, String affiliateId) {
        List<ActivityDto> out = new ArrayList<>();
        if (response == null || response.data == null || response.data.tours == null) {
            return out;
        }
        for (GygTour tour : response.data.tours) {
            if (tour == null) {
                continue;
            }
            out.add(new ActivityDto(
                ActivityProvider.GETYOURGUIDE.name(),
                tour.title,
                imageUrl(tour),
                startingPrice(tour),
                "EUR",
                tour.overallRating,
                tour.numberOfRatings,
                durationLabel(tour),
                withAffiliate(tour.url, affiliateId)));
        }
        return out;
    }

    /** Le lien porte deja {@code partner_id} quand la cle est liee au compte ; on ne double pas. */
    private String withAffiliate(String url, String affiliateId) {
        if (url == null || affiliateId == null || affiliateId.isBlank() || url.contains("partner_id=")) {
            return url;
        }
        return url + (url.contains("?") ? "&" : "?") + "partner_id=" + affiliateId;
    }

    private String imageUrl(GygTour tour) {
        if (tour.pictures == null || tour.pictures.isEmpty()) {
            return null;
        }
        GygPicture picture = tour.pictures.get(0);
        if (picture == null) {
            return null;
        }
        String url = picture.sslUrl != null ? picture.sslUrl : picture.url;
        return url == null ? null : url.replace(IMAGE_FORMAT_PLACEHOLDER, IMAGE_FORMAT_ID);
    }

    private String startingPrice(GygTour tour) {
        if (tour.price == null || tour.price.values == null || tour.price.values.amount == null) {
            return null;
        }
        return String.valueOf(Math.round(tour.price.values.amount));
    }

    private String durationLabel(GygTour tour) {
        if (tour.durations == null || tour.durations.isEmpty()) {
            return null;
        }
        GygDuration duration = tour.durations.get(0);
        if (duration == null || duration.duration == null) {
            return null;
        }
        return duration.unit == null
            ? String.valueOf(duration.duration)
            : duration.duration + " " + duration.unit;
    }

    // ─── DTOs, calques sur le schema Tour de la spec publique ────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygToursResponse {
        public GygData data;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygData {
        public List<GygTour> tours;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygTour {
        public String title;
        public String url;
        public List<GygPicture> pictures;
        public GygPrice price;
        public List<GygDuration> durations;
        @com.fasterxml.jackson.annotation.JsonProperty("overall_rating")
        public Double overallRating;
        @com.fasterxml.jackson.annotation.JsonProperty("number_of_ratings")
        public Integer numberOfRatings;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygPicture {
        public String url;
        @com.fasterxml.jackson.annotation.JsonProperty("ssl_url")
        public String sslUrl;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygPrice {
        public GygPriceValues values;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygPriceValues {
        public Double amount;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class GygDuration {
        public Integer duration;
        public String unit;
    }
}
