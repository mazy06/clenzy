package com.clenzy.service;

import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * Service d'anonymisation des donnees avant envoi aux LLMs.
 *
 * Detecte et masque les PII (Personally Identifiable Information) :
 * - Adresses email
 * - Numeros de telephone (FR + international)
 * - Numeros de carte bancaire
 * - IBAN
 *
 * Le masquage est unidirectionnel (remplacement par placeholder).
 * V2 future : mapping bidirectionnel pour re-anonymisation.
 */
@Service
public class AiAnonymizationService {

    // ─── Patterns PII ──────────────────────────────────────────────────

    /** Email : user@domain.tld */
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}"
    );

    /**
     * Telephone FR : 01-09 suivi de 8 chiffres, avec espaces/points/tirets optionnels.
     * Aussi : +33 suivi de 9 chiffres.
     */
    private static final Pattern PHONE_FR_PATTERN = Pattern.compile(
            "(?:\\+33\\s?[1-9](?:[\\s.\\-]?\\d{2}){4})" +
            "|(?:0[1-9](?:[\\s.\\-]?\\d{2}){4})"
    );

    /** Telephone international : +XX suivi de 7 a 14 chiffres (avec espaces/tirets optionnels). */
    private static final Pattern PHONE_INTERNATIONAL_PATTERN = Pattern.compile(
            "\\+(?!33\\s?[1-9])\\d{1,3}[\\s\\-]?(?:\\d[\\s\\-]?){6,13}\\d"
    );

    /** Carte bancaire : 13 a 19 chiffres (avec espaces/tirets optionnels). */
    private static final Pattern CREDIT_CARD_PATTERN = Pattern.compile(
            "\\b(?:\\d[\\s\\-]?){12,18}\\d\\b"
    );

    /** IBAN : 2 lettres + 2 chiffres + 11 a 30 alphanumeriques (avec espaces optionnels). */
    private static final Pattern IBAN_PATTERN = Pattern.compile(
            "\\b[A-Z]{2}\\d{2}[\\s]?(?:[A-Z0-9]{4}[\\s]?){3,7}[A-Z0-9]{1,4}\\b"
    );

    // ─── Placeholders ───────────────────────────────────────────────────

    private static final String EMAIL_PLACEHOLDER = "[EMAIL_REDACTED]";
    private static final String PHONE_PLACEHOLDER = "[PHONE_REDACTED]";
    private static final String CREDIT_CARD_PLACEHOLDER = "[CREDIT_CARD_REDACTED]";
    private static final String IBAN_PLACEHOLDER = "[IBAN_REDACTED]";

    // ─── Public API ─────────────────────────────────────────────────────

    /**
     * Anonymise le texte en remplacant les PII detectees par des placeholders.
     *
     * @param text le texte a anonymiser (peut etre null ou blank)
     * @return le texte anonymise, ou le texte original si null/blank
     */
    public String anonymize(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }

        String result = text;

        // Ordre important : IBAN avant credit card (IBAN contient des chiffres)
        result = IBAN_PATTERN.matcher(result).replaceAll(IBAN_PLACEHOLDER);
        result = CREDIT_CARD_PATTERN.matcher(result).replaceAll(CREDIT_CARD_PLACEHOLDER);
        result = EMAIL_PATTERN.matcher(result).replaceAll(EMAIL_PLACEHOLDER);
        result = PHONE_FR_PATTERN.matcher(result).replaceAll(PHONE_PLACEHOLDER);
        result = PHONE_INTERNATIONAL_PATTERN.matcher(result).replaceAll(PHONE_PLACEHOLDER);

        return result;
    }

    /**
     * Placeholder pour la V2 : de-anonymisation avec mapping bidirectionnel.
     * Actuellement retourne le texte tel quel.
     *
     * @param text le texte avec des placeholders
     * @return le texte (inchange en V1)
     */
    public String deAnonymize(String text) {
        // V2 : implement bidirectional mapping with stored token map
        return text;
    }
}
