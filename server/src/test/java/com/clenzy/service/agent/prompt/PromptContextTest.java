package com.clenzy.service.agent.prompt;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PromptContextTest {

    private static AgentContext sampleAgent() {
        return AgentContext.minimal(1L, "kc-123");
    }

    @Test
    void requires_agentContext() {
        assertThatThrownBy(() -> PromptContext.builder(null, PromptPreset.CHAT).build())
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void requires_preset() {
        assertThatThrownBy(() -> PromptContext.builder(sampleAgent(), null).build())
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void defaults_memories_and_hits_to_empty_list() {
        PromptContext ctx = PromptContext.builder(sampleAgent(), PromptPreset.CHAT).build();
        assertThat(ctx.memories()).isEmpty();
        assertThat(ctx.kbHits()).isEmpty();
        assertThat(ctx.today()).isNotNull();
    }

    @Test
    void copies_lists_defensively_to_prevent_external_mutation() {
        List<AssistantMemory> originalMemories = new ArrayList<>();
        originalMemories.add(new AssistantMemory());
        PromptContext ctx = PromptContext.builder(sampleAgent(), PromptPreset.CHAT)
                .memories(originalMemories)
                .build();
        originalMemories.clear();  // mutation externe
        assertThat(ctx.memories()).hasSize(1);  // contexte intact
    }

    @Test
    void returned_lists_are_unmodifiable() {
        PromptContext ctx = PromptContext.builder(sampleAgent(), PromptPreset.CHAT)
                .memories(List.of(new AssistantMemory()))
                .build();
        assertThatThrownBy(() -> ctx.memories().add(new AssistantMemory()))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void isChat_and_isBriefing_correctly_classify_presets() {
        AgentContext agent = sampleAgent();
        assertThat(PromptContext.builder(agent, PromptPreset.CHAT).build().isChat()).isTrue();
        assertThat(PromptContext.builder(agent, PromptPreset.CHAT).build().isBriefing()).isFalse();
        assertThat(PromptContext.builder(agent, PromptPreset.BRIEFING_DAILY).build().isBriefing()).isTrue();
        assertThat(PromptContext.builder(agent, PromptPreset.BRIEFING_WEEKLY).build().isBriefing()).isTrue();
        assertThat(PromptContext.builder(agent, PromptPreset.BRIEFING_ALERTS).build().isBriefing()).isTrue();
        assertThat(PromptContext.builder(agent, PromptPreset.BRIEFING_DAILY).build().isChat()).isFalse();
    }

    @Test
    void today_uses_provided_clock() {
        Clock fixed = Clock.fixed(Instant.parse("2026-07-15T10:00:00Z"), ZoneOffset.UTC);
        PromptContext ctx = PromptContext.builder(sampleAgent(), PromptPreset.CHAT)
                .clock(fixed)
                .build();
        assertThat(ctx.today()).isEqualTo(LocalDate.of(2026, 7, 15));
    }

    @Test
    void explicit_today_overrides_clock() {
        Clock fixed = Clock.fixed(Instant.parse("2026-07-15T10:00:00Z"), ZoneOffset.UTC);
        LocalDate explicit = LocalDate.of(2027, 1, 1);
        PromptContext ctx = PromptContext.builder(sampleAgent(), PromptPreset.CHAT)
                .clock(fixed)
                .today(explicit)
                .build();
        assertThat(ctx.today()).isEqualTo(explicit);
    }

    @Test
    void language_helper_proxies_agent_context() {
        AgentContext agent = new AgentContext(1L, "kc", null, "en", null, null, null);
        PromptContext ctx = PromptContext.builder(agent, PromptPreset.CHAT).build();
        assertThat(ctx.language()).isEqualTo("en");
    }
}
