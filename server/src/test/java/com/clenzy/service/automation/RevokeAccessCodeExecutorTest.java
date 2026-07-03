package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.SmartLockAccessCodeRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.access.AccessCodeGenerator;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import com.clenzy.service.smartlock.SmartLockAccessCodeService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("RevokeAccessCodeExecutor (F4b revocation auto du code apres check-out + grace)")
class RevokeAccessCodeExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long RESERVATION_ID = 100L;
    private static final Long PROPERTY_ID = 7L;

    @Mock private SmartLockAccessCodeRepository accessCodeRepository;
    @Mock private SmartLockAccessCodeService accessCodeService;
    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private AccessCodeGenerator accessCodeGenerator;
    @Mock private NotificationService notificationService;

    private RevokeAccessCodeExecutor executorAt(LocalTime wallTime) {
        Clock clock = Clock.fixed(
                LocalDate.now().atTime(wallTime).atZone(ZoneId.systemDefault()).toInstant(),
                ZoneId.systemDefault());
        return new RevokeAccessCodeExecutor(accessCodeRepository, accessCodeService,
                instructionsRepository, accessCodeGenerator, notificationService, clock);
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setId(13L);
        rule.setOrganizationId(ORG_ID);
        rule.setName("revocation code");
        rule.setTriggerType(AutomationTrigger.CHECK_OUT_DAY);
        return rule;
    }

    /** Reservation partie AUJOURD'HUI a 11:00 (fuseau systeme = pas de timezone logement). */
    private static Reservation reservationCheckedOutTodayAt11() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setOrganizationId(ORG_ID);
        reservation.setProperty(property);
        reservation.setCheckOut(LocalDate.now());
        reservation.setCheckOutTime("11:00");
        reservation.setStatus("confirmed");
        return reservation;
    }

    private static AutomationActionContext ctx(Reservation reservation) {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_RESERVATION,
                RESERVATION_ID, Map.of(), reservation);
    }

    @Test
    @DisplayName("action() -> REVOKE_ACCESS_CODE")
    void actionType() {
        assertThat(executorAt(LocalTime.of(16, 0)).action())
                .isEqualTo(AutomationAction.REVOKE_ACCESS_CODE);
    }

    @Test
    @DisplayName("guard : avant check-out + grace -> RESCHEDULED a l'heure exacte (non-terminal)")
    void beforeGrace_reschedulesAtExactMoment() {
        // 14:00 < 11:00 + 4 h de grace (15:00) → re-planification, pas de revocation.
        ExecutionResult result = executorAt(LocalTime.of(14, 0))
                .execute(rule(), ctx(reservationCheckedOutTodayAt11()));

        assertThat(result.rescheduledAt())
                .isEqualTo(LocalDate.now().atTime(15, 0));
        assertThat(result.skipped()).isFalse();
        verifyNoInteractions(accessCodeService, instructionsRepository, notificationService);
    }

    @Test
    @DisplayName("grace configurable via actionConfig JSON de la regle")
    void graceHours_readFromActionConfig() {
        AutomationRule rule = rule();
        rule.setActionConfig("{\"graceHours\": 6}");

        // 16:00 < 11:00 + 6 h (17:00) → toujours trop tot avec la grace etendue.
        ExecutionResult result = executorAt(LocalTime.of(16, 0))
                .execute(rule, ctx(reservationCheckedOutTodayAt11()));

        assertThat(result.rescheduledAt()).isEqualTo(LocalDate.now().atTime(17, 0));
    }

    @Test
    @DisplayName("apres la grace : codes serrure actifs revoques -> EXECUTED")
    void afterGrace_revokesSmartLockCodes() {
        when(accessCodeRepository.findByReservationIdAndStatus(RESERVATION_ID, CodeStatus.ACTIVE))
                .thenReturn(List.of(new SmartLockAccessCode()));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.empty());

        ExecutionResult result = executorAt(LocalTime.of(16, 0))
                .execute(rule(), ctx(reservationCheckedOutTodayAt11()));

        assertThat(result.skipped()).isFalse();
        assertThat(result.rescheduledAt()).isNull();
        verify(accessCodeService).revokeForReservation(RESERVATION_ID, "system:automation");
    }

    @Test
    @DisplayName("apres la grace : code statique tourne + notification host -> EXECUTED")
    void afterGrace_rotatesStaticCode() {
        when(accessCodeRepository.findByReservationIdAndStatus(RESERVATION_ID, CodeStatus.ACTIVE))
                .thenReturn(List.of());
        CheckInInstructions instructions = new CheckInInstructions();
        instructions.setAccessCode("1234");
        when(instructionsRepository.findByPropertyIdAndOrganizationId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(instructions));
        when(accessCodeGenerator.generate(any(), eq("1234"))).thenReturn("9876");

        ExecutionResult result = executorAt(LocalTime.of(16, 0))
                .execute(rule(), ctx(reservationCheckedOutTodayAt11()));

        assertThat(result.skipped()).isFalse();
        assertThat(instructions.getAccessCode()).isEqualTo("9876");
        assertThat(instructions.getAccessCodeRotatedAt()).isNotNull();
        verify(instructionsRepository).save(instructions);
        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.ACCESS_CODE_ROTATED),
                anyString(), contains("9876"), anyString());
        verify(accessCodeService, never()).revokeForReservation(any(), anyString());
    }

    @Test
    @DisplayName("code statique deja tourne depuis ce depart -> SKIPPED (idempotence rotation)")
    void staticCodeAlreadyRotated_skips() {
        when(accessCodeRepository.findByReservationIdAndStatus(RESERVATION_ID, CodeStatus.ACTIVE))
                .thenReturn(List.of());
        CheckInInstructions instructions = new CheckInInstructions();
        instructions.setAccessCode("1234");
        // Rotation posterieure au check-out (11:00) : deja couverte (scheduler opt-in).
        instructions.setAccessCodeRotatedAt(LocalDate.now().atTime(12, 0));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.of(instructions));

        ExecutionResult result = executorAt(LocalTime.of(16, 0))
                .execute(rule(), ctx(reservationCheckedOutTodayAt11()));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("deja tourne");
        verify(instructionsRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("ni serrure ni code statique -> SKIPPED (rien a revoquer)")
    void nothingManaged_skips() {
        when(accessCodeRepository.findByReservationIdAndStatus(RESERVATION_ID, CodeStatus.ACTIVE))
                .thenReturn(List.of());
        when(instructionsRepository.findByPropertyIdAndOrganizationId(PROPERTY_ID, ORG_ID))
                .thenReturn(Optional.empty());

        ExecutionResult result = executorAt(LocalTime.of(16, 0))
                .execute(rule(), ctx(reservationCheckedOutTodayAt11()));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("Aucun code");
    }

    @Test
    @DisplayName("reservation annulee -> SKIPPED (le flux d'annulation a deja revoque)")
    void cancelledReservation_skips() {
        Reservation reservation = reservationCheckedOutTodayAt11();
        reservation.setStatus("cancelled");

        ExecutionResult result = executorAt(LocalTime.of(16, 0)).execute(rule(), ctx(reservation));

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(accessCodeService, accessCodeRepository);
    }

    @Test
    @DisplayName("sujet non-reservation -> echec explicite")
    void wrongSubject_throws() {
        AutomationActionContext ctx = new AutomationActionContext(
                ORG_ID, AutomationSubject.TYPE_NOISE_ALERT, 5L, Map.of());

        assertThatThrownBy(() -> executorAt(LocalTime.of(16, 0)).execute(rule(), ctx))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("revocationMoment : check-out du logement + offset + grace, fuseau du logement")
    void revocationMoment_usesPropertyTimezoneAndOffset() {
        AutomationRule rule = rule();
        rule.setTriggerOffsetDays(1);
        rule.setActionConfig("{\"graceHours\": 2}");

        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setTimezone("Pacific/Auckland");
        property.setDefaultCheckOutTime("10:00");
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        reservation.setCheckOut(LocalDate.of(2026, 7, 10));

        ZonedDateTime moment = RevokeAccessCodeExecutor.revocationMoment(reservation, rule);

        assertThat(moment).isEqualTo(
                LocalDateTime.of(2026, 7, 11, 12, 0).atZone(ZoneId.of("Pacific/Auckland")));
    }
}
