package com.clenzy.service.agent;

import com.clenzy.config.ai.ToolDescriptor;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Contrat d'un tool executable par l'assistant.
 *
 * <p>Chaque implementation est un {@link org.springframework.stereotype.Component @Component}
 * Spring decouverte automatiquement par le {@link ToolRegistry}.</p>
 *
 * <p><b>Regle d'or</b> : un tool n'accede JAMAIS a la base de donnees directement.
 * Il delegue a un {@code Service} Spring existant (qui porte l'autorisation, le
 * filtrage multi-tenant, la logique metier). Cela garantit que l'assistant
 * herite des memes garanties de securite que les endpoints REST classiques.</p>
 *
 * <p>Convention de nommage : {@link #name()} est en snake_case, court et explicite
 * (ex: {@code list_reservations}, {@code get_dashboard_summary}).</p>
 */
public interface ToolHandler {

    /**
     * Nom du tool, expose au LLM. Doit etre unique sur le registry et stable
     * (changer un nom = changer les conversations historiques qui le referencent).
     */
    String name();

    /**
     * Descripteur complet du tool : description, schema JSON des args, flag confirmation.
     * Le {@link ToolDescriptor#name()} doit etre identique a {@link #name()}.
     */
    ToolDescriptor descriptor();

    /**
     * Execute le tool avec les arguments JSON fournis par le LLM.
     *
     * @param args    objet JSON des arguments (peut etre vide mais jamais null)
     * @param context contexte de la conversation (org, user, etc.)
     * @return resultat de l'execution (sera serialise et renvoye au LLM)
     * @throws ToolExecutionException si l'execution echoue de maniere previsible
     */
    ToolResult execute(JsonNode args, AgentContext context);
}
