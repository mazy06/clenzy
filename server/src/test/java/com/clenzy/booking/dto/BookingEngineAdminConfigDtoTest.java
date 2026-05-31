package com.clenzy.booking.dto;

import com.clenzy.booking.model.BookingEngineConfig;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class BookingEngineAdminConfigDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        LocalDateTime analysisAt = LocalDateTime.of(2026, 1, 1, 10, 0);
        BookingEngineAdminConfigDto dto = new BookingEngineAdminConfigDto(
                1L, 10L, "Default", true, "api-key-123",
                "#FF0000", "#00FF00", "https://logo.png", "Inter",
                "fr", "EUR", 1, 365,
                "Cancellation policy text", "https://terms", "https://privacy",
                "https://example.com",
                true, false, true, false,
                "body { color: red }", "console.log('hi')", "{\"layout\":\"grid\"}",
                "{\"primary\":\"#FF\"}", "https://source", analysisAt,
                "bottom", "target", "after",
                "Acme Corp"
        );

        assertEquals(1L, dto.id());
        assertEquals(10L, dto.organizationId());
        assertEquals("Default", dto.name());
        assertTrue(dto.enabled());
        assertEquals("api-key-123", dto.apiKey());
        assertEquals("#FF0000", dto.primaryColor());
        assertEquals("#00FF00", dto.accentColor());
        assertEquals("https://logo.png", dto.logoUrl());
        assertEquals("Inter", dto.fontFamily());
        assertEquals("fr", dto.defaultLanguage());
        assertEquals("EUR", dto.defaultCurrency());
        assertEquals(1, dto.minAdvanceDays());
        assertEquals(365, dto.maxAdvanceDays());
        assertEquals("Cancellation policy text", dto.cancellationPolicy());
        assertEquals("https://terms", dto.termsUrl());
        assertEquals("https://privacy", dto.privacyUrl());
        assertEquals("https://example.com", dto.allowedOrigins());
        assertTrue(dto.collectPaymentOnBooking());
        assertFalse(dto.autoConfirm());
        assertTrue(dto.showCleaningFee());
        assertFalse(dto.showTouristTax());
        assertEquals("body { color: red }", dto.customCss());
        assertEquals("console.log('hi')", dto.customJs());
        assertEquals("{\"layout\":\"grid\"}", dto.componentConfig());
        assertEquals("{\"primary\":\"#FF\"}", dto.designTokens());
        assertEquals("https://source", dto.sourceWebsiteUrl());
        assertEquals(analysisAt, dto.aiAnalysisAt());
        assertEquals("bottom", dto.widgetPosition());
        assertEquals("target", dto.inlineTargetId());
        assertEquals("after", dto.inlinePlacement());
        assertEquals("Acme Corp", dto.organizationName());
    }

    @Test
    void from_singleArg_mapsAllFieldsAndOrganizationNameIsNull() {
        BookingEngineConfig config = buildConfig();

        BookingEngineAdminConfigDto dto = BookingEngineAdminConfigDto.from(config);

        assertEquals(42L, dto.id());
        assertEquals(7L, dto.organizationId());
        assertEquals("Booking Default", dto.name());
        assertTrue(dto.enabled());
        assertEquals("the-api-key", dto.apiKey());
        assertEquals("#2563eb", dto.primaryColor());
        assertEquals("#FFAA00", dto.accentColor());
        assertEquals("https://logo.svg", dto.logoUrl());
        assertEquals("Roboto", dto.fontFamily());
        assertEquals("en", dto.defaultLanguage());
        assertEquals("USD", dto.defaultCurrency());
        assertEquals(2, dto.minAdvanceDays());
        assertEquals(180, dto.maxAdvanceDays());
        assertEquals("FLEXIBLE", dto.cancellationPolicy());
        assertEquals("https://terms.example", dto.termsUrl());
        assertEquals("https://privacy.example", dto.privacyUrl());
        assertEquals("https://allowed.example", dto.allowedOrigins());
        assertFalse(dto.collectPaymentOnBooking());
        assertTrue(dto.autoConfirm());
        assertFalse(dto.showCleaningFee());
        assertTrue(dto.showTouristTax());
        assertEquals("css", dto.customCss());
        assertEquals("js", dto.customJs());
        assertEquals("cfg", dto.componentConfig());
        assertEquals("tokens", dto.designTokens());
        assertEquals("https://source.example", dto.sourceWebsiteUrl());
        assertEquals("inline", dto.widgetPosition());
        assertEquals("widget-target", dto.inlineTargetId());
        assertEquals("before", dto.inlinePlacement());
        assertNull(dto.organizationName());
    }

    @Test
    void from_withOrganizationName_setsField() {
        BookingEngineConfig config = buildConfig();

        BookingEngineAdminConfigDto dto = BookingEngineAdminConfigDto.from(config, "Acme Corp");

        assertEquals("Acme Corp", dto.organizationName());
    }

    @Test
    void applyTo_updatesAllSettableFieldsOnEntity() {
        BookingEngineAdminConfigDto dto = new BookingEngineAdminConfigDto(
                null, null, null, false, null,
                "#111111", "#222222", "logo", "Arial",
                "es", "MAD", 5, 100,
                "STRICT", "terms2", "privacy2",
                "origin2",
                true, true, false, true,
                "css-new", "js-new", "cfg-new",
                "tokens-new", "https://new.source", null,
                "inline", "elem", "after",
                null
        );
        BookingEngineConfig target = new BookingEngineConfig();

        dto.applyTo(target);

        assertEquals("#111111", target.getPrimaryColor());
        assertEquals("#222222", target.getAccentColor());
        assertEquals("logo", target.getLogoUrl());
        assertEquals("Arial", target.getFontFamily());
        assertEquals("es", target.getDefaultLanguage());
        assertEquals("MAD", target.getDefaultCurrency());
        assertEquals(5, target.getMinAdvanceDays());
        assertEquals(100, target.getMaxAdvanceDays());
        assertEquals("STRICT", target.getCancellationPolicy());
        assertEquals("terms2", target.getTermsUrl());
        assertEquals("privacy2", target.getPrivacyUrl());
        assertEquals("origin2", target.getAllowedOrigins());
        assertTrue(target.isCollectPaymentOnBooking());
        assertTrue(target.isAutoConfirm());
        assertFalse(target.isShowCleaningFee());
        assertTrue(target.isShowTouristTax());
        assertEquals("css-new", target.getCustomCss());
        assertEquals("js-new", target.getCustomJs());
        assertEquals("cfg-new", target.getComponentConfig());
        assertEquals("tokens-new", target.getDesignTokens());
        assertEquals("https://new.source", target.getSourceWebsiteUrl());
        assertEquals("inline", target.getWidgetPosition());
        assertEquals("elem", target.getInlineTargetId());
        assertEquals("after", target.getInlinePlacement());
    }

    @Test
    void applyTo_doesNotChangeIdOrgIdEnabledNameOrApiKey() {
        BookingEngineConfig target = new BookingEngineConfig();
        target.setId(99L);
        target.setOrganizationId(123L);
        target.setName("Untouched");
        target.setEnabled(true);
        target.setApiKey("preserved-key");

        BookingEngineAdminConfigDto dto = new BookingEngineAdminConfigDto(
                1L, 2L, "Other", false, "other-key",
                null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                false, false, false, false,
                null, null, null,
                null, null, null,
                null, null, null,
                null
        );

        dto.applyTo(target);

        // These fields must NOT be overwritten by applyTo (handled by service)
        assertEquals(99L, target.getId());
        assertEquals(123L, target.getOrganizationId());
        assertEquals("Untouched", target.getName());
        assertTrue(target.isEnabled());
        assertEquals("preserved-key", target.getApiKey());
    }

    @Test
    void equalsAndHashCode_sameValues_areEqual() {
        BookingEngineAdminConfigDto a = new BookingEngineAdminConfigDto(
                1L, 1L, "n", true, "k",
                null, null, null, null, null, null, null, null,
                null, null, null, null,
                false, false, false, false,
                null, null, null, null, null, null,
                null, null, null, null
        );
        BookingEngineAdminConfigDto b = new BookingEngineAdminConfigDto(
                1L, 1L, "n", true, "k",
                null, null, null, null, null, null, null, null,
                null, null, null, null,
                false, false, false, false,
                null, null, null, null, null, null,
                null, null, null, null
        );
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    // --- Helpers ---

    private BookingEngineConfig buildConfig() {
        BookingEngineConfig config = new BookingEngineConfig();
        config.setId(42L);
        config.setOrganizationId(7L);
        config.setName("Booking Default");
        config.setEnabled(true);
        config.setApiKey("the-api-key");
        config.setPrimaryColor("#2563eb");
        config.setAccentColor("#FFAA00");
        config.setLogoUrl("https://logo.svg");
        config.setFontFamily("Roboto");
        config.setDefaultLanguage("en");
        config.setDefaultCurrency("USD");
        config.setMinAdvanceDays(2);
        config.setMaxAdvanceDays(180);
        config.setCancellationPolicy("FLEXIBLE");
        config.setTermsUrl("https://terms.example");
        config.setPrivacyUrl("https://privacy.example");
        config.setAllowedOrigins("https://allowed.example");
        config.setCollectPaymentOnBooking(false);
        config.setAutoConfirm(true);
        config.setShowCleaningFee(false);
        config.setShowTouristTax(true);
        config.setCustomCss("css");
        config.setCustomJs("js");
        config.setComponentConfig("cfg");
        config.setDesignTokens("tokens");
        config.setSourceWebsiteUrl("https://source.example");
        config.setWidgetPosition("inline");
        config.setInlineTargetId("widget-target");
        config.setInlinePlacement("before");
        return config;
    }
}
