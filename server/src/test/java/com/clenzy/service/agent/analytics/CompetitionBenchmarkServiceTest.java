package com.clenzy.service.agent.analytics;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.clenzy.model.Property;
import com.clenzy.repository.ExternalPricingConfigRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.ExternalPricingService;
import com.clenzy.service.ExternalPricingSourceRegistry;
import com.clenzy.service.PriceEngine;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CompetitionBenchmarkService — positionnement marché")
class CompetitionBenchmarkServiceTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 5L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private ExternalPricingConfigRepository configRepository;
    @Mock private ExternalPricingSourceRegistry sourceRegistry;
    @Mock private PriceEngine priceEngine;
    @Mock private PropertyRepository propertyRepository;
    @Mock private TenantContext tenantContext;
    @Mock private ExternalPricingService source;

    private CompetitionBenchmarkService service;

    @BeforeEach
    void setUp() {
        service = new CompetitionBenchmarkService(configRepository, sourceRegistry, priceEngine,
                propertyRepository, tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
        // Propriété possédée par l'org → guard ownership OK pour les tests existants.
        Property owned = new Property();
        owned.setId(PROP);
        owned.setOrganizationId(ORG);
        lenient().when(propertyRepository.findById(PROP)).thenReturn(Optional.of(owned));
    }

    @Test
    @DisplayName("Logement d'une autre org → message dédié (guard ownership, pas de fuite de prix)")
    void foreignProperty_returnsEmpty() {
        Property foreign = new Property();
        foreign.setId(PROP);
        foreign.setOrganizationId(2L);
        when(propertyRepository.findById(PROP)).thenReturn(Optional.of(foreign));

        CompetitionBenchmarkService.BenchmarkResult r = service.benchmark(PROP, 30);

        assertThat(r.sources()).isZero();
        assertThat(r.headline()).contains("introuvable");
    }

    @Test
    @DisplayName("Aucune source activée → message dédié")
    void noEnabledSource() {
        when(configRepository.findByOrganizationId(ORG)).thenReturn(List.of(config(false)));

        CompetitionBenchmarkService.BenchmarkResult r = service.benchmark(PROP, 30);

        assertThat(r.sources()).isZero();
        assertThat(r.headline()).contains("Aucune source");
    }

    @Test
    @DisplayName("Prix sous le marché → UNDERPRICED")
    void underpriced() {
        when(configRepository.findByOrganizationId(ORG)).thenReturn(List.of(config(true)));
        when(priceEngine.resolvePriceRange(eq(PROP), any(), any(), eq(ORG)))
                .thenReturn(Map.of(LocalDate.of(2026, 7, 2), new BigDecimal("100")));
        when(sourceRegistry.resolve(PricingProvider.PRICELABS)).thenReturn(source);
        when(source.fetchRecommendations(any(), eq(PROP), any(), any())).thenReturn(List.of(
                new ExternalPriceRecommendation(PROP, LocalDate.of(2026, 7, 2),
                        new BigDecimal("120"), "EUR", 0.9, "PRICELABS")));

        CompetitionBenchmarkService.BenchmarkResult r = service.benchmark(PROP, 30);

        assertThat(r.sources()).isEqualTo(1);
        assertThat(r.bySource().get(0).positioning()).isEqualTo("UNDERPRICED");
        assertThat(r.bySource().get(0).deltaPct()).isNegative();
        assertThat(r.headline()).contains("marge de hausse");
    }

    @Test
    @DisplayName("Source en échec → UNAVAILABLE sans casser le benchmark")
    void sourceFailure_marksUnavailable() {
        when(configRepository.findByOrganizationId(ORG)).thenReturn(List.of(config(true)));
        when(priceEngine.resolvePriceRange(eq(PROP), any(), any(), eq(ORG)))
                .thenReturn(Map.of(LocalDate.of(2026, 7, 2), new BigDecimal("100")));
        when(sourceRegistry.resolve(PricingProvider.PRICELABS)).thenReturn(source);
        when(source.fetchRecommendations(any(), eq(PROP), any(), any()))
                .thenThrow(new RuntimeException("timeout"));

        CompetitionBenchmarkService.BenchmarkResult r = service.benchmark(PROP, 30);

        assertThat(r.sources()).isEqualTo(1);
        assertThat(r.bySource().get(0).positioning()).isEqualTo("UNAVAILABLE");
    }

    private static ExternalPricingConfig config(boolean enabled) {
        ExternalPricingConfig c = new ExternalPricingConfig();
        c.setProvider(PricingProvider.PRICELABS);
        c.setEnabled(enabled);
        return c;
    }
}
