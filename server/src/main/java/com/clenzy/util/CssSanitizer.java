package com.clenzy.util;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Sanitisation des variables CSS de design (contrat {@code --bt-*}) émises par le LLM et du CSS de page
 * généré, AVANT persistance et rendu. La map de variables est injectée dans des blocs {@code :root{}} /
 * {@code .cb-widget{}} → surface d'injection CSS : on whiteliste le NOM et la VALEUR (rejet de toute
 * syntaxe permettant de sortir de la déclaration ou de charger du code/des ressources externes).
 *
 * <p>Défense en profondeur, dans l'esprit de {@link EmailHtmlSanitizer} (audit règle #4) : le CSS de page
 * généré par l'IA n'était jusqu'ici pas filtré ; {@link #sanitizeCss(String)} comble ce trou (best-effort).</p>
 */
public final class CssSanitizer {

    private CssSanitizer() {
    }

    /** Identifiant de variable CSS autorisé : {@code --} + minuscule, puis minuscules/chiffres/tirets, borné. */
    private static final Pattern VAR_NAME = Pattern.compile("^--[a-z][a-z0-9-]{0,40}$");

    /** Longueur maximale d'une valeur de token (anti valeurs absurdes / DoS). */
    private static final int MAX_VALUE_LEN = 200;

    /** Nombre maximal de variables conservées (anti-dérive de la sortie LLM). */
    private static final int MAX_VARS = 100;

    /**
     * Fragments interdits dans une VALEUR de token : sortie de déclaration ({@code } ; { @code }}{@code ; }),
     * règles ({@code @}), ressources/scripts ({@code url(}, {@code expression(}, {@code javascript:}),
     * balises ({@code <}), échappements ({@code \}) et commentaires.
     */
    private static final String[] FORBIDDEN_VALUE_FRAGMENTS = {
        "{", "}", ";", "@", "url(", "expression(", "javascript:", "<", "\\", "/*", "*/"
    };

    /** {@code true} si {@code name} est un identifiant de variable CSS sûr. */
    public static boolean isValidVarName(String name) {
        return name != null && VAR_NAME.matcher(name).matches();
    }

    /** {@code true} si {@code value} est bornée et ne contient aucun fragment dangereux. */
    public static boolean isValidVarValue(String value) {
        if (value == null) {
            return false;
        }
        String v = value.trim();
        if (v.isEmpty() || v.length() > MAX_VALUE_LEN) {
            return false;
        }
        String low = v.toLowerCase(Locale.ROOT);
        for (String bad : FORBIDDEN_VALUE_FRAGMENTS) {
            if (low.contains(bad)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Filtre une map de variables CSS : ne conserve que les paires (nom, valeur) sûres, bornée à
     * {@value #MAX_VARS} entrées, ordre d'insertion préservé.
     */
    public static Map<String, String> sanitizeVarMap(Map<String, String> vars) {
        Map<String, String> out = new LinkedHashMap<>();
        if (vars == null) {
            return out;
        }
        for (Map.Entry<String, String> e : vars.entrySet()) {
            if (out.size() >= MAX_VARS) {
                break;
            }
            String name = e.getKey() != null ? e.getKey().trim() : null;
            String value = e.getValue();
            if (isValidVarName(name) && isValidVarValue(value)) {
                out.put(name, value.trim());
            }
        }
        return out;
    }

    /**
     * Durcit une feuille de style générée (CSS de page) : retire {@code @import}/{@code @charset} et
     * neutralise {@code expression(...)} ainsi que les {@code url(javascript:|data:)}. Best-effort
     * (regex conservateur) — complément de la sanitisation HTML existante.
     */
    public static String sanitizeCss(String css) {
        if (css == null || css.isBlank()) {
            return css;
        }
        return css
            .replaceAll("(?i)@import\\b[^;]*;?", "")
            .replaceAll("(?i)@charset\\b[^;]*;?", "")
            .replaceAll("(?i)expression\\s*\\(", "/*blocked*/(")
            .replaceAll("(?i)url\\s*\\(\\s*['\"]?\\s*javascript:[^)]*\\)", "none")
            .replaceAll("(?i)url\\s*\\(\\s*['\"]?\\s*data:[^)]*\\)", "none");
    }
}
