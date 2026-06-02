package com.clenzy.dto;

import com.clenzy.model.MarketingIntegration;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MarketingIntegrationDtoTest {

    @Test
    void from_withApiKey_masksKeyAndMarksConfigured() {
        MarketingIntegration m = new MarketingIntegration();
        m.setApiKey("xkeysib-abcdefDzSYVG");
        m.setWaitlistListId(6L);
        m.setSyncWaitlistEnabled(true);

        MarketingIntegrationDto dto = MarketingIntegrationDto.from(m);

        assertThat(dto.configured()).isTrue();
        // La cle n'est jamais renvoyee en clair — seulement masquee (4 derniers chars).
        assertThat(dto.apiKeyMasked()).isEqualTo("••••SYVG");
        assertThat(dto.apiKeyMasked()).doesNotContain("xkeysib");
        assertThat(dto.provider()).isEqualTo("BREVO");
        assertThat(dto.waitlistListId()).isEqualTo(6L);
        assertThat(dto.syncWaitlistEnabled()).isTrue();
        assertThat(dto.status()).isEqualTo("UNCONFIGURED");
    }

    @Test
    void from_withoutApiKey_notConfigured_noMask() {
        MarketingIntegration m = new MarketingIntegration();

        MarketingIntegrationDto dto = MarketingIntegrationDto.from(m);

        assertThat(dto.configured()).isFalse();
        assertThat(dto.apiKeyMasked()).isNull();
    }
}
