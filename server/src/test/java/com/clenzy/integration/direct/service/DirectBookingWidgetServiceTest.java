package com.clenzy.integration.direct.service;

import com.clenzy.integration.direct.config.DirectBookingConfig;
import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DirectBookingWidgetServiceTest {

    @Mock private DirectBookingConfig config;
    @Mock private DirectBookingConfigRepository configRepository;

    private DirectBookingWidgetService service;

    @BeforeEach
    void setUp() {
        service = new DirectBookingWidgetService(config, configRepository);
        lenient().when(config.getWidgetBaseUrl()).thenReturn("https://widget.example.com");
        lenient().when(config.getDefaultCurrency()).thenReturn("EUR");
        lenient().when(config.isStripeEnabled()).thenReturn(true);
        lenient().when(config.getMinAdvanceDays()).thenReturn(1);
        lenient().when(config.getMaxAdvanceDays()).thenReturn(365);
        lenient().when(config.isAutoConfirm()).thenReturn(true);
        lenient().when(config.isRequirePayment()).thenReturn(true);
    }

    private static DirectBookingConfiguration dbConfig(boolean enabled, String theme) {
        DirectBookingConfiguration cfg = new DirectBookingConfiguration();
        cfg.setEnabled(enabled);
        cfg.setWidgetThemeColor(theme);
        cfg.setWidgetLogo("logo.png");
        cfg.setCustomCss(".x{color:red}");
        cfg.setTermsAndConditionsUrl("https://t.example.com");
        cfg.setCancellationPolicyText("flex");
        cfg.setAutoConfirm(false);
        cfg.setRequirePayment(false);
        cfg.setAllowedCurrencies("EUR,USD");
        return cfg;
    }

    @Test
    void getWidgetConfig_existingConfig_returnsConfiguredValues() {
        when(configRepository.findByPropertyIdAndOrganizationId(1L, 9L))
                .thenReturn(Optional.of(dbConfig(true, "#FF0000")));

        Map<String, Object> result = service.getWidgetConfig(1L, 9L);

        assertThat(result.get("enabled")).isEqualTo(true);
        assertThat(result.get("themeColor")).isEqualTo("#FF0000");
        assertThat(result.get("logo")).isEqualTo("logo.png");
        assertThat(result.get("customCss")).isEqualTo(".x{color:red}");
        assertThat(result.get("termsUrl")).isEqualTo("https://t.example.com");
        assertThat(result.get("autoConfirm")).isEqualTo(false);
        assertThat(result.get("requirePayment")).isEqualTo(false);
        assertThat(result.get("propertyId")).isEqualTo(1L);
        assertThat(result.get("widgetBaseUrl")).isEqualTo("https://widget.example.com");
        assertThat(result.get("currency")).isEqualTo("EUR");
    }

    @Test
    void getWidgetConfig_noConfig_fallsBackToDefaults() {
        when(configRepository.findByPropertyIdAndOrganizationId(2L, 9L))
                .thenReturn(Optional.empty());

        Map<String, Object> result = service.getWidgetConfig(2L, 9L);

        assertThat(result.get("enabled")).isEqualTo(false);
        assertThat(result.get("autoConfirm")).isEqualTo(true);
        assertThat(result.get("requirePayment")).isEqualTo(true);
        assertThat(result.get("propertyId")).isEqualTo(2L);
    }

    @Test
    void getEmbedCode_enabledConfig_returnsValidEmbedHtml() {
        when(configRepository.findByPropertyIdAndOrganizationId(5L, 9L))
                .thenReturn(Optional.of(dbConfig(true, "#0F0F0F")));

        String html = service.getEmbedCode(5L, 9L);

        assertThat(html).contains("data-property-id=\"5\"");
        assertThat(html).contains("#0F0F0F");
        assertThat(html).contains("https://widget.example.com/widget.js");
        assertThat(html).contains("clenzy-booking-widget");
    }

    @Test
    void getEmbedCode_noConfig_returnsComment() {
        when(configRepository.findByPropertyIdAndOrganizationId(7L, 9L))
                .thenReturn(Optional.empty());

        String html = service.getEmbedCode(7L, 9L);

        assertThat(html).contains("non active");
    }

    @Test
    void getEmbedCode_disabledConfig_returnsComment() {
        when(configRepository.findByPropertyIdAndOrganizationId(8L, 9L))
                .thenReturn(Optional.of(dbConfig(false, "#000")));

        String html = service.getEmbedCode(8L, 9L);

        assertThat(html).contains("non active");
    }

    @Test
    void getEmbedCode_nullThemeColor_fallsBackToDefaultBlue() {
        DirectBookingConfiguration cfg = dbConfig(true, null);
        when(configRepository.findByPropertyIdAndOrganizationId(9L, 9L))
                .thenReturn(Optional.of(cfg));

        String html = service.getEmbedCode(9L, 9L);

        assertThat(html).contains("#2563EB");
    }
}
