package com.clenzy.service.agent.portfolio;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Locale;
import java.util.Map;

/**
 * Template d'un pattern charge depuis {@code resources/patterns/portfolio.yaml}.
 *
 * <p>Contient les elements externalises : titre, description (avec placeholders),
 * type, severite (statique ou regle), seuils overridables. La logique de
 * detection reste cote {@link PortfolioPatternDetector}.</p>
 *
 * <p>Exemple YAML :
 * <pre>
 * - id: high_cancellation_rate
 *   type: HIGH_CANCELLATION_RATE
 *   title: "Taux d'annulation eleve"
 *   description: "{count} propriete(s) avec >{thresholdPct}% d'annulations"
 *   severity: MEDIUM
 *   severityRules:
 *     HIGH: "count >= 3"
 *   enabled: true
 * </pre>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class PortfolioPatternTemplate {

    public String id;
    public String type;
    public String title;
    public String description;
    public String severity = "MEDIUM";
    /**
     * Regles de surclassement de severite (key = niveau, value = expression simple).
     * Format supporte : {@code "<varName> <op> <number>"} avec
     * op ∈ {>=, >, <=, <, ==}. Variables disponibles via {@link #evaluateSeverityRule}.
     */
    public Map<String, String> severityRules;
    public boolean enabled = true;

    /**
     * Resout la severite finale en fonction des variables contextuelles
     * (typiquement {@code count}). Si une regle matche, retourne son niveau ;
     * sinon retourne {@link #severity} par defaut.
     *
     * <p>Evaluateur volontairement minimaliste pour eviter d'embarquer une lib
     * d'expression complete (sandbox issues). Format strict : {@code "<name>
     * <op> <number>"}, ex: {@code "count >= 3"}.</p>
     */
    public String resolveSeverity(Map<String, Number> vars) {
        if (severityRules == null || severityRules.isEmpty()) return severity;
        // Ordre d'evaluation : on prefere la severite la plus haute si plusieurs
        // matchent. On itere mais on prend la premiere qui matche selon l'ordre
        // typique CRITICAL > HIGH > MEDIUM > LOW.
        String[] orderedLevels = {"CRITICAL", "HIGH", "MEDIUM", "LOW"};
        for (String level : orderedLevels) {
            String rule = severityRules.get(level);
            if (rule != null && evaluateSeverityRule(rule, vars)) {
                return level;
            }
        }
        return severity;
    }

    /**
     * Evaluateur de regle simple : {@code "varName <op> number"}.
     * Retourne false si format invalide ou variable absente.
     */
    static boolean evaluateSeverityRule(String rule, Map<String, Number> vars) {
        if (rule == null || rule.isBlank()) return false;
        String trimmed = rule.trim();
        // Ordre des operateurs : >= et <= avant > et < (matching greedy)
        String[] operators = {">=", "<=", "==", ">", "<"};
        for (String op : operators) {
            int idx = trimmed.indexOf(op);
            if (idx <= 0) continue;
            String left = trimmed.substring(0, idx).trim();
            String right = trimmed.substring(idx + op.length()).trim();
            Number leftVal = vars.get(left);
            if (leftVal == null) return false;
            double rightVal;
            try { rightVal = Double.parseDouble(right); }
            catch (NumberFormatException e) { return false; }
            double leftD = leftVal.doubleValue();
            return switch (op) {
                case ">=" -> leftD >= rightVal;
                case "<=" -> leftD <= rightVal;
                case "==" -> Double.compare(leftD, rightVal) == 0;
                case ">" -> leftD > rightVal;
                case "<" -> leftD < rightVal;
                default -> false;
            };
        }
        return false;
    }

    /**
     * Interpole les placeholders {@code {key}} dans la description.
     * Format : {@code "Voici {count} truc(s)"} avec {@code vars.put("count", 3)}.
     */
    public String renderDescription(Map<String, Object> vars) {
        if (description == null) return "";
        String result = description;
        for (Map.Entry<String, Object> entry : vars.entrySet()) {
            result = result.replace("{" + entry.getKey() + "}",
                    String.valueOf(entry.getValue()));
        }
        return result;
    }

    @Override
    public String toString() {
        return String.format(Locale.ROOT,
                "PortfolioPatternTemplate{id='%s',type='%s',enabled=%s}",
                id, type, enabled);
    }
}
