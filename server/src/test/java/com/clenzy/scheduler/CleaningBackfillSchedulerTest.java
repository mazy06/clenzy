package com.clenzy.scheduler;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.ServiceType;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.service.ServiceRequestService.AutoCleaningOutcome;
import com.clenzy.service.agent.supervision.AutoApplyGate;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionAutoApplyService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Filet quotidien F4d : checkouts du jour sans menage planifie, pour les orgs
 * ayant une regle CREATE_CLEANING_REQUEST active (opt-in = regle active).
 */
@ExtendWith(MockitoExtension.class)
class CleaningBackfillSchedulerTest {

    @Mock private AutomationRuleRepository automationRuleRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private SupervisionActivityService supervisionActivityService;
    @Mock private SupervisionSuggestionService supervisionSuggestionService;
    @Mock private AutoApplyGate autoApplyGate;
    @Mock private SupervisionAutoApplyService autoApplyService;

    private CleaningBackfillScheduler scheduler;

    private static final Long ORG_ID = 1L;

    private Property property;
    private Reservation reservation;

    @BeforeEach
    void setUp() {
        scheduler = new CleaningBackfillScheduler(automationRuleRepository, reservationRepository,
            serviceRequestRepository, serviceRequestService, new SimpleMeterRegistry(),
            supervisionActivityService, supervisionSuggestionService, autoApplyGate, autoApplyService);

        property = new Property();
        property.setId(100L);
        property.setOrganizationId(ORG_ID);
        property.setTimezone("Europe/Paris");

        reservation = new Reservation();
        reservation.setId(42L);
        reservation.setProperty(property);
        reservation.setCheckIn(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).minusDays(4));
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")));
    }

    private AutomationRule cleaningRule(Long orgId) {
        AutomationRule rule = new AutomationRule();
        rule.setId(9L);
        rule.setOrganizationId(orgId);
        rule.setActionType(AutomationAction.CREATE_CLEANING_REQUEST);
        return rule;
    }

    @Test
    void whenOrgHasActiveRule_andCheckoutTodayWithoutCleaning_thenCreatesRequest() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of());
        ServiceRequest created = new ServiceRequest();
        created.setId(55L);
        when(serviceRequestService.createAutomaticCleaningRequest(
                eq(ORG_ID), eq(100L), any(), any(), eq(42L)))
            .thenReturn(new AutoCleaningOutcome(created, null));

        scheduler.backfillTodaysCheckouts();

        verify(serviceRequestService).createAutomaticCleaningRequest(
            eq(ORG_ID), eq(100L), eq(reservation.getCheckIn()), eq(reservation.getCheckOut()), eq(42L));
    }

    @Test
    void whenNoActiveCleaningRule_thenNoOp() {
        AutomationRule otherRule = new AutomationRule();
        otherRule.setOrganizationId(ORG_ID);
        otherRule.setActionType(AutomationAction.SEND_MESSAGE);
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(otherRule));

        scheduler.backfillTodaysCheckouts();

        verifyNoInteractions(reservationRepository, serviceRequestService);
    }

    @Test
    void whenCheckoutIsNotToday_inPropertyTimezone_thenSkips() {
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1));
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));

        scheduler.backfillTodaysCheckouts();

        verify(serviceRequestService, never()).createAutomaticCleaningRequest(
            anyLong(), anyLong(), any(), any(), any());
    }

    @Test
    void whenStayAlreadyHasActiveCleaning_thenSkips() {
        ServiceRequest existing = new ServiceRequest();
        existing.setServiceType(ServiceType.CLEANING);
        existing.setStatus(RequestStatus.AWAITING_PAYMENT);
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of(existing));

        scheduler.backfillTodaysCheckouts();

        verify(serviceRequestService, never()).createAutomaticCleaningRequest(
            anyLong(), anyLong(), any(), any(), any());
    }

    @Test
    void whenExistingCleaningIsCancelled_thenStillCreates() {
        ServiceRequest cancelled = new ServiceRequest();
        cancelled.setServiceType(ServiceType.CLEANING);
        cancelled.setStatus(RequestStatus.CANCELLED);
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of(cancelled));
        when(serviceRequestService.createAutomaticCleaningRequest(any(), any(), any(), any(), any()))
            .thenReturn(new AutoCleaningOutcome(null, "frequence menage WEEKLY"));

        scheduler.backfillTodaysCheckouts();

        verify(serviceRequestService).createAutomaticCleaningRequest(
            eq(ORG_ID), eq(100L), any(), any(), eq(42L));
    }

    // ── Regle de scan HITL : depart de DEMAIN sans menage planifie ─────────────

    @Test
    void whenCheckoutTomorrowWithoutCleaning_afterEachStay_thenActionableHitlCard() {
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1));
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of());

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        // Propriete AFTER_EACH_STAY (defaut) → carte APPLICABLE (« Planifier le menage »).
        verify(supervisionSuggestionService).recordActionable(
            eq(ORG_ID), eq(100L), eq("ops"),
            eq("Menage manquant pour le depart de demain"), any(),
            eq("CLEANING_REQUEST"), any(), any(), eq("warning"));
    }

    @Test
    void whenGateAllowsAuto_thenCardCreatedQuietlyAndAutoAppliedViaPipeline() {
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1));
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of());
        when(autoApplyGate.decide(eq(ORG_ID), eq("ops"), eq("CLEANING_REQUEST"), any()))
            .thenReturn(AutoApplyGate.AutoDecision.AUTO_SILENT);
        when(supervisionSuggestionService.recordActionableForAutoApply(eq(ORG_ID), eq(100L), eq("ops"),
                eq(42L), any(), any(), eq("CLEANING_REQUEST"), any(), any(), eq("warning")))
            .thenReturn(java.util.Optional.of(77L));

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        // Chemin auto : carte créée SANS notif « en attente » puis appliquée par le pipeline.
        verify(autoApplyService).autoApply(eq(AutoApplyGate.AutoDecision.AUTO_SILENT),
            eq(ORG_ID), eq(100L), eq("ops"), eq(77L), any(), any(), eq(null));
        verify(supervisionSuggestionService, never()).recordActionable(
            any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void whenGateSaysCard_thenHitlCardAsBefore() {
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1));
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of());
        when(autoApplyGate.decide(eq(ORG_ID), eq("ops"), eq("CLEANING_REQUEST"), any()))
            .thenReturn(AutoApplyGate.AutoDecision.CARD);

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        verify(supervisionSuggestionService).recordActionable(
            eq(ORG_ID), eq(100L), eq("ops"),
            eq("Menage manquant pour le depart de demain"), any(),
            eq("CLEANING_REQUEST"), any(), any(), eq("warning"));
        verifyNoInteractions(autoApplyService);
    }

    @Test
    void whenCheckoutTomorrowWithoutCleaning_nonAfterEachStay_thenInformationalCard() {
        property.setCleaningFrequency(com.clenzy.model.CleaningFrequency.WEEKLY);
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1));
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of());

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        // Frequence non AFTER_EACH_STAY → l'apply ne pourrait pas aboutir → carte informationnelle.
        verify(supervisionSuggestionService).record(
            eq(ORG_ID), eq(100L), eq("ops"), eq("cleaning_missing"),
            eq("Menage manquant pour le depart de demain"), any());
    }

    @Test
    void whenCheckoutTomorrowButCleaningAlreadyPlanned_thenNoHitlCard() {
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")).plusDays(1));
        ServiceRequest existing = new ServiceRequest();
        existing.setServiceType(ServiceType.CLEANING);
        existing.setStatus(RequestStatus.AWAITING_PAYMENT);
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));
        when(serviceRequestRepository.findByReservationId(42L, ORG_ID)).thenReturn(List.of(existing));

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        verifyNoInteractions(supervisionSuggestionService);
    }

    @Test
    void whenCheckoutIsTodayNotTomorrow_inPropertyTimezone_thenNoHitlCard() {
        reservation.setCheckOut(LocalDate.now(java.time.ZoneId.of("Europe/Paris")));
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(cleaningRule(ORG_ID)));
        when(reservationRepository.findConfirmedByCheckOutRange(any(), any(), eq(ORG_ID)))
            .thenReturn(List.of(reservation));

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        verifyNoInteractions(supervisionSuggestionService);
    }

    @Test
    void whenNoActiveCleaningRule_thenScanIsNoOp() {
        AutomationRule otherRule = new AutomationRule();
        otherRule.setOrganizationId(ORG_ID);
        otherRule.setActionType(AutomationAction.SEND_MESSAGE);
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(otherRule));

        scheduler.scanTomorrowCheckoutsMissingCleaning();

        verifyNoInteractions(reservationRepository, supervisionSuggestionService);
    }
}
