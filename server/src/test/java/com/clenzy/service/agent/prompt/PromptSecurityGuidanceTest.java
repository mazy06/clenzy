package com.clenzy.service.agent.prompt;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifie le texte canonique de la garde anti-injection (source unique partagee
 * par le mono-agent v2, le multi-agent et le fallback v1).
 */
class PromptSecurityGuidanceTest {

    @Test
    void block_wraps_inner_with_tag() {
        String block = PromptSecurityGuidance.block();
        assertThat(block)
                .startsWith("<" + PromptSecurityGuidance.TAG + ">")
                .endsWith("</" + PromptSecurityGuidance.TAG + ">")
                .contains(PromptSecurityGuidance.INNER);
    }

    @Test
    void inner_covers_the_injection_threat_model() {
        String inner = PromptSecurityGuidance.INNER;
        assertThat(inner)
                .contains("prompt injection")
                .contains("DONNEE")                 // donnee, pas instructions
                .contains("N'OBEIS JAMAIS")
                .contains("kb_context")              // source RAG nommee
                .contains("memory")                  // source memoire nommee
                .contains("resultats d'outils")      // resultats de tools nommes
                .contains("confirmation user")       // defense write-tool reaffirmee
                .contains("Ne revele jamais");       // pas de fuite prompt/secret
    }

    @Test
    void tag_is_stable_snake_case() {
        assertThat(PromptSecurityGuidance.TAG).isEqualTo("security_guard");
    }
}
