package com.clenzy.config.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Vérifie la facturation des tokens cachés (prompt caching OpenAI, lever #4). */
class ChatEventDoneTest {

    @Test
    void noCache_billedEqualsPrompt() {
        ChatEvent.Done done = new ChatEvent.Done(1000, 200, "gpt-5-mini", "stop", "hi");

        assertThat(done.cachedPromptTokens()).isZero();
        assertThat(done.billedPromptTokens()).isEqualTo(1000);
    }

    @Test
    void cachedTokens_billedAtHalf() {
        // 800 des 1000 tokens d'entrée servis depuis le cache → facturés à 50% :
        // billed = 1000 - round(800 * 0.5) = 1000 - 400 = 600.
        ChatEvent.Done done = new ChatEvent.Done(1000, 200, "gpt-5-mini", "stop", "hi", 800);

        assertThat(done.billedPromptTokens()).isEqualTo(600);
    }

    @Test
    void billedNeverNegative() {
        ChatEvent.Done done = new ChatEvent.Done(100, 10, "gpt-5-mini", "stop", "hi", 100);

        // 100 - round(100*0.5) = 50, jamais négatif.
        assertThat(done.billedPromptTokens()).isEqualTo(50);
    }
}
