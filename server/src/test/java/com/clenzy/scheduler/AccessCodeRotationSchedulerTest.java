package com.clenzy.scheduler;

import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.access.AccessCodeGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessCodeRotationSchedulerTest {

    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private NotificationService notificationService;
    private final AccessCodeGenerator generator = new AccessCodeGenerator();
    private AccessCodeRotationScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AccessCodeRotationScheduler(
            instructionsRepository, reservationRepository, generator, notificationService);
    }

    private CheckInInstructions autoRotateInstructions() {
        Property p = new Property();
        p.setId(10L);
        p.setName("Studio");
        p.setTimezone("Europe/Paris");
        CheckInInstructions ci = new CheckInInstructions(p, 1L);
        ci.setAccessCode("4827");
        ci.setAccessCodeAutoRotate(true);
        ci.setAccessCodeFormat("{\"pattern\":[\"digits\",\"digits\",\"digits\",\"digits\"]}");
        return ci;
    }

    private Reservation checkoutYesterday(Property p) {
        Reservation r = new Reservation();
        r.setProperty(p);
        r.setOrganizationId(1L);
        r.setStatus("confirmed");
        r.setCheckOut(LocalDate.now().minusDays(1));
        r.setCheckOutTime("11:00");
        return r;
    }

    @Test
    void rotatesCodeAfterPastCheckout() {
        CheckInInstructions ci = autoRotateInstructions();
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));

        scheduler.rotateAfterCheckout();

        assertThat(ci.getAccessCode()).hasSize(4).matches("\\d{4}");
        assertThat(ci.getAccessCodeRotatedAt()).isNotNull();
        verify(instructionsRepository).save(ci);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
            eq(1L), eq(NotificationKey.ACCESS_CODE_ROTATED), anyString(), anyString(), anyString());
    }

    @Test
    void doesNotRotateWhenAlreadyRotatedAfterCheckout() {
        CheckInInstructions ci = autoRotateInstructions();
        ci.setAccessCodeRotatedAt(LocalDateTime.now()); // déjà tourné après le départ d'hier
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of(ci));
        when(reservationRepository.findRecentCheckoutsByProperty(eq(10L), any(), any(), eq(1L)))
            .thenReturn(List.of(checkoutYesterday(ci.getProperty())));

        scheduler.rotateAfterCheckout();

        assertThat(ci.getAccessCode()).isEqualTo("4827");
        verify(instructionsRepository, never()).save(any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(any(), any(), any(), any(), any());
    }

    @Test
    void doesNothingWhenNoAutoRotateProperties() {
        when(instructionsRepository.findAutoRotateWithProperty()).thenReturn(List.of());
        scheduler.rotateAfterCheckout();
        verify(instructionsRepository, never()).save(any());
    }
}
