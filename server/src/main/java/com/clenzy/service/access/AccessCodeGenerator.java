package com.clenzy.service.access;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * Génère un code d'accès statique aléatoire selon un format défini par l'hôte
 * (générateur frontend), pour la rotation automatique après checkout.
 *
 * <p>Le format est un JSON {@code {pattern, letters, symbols}} :</p>
 * <ul>
 *   <li>{@code pattern} : type par position — {@code "digits" | "letters" | "symbols"}</li>
 *   <li>{@code letters} : sous-ensemble de lettres autorisées (vide = toutes)</li>
 *   <li>{@code symbols} : sous-ensemble de symboles autorisés (vide = tous)</li>
 * </ul>
 *
 * <p>Sans format exploitable, on déduit la structure du code courant (même longueur,
 * même type à chaque position).</p>
 */
@Component
public class AccessCodeGenerator {

    private static final Logger log = LoggerFactory.getLogger(AccessCodeGenerator.class);

    private static final String DIGITS = "0123456789";
    private static final String LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I/O (ambigus)
    private static final String SYMBOLS = "#@$%&*?!";

    private final SecureRandom random = new SecureRandom();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Génère un nouveau code. {@code formatJson} prioritaire ; sinon repli sur la
     * structure de {@code currentCode}. Retourne {@code null} si aucune base exploitable.
     */
    public String generate(String formatJson, String currentCode) {
        List<String> pattern = parsePattern(formatJson);
        String letterPool = LETTERS;
        String symbolPool = SYMBOLS;

        if (pattern != null && formatJson != null && !formatJson.isBlank()) {
            try {
                JsonNode root = mapper.readTree(formatJson);
                String letters = joinChars(root.get("letters"));
                String symbols = joinChars(root.get("symbols"));
                if (!letters.isEmpty()) letterPool = letters;
                if (!symbols.isEmpty()) symbolPool = symbols;
            } catch (Exception e) {
                log.warn("Format de code illisible: {}", e.getMessage());
            }
        }

        if (pattern == null || pattern.isEmpty()) {
            pattern = patternFromCode(currentCode);
        }
        if (pattern.isEmpty()) return null;

        StringBuilder out = new StringBuilder(pattern.size());
        for (String type : pattern) {
            String pool = switch (type) {
                case "letters" -> letterPool;
                case "symbols" -> symbolPool;
                default -> DIGITS;
            };
            if (!pool.isEmpty()) out.append(pool.charAt(random.nextInt(pool.length())));
        }
        return out.length() > 0 ? out.toString() : null;
    }

    /**
     * Code purement numérique pour une serrure à clavier (qui n'accepte que des chiffres).
     * Longueur = nombre de positions du format SI compatible serrure (6–8), sinon
     * {@code fallbackLength} — le format de la boîte à clé (souvent 4) ne doit pas produire
     * un PIN refusé par la serrure. Lettres/symboles du format sont ignorés.
     */
    public String generateNumeric(String formatJson, int fallbackLength) {
        List<String> pattern = parsePattern(formatJson);
        int length = fallbackLength;
        if (pattern != null && pattern.size() >= 6 && pattern.size() <= 8) {
            length = pattern.size();
        }
        StringBuilder out = new StringBuilder(length);
        for (int i = 0; i < length; i++) out.append(DIGITS.charAt(random.nextInt(DIGITS.length())));
        return out.toString();
    }

    /**
     * Variante d'un PIN sans le chiffre 0 (les claviers Nuki n'acceptent que 1-9) :
     * chaque '0' est remplacé par un chiffre aléatoire 1-9.
     */
    public String withoutZeros(String pin) {
        if (pin == null || pin.indexOf('0') < 0) return pin;
        StringBuilder out = new StringBuilder(pin.length());
        for (char c : pin.toCharArray()) {
            out.append(c == '0' ? (char) ('1' + random.nextInt(9)) : c);
        }
        return out.toString();
    }

    private List<String> parsePattern(String formatJson) {
        if (formatJson == null || formatJson.isBlank()) return null;
        try {
            JsonNode pat = mapper.readTree(formatJson).get("pattern");
            if (pat == null || !pat.isArray()) return null;
            List<String> pattern = new ArrayList<>();
            for (JsonNode n : pat) pattern.add(n.asText());
            return pattern;
        } catch (Exception e) {
            log.warn("Format de code illisible, repli sur le code courant: {}", e.getMessage());
            return null;
        }
    }

    private String joinChars(JsonNode node) {
        StringBuilder sb = new StringBuilder();
        if (node != null && node.isArray()) {
            for (JsonNode n : node) {
                String s = n.asText();
                if (s != null && !s.isEmpty()) sb.append(s.charAt(0));
            }
        }
        return sb.toString();
    }

    /** Déduit le patron (type par position) d'un code existant. */
    private List<String> patternFromCode(String code) {
        List<String> pattern = new ArrayList<>();
        if (code == null) return pattern;
        for (char c : code.toCharArray()) {
            if (Character.isDigit(c)) pattern.add("digits");
            else if (Character.isLetter(c)) pattern.add("letters");
            else pattern.add("symbols");
        }
        return pattern;
    }
}
