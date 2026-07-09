package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PortfolioSnapshotDto;
import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.Property;
import com.clenzy.model.SupervisionActivity;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.PropertyPerformanceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupervisionPortfolioServiceTest {

    private static final Long ORG = 1L;

    @Mock private PropertyRepository propertyRepository;
    @Mock private SupervisionSuggestionRepository suggestionRepository;
    @Mock private SupervisionModuleSettingsRepository moduleSettingsRepository;
    @Mock private SupervisionActivityService activityService;
    @Mock private PropertyPerformanceService performanceService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-07T10:00:00Z"), ZoneOffset.UTC);
    private SupervisionPortfolioService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionPortfolioService(
                propertyRepository, suggestionRepository, moduleSettingsRepository, activityService,
                performanceService, clock);
    }

    private PropertyPerformanceDto perf(Long id, double occupancyRate, String revenue, double netMargin) {
        return new PropertyPerformanceDto(id, "Logement " + id, 0, java.math.BigDecimal.ZERO,
                occupancyRate, new java.math.BigDecimal(revenue), netMargin, 90);
    }

    private Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setOrganizationId(ORG);
        return p;
    }

    private SupervisionSuggestion suggestion(Long id, Long propertyId, String module, String title) {
        SupervisionSuggestion s = new SupervisionSuggestion(ORG, propertyId, module, null, title, "motif",
                clock.instant());
        s.setId(id);
        return s;
    }

    @Test
    void aggregatesPendingAndFeedByProperty() {
        when(propertyRepository.findByOrganizationId(ORG))
                .thenReturn(List.of(property(10L, "Duplex Marais"), property(20L, "Studio Montmartre")));
        when(suggestionRepository.findByOrganizationIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                eq(ORG), eq("PENDING"), any()))
                .thenReturn(List.of(
                        suggestion(100L, 10L, "rev", "Baisser le tarif"),
                        suggestion(101L, 20L, "ops", "Menage manquant")));
        when(activityService.recentOrgFeed(eq(ORG), anyInt(), anyInt()))
                .thenReturn(List.of(new SupervisionActivity(ORG, 10L, "rev",
                        SupervisionActivity.KIND_ACT, "pricing_pushed", "Prix poussés")));
        when(activityService.orgAutoActions(ORG)).thenReturn(3L);

        PortfolioSnapshotDto snap = service.getSnapshot(ORG);

        assertThat(snap.scope()).isEqualTo("portfolio");
        assertThat(snap.propertyCount()).isEqualTo(2);
        assertThat(snap.pending()).hasSize(2);
        assertThat(snap.pending().get(0).propertyName()).isIn("Duplex Marais", "Studio Montmartre");
        assertThat(snap.feed()).hasSize(1);
        assertThat(snap.feed().get(0).propertyName()).isEqualTo("Duplex Marais");
        assertThat(snap.dayMetrics().awaiting()).isEqualTo(2);
        assertThat(snap.dayMetrics().autoActions()).isEqualTo(3);

        PortfolioSnapshotDto.AgentRollup rev = snap.agents().stream()
                .filter(a -> a.id().equals("rev")).findFirst().orElseThrow();
        assertThat(rev.status()).isEqualTo("wait");
        assertThat(rev.propertyCount()).isEqualTo(1);
        assertThat(rev.items()).hasSize(1);
        PortfolioSnapshotDto.AgentRollup com = snap.agents().stream()
                .filter(a -> a.id().equals("com")).findFirst().orElseThrow();
        assertThat(com.status()).isEqualTo("veille");
    }

    @Test
    void emptyOrg_returnsFiveIdleAgents() {
        when(propertyRepository.findByOrganizationId(ORG)).thenReturn(List.of());
        when(suggestionRepository.findByOrganizationIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                eq(ORG), eq("PENDING"), any())).thenReturn(List.of());
        when(activityService.recentOrgFeed(eq(ORG), anyInt(), anyInt())).thenReturn(List.of());
        when(activityService.orgAutoActions(ORG)).thenReturn(0L);

        PortfolioSnapshotDto snap = service.getSnapshot(ORG);

        assertThat(snap.propertyCount()).isZero();
        assertThat(snap.pending()).isEmpty();
        assertThat(snap.agents()).hasSize(5);
        assertThat(snap.agents()).allMatch(a -> a.status().equals("veille"));
    }

    @Test
    void computesOrgAlerts_whenOccupancyCriticalAndVacancyHigh() {
        when(propertyRepository.findByOrganizationId(ORG))
                .thenReturn(List.of(property(10L, "A"), property(20L, "B")));
        when(suggestionRepository.findByOrganizationIdAndStatusAndExpiresAtAfterOrderByCreatedAtDesc(
                eq(ORG), eq("PENDING"), any())).thenReturn(List.of());
        when(activityService.recentOrgFeed(eq(ORG), anyInt(), anyInt())).thenReturn(List.of());
        when(activityService.orgAutoActions(ORG)).thenReturn(0L);
        // Occupation moyenne 22,5 % (< 50 → critique) + ~140 nuits vacantes cumulées (> 20).
        when(performanceService.computeSummaries(ORG, 90)).thenReturn(List.of(
                perf(10L, 20.0, "5000", 70.0), perf(20L, 25.0, "4000", 65.0)));

        PortfolioSnapshotDto snap = service.getSnapshot(ORG);

        assertThat(snap.orgAlerts()).isNotEmpty();
        assertThat(snap.orgAlerts())
                .anyMatch(a -> a.severity().equals("critical") && a.title().contains("occupation"));
        assertThat(snap.orgAlerts()).anyMatch(a -> a.title().contains("Nuits vacantes"));
    }
}
