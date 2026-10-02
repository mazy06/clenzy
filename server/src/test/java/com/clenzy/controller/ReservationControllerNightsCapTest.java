package com.clenzy.controller;

import com.clenzy.dto.ReservationDto;
import com.clenzy.exception.NightsCapExceededException;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.CancellationRefundService;
import com.clenzy.service.InterventionMapper;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationPaymentService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.regulatory.NightsCapService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plafond annuel de nuitées sur la création manuelle : refus par défaut, dérogation
 * explicite possible — et alors notifiée (décision produit 2026-10-01).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReservationControllerNightsCapTest {

    @Mock private ReservationService reservationService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private ReservationPaymentService reservationPaymentService;
    @Mock private InterventionMapper interventionMapper;
    @Mock private CancellationRefundService cancellationRefundService;
    @Mock private NightsCapService nightsCapService;

    private ReservationController controller;
    private Property property;
    private final Jwt jwt = Jwt.withTokenValue("t").header("alg", "RS256").claim("sub", "user-1")
            .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    private final ReservationDto dto = new ReservationDto(null, 1L, null, "Guest", null, null, null, 2,
            "2026-12-20", "2026-12-27", null, null, null, null, null, null, null, null,
            null, null, null, null, null, false, null, null, null, null, null);

    @BeforeEach
    void setUp() {
        controller = new ReservationController(reservationService, reservationMapper, reservationPaymentService,
                interventionMapper, cancellationRefundService, nightsCapService);
        property = new Property();
        property.setId(1L);
        property.setOrganizationId(7L);
        property.setName("Studio Marais");
        doAnswer(inv -> {
            Reservation r = inv.getArgument(1);
            r.setProperty(property);
            r.setCheckIn(LocalDate.of(2026, 12, 20));
            r.setCheckOut(LocalDate.of(2026, 12, 27));
            return null;
        }).when(reservationMapper).apply(any(), any());
        when(reservationService.save(any())).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            r.setId(42L);
            r.setOrganizationId(7L);
            return r;
        });
        when(reservationService.reloadWithRelations(any())).thenAnswer(inv -> inv.getArgument(0));
        when(nightsCapService.overruns(eq(1L), eq(7L), any(), any()))
                .thenReturn(List.of(new NightsCapService.YearOverrun(2026, 118, 7, 120)));
    }

    @Test
    void overrunWithoutDerogation_isRefusedAndNothingIsSaved() {
        assertThatThrownBy(() -> controller.create(dto, jwt, false))
                .isInstanceOf(NightsCapExceededException.class)
                .hasMessageContaining("118");
        verify(reservationService, never()).save(any());
        verify(nightsCapService, never()).notifyDerogation(any(), any(), any(), anyString(), any());
    }

    @Test
    void explicitDerogation_savesAndNotifiesManagers() {
        controller.create(dto, jwt, true);

        verify(reservationService).save(any());
        verify(nightsCapService).notifyDerogation(eq(7L), eq(1L), eq("Studio Marais"), anyString(), eq("user-1"));
    }

    @Test
    void withinCap_savesWithoutNotification() {
        when(nightsCapService.overruns(eq(1L), eq(7L), any(), any())).thenReturn(List.of());

        controller.create(dto, jwt, false);

        verify(reservationService).save(any());
        verify(nightsCapService, never()).notifyDerogation(any(), any(), any(), anyString(), any());
    }
}
