package com.clenzy.service.agent.prompt;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests du value object {@link ComposedSystemPrompt} — focalises sur la
 * reconstitution {@link ComposedSystemPrompt#full()} et les predicats de
 * presence, dont depend le routage 1-bloc / 2-blocs cote provider.
 */
class ComposedSystemPromptTest {

    @Test
    void of_buildsMonoBlock_withoutVolatileSuffix() {
        ComposedSystemPrompt prompt = ComposedSystemPrompt.of("PREFIXE");

        assertThat(prompt.cacheablePrefix()).isEqualTo("PREFIXE");
        assertThat(prompt.volatileSuffix()).isNull();
        assertThat(prompt.hasVolatileSuffix()).isFalse();
        assertThat(prompt.full()).isEqualTo("PREFIXE");
    }

    @Test
    void full_joinsPrefixAndSuffix_withParagraphSeparator() {
        ComposedSystemPrompt prompt = new ComposedSystemPrompt("PREFIXE", "SUFFIXE");

        assertThat(prompt.hasVolatileSuffix()).isTrue();
        assertThat(prompt.full()).isEqualTo("PREFIXE\n\nSUFFIXE");
    }

    @Test
    void full_blankSuffix_returnsPrefixOnly() {
        ComposedSystemPrompt prompt = new ComposedSystemPrompt("PREFIXE", "   \n ");

        assertThat(prompt.hasVolatileSuffix()).isFalse();
        assertThat(prompt.full()).isEqualTo("PREFIXE");
    }

    @Test
    void full_blankPrefixWithSuffix_returnsSuffixOnly_noLeadingSeparator() {
        ComposedSystemPrompt prompt = new ComposedSystemPrompt("  ", "SUFFIXE");

        assertThat(prompt.full()).isEqualTo("SUFFIXE");
    }

    @Test
    void full_bothBlank_returnsEmpty() {
        ComposedSystemPrompt prompt = new ComposedSystemPrompt(null, null);

        assertThat(prompt.full()).isEmpty();
        assertThat(prompt.hasContent()).isFalse();
    }

    @Test
    void hasContent_trueWhenOnlyVolatileSuffixPresent() {
        ComposedSystemPrompt prompt = new ComposedSystemPrompt(null, "SUFFIXE");

        assertThat(prompt.hasContent()).isTrue();
    }
}
