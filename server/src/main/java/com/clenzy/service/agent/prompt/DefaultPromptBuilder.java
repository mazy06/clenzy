package com.clenzy.service.agent.prompt;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Implementation par defaut du {@link PromptBuilder} : assemble un
 * {@link PromptContext} immutable et delegue au {@link SystemPromptComposer}.
 *
 * <p>Stateless + thread-safe (singleton Spring).</p>
 */
@Component
public class DefaultPromptBuilder implements PromptBuilder {

    private final SystemPromptComposer composer;

    public DefaultPromptBuilder(SystemPromptComposer composer) {
        this.composer = composer;
    }

    @Override
    public ComposedSystemPrompt buildChatPrompt(AgentContext agentContext,
                                                 String userMessage,
                                                 List<AssistantMemory> memories,
                                                 List<KbSearchService.KbSearchHit> kbHits) {
        PromptContext ctx = PromptContext.builder(agentContext, PromptPreset.CHAT)
                .latestUserMessage(userMessage)
                .memories(memories)
                .kbHits(kbHits)
                .build();
        return composer.composeSegmented(ctx);
    }

    @Override
    public String buildBriefingPrompt(AgentContext agentContext,
                                        PromptPreset preset,
                                        List<AssistantMemory> memories) {
        if (preset == null || preset == PromptPreset.CHAT) {
            throw new IllegalArgumentException("Briefing preset required, got: " + preset);
        }
        PromptContext ctx = PromptContext.builder(agentContext, preset)
                .memories(memories)
                .build();
        return composer.compose(ctx);
    }
}
