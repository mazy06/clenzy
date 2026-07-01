package com.clenzy.service.agent.analytics;

import com.clenzy.model.Reservation;
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
@DisplayName("ChannelAttributionService — revenu net de commission par canal")
class ChannelAttributionServiceTest {

    private static final Long ORG = 1L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private TenantContext tenantContext;

    private ChannelAttributionService service;

    @BeforeEach
    void setUp() {
        service = new ChannelAttributionService(reservationRepository, new ChannelCommissionResolver(),
                tenantContext, CLOCK);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG);
    }

    @Test
    @DisplayName("Commission réelle (Airbnb) vs estimée (Booking) → net + parts corrects")
    void mixedChannels_computesNet() {
        Reservation airbnb = res("airbnb", "1000", "30");   // commission réelle 30
        Reservation booking = res("booking", "1000", null); // estimée 15% = 150
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(airbnb, booking));

        ChannelAttributionService.AttributionResult result = service.attribution(3);

        assertThat(result.totalGross()).isEqualByComparingTo("2000.00");
        assertThat(result.totalCommission()).isEqualByComparingTo("180.00");
        assertThat(result.totalNet()).isEqualByComparingTo("1820.00");

        ChannelAttributionService.ChannelAttribution ab = channel(result, "airbnb");
        assertThat(ab.commission()).isEqualByComparingTo("30.00");
        assertThat(ab.netRevenue()).isEqualByComparingTo("970.00");
        assertThat(ab.commissionEstimated()).isFalse();

        ChannelAttributionService.ChannelAttribution bk = channel(result, "booking");
        assertThat(bk.commission()).isEqualByComparingTo("150.00");
        assertThat(bk.commissionEstimated()).isTrue();

        // Airbnb (net 970) avant Booking (net 850).
        assertThat(result.channels().get(0).channel()).isEqualTo("airbnb");
        assertThat(result.recommendation()).contains("booking");
    }

    @Test
    @DisplayName("Réservation annulée → exclue de l'attribution")
    void cancelled_excluded() {
        Reservation confirmed = res("airbnb", "1000", "30");
        Reservation cancelled = res("airbnb", "5000", "200");
        cancelled.setStatus("cancelled");
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(confirmed, cancelled));

        ChannelAttributionService.AttributionResult result = service.attribution(3);

        assertThat(result.totalGross()).isEqualByComparingTo("1000.00");
    }

    @Test
    @DisplayName("Canal direct → aucune commission, pas d'estimation")
    void directChannel_noCommission() {
        when(reservationRepository.findAllByDateRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(res("direct", "1000", null)));

        ChannelAttributionService.AttributionResult result = service.attribution(3);

        ChannelAttributionService.ChannelAttribution direct = channel(result, "direct");
        assertThat(direct.commission()).isEqualByComparingTo("0.00");
        assertThat(direct.netRevenue()).isEqualByComparingTo("1000.00");
        assertThat(direct.commissionEstimated()).isFalse();
        assertThat(result.recommendation()).contains("mix sain");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static ChannelAttributionService.ChannelAttribution channel(
            ChannelAttributionService.AttributionResult result, String name) {
        return result.channels().stream()
                .filter(c -> c.channel().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private static Reservation res(String source, String total, String otaFee) {
        Reservation r = new Reservation();
        r.setSource(source);
        r.setStatus("confirmed");
        r.setCurrency("EUR");
        r.setTotalPrice(new BigDecimal(total));
        if (otaFee != null) {
            r.setOtaFeeAmount(new BigDecimal(otaFee));
        }
        return r;
    }
}
