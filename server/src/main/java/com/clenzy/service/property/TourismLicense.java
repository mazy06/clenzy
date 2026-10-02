package com.clenzy.service.property;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Licence d'hebergement touristique d'un logement : format national et peremption.
 *
 * <p>Le format depend du PAYS, pas du produit — d'ou une regle par code pays
 * plutot qu'une expression unique. Un pays sans regle connue renvoie
 * {@link Verdict#UNCHECKED} : on enregistre le numero sans pretendre l'avoir
 * verifie, ce qui vaut mieux que de le rejeter ou de le declarer valide.</p>
 *
 * <p>La verification EN LIGNE (annuaire public du ministere saoudien) est un
 * autre sujet : elle exige un compte integrateur et vit dans le connecteur. Ici
 * on ne fait que la forme, qui ne demande aucun appel reseau et attrape la
 * faute de frappe au moment ou elle est commise.</p>
 */
public final class TourismLicense {

    /**
     * Arabie saoudite — licence d'hebergement prive : 8 chiffres commencant par
     * 50. Le prefixe distingue l'hebergement prive (villa, chalet, istiraha) des
     * autres categories d'etablissement.
     */
    private static final Pattern SA_PRIVATE_HOSPITALITY = Pattern.compile("^50\\d{6}$");

    /**
     * France — numero d'enregistrement d'un meuble de tourisme (Code du tourisme
     * L324-1-1 et D324-1-1) : 13 caracteres = code INSEE de la commune (5, Corse
     * 2A/2B comprise) + 6 chiffres attribues par la commune + 2 caracteres de cle.
     * Les espaces de presentation (« 75056 000123 AB ») sont retires avant controle.
     */
    private static final Pattern FR_REGISTRATION = Pattern.compile("^(\\d{5}|2[AB]\\d{3})\\d{6}[A-Z0-9]{2}$");

    public enum Verdict {
        /** Aucun numero saisi. */
        ABSENT,
        /** Conforme au format du pays. */
        VALID,
        /** Non conforme au format du pays. */
        MALFORMED,
        /** Pays sans regle de format connue : enregistre tel quel. */
        UNCHECKED,
        /**
         * Bien forme, mais emis par une autre commune que celle du logement (France :
         * le prefixe INSEE du numero differe du code INSEE du logement).
         */
        COMMUNE_MISMATCH
    }

    private TourismLicense() {
    }

    /**
     * Controle de forme du numero pour le pays donne.
     *
     * @param countryCode code ISO 2 du logement, insensible a la casse ; {@code null} accepte
     * @param number      numero saisi ; {@code null} ou blanc accepte
     */
    public static Verdict check(String countryCode, String number) {
        return check(countryCode, number, null);
    }

    /**
     * Controle de forme, et pour la France de coherence avec la commune du logement.
     *
     * @param communeInseeCode code INSEE du logement ; {@code null} = coherence non verifiable
     */
    public static Verdict check(String countryCode, String number, String communeInseeCode) {
        if (number == null || number.isBlank()) {
            return Verdict.ABSENT;
        }
        String country = countryCode == null ? "" : countryCode.trim().toUpperCase(Locale.ROOT);
        String normalized = normalize(country, number);
        return switch (country) {
            case "SA" -> SA_PRIVATE_HOSPITALITY.matcher(normalized).matches()
                    ? Verdict.VALID
                    : Verdict.MALFORMED;
            case "FR" -> {
                if (!FR_REGISTRATION.matcher(normalized).matches()) {
                    yield Verdict.MALFORMED;
                }
                // Paris, Lyon et Marseille numerotent par ARRONDISSEMENT (75105…) : le prefixe
                // est ramene a la commune avant comparaison avec celle du logement.
                if (communeInseeCode != null && !communeInseeCode.isBlank()
                        && !com.clenzy.service.regulatory.FrCommuneResolver.toCommune(normalized.substring(0, 5))
                                .equals(com.clenzy.service.regulatory.FrCommuneResolver.toCommune(communeInseeCode))) {
                    yield Verdict.COMMUNE_MISMATCH;
                }
                yield Verdict.VALID;
            }
            default -> Verdict.UNCHECKED;
        };
    }

    /**
     * Forme canonique a stocker : la France retire les espaces de presentation et
     * passe la cle en majuscules ; ailleurs on se contente de rogner.
     */
    public static String normalize(String countryCode, String number) {
        if (number == null) {
            return null;
        }
        if (countryCode != null && "FR".equalsIgnoreCase(countryCode.trim())) {
            return number.replaceAll("[\\s.\\-]", "").toUpperCase(Locale.ROOT);
        }
        return number.trim();
    }

    /** Le verdict interdit-il l'enregistrement ? Strict en France (decision produit). */
    public static boolean rejects(String countryCode, Verdict verdict) {
        return countryCode != null && "FR".equalsIgnoreCase(countryCode.trim())
                && (verdict == Verdict.MALFORMED || verdict == Verdict.COMMUNE_MISMATCH);
    }

    /**
     * La licence expire-t-elle dans les {@code days} jours ?
     *
     * <p>« Aujourd'hui » est le jour DU LOGEMENT, pas celui de la JVM : une
     * licence saoudienne se perime a Riyad, et l'ecart de fuseau suffit a
     * alerter un jour trop tot ou trop tard.</p>
     *
     * @param expiresAt    date d'expiration ; {@code null} = pas d'echeance connue
     * @param propertyZone fuseau IANA du logement ; {@code null} = repli Europe/Paris
     * @param days         fenetre d'alerte en jours
     * @return {@code true} si l'echeance est passee ou tombe dans la fenetre
     */
    public static boolean expiresWithin(LocalDate expiresAt, String propertyZone, int days) {
        if (expiresAt == null) {
            return false;
        }
        ZoneId zone = resolveZone(propertyZone);
        return !expiresAt.isAfter(LocalDate.now(zone).plusDays(days));
    }

    private static ZoneId resolveZone(String propertyZone) {
        if (propertyZone == null || propertyZone.isBlank()) {
            return ZoneId.of("Europe/Paris");
        }
        try {
            return ZoneId.of(propertyZone.trim());
        } catch (Exception ignored) {
            // Fuseau illisible en base : mieux vaut alerter sur Paris que ne pas alerter.
            return ZoneId.of("Europe/Paris");
        }
    }
}
