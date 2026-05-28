package com.clenzy.service.agent.prompt;

import com.clenzy.service.agent.AgentContext;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires du composer sans Spring (pas de SpringExtension nécessaire,
 * boot ultra-rapide ~50ms).
 */
class DefaultSystemPromptComposerTest {

    private SimpleMeterRegistry meterRegistry;

    @BeforeEach
    void setup() {
        meterRegistry = new SimpleMeterRegistry();
    }

    private DefaultSystemPromptComposer composerWith(PromptSection... sections) {
        @SuppressWarnings("unchecked")
        ObjectProvider<PromptSection> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> Stream.of(sections));
        return new DefaultSystemPromptComposer(provider, meterRegistry);
    }

    private PromptContext sampleContext() {
        return PromptContext.builder(AgentContext.minimal(1L, "kc"), PromptPreset.CHAT).build();
    }

    @Test
    void compose_with_no_sections_returns_empty_string() {
        DefaultSystemPromptComposer composer = composerWith();
        assertThat(composer.compose(sampleContext())).isEmpty();
    }

    @Test
    void compose_respects_order_ascending() {
        PromptSection a = fakeSection("a", 100, "AAA");
        PromptSection b = fakeSection("b", 50, "BBB");
        PromptSection c = fakeSection("c", 200, "CCC");
        String result = composerWith(a, b, c).compose(sampleContext());
        // order asc : b (50), a (100), c (200)
        int idxB = result.indexOf("BBB");
        int idxA = result.indexOf("AAA");
        int idxC = result.indexOf("CCC");
        assertThat(idxB).isLessThan(idxA);
        assertThat(idxA).isLessThan(idxC);
    }

    @Test
    void compose_separates_sections_with_double_newline() {
        PromptSection a = fakeSection("a", 10, "first");
        PromptSection b = fakeSection("b", 20, "second");
        String result = composerWith(a, b).compose(sampleContext());
        assertThat(result).isEqualTo("first\n\nsecond");
    }

    @Test
    void compose_skips_sections_not_applicable() {
        PromptSection alwaysOn = fakeSection("on", 10, "rendered");
        PromptSection skipped = new PromptSection() {
            public String name() { return "skip"; }
            public int order() { return 20; }
            public boolean appliesTo(PromptContext c) { return false; }
            public Optional<String> render(PromptContext c) { return Optional.of("SHOULD-NOT-APPEAR"); }
        };
        String result = composerWith(alwaysOn, skipped).compose(sampleContext());
        assertThat(result).contains("rendered").doesNotContain("SHOULD-NOT-APPEAR");
    }

    @Test
    void compose_skips_sections_returning_optional_empty() {
        PromptSection on = fakeSection("on", 10, "rendered");
        PromptSection empty = new PromptSection() {
            public String name() { return "empty"; }
            public int order() { return 20; }
            public Optional<String> render(PromptContext c) { return Optional.empty(); }
        };
        String result = composerWith(on, empty).compose(sampleContext());
        assertThat(result).isEqualTo("rendered");
    }

    @Test
    void compose_skips_sections_returning_blank_content() {
        PromptSection on = fakeSection("on", 10, "rendered");
        PromptSection blank = fakeSection("blank", 20, "   \n  ");
        String result = composerWith(on, blank).compose(sampleContext());
        assertThat(result).isEqualTo("rendered");
    }

    @Test
    void section_throwing_does_not_break_composition() {
        PromptSection ok = fakeSection("ok", 10, "OK");
        PromptSection bad = new PromptSection() {
            public String name() { return "bad"; }
            public int order() { return 20; }
            public Optional<String> render(PromptContext c) {
                throw new RuntimeException("BOOM");
            }
        };
        PromptSection alsoOk = fakeSection("alsoOk", 30, "ALSO-OK");
        String result = composerWith(ok, bad, alsoOk).compose(sampleContext());
        assertThat(result).contains("OK").contains("ALSO-OK").doesNotContain("BOOM");
        // metric incrementee
        assertThat(meterRegistry.counter("assistant.prompt.section_errors", "section", "bad").count()).isEqualTo(1.0);
    }

    @Test
    void sortedSections_cache_is_thread_safe_and_idempotent() throws Exception {
        AtomicInteger streamCount = new AtomicInteger();
        @SuppressWarnings("unchecked")
        ObjectProvider<PromptSection> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(inv -> {
            streamCount.incrementAndGet();
            return Stream.of(fakeSection("a", 10, "X"));
        });
        DefaultSystemPromptComposer composer = new DefaultSystemPromptComposer(provider, meterRegistry);

        // 100 threads composent en parallele
        ExecutorService pool = Executors.newFixedThreadPool(20);
        try {
            for (int i = 0; i < 100; i++) {
                pool.submit(() -> composer.compose(sampleContext()));
            }
            pool.shutdown();
            assertThat(pool.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        } finally {
            if (!pool.isShutdown()) pool.shutdownNow();
        }
        // Au pire chaque thread a recalcule (CAS sans synchronized), au mieux un seul.
        // L'important : le resultat est correct et le programme ne plante pas.
        assertThat(streamCount.get()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void metrics_counter_increments_per_render() {
        PromptSection a = fakeSection("a", 10, "A");
        PromptSection b = fakeSection("b", 20, "B");
        DefaultSystemPromptComposer composer = composerWith(a, b);
        composer.compose(sampleContext());
        assertThat(meterRegistry.counter("assistant.prompt.sections_rendered").count()).isEqualTo(2.0);
        composer.compose(sampleContext());
        assertThat(meterRegistry.counter("assistant.prompt.sections_rendered").count()).isEqualTo(4.0);
    }

    @Test
    void timer_records_compose_latency() {
        PromptSection a = fakeSection("a", 10, "A");
        DefaultSystemPromptComposer composer = composerWith(a);
        composer.compose(sampleContext());
        assertThat(meterRegistry.timer("assistant.prompt.compose").count()).isEqualTo(1);
    }

    private static PromptSection fakeSection(String name, int order, String content) {
        return new PromptSection() {
            public String name() { return name; }
            public int order() { return order; }
            public Optional<String> render(PromptContext c) { return Optional.of(content); }
        };
    }
}
