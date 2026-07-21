package com.clenzy.service.report;

import com.clenzy.dto.ReportResultDto;
import com.clenzy.dto.ReportResultRowDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.agent.analytics.ChannelCommissionResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportExecutionServiceTest {

    private static final Long ORG = 10L;

    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private ChannelCommissionResolver commissionResolver;

    private ReportExecutionService service;
    private Property villa;
    private Property studio;

    @BeforeEach
    void setUp() {
        service = new ReportExecutionService(reservationRepository, interventionRepository,
                propertyRepository, commissionResolver, new ReportFieldCatalog());
        villa = property(1L, "Villa Azur", "Maroc");
        studio = property(2L, "Studio Centre", "Maroc");
        lenient().when(propertyRepository.findByOrganizationId(ORG))
                .thenReturn(List.of(villa, studio));
        lenient().when(commissionResolver.commissionOf(any(), any())).thenReturn(BigDecimal.ZERO);
    }

    private static Property property(Long id, String name, String country) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setCountry(country);
        p.setStatus(PropertyStatus.ACTIVE);
        return p;
    }

    private static Reservation reservation(Property property, String source,
                                           LocalDate checkIn, LocalDate checkOut, String price) {
        Reservation r = new Reservation();
        r.setProperty(property);
        r.setSource(source);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(new BigDecimal(price));
        r.setStatus("confirmed");
        r.setCurrency("MAD");
        return r;
    }

    @Test
    void whenInvalidMetric_thenRejectedBeforeAnyFetch() {
        assertThatThrownBy(() -> service.execute(
                List.of("PROPERTY"), List.of("DROP TABLE"), "MONTH",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), ORG))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(reservationRepository, interventionRepository, propertyRepository);
    }

    @Test
    void whenStaySpansTwoMonths_thenNightsProratedIntoEachBucket() {
        // 10 nuits (28 juil -> 7 août) à 1000 : 4 nuits en juillet (400), 6 en août (600).
        when(reservationRepository.findOverlappingWindowForPace(any(), any(), any(), any(), any()))
                .thenReturn(List.of(reservation(villa, "direct",
                        LocalDate.of(2026, 7, 28), LocalDate.of(2026, 8, 7), "1000.00")));

        ReportResultDto result = service.execute(
                List.of("PERIOD"), List.of("REVENUE", "ADR"), "MONTH",
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 8, 31), ORG);

        assertThat(result.rows()).hasSize(2);
        ReportResultRowDto july = result.rows().get(0);
        ReportResultRowDto august = result.rows().get(1);
        assertThat(july.dimensionValues()).containsExactly("2026-07");
        assertThat((BigDecimal) july.metrics().get("REVENUE")).isEqualByComparingTo("400.00");
        assertThat(august.dimensionValues()).containsExactly("2026-08");
        assertThat((BigDecimal) august.metrics().get("REVENUE")).isEqualByComparingTo("600.00");
        // ADR constant : 100/nuit des deux côtés.
        assertThat((BigDecimal) august.metrics().get("ADR")).isEqualByComparingTo("100.00");
        assertThat(result.currency()).isEqualTo("MAD");
    }

    @Test
    void whenGroupedByChannel_thenOccupancySharesSumToTotal() {
        // Août : direct 10 nuits, airbnb 20 nuits ; 2 logements actifs x 31 j = 62 nuits dispo.
        when(reservationRepository.findOverlappingWindowForPace(any(), any(), any(), any(), any()))
                .thenReturn(List.of(
                        reservation(villa, "direct",
                                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 11), "1000.00"),
                        reservation(studio, "airbnb",
                                LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 25), "3000.00")));

        ReportResultDto result = service.execute(
                List.of("CHANNEL"), List.of("OCCUPANCY", "REVENUE"), "MONTH",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), ORG);

        Map<String, Map<String, Object>> byChannel = Map.of(
                (String) result.rows().get(0).dimensionValues().get(0), result.rows().get(0).metrics(),
                (String) result.rows().get(1).dimensionValues().get(0), result.rows().get(1).metrics());
        // 10/62 = 16.1 %, 20/62 = 32.3 % — les parts somment à l'occupation totale.
        assertThat((Double) byChannel.get("direct").get("OCCUPANCY")).isEqualTo(16.1);
        assertThat((Double) byChannel.get("airbnb").get("OCCUPANCY")).isEqualTo(32.3);
    }

    @Test
    void whenMarginRequested_thenInterventionCostDistributedProRataAcrossChannels() {
        when(reservationRepository.findOverlappingWindowForPace(any(), any(), any(), any(), any()))
                .thenReturn(List.of(
                        reservation(villa, "direct",
                                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 11), "1000.00"),
                        reservation(villa, "airbnb",
                                LocalDate.of(2026, 8, 11), LocalDate.of(2026, 8, 21), "1000.00")));
        Intervention cleaning = new Intervention();
        cleaning.setProperty(villa);
        cleaning.setScheduledDate(LocalDate.of(2026, 8, 12).atTime(10, 0));
        cleaning.setActualCost(new BigDecimal("100.00"));
        when(interventionRepository.findAllByDateRange(any(), any(), any()))
                .thenReturn(List.of(cleaning));

        ReportResultDto result = service.execute(
                List.of("CHANNEL"), List.of("MARGIN"), "MONTH",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), ORG);

        // 10 nuits par canal -> coût réparti 50/50 : marge = 1000 - 0 - 50.
        assertThat(result.rows()).hasSize(2);
        for (ReportResultRowDto row : result.rows()) {
            assertThat((BigDecimal) row.metrics().get("MARGIN")).isEqualByComparingTo("950.00");
        }
    }

    @Test
    void whenCancelledReservation_thenExcludedFromReport() {
        Reservation cancelled = reservation(villa, "direct",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 11), "1000.00");
        cancelled.markCancelled();
        when(reservationRepository.findOverlappingWindowForPace(any(), any(), any(), any(), any()))
                .thenReturn(List.of(cancelled));

        ReportResultDto result = service.execute(
                List.of("PROPERTY"), List.of("REVENUE"), "MONTH",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31), ORG);

        assertThat(result.rows()).isEmpty();
    }
}
