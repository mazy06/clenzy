package com.clenzy.service.regulatory;

import com.clenzy.integration.geo.BanGeocodingClient;
import com.clenzy.model.Property;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;

/**
 * Code INSEE de la commune d'un logement francais, DEDUIT de son adresse — jamais saisi.
 *
 * <p>Tout logement a une adresse et une ville : la Base Adresse Nationale en donne la
 * commune. Paris, Lyon et Marseille sont renvoyes par ARRONDISSEMENT (75102, 69381,
 * 13201…) ; la taxe de sejour et le plafond de nuitees se decident a la COMMUNE (75056,
 * 69123, 13055) : le code est donc ramene a la commune.</p>
 */
@Service
public class FrCommuneResolver {

    private static final Logger log = LoggerFactory.getLogger(FrCommuneResolver.class);

    private final BanGeocodingClient client;

    public FrCommuneResolver(BanGeocodingClient client) {
        this.client = client;
    }

    /** Le logement est-il situe en France (code pays ISO) ? */
    public static boolean isFrench(Property property) {
        return property != null && property.getCountryCode() != null
                && "FR".equalsIgnoreCase(property.getCountryCode().trim());
    }

    /**
     * Commune du logement d'apres son adresse ; vide si hors France, sans adresse
     * exploitable, ou si la BAN ne repond pas avec assez de certitude. Jamais d'exception :
     * l'echec laisse simplement la commune a resoudre plus tard.
     */
    public Optional<String> resolve(Property property) {
        if (!isFrench(property)) {
            return Optional.empty();
        }
        String postcode = property.getPostalCode() != null ? property.getPostalCode().trim() : null;
        String city = property.getCity() != null ? property.getCity().trim() : "";
        String street = property.getAddress() != null ? property.getAddress().trim() : "";
        try {
            Optional<BanGeocodingClient.Match> match = client.search(
                    String.join(" ", street, postcode != null ? postcode : "", city).trim(), postcode, false);
            if (match.isEmpty() && !city.isEmpty()) {
                // Adresse incomplete ou mal orthographiee : la ville seule suffit pour la commune.
                match = client.search(String.join(" ", postcode != null ? postcode : "", city).trim(), postcode, true);
            }
            return match.map(m -> toCommune(m.citycode()));
        } catch (RuntimeException e) {
            log.info("Commune non resolue pour le logement {} : {}", property.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    /** Arrondissement municipal → commune (Paris, Lyon, Marseille) ; autres codes inchanges. */
    public static String toCommune(String code) {
        if (code == null) {
            return null;
        }
        String c = code.trim().toUpperCase(Locale.ROOT);
        if (c.matches("751(0[1-9]|1\\d|20)")) {
            return "75056";
        }
        if (c.matches("6938[1-9]")) {
            return "69123";
        }
        if (c.matches("132(0[1-9]|1[0-6])")) {
            return "13055";
        }
        return c;
    }
}
