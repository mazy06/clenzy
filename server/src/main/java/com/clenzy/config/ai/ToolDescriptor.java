package com.clenzy.config.ai;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Descripteur d'un outil exposable au LLM via function calling.
 *
 * <p>Le {@link #jsonSchema} suit le standard JSON Schema (object, properties, required)
 * et est envoye tel quel a Anthropic ({@code input_schema}) ou OpenAI ({@code parameters}).</p>
 *
 * <p>Le flag {@link #requiresConfirmation} indique que l'execution doit etre
 * gatee par une confirmation utilisateur explicite cote frontend AVANT d'etre
 * effectuee. L'orchestrateur ne doit jamais executer un tool requiresConfirmation
 * sans avoir recu un {@code POST /assistant/tool-confirm} prealable.</p>
 *
 * @param name                 nom unique du tool (snake_case recommande, ex: "list_reservations")
 * @param description          description courte pour le LLM (1-2 phrases, en francais)
 * @param jsonSchema           schema JSON des arguments
 * @param requiresConfirmation true si l'execution est une operation d'ecriture/destructive
 */
public record ToolDescriptor(
        String name,
        String description,
        JsonNode jsonSchema,
        boolean requiresConfirmation
) {

    /** Tool de lecture (execution directe, pas de confirmation). */
    public static ToolDescriptor readOnly(String name, String description, JsonNode jsonSchema) {
        return new ToolDescriptor(name, description, jsonSchema, false);
    }

    /** Tool d'ecriture (necessite confirmation utilisateur). */
    public static ToolDescriptor write(String name, String description, JsonNode jsonSchema) {
        return new ToolDescriptor(name, description, jsonSchema, true);
    }
}
