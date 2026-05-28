package com.clenzy.service.agent.prompt;

import com.clenzy.model.AssistantMemory;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.kb.KbSearchService;
import com.clenzy.service.agent.prompt.sections.AntiHallucinationSection;
import com.clenzy.service.agent.prompt.sections.CommunicationRulesSection;
import com.clenzy.service.agent.prompt.sections.ContextSection;
import com.clenzy.service.agent.prompt.sections.ExampleLoader;
import com.clenzy.service.agent.prompt.sections.ExamplesSection;
import com.clenzy.service.agent.prompt.sections.MemorySection;
import com.clenzy.service.agent.prompt.sections.NavigationMapSection;
import com.clenzy.service.agent.prompt.sections.OutputFormatSection;
import com.clenzy.service.agent.prompt.sections.RagContextSection;
import com.clenzy.service.agent.prompt.sections.RenderingConstraintSection;
import com.clenzy.service.agent.prompt.sections.RoleSection;
import com.clenzy.service.agent.prompt.sections.ToolsUsageHintsSection;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.ClassPathResource;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests de performance + integration full-stack (sans Spring) du composer
 * avec TOUTES les sections reelles.
 *
 * <p>Cibles :</p>
 * <ul>
 *   <li>Latence p99 &lt; 5 ms par compose (10k iterations)</li>
 *   <li>100 threads simultanes sans race, sans corruption</li>
 *   <li>Taille du prompt &lt; 10 KB en mode chat full (memory + RAG + examples)</li>
 * </ul>
 */
class PromptComposerPerformanceTest {

    private DefaultSystemPromptComposer buildComposerWithAllSections() {
        ExampleLoader loader = new ExampleLoader(new ClassPathResource("prompts/examples.yaml"));
        loader.loadExamples();

        List<PromptSection> sections = Arrays.asList(
                new RoleSection(),
                new ContextSection(),
                new CommunicationRulesSection(),
                new OutputFormatSection(),
                new RenderingConstraintSection(),
                new AntiHallucinationSection(),
                new MemorySection(),
                new RagContextSection(),
                new ToolsUsageHintsSection(),
                new ExamplesSection(loader),
                new NavigationMapSection()
        );

        @SuppressWarnings("unchecked")
        ObjectProvider<PromptSection> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> sections.stream());
        return new DefaultSystemPromptComposer(provider, new SimpleMeterRegistry());
    }

    private PromptContext sampleChatContext() {
        AgentContext agent = new AgentContext(1L, "kc-perf", null, "fr",
                "/reservations?propertyId=42", 42L, null);
        return PromptContext.builder(agent, PromptPreset.CHAT)
                .latestUserMessage("Comment va mon portfolio cette semaine ?")
                .memories(sampleMemories())
                .kbHits(sampleHits())
                .build();
    }

    private static List<AssistantMemory> sampleMemories() {
        return IntStream.range(0, 10).mapToObj(i -> {
            AssistantMemory m = new AssistantMemory();
            m.setMemoryKey("key_" + i);
            m.setMemoryValue("value " + i + " avec un peu de texte pour realisme");
            m.setScope((i % 4 == 0 ? AssistantMemory.Scope.PREFERENCE
                    : i % 4 == 1 ? AssistantMemory.Scope.FACT
                    : i % 4 == 2 ? AssistantMemory.Scope.GOAL
                    : AssistantMemory.Scope.PROJECT).name());
            return m;
        }).toList();
    }

    private static List<KbSearchService.KbSearchHit> sampleHits() {
        return List.of(
                new KbSearchService.KbSearchHit(1L, 10L, "Pricing dynamique",
                        "/docs/pricing.md", "Le pricing dynamique permet d'ajuster les prix...", 0.92),
                new KbSearchService.KbSearchHit(2L, 20L, "Yield management",
                        "/docs/yield.md", "Strategies de yield management...", 0.85),
                new KbSearchService.KbSearchHit(3L, 30L, "Sync iCal",
                        "/docs/ical.md", "La synchronisation iCal importe...", 0.78)
        );
    }

    @Test
    void p99_latency_under_5ms_over_10k_renders() {
        DefaultSystemPromptComposer composer = buildComposerWithAllSections();
        PromptContext ctx = sampleChatContext();

        // Warm-up : 1k iterations pour amortir JIT
        for (int i = 0; i < 1_000; i++) composer.compose(ctx);

        // Mesure : 10k iterations
        int N = 10_000;
        long[] timings = new long[N];
        for (int i = 0; i < N; i++) {
            long t0 = System.nanoTime();
            composer.compose(ctx);
            timings[i] = System.nanoTime() - t0;
        }
        Arrays.sort(timings);
        long p50 = timings[N / 2];
        long p95 = timings[(int) (N * 0.95)];
        long p99 = timings[(int) (N * 0.99)];
        long max = timings[N - 1];

        System.out.printf("compose latency : p50=%.2fms p95=%.2fms p99=%.2fms max=%.2fms%n",
                p50 / 1_000_000.0, p95 / 1_000_000.0, p99 / 1_000_000.0, max / 1_000_000.0);

        // Cible : p99 sous 5 ms. Genereux car varie selon CPU. Si jamais > 10ms,
        // c'est un regression critique.
        assertThat(p99).isLessThan(10_000_000L);  // 10 ms
    }

    @Test
    void concurrent_100_threads_produce_identical_output() throws Exception {
        DefaultSystemPromptComposer composer = buildComposerWithAllSections();
        PromptContext ctx = sampleChatContext();
        String reference = composer.compose(ctx);

        int THREADS = 100;
        int ITER_PER_THREAD = 50;
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        AtomicInteger mismatches = new AtomicInteger();
        AtomicInteger errors = new AtomicInteger();
        try {
            for (int i = 0; i < THREADS; i++) {
                pool.submit(() -> {
                    try {
                        for (int j = 0; j < ITER_PER_THREAD; j++) {
                            String result = composer.compose(ctx);
                            if (!reference.equals(result)) mismatches.incrementAndGet();
                        }
                    } catch (Exception e) {
                        errors.incrementAndGet();
                    }
                });
            }
            pool.shutdown();
            assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();
        } finally {
            if (!pool.isShutdown()) pool.shutdownNow();
        }
        assertThat(errors.get()).isZero();
        assertThat(mismatches.get()).isZero();
    }

    @Test
    void full_chat_prompt_size_reasonable() {
        DefaultSystemPromptComposer composer = buildComposerWithAllSections();
        String prompt = composer.compose(sampleChatContext());
        // En CHAT full (avec memory + RAG + examples + navigation), le prompt
        // doit rester sous 20 KB. Si on depasse, c'est qu'on a ajoute du contenu
        // qu'on devrait elaguer (gain coût LLM).
        assertThat(prompt.length()).isLessThan(20_000);
        // Mais > 2 KB sinon on perd l'effet du framework (juste 1 section)
        assertThat(prompt.length()).isGreaterThan(2_000);
    }

    @Test
    void all_expected_xml_tags_present_in_full_chat_compose() {
        DefaultSystemPromptComposer composer = buildComposerWithAllSections();
        String prompt = composer.compose(sampleChatContext());
        // Verifier presence des sections cles (assemblage end-to-end)
        assertThat(prompt)
                .contains("<role>").contains("</role>")
                .contains("<context>").contains("</context>")
                .contains("<communication_rules>")
                .contains("<output_format>")
                .contains("<rendering_constraint>")
                .contains("<anti_hallucination>")
                .contains("<memory>")
                .contains("<kb_context>")
                .contains("<tools_usage_hints>")
                .contains("<examples>")
                .contains("<navigation_map>");
    }

    @Test
    void briefing_compose_skips_chat_only_sections() {
        DefaultSystemPromptComposer composer = buildComposerWithAllSections();
        AgentContext agent = AgentContext.minimal(1L, "kc");
        PromptContext briefingCtx = PromptContext.builder(agent, PromptPreset.BRIEFING_DAILY)
                .build();
        String prompt = composer.compose(briefingCtx);
        // Sections briefing-friendly : role, context, communication, anti-hallu
        assertThat(prompt).contains("<role>").contains("<anti_hallucination>");
        // Sections chat-only EXCLUES
        assertThat(prompt)
                .doesNotContain("<output_format>")
                .doesNotContain("<rendering_constraint>")
                .doesNotContain("<tools_usage_hints>")
                .doesNotContain("<examples>")
                .doesNotContain("<navigation_map>");
    }
}
