package com.clenzy.dto;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WhatsAppConfigDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        WhatsAppConfigDto dto = new WhatsAppConfigDto(
            1L, WhatsAppProviderType.META,
            "phone-123", "ba-456", true,
            "owa-uuid", false, true
        );

        assertEquals(1L, dto.id());
        assertEquals(WhatsAppProviderType.META, dto.provider());
        assertEquals("phone-123", dto.phoneNumberId());
        assertEquals("ba-456", dto.businessAccountId());
        assertTrue(dto.hasApiToken());
        assertEquals("owa-uuid", dto.openwaSessionId());
        assertFalse(dto.hasOpenwaApiKey());
        assertTrue(dto.enabled());
    }

    @Test
    void from_metaProvider_withTokenPresent_setsHasApiTokenTrue() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setId(10L);
        config.setProvider(WhatsAppProviderType.META);
        config.setApiToken("EAAxxxxxxxx");
        config.setPhoneNumberId("phone-99");
        config.setBusinessAccountId("ba-99");
        config.setEnabled(true);

        WhatsAppConfigDto dto = WhatsAppConfigDto.from(config);

        assertEquals(10L, dto.id());
        assertEquals(WhatsAppProviderType.META, dto.provider());
        assertEquals("phone-99", dto.phoneNumberId());
        assertEquals("ba-99", dto.businessAccountId());
        assertTrue(dto.hasApiToken());
        assertFalse(dto.hasOpenwaApiKey()); // openwaApiKey was null
        assertTrue(dto.enabled());
        // SECURITY: never leak raw token through the DTO surface
        // (the DTO has no accessor for apiToken — only the boolean)
    }

    @Test
    void from_metaProvider_blankToken_setsHasApiTokenFalse() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.META);
        config.setApiToken("   ");

        WhatsAppConfigDto dto = WhatsAppConfigDto.from(config);

        assertFalse(dto.hasApiToken());
    }

    @Test
    void from_metaProvider_nullToken_setsHasApiTokenFalse() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.META);

        WhatsAppConfigDto dto = WhatsAppConfigDto.from(config);

        assertFalse(dto.hasApiToken());
    }

    @Test
    void from_openwaProvider_withApiKeyPresent_setsHasOpenwaApiKeyTrue() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.OPENWA);
        config.setOpenwaSessionId("owa-session-1");
        config.setOpenwaApiKey("owa_abc123");

        WhatsAppConfigDto dto = WhatsAppConfigDto.from(config);

        assertEquals(WhatsAppProviderType.OPENWA, dto.provider());
        assertEquals("owa-session-1", dto.openwaSessionId());
        assertTrue(dto.hasOpenwaApiKey());
    }

    @Test
    void from_openwaProvider_blankApiKey_setsHasOpenwaApiKeyFalse() {
        WhatsAppConfig config = new WhatsAppConfig();
        config.setProvider(WhatsAppProviderType.OPENWA);
        config.setOpenwaApiKey("");

        WhatsAppConfigDto dto = WhatsAppConfigDto.from(config);

        assertFalse(dto.hasOpenwaApiKey());
    }

    @Test
    void from_nullProvider_fallsBackToMeta() {
        // The entity setter would coerce null to META; but if the entity has
        // a null provider set via reflection-style path, the DTO mapper itself
        // also defends with a null check. Validate the DTO fallback explicitly.
        WhatsAppConfig config = new WhatsAppConfig() {
            @Override
            public WhatsAppProviderType getProvider() { return null; }
        };

        WhatsAppConfigDto dto = WhatsAppConfigDto.from(config);

        assertEquals(WhatsAppProviderType.META, dto.provider());
    }

    @Test
    void record_equalityByValue() {
        WhatsAppConfigDto a = new WhatsAppConfigDto(
            1L, WhatsAppProviderType.META, "p", "b", false, null, false, false);
        WhatsAppConfigDto b = new WhatsAppConfigDto(
            1L, WhatsAppProviderType.META, "p", "b", false, null, false, false);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
