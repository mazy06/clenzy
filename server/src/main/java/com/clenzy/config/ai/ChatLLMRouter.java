package com.clenzy.config.ai;

import org.springframework.stereotype.Component;

import java.util.function.Consumer;

/**
 * Routeur {@link ChatLLMProvider} : choisit l'implementation concrete selon
 * {@link ChatRequest#provider()}.
 *
 * <p>Le bean {@code @Primary} de l'interface est {@code FailoverChatLLMProvider}
 * (service.agent), qui ENVELOPPE ce routeur pour ajouter le basculement
 * multi-provider (NVIDIA → Anthropic → OpenAI) sur indisponibilite. Ce routeur
 * reste un {@code @Component} simple, injecte par type concret dans le wrapper,
 * et delegue a :</p>
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
