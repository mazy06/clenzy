package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.ChannelSyncHealthService;
import com.clenzy.service.PropertyService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OpsRiskService — détection proactive d'anomalies ops")
class OpsRiskServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate TODAY = LocalDate.of(2026, 7, 1);

    @Mock private InterventionRepository interventionRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ChannelSyncHealthService channelSyncHealthService;
    @Mock private PropertyService propertyService;
    @Mock private TenantContext tenantContext;

    private OpsRiskService service;

    @BeforeEach
    void setUp() {
        service = new OpsRiskService(interventionRepository, reservationRepository,
                channelSyncHealthService, propertyService, tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
        // Pas de risque sync canal dans ces tests : aucun logement enumeré.
        lenient().when(propertyService.search(any(), any(), any(), any(), any())).thenReturn(Page.empty());
        lenient().when(channelSyncHealthService.getHealthByPropertyIds(anyList())).thenReturn(Map.of());
    }

    @Test
    @DisplayName("Aucune donnée → aucun risque")
    void noData_returnsEmpty() {
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of());
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of());

        assertThat(service.detectRisks(3)).isEmpty();
    }

    @Test
    @DisplayName("Intervention prévue dans le passé et encore ouverte → OVERDUE_INTERVENTION")
    void overdueIntervention_flagged() {
        Intervention overdue = intervention(10L, 5L, "Villa A", "MAINTENANCE",
                InterventionStatus.PENDING, LocalDateTime.of(2026, 6, 28, 9, 0));
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of(overdue));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of());

        List<OpsRiskService.OperationalRisk> risks = service.detectRisks(3);

        assertThat(risks).hasSize(1);
        assertThat(risks.get(0).type()).isEqualTo("OVERDUE_INTERVENTION");
        assertThat(risks.get(0).propertyId()).isEqualTo(5L);
    }

    @Test
    @DisplayName("Arrivée à venir sans ménage prévu → MISSING_CLEANING (HIGH, en tête)")
    void arrivalWithoutCleaning_flaggedHigh() {
        Reservation res = reservation(20L, 5L, "Villa A", "Léa Marchand", TODAY.plusDays(1));
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of());
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of(res));

        List<OpsRiskService.OperationalRisk> risks = service.detectRisks(3);

        assertThat(risks).hasSize(1);
        assertThat(risks.get(0).type()).isEqualTo("MISSING_CLEANING");
        assertThat(risks.get(0).severity()).isEqualTo("HIGH");
        assertThat(risks.get(0).reservationId()).isEqualTo(20L);
    }

    @Test
    @DisplayName("Arrivée avec ménage prévu dans la fenêtre → aucun risque")
    void arrivalWithCleaning_noRisk() {
        LocalDate checkIn = TODAY.plusDays(1);
        Reservation res = reservation(20L, 5L, "Villa A", "Léa", checkIn);
        Intervention cleaning = intervention(11L, 5L, "Villa A", "CLEANING",
                InterventionStatus.PENDING, checkIn.atTime(8, 0)); // futur → pas overdue
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of(cleaning));
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG))).thenReturn(List.of(res));

        assertThat(service.detectRisks(3)).isEmpty();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static Intervention intervention(Long id, Long propertyId, String propertyName,
                                             String type, InterventionStatus status, LocalDateTime scheduled) {
        Intervention i = new Intervention();
        i.setId(id);
        i.setProperty(property(propertyId, propertyName));
        i.setType(type);
        i.setStatus(status);
        i.setScheduledDate(scheduled);
        return i;
    }

    private static Reservation reservation(Long id, Long propertyId, String propertyName,
                                           String guestName, LocalDate checkIn) {
        Reservation r = new Reservation();
        r.setId(id);
        r.setProperty(property(propertyId, propertyName));
        r.setGuestName(guestName);
        r.setCheckIn(checkIn);
        r.setStatus("confirmed");
        return r;
    }

    private static Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }
}
