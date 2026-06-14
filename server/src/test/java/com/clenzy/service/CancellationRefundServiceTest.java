package com.clenzy.service;

import com.clenzy.dto.CancellationRefundPreviewDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.CancellationPolicyType;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ChannelCancellationPolicyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Application de la politique d'annulation a une reservation (CLZ Domaine 2) : ownership org,
 * resolution de politique (DIRECT prioritaire) et repli FLEXIBLE par defaut.
 */
@ExtendWith(MockitoExtension.class)
class CancellationRefundServiceTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private ChannelCancellationPolicyRepository policyRepository;
    @Mock private TenantContext tenantContext;

    private CancellationRefundService service;

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    @BeforeEach
    void setUp() {
        // Horloge fixee 10 jours avant l'arrivee (20/06/2026 15:00 Paris).
        Clock clock = Clock.fixed(
                ZonedDateTime.of(2026, 6, 10, 12, 0, 0, 0, PARIS).toInstant(), PARIS);
        service = new CancellationRefundService(
                reservationRepository, policyRepository, new CancellationRefundCalculator(), tenantContext, clock);
        lenient().when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
    }

    private Reservation reservationInOrg(Long orgId) {
        Reservation r = new Reservation();
        r.setOrganizationId(orgId);
        r.setTotalPrice(new BigDecimal("200.00"));
        r.setCheckIn(LocalDate.of(2026, 6, 20));
        r.setCheckInTime("15:00");
        Property p = new Property();
        p.setId(7L);
        p.setTimezone("Europe/Paris");
        p.setDefaultCurrency("EUR");
        r.setProperty(p);
        return r;
    }

    @Test
    void preview_appliesDirectPolicy() {
        when(reservationRepository.findById(5L)).thenReturn(Optional.of(reservationInOrg(1L)));
        ChannelCancellationPolicy policy = new ChannelCancellationPolicy();
        policy.setPolicyType(CancellationPolicyType.MODERATE);
        when(policyRepository.findByPropertyIdAndChannelName(7L, ChannelName.DIRECT, 1L))
                .thenReturn(Optional.of(policy));

        CancellationRefundPreviewDto dto = service.preview(5L);

        // 10 jours de preavis, MODERATE (>=5) -> 100%
        assertThat(dto.policyType()).isEqualTo("MODERATE");
        assertThat(dto.refundPercentage()).isEqualTo(100);
        assertThat(dto.refundAmount()).isEqualByComparingTo("200.00");
        assertThat(dto.currency()).isEqualTo("EUR");
        assertThat(dto.daysBeforeCheckIn()).isEqualTo(10);
        assertThat(dto.policyConfigured()).isTrue();
    }

    @Test
    void preview_rejectsReservationFromAnotherOrg() {
        when(reservationRepository.findById(5L)).thenReturn(Optional.of(reservationInOrg(2L)));

        assertThatThrownBy(() -> service.preview(5L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void preview_notFound() {
        when(reservationRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.preview(404L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void preview_defaultsToFlexibleWhenNoPolicyConfigured() {
        when(reservationRepository.findById(5L)).thenReturn(Optional.of(reservationInOrg(1L)));
        when(policyRepository.findByPropertyIdAndChannelName(eq(7L), eq(ChannelName.DIRECT), eq(1L)))
                .thenReturn(Optional.empty());
        when(policyRepository.findByPropertyIdAndChannelName(eq(7L), eq(ChannelName.BOOKING_ENGINE), eq(1L)))
                .thenReturn(Optional.empty());
        when(policyRepository.findByPropertyId(7L, 1L)).thenReturn(List.of());

        CancellationRefundPreviewDto dto = service.preview(5L);

        assertThat(dto.policyType()).isEqualTo("FLEXIBLE");
        assertThat(dto.policyConfigured()).isFalse();
        assertThat(dto.refundPercentage()).isEqualTo(100); // flexible, 10j de preavis
    }
}
