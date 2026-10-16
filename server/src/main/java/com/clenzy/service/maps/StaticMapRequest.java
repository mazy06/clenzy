package com.clenzy.service.maps;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Ce que montre une image de carte : le logement, et éventuellement le point de
 * remise des clés. Sérialisé en jeton compact (base64url) dans l'URL publique de
 * l'image ; ce jeton est SIGNÉ par {@link StaticMapSigner} — seul le serveur peut
 * en fabriquer, personne ne peut faire dessiner une carte arbitraire.
 *
 * @param language langue des libellés de la carte ({@code fr}, {@code en}, {@code ar})
 */
public record StaticMapRequest(double propertyLat, double propertyLng,
                               Double storeLat, Double storeLng, String language) {

    private static final Set<String> LANGUAGES = Set.of("fr", "en", "ar");
    private static final String VERSION = "v1";

    public StaticMapRequest {
        language = normalizeLanguage(language);
        if (storeLat == null || storeLng == null || (storeLat == 0.0 && storeLng == 0.0)) {
            storeLat = null;
            storeLng = null;
        }
    }

    public boolean hasStore() {
        return storeLat != null;
    }

    /** Langue de la carte : celle du voyageur si la carte la connaît, sinon le français. */
    public static String normalizeLanguage(String language) {
        if (language == null) return "fr";
        String base = language.toLowerCase(Locale.ROOT).split("[-_]")[0];
        return LANGUAGES.contains(base) ? base : "fr";
    }

    public String toPayload() {
        String raw = String.join("|", VERSION,
                format(propertyLat), format(propertyLng),
                storeLat == null ? "" : format(storeLat),
                storeLng == null ? "" : format(storeLng),
                language);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** Vide si le jeton est illisible : l'appelant répond 404 sans détail. */
    public static Optional<StaticMapRequest> fromPayload(String payload) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8);
            String[] parts = raw.split("\\|", -1);
            if (parts.length != 6 || !VERSION.equals(parts[0])) return Optional.empty();
            return Optional.of(new StaticMapRequest(
                    Double.parseDouble(parts[1]), Double.parseDouble(parts[2]),
                    parts[3].isEmpty() ? null : Double.parseDouble(parts[3]),
                    parts[4].isEmpty() ? null : Double.parseDouble(parts[4]),
                    parts[5]));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** 6 décimales ≈ 11 cm : la précision d'une adresse, pas plus. */
    private static String format(double value) {
        return String.format(Locale.US, "%.6f", value);
    }
}
