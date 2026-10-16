package com.clenzy.service.maps;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

/**
 * Client du moteur de rendu d'images Baitly (conteneur {@code baitly-maps-renderer},
 * tileserver-gl) : dessine la carte d'un {@link StaticMapRequest} avec le style
 * « Papier » de la carte web et les épingles Baitly.
 *
 * <p>Sans URL configurée ({@code clenzy.maps.renderer-url}), le rendu est désactivé.</p>
 */
@Component
public class StaticMapRenderer {

    /** Dimensions logiques de l'image (rendue en @2x pour les écrans haute densité). */
    public static final int WIDTH = 600;
    public static final int HEIGHT = 300;
    private static final int SINGLE_POINT_ZOOM = 15;
    /** Marge du cadrage à deux points : laisse la place à la tête des épingles. */
    private static final double TWO_POINTS_PADDING = 0.4;

    private final String rendererUrl;
    private final RestClient client;

    public StaticMapRenderer(@Value("${clenzy.maps.renderer-url:}") String rendererUrl, RestClient.Builder builder) {
        this.rendererUrl = rendererUrl == null ? "" : rendererUrl.replaceAll("/+$", "");
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        // Un premier rendu (tuiles froides) prend quelques secondes ; ensuite le CDN sert l'image.
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.client = builder.requestFactory(factory).build();
    }

    public boolean isEnabled() {
        return !rendererUrl.isEmpty();
    }

    /** Image JPEG de la carte. */
    public byte[] render(StaticMapRequest request) {
        if (!isEnabled()) throw new IllegalStateException("Moteur de rendu des cartes non configure");
        return client.get().uri(URI.create(rendererUrl + path(request))).retrieve().body(byte[].class);
    }

    /**
     * Tuile raster 512 px (256 @2x) du style Papier — pour la carte de l'application
     * mobile, qui n'embarque pas de moteur vectoriel. Coordonnées déjà validées.
     */
    public byte[] tile(String language, int z, int x, int y) {
        if (!isEnabled()) throw new IllegalStateException("Moteur de rendu des cartes non configure");
        String path = "/styles/baitly-paper-" + StaticMapRequest.normalizeLanguage(language) + "/" + z + "/" + x + "/" + y + "@2x.png";
        return client.get().uri(URI.create(rendererUrl + path)).retrieve().body(byte[].class);
    }

    /** Chemin tileserver-gl : centré sur le logement, ou cadré sur le logement ET le point de remise. */
    static String path(StaticMapRequest request) {
        String style = "/styles/baitly-paper-" + request.language() + "/static/";
        String size = WIDTH + "x" + HEIGHT + "@2x.jpg";
        String property = marker(request.propertyLng(), request.propertyLat(), "pin-property.png");
        if (!request.hasStore()) {
            String center = String.format(Locale.US, "%.6f,%.6f,%d", request.propertyLng(), request.propertyLat(), SINGLE_POINT_ZOOM);
            return style + center + "/" + size + "?marker=" + property;
        }
        String store = marker(request.storeLng(), request.storeLat(), "pin-key.png");
        return style + "auto/" + size + "?padding=" + TWO_POINTS_PADDING + "&marker=" + property + "&marker=" + store;
    }

    /** Icône @2x ramenée à l'échelle 1 : la base de l'épingle se pose sur le point. */
    private static String marker(double lng, double lat, String icon) {
        String value = String.format(Locale.US, "%.6f,%.6f|%s|scale:0.5", lng, lat, icon);
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
