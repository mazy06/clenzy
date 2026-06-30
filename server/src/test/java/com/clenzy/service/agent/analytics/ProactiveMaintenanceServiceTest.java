package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
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
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProactiveMaintenanceService — maintenance prédictive")
class ProactiveMaintenanceServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private TenantContext tenantContext;

    private ProactiveMaintenanceService service;

    @BeforeEach
    void setUp() {
        service = new ProactiveMaintenanceService(reservationRepository, interventionRepository,
                tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Jamais entretenu + forte usure → risque HIGH")
    void neverMaintained_highUsage_HIGH() {
        Property p = property(5L, "Villa A");
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of());
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 5, 31)))); // 150 nuits

        ProactiveMaintenanceService.MaintenanceForecastResult r = service.predict();

        assertThat(r.atRisk()).hasSize(1);
        assertThat(r.atRisk().get(0).riskLevel()).isEqualTo("HIGH");
        assertThat(r.atRisk().get(0).guestNightsSinceLastMaintenance()).isEqualTo(150);
        assertThat(r.atRisk().get(0).lastMaintenanceDate()).isNull();
    }

    @Test
    @DisplayName("Dernier entretien très ancien (> 1 an) → risque HIGH")
    void oldMaintenance_HIGH() {
        Property p = property(5L, "Villa A");
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(maintenance(p, LocalDateTime.of(2025, 1, 15, 9, 0))));
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5))));

        ProactiveMaintenanceService.MaintenanceForecastResult r = service.predict();

        assertThat(r.atRisk()).hasSize(1);
        assertThat(r.atRisk().get(0).riskLevel()).isEqualTo("HIGH");
        assertThat(r.atRisk().get(0).daysSinceLastMaintenance()).isGreaterThan(365);
    }

    @Test
    @DisplayName("Séjour à cheval sur l'entretien → seules les nuits postérieures comptent")
    void straddlingStay_countsOnlyPostMaintenanceNights() {
        Property p = property(5L, "Villa A");
        // Entretien ancien (>1 an → HIGH) pour que le logement apparaisse dans atRisk.
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(maintenance(p, LocalDateTime.of(2025, 6, 1, 9, 0))));
        // Séjour 2025-05-20 → 2025-06-10 : à cheval sur l'entretien (2025-06-01).
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, LocalDate.of(2025, 5, 20), LocalDate.of(2025, 6, 10))));

        ProactiveMaintenanceService.MaintenanceForecastResult r = service.predict();

        assertThat(r.atRisk()).hasSize(1);
        // 2025-06-01 → 2025-06-10 = 9 nuits (et non 21 = durée totale du séjour).
        assertThat(r.atRisk().get(0).guestNightsSinceLastMaintenance()).isEqualTo(9);
    }

    @Test
    @DisplayName("Entretien récent + faible usage → pas de risque")
    void recentMaintenance_lowUsage_none() {
        Property p = property(5L, "Villa A");
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(maintenance(p, LocalDateTime.of(2026, 6, 15, 9, 0))));
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, LocalDate.of(2026, 6, 20), LocalDate.of(2026, 6, 30)))); // 10 nuits

        ProactiveMaintenanceService.MaintenanceForecastResult r = service.predict();

        assertThat(r.atRisk()).isEmpty();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }

    private static Intervention maintenance(Property p, LocalDateTime completedAt) {
        Intervention i = new Intervention();
        i.setProperty(p);
        i.setType("MAINTENANCE");
        i.setStatus(InterventionStatus.COMPLETED);
        i.setActualCost(BigDecimal.TEN);
        i.setCompletedAt(completedAt);
        return i;
    }

    private static Reservation res(Property p, LocalDate checkIn, LocalDate checkOut) {
        Reservation r = new Reservation();
        r.setProperty(p);
        r.setStatus("confirmed");
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        return r;
    }
}
