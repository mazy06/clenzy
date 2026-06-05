package com.clenzy.config.ai;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.function.Consumer;

/**
 * Routeur {@link ChatLLMProvider} : choisit l'implementation concrete selon
 * {@link ChatRequest#provider()}.
 *
 * <p>Bean {@code @Primary} : tous les points d'injection existants (AgentOrchestrator,
 * OrchestratorAgent, specialists) injectent {@link ChatLLMProvider} et recoivent ce
 * routeur, sans changer leur constructeur. Le routeur delegue ensuite a :</p>
 * <ul>
 *   <li><b>anthropic</b> (ou provider null/par defaut) → {@link AnthropicChatProvider}</li>
 *   <li><b>openai / nvidia / bedrock / ...</b> (tout endpoint OpenAI-compatible) →
 *       {@link OpenAiChatProvider}</li>
 * </ul>
 *
 * <p>L'orchestrateur resout le provider effectif (cle BYOK, modele plateforme, override
 * feature) et le pose sur le {@link ChatRequest} via {@link ChatRequest#withTarget}. Le
 * routeur n'a donc aucune logique de credentials — uniquement le choix d'implementation.</p>
 */
@Primary
@Component
public class ChatLLMRouter implements ChatLLMProvider {

    private final AnthropicChatProvider anthropic;
    private final OpenAiChatProvider openai;

    public ChatLLMRouter(AnthropicChatProvider anthropic, OpenAiChatProvider openai) {
        this.anthropic = anthropic;
        this.openai = openai;
    }

    @Override
    public String name() {
        return "router";
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer) {
        pick(request).streamChat(request, consumer);
    }

    @Override
    public void streamChat(ChatRequest request, Consumer<ChatEvent> consumer, String apiKey) {
        pick(request).streamChat(request, consumer, apiKey);
    }

    /** Anthropic par defaut ; tout autre provider passe par le chemin OpenAI-compatible. */
    private ChatLLMProvider pick(ChatRequest request) {
        String provider = request.provider();
        if (provider == null || provider.isBlank() || "anthropic".equalsIgnoreCase(provider)) {
            return anthropic;
        }
        return openai;
    }
}
