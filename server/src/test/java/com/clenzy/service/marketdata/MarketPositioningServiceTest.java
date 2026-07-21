package com.clenzy.service.marketdata;

import com.clenzy.dto.MarketPositioningDto;
import com.clenzy.model.MarketDataSnapshot;
import com.clenzy.model.Property;
import com.clenzy.repository.MarketDataSnapshotRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.PropertyPerformanceService;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketPositioningServiceTest {

    private static final Long ORG = 10L;
    private static final Long PROPERTY = 42L;
    private static final Instant NOW = Instant.parse("2026-07-20T12:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 20);

    @Mock private PropertyRepository propertyRepository;
    @Mock private MarketDataSnapshotRepository snapshotRepository;
    @Mock private PriceEngine priceEngine;
    @Mock private PropertyPerformanceService performanceService;
    @Mock private OrganizationAccessGuard organizationAccessGuard;

    private MarketPositioningService service;

    @BeforeEach
    void setUp() {
        service = new MarketPositioningService(propertyRepository, snapshotRepository, priceEngine,
                performanceService, organizationAccessGuard, Clock.fixed(NOW, ZoneId.of("UTC")));
        Property property = new Property();
        property.setId(PROPERTY);
        property.setOrganizationId(ORG);
        property.setCity("Marrakech");
        property.setDefaultCurrency("MAD");
        lenient().when(propertyRepository.findByIdWithOwnerNoOrgFilter(PROPERTY))
                .thenReturn(Optional.of(property));
        lenient().when(performanceService.forwardOccupancyRate(PROPERTY, 30)).thenReturn(55.0);
    }

    private static MarketDataSnapshot benchmark(String source, String adr, String confidence) {
        return new MarketDataSnapshot(null, "Marrakech", "MA", source, TODAY, "2026-07",
                new BigDecimal(adr), new BigDecimal("60.00"), new BigDecimal("360.00"),
                "MAD", 40, new BigDecimal(confidence));
    }

    @Test
    void whenPropertyBelowMarket_thenUnderpriced() {
        // Prix publié moyen 500 vs marché 620 -> -19.4 % -> UNDERPRICED.
        when(priceEngine.resolvePriceRange(eq(PROPERTY), any(), any(), eq(ORG)))
                .thenReturn(Map.of(TODAY, new BigDecimal("500")));
        when(snapshotRepository.findLatestByArea("Marrakech"))
                .thenReturn(List.of(benchmark("FIRST_PARTY", "620", "0.45")));

        MarketPositioningDto dto = service.position(PROPERTY, ORG);

        assertThat(dto.positioning()).isEqualTo("UNDERPRICED");
        assertThat(dto.marketAdr()).isEqualByComparingTo("620");
        assertThat(dto.source()).isEqualTo("FIRST_PARTY");
        assertThat(dto.deltaPct()).isNegative();
        assertThat(dto.headline()).contains("Marrakech").contains("confiance 45 %");
    }

    @Test
    void whenMultipleSources_thenHighestConfidenceWins() {
        when(priceEngine.resolvePriceRange(eq(PROPERTY), any(), any(), eq(ORG)))
                .thenReturn(Map.of(TODAY, new BigDecimal("620")));
        when(snapshotRepository.findLatestByArea("Marrakech")).thenReturn(List.of(
                benchmark("FIRST_PARTY", "500", "0.40"),
                benchmark("AIRBTICS", "620", "0.80")));

        MarketPositioningDto dto = service.position(PROPERTY, ORG);

        // Airbtics (confiance 0.80) l'emporte -> aligné (620 vs 620).
        assertThat(dto.source()).isEqualTo("AIRBTICS");
        assertThat(dto.positioning()).isEqualTo("ALIGNED");
    }

    @Test
    void whenNoMarketData_thenNoMarketDataPositioning() {
        when(priceEngine.resolvePriceRange(eq(PROPERTY), any(), any(), eq(ORG)))
                .thenReturn(Map.of(TODAY, new BigDecimal("500")));
        when(snapshotRepository.findLatestByArea("Marrakech")).thenReturn(List.of());

        MarketPositioningDto dto = service.position(PROPERTY, ORG);

        assertThat(dto.positioning()).isEqualTo("NO_MARKET_DATA");
        assertThat(dto.marketAdr()).isNull();
        assertThat(dto.propertyAdr()).isEqualByComparingTo("500"); // le réalisé reste affiché
    }
}
