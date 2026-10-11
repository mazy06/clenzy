package com.clenzy.service.maps;

import com.clenzy.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Carte de localisation des e-mails de check-in : une image servie par Baitly
 * (moteur de rendu interne, style « Papier », épingles Baitly) — remplace l'API
 * Mapbox Static Images.
 *
 * <p>L'image est référencée par une URL publique signée
 * ({@code /api/public/maps/static/{jeton}.{signature}.jpg}) : les clients mail la
 * chargent sans session, et seul le serveur peut en émettre. Sans moteur de rendu
 * ou sans secret configuré, aucune carte n'est insérée (le placeholder
 * {@code {locationMap}} est simplement vidé).</p>
 */
@Service
public class BaitlyStaticMapService {

    private final StaticMapSigner signer;
    private final StaticMapRenderer renderer;
    private final String publicBaseUrl;

    public BaitlyStaticMapService(StaticMapSigner signer, StaticMapRenderer renderer,
                                  @Value("${clenzy.maps.public-base-url:http://localhost:3000}") String publicBaseUrl) {
        this.signer = signer;
        this.renderer = renderer;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    /**
     * Balise {@code <img>} prête à insérer dans un e-mail, ou chaîne vide si la
     * carte ne peut pas être proposée (pas de coordonnées, rendu désactivé).
     */
    public String generateMapImageTag(StaticMapRequest request, String propertyName, String storeName) {
        if (request == null || !signer.isEnabled() || !renderer.isEnabled()) {
            return "";
        }
        String payload = request.toPayload();
        String url = publicBaseUrl + "/api/public/maps/static/" + payload + "." + signer.sign(payload) + ".jpg";
        return imgTag(url, altText(propertyName, storeName, request.hasStore()));
    }

    private static String altText(String propertyName, String storeName, boolean hasStore) {
        String property = StringUtils.escapeHtml(propertyName != null ? propertyName : "Logement");
        if (hasStore && storeName != null && !storeName.isBlank()) {
            return "Carte - " + property + " et point de remise " + StringUtils.escapeHtml(storeName);
        }
        return "Carte - " + property;
    }

    private static String imgTag(String url, String altText) {
        return String.format(
                "<img src=\"%s\" alt=\"%s\" width=\"%d\" height=\"%d\" "
                        + "style=\"width:100%%;max-width:%dpx;height:auto;border-radius:8px;display:block;margin:12px 0;\" />",
                StringUtils.escapeHtml(url), altText, StaticMapRenderer.WIDTH, StaticMapRenderer.HEIGHT, StaticMapRenderer.WIDTH);
    }
}
