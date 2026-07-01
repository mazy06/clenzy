package com.clenzy.service.agent.analytics;

import com.clenzy.model.Intervention;
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
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PropertyPnlService — rentabilité nette par logement")
class PropertyPnlServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private TenantContext tenantContext;

    private PropertyPnlService service;

    @BeforeEach
    void setUp() {
        service = new PropertyPnlService(reservationRepository, interventionRepository,
                new ChannelCommissionResolver(), tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Revenu − commission − coûts = net + marge")
    void computesNetAndMargin() {
        Property p = property(5L, "Villa A");
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, "1000", "30", "airbnb")));
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(intv(p, "80")));

        PropertyPnlService.PnlResult result = service.compute(3);

        assertThat(result.properties()).hasSize(1);
        PropertyPnlService.PropertyPnl pnl = result.properties().get(0);
        assertThat(pnl.revenue()).isEqualByComparingTo("1000.00");
        assertThat(pnl.commission()).isEqualByComparingTo("30.00");
        assertThat(pnl.interventionCost()).isEqualByComparingTo("80.00");
        assertThat(pnl.netProfit()).isEqualByComparingTo("890.00");
        assertThat(result.deficitCount()).isZero();
    }

    @Test
    @DisplayName("Logement déficitaire → compté + recommandation")
    void deficitProperty_flagged() {
        Property p = property(7L, "Studio B");
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, "100", null, "booking"))); // commission estimée 15
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(intv(p, "200")));

        PropertyPnlService.PnlResult result = service.compute(3);

        // net = 100 - 15 - 200 = -115
        assertThat(result.properties().get(0).netProfit()).isEqualByComparingTo("-115.00");
        assertThat(result.deficitCount()).isEqualTo(1);
        assertThat(result.recommendation()).contains("déficit");
    }

    @Test
    @DisplayName("Réservation annulée exclue du revenu")
    void cancelled_excluded() {
        Property p = property(5L, "Villa A");
        Reservation cancelled = res(p, "5000", "100", "airbnb");
        cancelled.setStatus("cancelled");
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res(p, "1000", "30", "airbnb"), cancelled));
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of());

        PropertyPnlService.PnlResult result = service.compute(3);

        assertThat(result.totalRevenue()).isEqualByComparingTo("1000.00");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        return p;
    }

    private static Reservation res(Property p, String total, String otaFee, String source) {
        Reservation r = new Reservation();
        r.setProperty(p);
        r.setStatus("confirmed");
        r.setCurrency("EUR");
        r.setSource(source);
        r.setTotalPrice(new BigDecimal(total));
        if (otaFee != null) {
            r.setOtaFeeAmount(new BigDecimal(otaFee));
        }
        return r;
    }

    private static Intervention intv(Property p, String actualCost) {
        Intervention i = new Intervention();
        i.setProperty(p);
        i.setActualCost(new BigDecimal(actualCost));
        return i;
    }
}
