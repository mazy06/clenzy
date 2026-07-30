package com.clenzy.service;

import com.clenzy.dto.ChannelCommissionOverviewDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.ChannelCommission;
import com.clenzy.repository.ChannelCommissionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ReservationRepository.ChannelFeeAggregate;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelCommissionOverviewServiceTest {

    private static final Long ORG_ID = 7L;

    @Mock private ReservationRepository reservationRepository;
    @Mock private ChannelCommissionRepository commissionRepository;

    private ChannelCommissionOverviewService service;

    @BeforeEach
    void setUp() {
        // Resolver reel : les taux de reference font partie du comportement teste.
        service = new ChannelCommissionOverviewService(
            reservationRepository, commissionRepository, new ChannelCommissionResolver());
    }

    @Test
    void whenNoReservation_thenEveryChannelIsListedWithoutObservedRate() {
        givenAggregates();
        givenBookingEngineRate(null);

        List<ChannelCommissionOverviewDto> rows = service.getOverview(ORG_ID);

        assertThat(rows).extracting(ChannelCommissionOverviewDto::channel)
            .containsExactlyInAnyOrder("airbnb", "booking", "vrbo", "expedia", "direct");
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.observedRate()).isNull();
            assertThat(row.stayCount()).isZero();
        });
    }

    @Test
    void whenAirbnbHasRealFees_thenObservedRateIgnoresStaysWithoutFee() {
        // 3 sejours Airbnb, dont 2 seulement portent une commission reelle :
        // 310 de frais sur 2000 de brut = 15,50 %. Le 3e sejour (5000 de brut,
        // aucune commission remontee) ne doit pas diluer le taux vers 4,43 %.
        givenAggregates(aggregate("airbnb", 3, 2, "310.00", "2000.00"));
        givenBookingEngineRate(null);

        ChannelCommissionOverviewDto airbnb = channel(service.getOverview(ORG_ID), "airbnb");

        assertThat(airbnb.observedRate()).isEqualByComparingTo("15.50");
        assertThat(airbnb.stayCount()).isEqualTo(3);
        assertThat(airbnb.realFeeCount()).isEqualTo(2);
    }

    @Test
    void whenSourcesSpellDifferently_thenTheyMergeIntoOneChannel() {
        givenAggregates(
            aggregate("airbnb", 1, 1, "100.00", "1000.00"),
            aggregate("airbnb_api", 2, 2, "210.00", "1000.00"));
        givenBookingEngineRate(null);

        ChannelCommissionOverviewDto airbnb = channel(service.getOverview(ORG_ID), "airbnb");

        assertThat(airbnb.stayCount()).isEqualTo(3);
        // 310 de frais cumules sur 2000 de brut cumule.
        assertThat(airbnb.observedRate()).isEqualByComparingTo("15.50");
    }

    @Test
    void whenChannelReportsNoFeeAtAll_thenObservedRateStaysNull() {
        givenAggregates(aggregate("vrbo", 4, 0, null, null));
        givenBookingEngineRate(null);

        ChannelCommissionOverviewDto vrbo = channel(service.getOverview(ORG_ID), "vrbo");

        assertThat(vrbo.stayCount()).isEqualTo(4);
        assertThat(vrbo.observedRate()).isNull();
        assertThat(vrbo.referenceRate()).isEqualByComparingTo("8.00");
    }

    @Test
    void whenBookingEngineRateIsConfigured_thenItIsTheReferenceAndEditable() {
        givenAggregates();
        givenBookingEngineRate(new BigDecimal("2.5"));

        ChannelCommissionOverviewDto direct = channel(service.getOverview(ORG_ID), "direct");

        assertThat(direct.referenceRate()).isEqualByComparingTo("2.50");
        assertThat(direct.editable()).isTrue();
    }

    @Test
    void whenChannelIsAnOta_thenItIsNotEditable() {
        givenAggregates();
        givenBookingEngineRate(null);

        assertThat(service.getOverview(ORG_ID))
            .filteredOn(row -> !"direct".equals(row.channel()))
            .allSatisfy(row -> assertThat(row.editable()).isFalse());
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private void givenAggregates(ChannelFeeAggregate... aggregates) {
        when(reservationRepository.aggregateOtaFeesBySource(eq(ORG_ID), any(LocalDate.class)))
            .thenReturn(List.of(aggregates));
    }

    private void givenBookingEngineRate(BigDecimal rate) {
        Optional<ChannelCommission> stored = Optional.ofNullable(rate).map(r -> {
            ChannelCommission commission = new ChannelCommission();
            commission.setCommissionRate(r);
            return commission;
        });
        when(commissionRepository.findByChannelAndOrgId(ChannelName.DIRECT, ORG_ID))
            .thenReturn(stored);
    }

    private static ChannelCommissionOverviewDto channel(List<ChannelCommissionOverviewDto> rows,
                                                        String channel) {
        return rows.stream()
            .filter(row -> channel.equals(row.channel()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("canal absent du rapport : " + channel));
    }

    /** Projection minimale — Mockito ne sait pas instancier une interface de projection. */
    private static ChannelFeeAggregate aggregate(String source, long stays, long realFees,
                                                 String realFeeTotal, String realFeeGross) {
        Function<String, BigDecimal> decimal = value -> value != null ? new BigDecimal(value) : null;
        return new ChannelFeeAggregate() {
            @Override public String getSource() { return source; }
            @Override public long getStayCount() { return stays; }
            @Override public long getRealFeeCount() { return realFees; }
            @Override public BigDecimal getRealFeeTotal() { return decimal.apply(realFeeTotal); }
            @Override public BigDecimal getRealFeeGross() { return decimal.apply(realFeeGross); }
        };
    }
}
