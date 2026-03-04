package com.clenzy.service;

import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Genere des URLs Mapbox Static Images API et les encapsule dans un tag HTML &lt;img&gt;
 * pour inclusion dans les emails de check-in.
 *
 * <p>Deux cas d'usage :
 * <ul>
 *   <li>Propriete seule : 1 marker bleu centre sur la propriete (zoom 15)</li>
 *   <li>Propriete + point d'echange de cles : 2 markers (bleu + orange) avec zoom automatique</li>
 * </ul>
 *
 * <p>Si le token Mapbox n'est pas configure ou si la propriete n'a pas de coordonnees,
 * retourne une chaine vide (le placeholder {locationMap} sera simplement supprime du template).
 */
@Service
public class MapboxStaticImageService {

    private static final Logger log = LoggerFactory.getLogger(MapboxStaticImageService.class);

    private static final String BASE_URL = "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static";
    private static final String PROPERTY_MARKER_COLOR = "3b82f6";   // Bleu
    private static final String STORE_MARKER_COLOR = "ff6b35";      // Orange
    private static final int WIDTH = 600;
    private static final int HEIGHT = 300;
    private static final int DEFAULT_ZOOM = 15;
    private static final int PADDING = 60;

    @Value("${clenzy.mapbox.access-token:}")
    private String accessToken;

    /**
     * Genere un tag &lt;img&gt; HTML contenant une carte statique Mapbox.
     *
     * @param propertyLat  latitude de la propriete (nullable)
     * @param propertyLng  longitude de la propriete (nullable)
     * @param storeLat     latitude du point d'echange de cles (nullable)
     * @param storeLng     longitude du point d'echange de cles (nullable)
     * @param propertyName nom de la propriete (pour l'attribut alt)
     * @param storeName    nom du point d'echange (pour l'attribut alt, nullable)
     * @return un tag HTML &lt;img&gt; complet, ou "" si impossible de generer
     */
    public String generateMapImageTag(
            BigDecimal propertyLat, BigDecimal propertyLng,
            Double storeLat, Double storeLng,
            String propertyName, String storeName
    ) {
        if (accessToken == null || accessToken.isBlank()) {
            log.debug("Mapbox access token non configure, pas de carte generee");
            return "";
        }

        if (propertyLat == null || propertyLng == null) {
            log.debug("Propriete sans coordonnees GPS, pas de carte generee");
            return "";
        }

        try {
            String imageUrl = buildImageUrl(propertyLat, propertyLng, storeLat, storeLng);
            String altText = buildAltText(propertyName, storeName, storeLat != null);
            return buildImgTag(imageUrl, altText);
        } catch (Exception e) {
            log.error("Erreur generation image carte Mapbox: {}", e.getMessage());
            return "";
        }
    }

    /**
     * Construit l'URL Mapbox Static Images API.
     */
    private String buildImageUrl(
            BigDecimal propertyLat, BigDecimal propertyLng,
            Double storeLat, Double storeLng
    ) {
        double pLat = propertyLat.doubleValue();
        double pLng = propertyLng.doubleValue();

        boolean hasStore = storeLat != null && storeLng != null
                && storeLat != 0.0 && storeLng != 0.0;

        // Markers : pin-l-{icon}+{color}({lng},{lat})
        StringBuilder markers = new StringBuilder();
        markers.append(String.format(Locale.US,
                "pin-l-lodging+%s(%.6f,%.6f)",
                PROPERTY_MARKER_COLOR, pLng, pLat));

        if (hasStore) {
            markers.append(String.format(Locale.US,
                    ",pin-l-marker+%s(%.6f,%.6f)",
                    STORE_MARKER_COLOR, storeLng, storeLat));
        }

        // Centre et zoom
        String centerZoom;
        if (hasStore) {
            // Deux markers : zoom automatique
            centerZoom = "auto";
        } else {
            // Un seul marker : centrer sur la propriete
            centerZoom = String.format(Locale.US, "%.6f,%.6f,%d", pLng, pLat, DEFAULT_ZOOM);
        }

        // URL complete
        String url = String.format(Locale.US,
                "%s/%s/%s/%dx%d@2x?access_token=%s&logo=false&attribution=false",
                BASE_URL, markers, centerZoom, WIDTH, HEIGHT, accessToken);

        if (hasStore) {
            url += "&padding=" + PADDING;
        }

        return url;
    }

    /**
     * Construit le texte alternatif de l'image.
     */
    private String buildAltText(String propertyName, String storeName, boolean hasStore) {
        String escapedProperty = StringUtils.escapeHtml(propertyName != null ? propertyName : "Propriete");

        if (hasStore && storeName != null && !storeName.isBlank()) {
            String escapedStore = StringUtils.escapeHtml(storeName);
            return String.format("Carte - %s et point de retrait %s", escapedProperty, escapedStore);
        }
        return String.format("Carte - %s", escapedProperty);
    }

    /**
     * Encapsule l'URL dans un tag &lt;img&gt; HTML responsive et compatible emails.
     */
    private String buildImgTag(String imageUrl, String altText) {
        return String.format(
                "<img src=\"%s\" alt=\"%s\" width=\"%d\" height=\"%d\" "
                        + "style=\"width:100%%;max-width:%dpx;height:auto;border-radius:8px;display:block;margin:12px 0;\" />",
                imageUrl, altText, WIDTH, HEIGHT, WIDTH
        );
    }
}
