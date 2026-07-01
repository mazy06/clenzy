package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.InterventionRepository;
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
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OpsAnalyticsService — coûts, SLA, retards des opérations")
class OpsAnalyticsServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private InterventionRepository interventionRepository;
    @Mock private TenantContext tenantContext;

    private OpsAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new OpsAnalyticsService(interventionRepository, tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Coûts par type/logement, complétion, SLA, retard, durée")
    void computesAnalytics() {
        Property p = property(5L, "Villa A");
        Intervention cleaning = intv(p, "CLEANING", InterventionStatus.COMPLETED, "80", null,
                LocalDateTime.of(2026, 6, 20, 9, 0), LocalDateTime.of(2026, 6, 20, 11, 0), 120);
        Intervention maintenance = intv(p, "MAINTENANCE", InterventionStatus.PENDING, null, "200",
                LocalDateTime.of(2026, 6, 25, 9, 0), null, null); // passé + actif → en retard
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(cleaning, maintenance));

        OpsAnalyticsService.OpsAnalyticsResult r = service.analyze(3);

        assertThat(r.totalInterventions()).isEqualTo(2);
        assertThat(r.totalCost()).isEqualByComparingTo("280.00");
        assertThat(r.costByType().get("CLEANING")).isEqualByComparingTo("80.00");
        assertThat(r.costByType().get("MAINTENANCE")).isEqualByComparingTo("200.00");
        assertThat(r.completionRate()).isEqualTo(0.5);
        assertThat(r.slaOnTimeRate()).isEqualTo(1.0);
        assertThat(r.overdueCount()).isEqualTo(1);
        assertThat(r.avgDurationMinutes()).isEqualTo(120);
        assertThat(r.topCostProperties().get(0).propertyName()).isEqualTo("Villa A");
        assertThat(r.recommendation()).contains("retard");
    }

    @Test
    @DisplayName("Aucune intervention → vide")
    void empty() {
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of());

        OpsAnalyticsService.OpsAnalyticsResult r = service.analyze(3);

        assertThat(r.totalInterventions()).isZero();
        assertThat(r.totalCost()).isEqualByComparingTo("0.00");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }

    private static Intervention intv(Property p, String type, InterventionStatus status,
                                     String actualCost, String estimatedCost,
                                     LocalDateTime scheduled, LocalDateTime completed, Integer durationMin) {
        Intervention i = new Intervention();
        i.setProperty(p);
        i.setType(type);
        i.setStatus(status);
        if (actualCost != null) {
            i.setActualCost(new BigDecimal(actualCost));
        }
        if (estimatedCost != null) {
            i.setEstimatedCost(new BigDecimal(estimatedCost));
        }
        i.setScheduledDate(scheduled);
        if (completed != null) {
            i.setCompletedAt(completed);
        }
        if (durationMin != null) {
            i.setActualDurationMinutes(durationMin);
        }
        return i;
    }
}
