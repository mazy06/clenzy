package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PriceLabsServiceTest {

    @Mock private RestTemplate restTemplate;
    @Mock private ObjectMapper objectMapper;

    private PriceLabsService service;

    @BeforeEach
    void setUp() {
        service = new PriceLabsService(restTemplate, objectMapper);
    }

    private ExternalPricingConfig createConfig(Map<String, String> mappings) {
        ExternalPricingConfig config = new ExternalPricingConfig();
        config.setId(1L);
        config.setOrganizationId(1L);
        config.setProvider(PricingProvider.PRICELABS);
        config.setApiKey("test-api-key");
        config.setApiUrl("https://api.pricelabs.co");
        config.setPropertyMappings(mappings);
        config.setEnabled(true);
        return config;
    }

    @SuppressWarnings("unchecked")
    private void mockRestTemplateExchange() {
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok("[]"));
    }

    @Test
    void fetchRecommendations_withMapping_returnsEmptyMvp() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-listing-123"));
        mockRestTemplateExchange();

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 100L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void fetchRecommendations_withoutMapping_returnsEmpty() {
        ExternalPricingConfig config = createConfig(Map.of("200", "pl-listing-456"));

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 999L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertTrue(result.isEmpty());
    }

    @Test
    void fetchRecommendations_nullMappings_returnsEmpty() {
        ExternalPricingConfig config = createConfig(null);
        config.setPropertyMappings(null);

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 100L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertTrue(result.isEmpty());
    }

    @Test
    void pushListingData_withMapping_doesNotThrow() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-listing-123"));
        mockRestTemplateExchange();

        assertDoesNotThrow(() -> service.pushListingData(config, 100L));
    }

    @Test
    void pushListingData_withoutMapping_doesNotThrow() {
        ExternalPricingConfig config = createConfig(Map.of());

        assertDoesNotThrow(() -> service.pushListingData(config, 100L));
    }

    @Test
    void fetchRecommendations_emptyMappings_returnsEmpty() {
        ExternalPricingConfig config = createConfig(Map.of());

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 100L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertTrue(result.isEmpty());
    }
}
