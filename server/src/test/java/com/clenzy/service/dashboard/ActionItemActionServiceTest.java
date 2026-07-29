package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.service.AccountingService;
import com.clenzy.service.DocumentGenerationPipeline;
import com.clenzy.service.IssueService;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.OrganizationInvitationService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.messaging.AutomationEvaluationService;
import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.service.messaging.GuestMessagingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Les gardes du point d'entrée unique des gestes.
 *
 * <p>Le nom du geste et l'identifiant de l'action viennent tous deux du client.
 * Deux choses doivent donc être impossibles, et c'est ce que ces tests
 * figent : agir sur l'action d'une autre organisation, et détourner un geste
 * vers un service auquel il n'était pas destiné — « libérer la caution » envoyé
 * sur une invitation appellerait le service des cautions avec un identifiant
 * étranger.</p>
 */
class ActionItemActionServiceTest {

    private static final Long ORG = 12L;

    private ActionItemRepository actionItemRepository;
    private NoiseAlertService noiseAlertService;
    private SecurityDepositPaymentService securityDepositPaymentService;
    private AccountingService accountingService;
    private OutboxEventRepository outboxEventRepository;
    private ReservationService reservationService;
    private AutomationEvaluationService automationEvaluationService;
    private ActionItemActionService service;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        actionItemRepository = mock(ActionItemRepository.class);
        noiseAlertService = mock(NoiseAlertService.class);
        securityDepositPaymentService = mock(SecurityDepositPaymentService.class);
        accountingService = mock(AccountingService.class);
        outboxEventRepository = mock(OutboxEventRepository.class);
        reservationService = mock(ReservationService.class);
        automationEvaluationService = mock(AutomationEvaluationService.class);
        jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn("kc-user");

        service = new ActionItemActionService(
                actionItemRepository,
                mock(DocumentGenerationRepository.class),
                mock(GuestMessageLogRepository.class),
                mock(DocumentGenerationPipeline.class),
                mock(GuestMessagingService.class),
                outboxEventRepository,
                noiseAlertService,
                accountingService,
                securityDepositPaymentService,
                mock(OrganizationInvitationService.class),
                mock(IssueService.class),
                reservationService,
                automationEvaluationService);
    }

    private void queueHolds(ActionItemKind kind, Long targetId, Long orgId) {
        final ActionItem item = new ActionItem();
        item.setId(41L);
        item.setOrganizationId(orgId);
        item.setKind(kind.name());
        item.setTargetId(targetId);
        when(actionItemRepository.findById(41L)).thenReturn(Optional.of(item));
    }

    @Test
    void whenTheGestureMatchesTheKind_thenItReachesItsService() {
        queueHolds(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED, 7L, ORG);

        service.act(41L, ORG, "acknowledge", jwt);

        verify(noiseAlertService).acknowledge(eq(7L), eq(ORG), eq("kc-user"), any());
    }

    @Test
    void whenTheGestureTargetsAnotherKind_thenItIsRefusedBeforeReachingAnyService() {
        // « Liberer la caution » envoye sur une invitation appellerait le service
        // des cautions avec un identifiant qui n'est pas une caution.
        queueHolds(ActionItemKind.INVITATION_EXPIRED, 9L, ORG);

        assertThatThrownBy(() -> service.act(41L, ORG, "release", jwt))
                .isInstanceOf(IllegalStateException.class);

        verifyNoInteractions(securityDepositPaymentService);
    }

    @Test
    void whenTheActionBelongsToAnotherOrganization_thenNothingIsDone() {
        queueHolds(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED, 7L, 99L);

        assertThatThrownBy(() -> service.act(41L, ORG, "acknowledge", jwt))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(noiseAlertService);
    }

    @Test
    void whenTheGestureIsUnknown_thenNoServiceIsCalled() {
        queueHolds(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED, 7L, ORG);

        assertThatThrownBy(() -> service.act(41L, ORG, "drop-everything", jwt))
                .isInstanceOf(IllegalStateException.class);

        verifyNoInteractions(noiseAlertService, accountingService, securityDepositPaymentService);
    }

    @Test
    void whenConfirmingABooking_thenItGoesThroughTheCalendarAwarePath() {
        // Le geste ne pose PAS le statut lui-meme : il delegue au service qui
        // reserve les jours et refuse un conflit. Un raccourci ici produirait la
        // surreservation que tout le reste du systeme s'emploie a eviter.
        queueHolds(ActionItemKind.RESERVATION_PENDING, 88L, ORG);

        service.act(41L, ORG, "confirm", jwt);

        verify(reservationService).confirm(88L, "kc-user");
    }

    @Test
    void whenReplayingAnAutomation_thenOnlyTheFailedExecutionIsReplayed() {
        // `fireTrigger` reevaluerait toutes les regles du declencheur et
        // renverrait les messages de celles qui avaient abouti.
        queueHolds(ActionItemKind.AUTOMATION_FAILED, 5L, ORG);

        service.act(41L, ORG, "replayAutomation", jwt);

        verify(automationEvaluationService).replayExecution(5L, ORG);
    }

    @Test
    void whenConfirmIsAimedAtAnythingElse_thenTheBookingEngineIsNeverTouched() {
        queueHolds(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED, 7L, ORG);

        assertThatThrownBy(() -> service.act(41L, ORG, "confirm", jwt))
                .isInstanceOf(IllegalStateException.class);

        verifyNoInteractions(reservationService);
    }

    @Test
    void whenReplayingAMessageOfAnotherOrganization_thenItIsRefused() {
        // Le rejeu en masse existant ne filtre pas par organisation : c'est
        // precisement pourquoi ce chemin ne l'utilise pas.
        queueHolds(ActionItemKind.OUTBOX_DEAD_LETTER, 5L, ORG);
        final com.clenzy.model.OutboxEvent foreign = new com.clenzy.model.OutboxEvent();
        foreign.setOrganizationId(99L);
        when(outboxEventRepository.findById(5L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.act(41L, ORG, "replay", jwt))
                .isInstanceOf(IllegalArgumentException.class);

        verify(outboxEventRepository, never()).save(any());
    }
}
