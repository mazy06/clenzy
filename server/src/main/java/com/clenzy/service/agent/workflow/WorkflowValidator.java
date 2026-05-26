package com.clenzy.service.agent.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Validateur des reponses utilisateur contre le contrat {@code expectsData} d'un
 * step de workflow.
 *
 * <h3>Pourquoi sans dependance externe</h3>
 * Le format declare est tres limite (4 types primitifs + une declinaison liste).
 * Charger {@code com.networknt:json-schema-validator} (~400KB + transitive) pour
 * 4 types est disproportionne. On verifie nous-memes les contrats avec une regle
 * simple par type.
 *
 * <h3>Types supportes (chaine sensible casse-insensitive)</h3>
 * <ul>
 *   <li>{@code "string"} : reponse non blank</li>
 *   <li>{@code "number"} : parseable en double (entiers OK)</li>
 *   <li>{@code "boolean"} : "oui|non|yes|no|true|false|0|1" (insensible casse)</li>
 *   <li>{@code "string[]"} : reponse non-blank, decoupable en >= 1 element par {@code [,;\s]+}</li>
 * </ul>
 *
 * <h3>Strategie de validation</h3>
 * <ol>
 *   <li>Si le step n'a pas d'{@code expectsData}, validation OK (rien a verifier).</li>
 *   <li>Si la reponse est blank, validation OK (le caller decide de le laisser passer
 *       ou de re-prompter — le contrat ne s'applique que sur reponse non vide).</li>
 *   <li>Si {@code expectsData} declare 1 seul champ : la reponse texte de l'user
 *       represente directement ce champ — on valide le type unique.</li>
 *   <li>Si {@code expectsData} declare N champs : la reponse doit etre un JSON
 *       parseable contenant ces N cles. Si l'user a repondu en texte libre, on
 *       throw avec un message demandant un JSON structure.</li>
 * </ol>
 */
@Component
public class WorkflowValidator {

    private static final Logger log = LoggerFactory.getLogger(WorkflowValidator.class);

    /** Tokens "true" reconnus (insensible casse). */
    private static final java.util.Set<String> TRUE_TOKENS = java.util.Set.of(
            "true", "1", "oui", "yes", "ok", "y", "o");
    /** Tokens "false" reconnus (insensible casse). */
    private static final java.util.Set<String> FALSE_TOKENS = java.util.Set.of(
            "false", "0", "non", "no", "n");

    private final ObjectMapper objectMapper;

    public WorkflowValidator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Valide la reponse user pour le step donne.
     *
     * @throws WorkflowValidationException si la reponse viole le contrat declare
     */
    public void validate(WorkflowDefinition.Step step, String userResponse) {
        if (step == null || step.expectsData == null || step.expectsData.isEmpty()) {
            return;
        }
        if (userResponse == null || userResponse.isBlank()) {
            return;
        }

        Map<String, Object> contract = step.expectsData;
        if (contract.size() == 1) {
            Map.Entry<String, Object> only = contract.entrySet().iterator().next();
            validateSingleField(step.id, only.getKey(), String.valueOf(only.getValue()), userResponse);
            return;
        }

        // Plusieurs champs : on attend du JSON
        JsonNode parsed;
        try {
            parsed = objectMapper.readTree(userResponse);
        } catch (Exception e) {
            throw new WorkflowValidationException(step.id,
                    "Le step '" + step.id + "' attend " + contract.size()
                            + " champs (" + String.join(", ", contract.keySet())
                            + ") — reponds en JSON structure.");
        }
        if (!(parsed instanceof ObjectNode obj)) {
            throw new WorkflowValidationException(step.id,
                    "Reponse JSON attendue (objet), recu " + parsed.getNodeType());
        }
        for (Map.Entry<String, Object> e : contract.entrySet()) {
            String field = e.getKey();
            String type = String.valueOf(e.getValue());
            JsonNode value = obj.get(field);
            if (value == null || value.isNull()) {
                throw new WorkflowValidationException(step.id,
                        "Champ '" + field + "' manquant dans la reponse JSON.");
            }
            validateJsonField(step.id, field, type, value);
        }
    }

    private void validateSingleField(String stepId, String field, String type, String response) {
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        switch (normalized) {
            case "string" -> {
                if (response.trim().isEmpty()) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' attendu string non vide.");
                }
            }
            case "number" -> {
                try {
                    Double.parseDouble(response.trim().replace(',', '.'));
                } catch (NumberFormatException nfe) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' attendu number, recu '" + response.trim() + "'.");
                }
            }
            case "boolean" -> {
                if (parseBoolean(response).isEmpty()) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' attendu boolean (oui/non/true/false), recu '"
                                    + response.trim() + "'.");
                }
            }
            case "string[]" -> {
                List<String> tokens = splitList(response);
                if (tokens.isEmpty()) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' attendu liste non vide (separateurs , ; espace).");
                }
            }
            default -> log.debug("Type '{}' non reconnu pour champ '{}', validation skipped", type, field);
        }
    }

    private void validateJsonField(String stepId, String field, String type, JsonNode value) {
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        switch (normalized) {
            case "string" -> {
                if (!value.isTextual() || value.asText().isBlank()) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' doit etre une string non vide.");
                }
            }
            case "number" -> {
                if (!value.isNumber()) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' doit etre un number, recu " + value.getNodeType());
                }
            }
            case "boolean" -> {
                if (!value.isBoolean()) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' doit etre boolean (true/false), recu " + value.getNodeType());
                }
            }
            case "string[]" -> {
                if (!value.isArray() || value.size() == 0) {
                    throw new WorkflowValidationException(stepId,
                            "Champ '" + field + "' doit etre un array non vide de strings.");
                }
                for (JsonNode item : value) {
                    if (!item.isTextual()) {
                        throw new WorkflowValidationException(stepId,
                                "Champ '" + field + "' : chaque element doit etre une string.");
                    }
                }
            }
            default -> log.debug("Type '{}' non reconnu pour champ '{}', validation skipped", type, field);
        }
    }

    /** Parse boolean tolerant (fr/en/numerique). */
    static java.util.Optional<Boolean> parseBoolean(String raw) {
        if (raw == null) return java.util.Optional.empty();
        String t = raw.trim().toLowerCase(Locale.ROOT);
        if (TRUE_TOKENS.contains(t)) return java.util.Optional.of(true);
        if (FALSE_TOKENS.contains(t)) return java.util.Optional.of(false);
        return java.util.Optional.empty();
    }

    /** Decoupe une liste libre par virgule, point-virgule ou espace. */
    static List<String> splitList(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        String[] parts = raw.trim().split("[,;\\s]+");
        List<String> out = new java.util.ArrayList<>(parts.length);
        for (String p : parts) {
            if (!p.isBlank()) out.add(p.trim());
        }
        return out;
    }
}
