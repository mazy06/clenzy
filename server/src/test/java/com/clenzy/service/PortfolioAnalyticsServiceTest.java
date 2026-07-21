package com.clenzy.service;

import com.clenzy.dto.analytics.PortfolioAnalyticsDto;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
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
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioAnalyticsServiceTest {

    private static final Long ORG = 10L;
    private static final Instant NOW = Instant.parse("2026-07-20T12:00:00Z");
    private static final LocalDate TODAY = LocalDate.ofInstant(NOW, ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;

    private PortfolioAnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new PortfolioAnalyticsService(reservationRepository, propertyRepository,
                interventionRepository, serviceRequestRepository, Clock.fixed(NOW, ZoneId.of("UTC")));
        lenient().when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of());
        lenient().when(interventionRepository.countByStatus(any(), eq(ORG))).thenReturn(0L);
        lenient().when(serviceRequestRepository.countByStatusForDashboard(eq(ORG), any(), any())).thenReturn(0L);
    }

    private static Property property(long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setStatus(PropertyStatus.ACTIVE);
        return p;
    }

    private static Reservation reservation(long propertyId, LocalDate checkIn, LocalDate checkOut,
                                           String price, String source) {
        Property p = new Property();
        p.setId(propertyId);
        p.setName("Logement " + propertyId);
        Reservation r = new Reservation();
        r.setProperty(p);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setTotalPrice(new BigDecimal(price));
        r.setStatus("confirmed");
        r.setSource(source);
        return r;
    }

    @Test
    void whenCurrentWindowBookings_thenGlobalKpisComputed() {
        // 1 bien actif, fenêtre 30 j. Réservation 5 nuits (10-15 juil) à 500 dans la fenêtre.
        when(propertyRepository.findByOrganizationIdAndStatus(ORG, PropertyStatus.ACTIVE))
                .thenReturn(List.of(property(1L, "Villa")));
        when(reservationRepository.findAllByDateRange(any(), eq(TODAY), eq(ORG)))
                .thenReturn(List.of(reservation(1L,
                        LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 15), "500", "airbnb")));

        PortfolioAnalyticsDto dto = service.getPortfolio(ORG, 30);

        // ADR = 500 / 5 nuits = 100 ; RevPAN = 500 / (1 bien x 30 j) = 16.67.
        assertThat(dto.global().adr().value()).isEqualTo(100.0);
        assertThat(dto.global().revPAN().value()).isEqualTo(16.67);
        assertThat(dto.global().totalRevenue().value()).isEqualTo(500.0);
        // Occupation = 5 / 30 = 16.7 %.
        assertThat(dto.global().occupancyRate().value()).isEqualTo(16.7);
        // Aucune intervention → marge 100 %, ROI 0 (coûts nuls).
        assertThat(dto.global().netMargin().value()).isEqualTo(100.0);
        assertThat(dto.global().activeProperties()).isEqualTo(1L);
    }

    @Test
    void whenRealInterventionCosts_thenMarginReflectsThem() {
        when(propertyRepository.findByOrganizationIdAndStatus(ORG, PropertyStatus.ACTIVE))
                .thenReturn(List.of(property(1L, "Villa")));
        when(reservationRepository.findAllByDateRange(any(), eq(TODAY), eq(ORG)))
                .thenReturn(List.of(reservation(1L,
                        LocalDate.of(2026, 7, 10), LocalDate.of(2026, 7, 15), "1000", "direct")));
        com.clenzy.model.Intervention cleaning = new com.clenzy.model.Intervention();
        cleaning.setScheduledDate(LocalDate.of(2026, 7, 12).atTime(10, 0));
        cleaning.setActualCost(new BigDecimal("200"));
        when(interventionRepository.findAllByDateRange(any(), any(), eq(ORG))).thenReturn(List.of(cleaning));

        PortfolioAnalyticsDto dto = service.getPortfolio(ORG, 30);

        // Marge = (1000 - 200) / 1000 = 80 % ; ROI = (1000 - 200) / 200 = 400 %.
        assertThat(dto.global().netMargin().value()).isEqualTo(80.0);
        assertThat(dto.global().roi().value()).isEqualTo(400.0);
    }

    @Test
    void whenBookings_thenRevenueByChannelAndTopProperties() {
        when(propertyRepository.findByOrganizationIdAndStatus(ORG, PropertyStatus.ACTIVE))
                .thenReturn(List.of(property(1L, "Villa"), property(2L, "Studio")));
        when(reservationRepository.findAllByDateRange(any(), eq(TODAY), eq(ORG)))
                .thenReturn(List.of(
                        reservation(1L, LocalDate.of(2026, 7, 5), LocalDate.of(2026, 7, 10), "800", "airbnb"),
                        reservation(2L, LocalDate.of(2026, 7, 8), LocalDate.of(2026, 7, 12), "300", "direct")));

        PortfolioAnalyticsDto dto = service.getPortfolio(ORG, 30);

        assertThat(dto.revenue().byChannel())
                .extracting(PortfolioAnalyticsDto.ChannelRevenue::name)
                .contains("Airbnb", "Direct");
        // Top property = Villa (800 > 300).
        assertThat(dto.revenue().byProperty().get(0).name()).isEqualTo("Logement 1");
        assertThat(dto.revenue().byProperty().get(0).revenue()).isEqualTo(800L);
        assertThat(dto.revenue().avgRevenuePerBooking()).isEqualTo(550L); // (800+300)/2
    }

    @Test
    void whenNoData_thenNoDivisionErrorsAndZeroes() {
        when(propertyRepository.findByOrganizationIdAndStatus(ORG, PropertyStatus.ACTIVE)).thenReturn(List.of());
        when(reservationRepository.findAllByDateRange(any(), eq(TODAY), eq(ORG))).thenReturn(List.of());

        PortfolioAnalyticsDto dto = service.getPortfolio(ORG, 30);

        assertThat(dto.global().totalRevenue().value()).isZero();
        assertThat(dto.occupancy().globalRate()).isZero();
        assertThat(dto.occupancy().heatmap()).hasSize(42);
        assertThat(dto.revenue().byMonth()).hasSize(6);
    }
}
