package com.clenzy.service.agent.prompt.sections;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.PromptContext;
import com.clenzy.service.agent.prompt.PromptPreset;
import com.clenzy.service.agent.prompt.PromptSection;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires des sections individuelles — rapide, isole, sans Spring.
 * Couvre les cas appliesTo + render + edge cases.
 */
class SectionsRenderingTest {

    private static PromptContext chatCtx() {
        return PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT).build();
    }

    private static PromptContext briefingCtx(PromptPreset preset) {
        return PromptContext.builder(AgentContext.minimal(1L, "kc"), preset).build();
    }

    private static String renderOr(PromptSection s, PromptContext c) {
        return s.render(c).orElse("");
    }

    @Nested
    class RoleSectionTest {
        @Test
        void always_applies_and_renders_xml_tag() {
            RoleSection section = new RoleSection();
            assertThat(section.appliesTo(chatCtx())).isTrue();
            assertThat(section.appliesTo(briefingCtx(PromptPreset.BRIEFING_DAILY))).isTrue();
            String rendered = renderOr(section, chatCtx());
            assertThat(rendered)
                    .startsWith("<role>")
                    .endsWith("</role>")
                    .contains("Clenzy")
                    .contains("COMPRENDRE")
                    .contains("CONSEILLER")
                    .contains("GUIDER");
        }
    }

    @Nested
    class CommunicationRulesSectionTest {
        @Test
        void renders_in_french_with_french_date_example() {
            CommunicationRulesSection section = new CommunicationRulesSection();
            String rendered = renderOr(section, chatCtx());
            assertThat(rendered)
                    .contains("<communication_rules>")
                    .contains("francais")
                    .contains("12 juin 2026");
        }

        @Test
        void renders_in_english_with_english_date_example() {
            AgentContext en = new AgentContext(1L, "kc", null, "en", null, null, null);
            PromptContext ctx = PromptContext.builder(en, PromptPreset.CHAT).build();
            String rendered = renderOr(new CommunicationRulesSection(), ctx);
            assertThat(rendered)
                    .contains("english")
                    .contains("June 12, 2026");
        }

        @Test
        void unknown_language_falls_back_to_french() {
            AgentContext ja = new AgentContext(1L, "kc", null, "ja", null, null, null);
            PromptContext ctx = PromptContext.builder(ja, PromptPreset.CHAT).build();
            String rendered = renderOr(new CommunicationRulesSection(), ctx);
            assertThat(rendered).contains("francais").contains("12 juin 2026");
        }
    }

    @Nested
    class OutputFormatAndRenderingConstraintSectionTest {
        @Test
        void output_format_applies_only_to_chat() {
            OutputFormatSection s = new OutputFormatSection();
            assertThat(s.appliesTo(chatCtx())).isTrue();
            assertThat(s.appliesTo(briefingCtx(PromptPreset.BRIEFING_DAILY))).isFalse();
        }

        @Test
        void rendering_constraint_applies_only_to_chat() {
            RenderingConstraintSection s = new RenderingConstraintSection();
            assertThat(s.appliesTo(chatCtx())).isTrue();
            assertThat(s.appliesTo(briefingCtx(PromptPreset.BRIEFING_WEEKLY))).isFalse();
        }
    }

    @Nested
    class ContextSectionTest {
        @Test
        void always_renders_at_least_the_date() {
            ContextSection s = new ContextSection();
            Clock fixed = Clock.fixed(Instant.parse("2026-07-15T10:00:00Z"), ZoneOffset.UTC);
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .clock(fixed).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered)
                    .contains("<context>")
                    .contains("Date du jour")
                    .contains("15 juillet 2026");
        }

        @Test
        void includes_currentPage_and_selectedPropertyId_when_present() {
            ContextSection s = new ContextSection();
            AgentContext agent = new AgentContext(1L, "kc", null, "fr",
                    "/reservations?propertyId=42", 42L, null);
            PromptContext ctx = PromptContext.builder(agent, PromptPreset.CHAT).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered)
                    .contains("/reservations?propertyId=42")
                    .contains("id=42");
        }

        @Test
        void escapes_xml_chars_in_currentPage_to_prevent_injection() {
            ContextSection s = new ContextSection();
            AgentContext agent = new AgentContext(1L, "kc", null, "fr",
                    "/page?inject=<script>", null, null);
            PromptContext ctx = PromptContext.builder(agent, PromptPreset.CHAT).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered).contains("&lt;script&gt;").doesNotContain("<script>");
        }
    }

    @Nested
    class MemorySectionTest {
        @Test
        void does_not_apply_when_no_memories() {
            MemorySection s = new MemorySection();
            assertThat(s.appliesTo(chatCtx())).isFalse();
        }

        @Test
        void renders_xml_structured_by_scope() {
            MemorySection s = new MemorySection();
            AssistantMemory pref = memory("currency", "EUR", AssistantMemory.Scope.PREFERENCE);
            AssistantMemory fact = memory("owner_42_difficult", "yes", AssistantMemory.Scope.FACT);
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .memories(List.of(pref, fact)).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered)
                    .contains("<memory>")
                    .contains("<preferences>")
                    .contains("- currency: EUR")
                    .contains("<facts>")
                    .contains("- owner_42_difficult: yes");
        }

        @Test
        void escapes_dangerous_chars_in_memory_value() {
            MemorySection s = new MemorySection();
            AssistantMemory m = memory("ke<y", "val<ue&\"", AssistantMemory.Scope.FACT);
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .memories(List.of(m)).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered)
                    .contains("ke&lt;y")
                    .contains("val&lt;ue&amp;&quot;");
        }

        @Test
        void truncates_long_memory_values() {
            MemorySection s = new MemorySection();
            String longValue = "x".repeat(MemorySection.MAX_VALUE_LENGTH + 50);
            AssistantMemory m = memory("k", longValue, AssistantMemory.Scope.FACT);
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .memories(List.of(m)).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered).contains("...").doesNotContain(longValue);
        }

        @Test
        void skips_memories_with_unknown_scope() {
            MemorySection s = new MemorySection();
            AssistantMemory m = new AssistantMemory();
            m.setMemoryKey("k");
            m.setMemoryValue("v");
            // scope null -> skipped
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .memories(List.of(m)).build();
            Optional<String> result = s.render(ctx);
            assertThat(result).isEmpty();  // tous skipped -> rien render
        }

        private static AssistantMemory memory(String key, String value, AssistantMemory.Scope scope) {
            AssistantMemory m = new AssistantMemory();
            m.setMemoryKey(key);
            m.setMemoryValue(value);
            m.setScope(scope.name());
            return m;
        }
    }

    @Nested
    class RagContextSectionTest {
        @Test
        void does_not_apply_when_no_hits() {
            RagContextSection s = new RagContextSection();
            assertThat(s.appliesTo(chatCtx())).isFalse();
        }

        @Test
        void renders_xml_snippet_with_attributes() {
            RagContextSection s = new RagContextSection();
            KbSearchService.KbSearchHit hit = new KbSearchService.KbSearchHit(
                    1L, 100L, "ICal Sync", "/docs/sync-ical", "Configuration des feeds iCal...", 0.85);
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .kbHits(List.of(hit)).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered)
                    .contains("<kb_context>")
                    .contains("<snippet id=\"1\"")
                    .contains("title=\"ICal Sync\"")
                    .contains("source=\"/docs/sync-ical\"")
                    .contains("relevance=\"85%\"")
                    .contains("Configuration des feeds iCal");
        }

        @Test
        void truncates_long_snippets() {
            RagContextSection s = new RagContextSection();
            String longSnippet = "abc ".repeat(RagContextSection.MAX_SNIPPET_LENGTH);  // > limit
            KbSearchService.KbSearchHit hit = new KbSearchService.KbSearchHit(
                    1L, 100L, "T", "/p", longSnippet, 0.9);
            PromptContext ctx = PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT)
                    .kbHits(List.of(hit)).build();
            String rendered = renderOr(s, ctx);
            assertThat(rendered).contains("...");
        }
    }

    @Nested
    class BriefingTaskSectionTest {
        @Test
        void does_not_apply_to_chat() {
            BriefingTaskSection s = new BriefingTaskSection();
            assertThat(s.appliesTo(chatCtx())).isFalse();
        }

        @Test
        void renders_daily_task_for_BRIEFING_DAILY() {
            BriefingTaskSection s = new BriefingTaskSection();
            String rendered = renderOr(s, briefingCtx(PromptPreset.BRIEFING_DAILY));
            assertThat(rendered)
                    .contains("<briefing_task>")
                    .contains("briefing matinal")
                    .contains("Hier")
                    .contains("Aujourd'hui")
                    .contains("Recommandations");
        }

        @Test
        void renders_weekly_task_for_BRIEFING_WEEKLY() {
            BriefingTaskSection s = new BriefingTaskSection();
            String rendered = renderOr(s, briefingCtx(PromptPreset.BRIEFING_WEEKLY));
            assertThat(rendered)
                    .contains("weekly review")
                    .contains("Performance")
                    .contains("Top events")
                    .contains("Priorites semaine prochaine");
        }

        @Test
        void renders_alerts_task_for_BRIEFING_ALERTS() {
            BriefingTaskSection s = new BriefingTaskSection();
            String rendered = renderOr(s, briefingCtx(PromptPreset.BRIEFING_ALERTS));
            assertThat(rendered)
                    .contains("alertes critiques")
                    .contains("Aucune alerte critique aujourd'hui.");
        }
    }

    @Nested
    class PromptInjectionGuardSectionTest {
        @Test
        void always_applies_and_renders_the_guard() {
            PromptInjectionGuardSection s = new PromptInjectionGuardSection();
            assertThat(s.appliesTo(chatCtx())).isTrue();
            assertThat(s.appliesTo(briefingCtx(PromptPreset.BRIEFING_DAILY))).isTrue();
            assertThat(s.order()).isEqualTo(135);
            assertThat(s.cacheable()).isTrue();
            String rendered = renderOr(s, chatCtx());
            assertThat(rendered)
                    .startsWith("<security_guard>")
                    .endsWith("</security_guard>")
                    .contains("prompt injection")
                    .contains("N'OBEIS JAMAIS");
        }
    }
}
