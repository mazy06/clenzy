package com.clenzy.service.agent.prompt.sections;

import java.util.Objects;

/**
 * Few-shot example pour guider le LLM via demonstration.
 *
 * <p>Charge depuis {@code resources/prompts/examples.yaml} au boot via
 * {@link ExampleLoader}. Immutable, safe a partager entre threads.</p>
 *
 * @param id        identifiant unique snake_case (cle de tracking / metrics)
 * @param category  categorie metier (analysis, simulation, navigation, write_action, kb_query)
 * @param user      message utilisateur type
 * @param thinking  raisonnement cache optionnel (peut etre null)
 * @param assistant reponse ideale
 */
public record PromptExample(
        String id,
        String category,
        String user,
        String thinking,
        String assistant
) {
    public PromptExample {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(category, "category");
        Objects.requireNonNull(user, "user");
        Objects.requireNonNull(assistant, "assistant");
        if (id.isBlank()) throw new IllegalArgumentException("PromptExample.id cannot be blank");
        if (user.isBlank()) throw new IllegalArgumentException("PromptExample.user cannot be blank");
        if (assistant.isBlank()) throw new IllegalArgumentException("PromptExample.assistant cannot be blank");
    }
}
