package com.clenzy.integration.geo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Geocodage de la Base Adresse Nationale (IGN Geoplateforme, service public, sans cle) :
 * adresse francaise → code INSEE de la commune ({@code citycode}).
 *
 * <p>Hote FIXE (configuration). Delais courts : appele pendant l'enregistrement d'un
 * logement, une BAN lente ne doit jamais bloquer la saisie — l'appelant traite l'absence
 * de reponse comme « commune non resolue ».</p>
 */
@Component
public class BanGeocodingClient {

    /** En dessous, la BAN devine : on prefere ne rien conclure qu'un mauvais code. */
    static final double MIN_SCORE = 0.5;

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public BanGeocodingClient(RestTemplateBuilder builder,
                              @Value("${clenzy.geocoding.ban-url:https://data.geopf.fr/geocodage}") String baseUrl) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
        this.baseUrl = baseUrl;
    }

    /** Commune trouvee : code INSEE tel que renvoye (arrondissement pour Paris/Lyon/Marseille). */
    public record Match(String citycode, String city, String postcode, double score) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Response(@JsonProperty("features") List<Feature> features) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Feature(@JsonProperty("properties") Props properties) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Props(@JsonProperty("citycode") String citycode, @JsonProperty("city") String city,
                 @JsonProperty("postcode") String postcode, @JsonProperty("score") double score) {
    }

    /**
     * @param query     adresse libre (numero, voie, code postal, ville)
     * @param postcode  code postal attendu, filtre la recherche s'il est connu
     * @param municipalityOnly ne chercher que des communes (repli sur la ville seule)
     */
    public Optional<Match> search(String query, String postcode, boolean municipalityOnly) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(baseUrl)
                .path("/search")
                .queryParam("q", query.length() > 200 ? query.substring(0, 200) : query)
                .queryParam("limit", 1);
        if (postcode != null && postcode.matches("\\d{5}")) {
            uri.queryParam("postcode", postcode);
        }
        if (municipalityOnly) {
            uri.queryParam("type", "municipality");
        }
        Response response = restTemplate.getForObject(uri.encode().build().toUri(), Response.class);
        if (response == null || response.features() == null || response.features().isEmpty()) {
            return Optional.empty();
        }
        Props p = response.features().get(0).properties();
        if (p == null || p.citycode() == null || p.score() < MIN_SCORE) {
            return Optional.empty();
        }
        return Optional.of(new Match(p.citycode(), p.city(), p.postcode(), p.score()));
    }
}
