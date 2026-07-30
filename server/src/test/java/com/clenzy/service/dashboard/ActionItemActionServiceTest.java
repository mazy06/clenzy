package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.service.AccountingService;
import com.clenzy.service.InterventionLifecycleService;
import com.clenzy.service.InterventionService;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.service.dashboard.gesture.AcknowledgeNoiseAlertHandler;
import com.clenzy.service.dashboard.gesture.ActionGestureHandler;
import com.clenzy.service.dashboard.gesture.ApprovePayoutHandler;
import com.clenzy.service.dashboard.gesture.AssignInterventionHandler;
import com.clenzy.service.dashboard.gesture.CancelInterventionHandler;
import com.clenzy.service.dashboard.gesture.ConfirmReservationHandler;
import com.clenzy.service.dashboard.gesture.GestureContext;
import com.clenzy.service.dashboard.gesture.ReleaseDepositHandler;
import com.clenzy.service.dashboard.gesture.ReplayAutomationHandler;
import com.clenzy.service.dashboard.gesture.ReplayOutboxHandler;
import com.clenzy.service.dashboard.gesture.RescheduleInterventionHandler;
import com.clenzy.service.messaging.AutomationEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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
 *
 * <p>Les handlers testés sont les vrais, montés sur des services simulés : ce
 * qui compte est que le couple (geste, nature) mène au bon service, et un
 * handler factice ne le prouverait pas.</p>
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
    private InterventionService interventionService;
    private InterventionLifecycleService interventionLifecycleService;
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
        interventionService = mock(InterventionService.class);
        interventionLifecycleService = mock(InterventionLifecycleService.class);

        // Le verrou anti double-clic laisse passer le premier appel.
        final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        final ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(true);

        jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn("kc-user");

        service = new ActionItemActionService(
                new ActionItemLoader(actionItemRepository),
                redisTemplate,
                List.of(
                        new AcknowledgeNoiseAlertHandler(noiseAlertService),
                        new ApprovePayoutHandler(accountingService),
                        new ReleaseDepositHandler(securityDepositPaymentService),
                        new ConfirmReservationHandler(reservationService),
                        new ReplayAutomationHandler(automationEvaluationService),
                        new ReplayOutboxHandler(outboxEventRepository),
                        new AssignInterventionHandler(interventionService),
                        new CancelInterventionHandler(interventionLifecycleService),
                        new RescheduleInterventionHandler(interventionLifecycleService)));
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
    void whenTwoHandlersClaimTheSameGesture_thenTheApplicationRefusesToStart() {
        // Un doublon ferait partir le geste vers l'un ou l'autre selon l'ordre
        // d'injection de Spring — c'est-a-dire au hasard. Mieux vaut ne pas
        // demarrer que d'approuver un reversement par le mauvais chemin un jour
        // sur deux.
        final ActionGestureHandler impostor = new ActionGestureHandler() {
            @Override public String action() { return "acknowledge"; }
            @Override public Set<ActionItemKind> kinds() {
                return Set.of(ActionItemKind.NOISE_ALERT_UNACKNOWLEDGED);
            }
            @Override public void handle(GestureContext context) { }
        };

        assertThatThrownBy(() -> new ActionItemActionService(
                new ActionItemLoader(actionItemRepository),
                mock(StringRedisTemplate.class),
                List.of(new AcknowledgeNoiseAlertHandler(noiseAlertService), impostor)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("acknowledge");
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
    void whenAssigningWithoutChoosingATeam_thenNothingIsAssigned() {
        // Le bouton est cense etre desactive tant qu'aucune equipe n'est
        // choisie ; le serveur ne s'en remet pas a l'ecran pour autant.
        queueHolds(ActionItemKind.INTERVENTION_UNASSIGNED, 55L, ORG);

        assertThatThrownBy(() -> service.act(41L, ORG, "assign", null, jwt))
                .isInstanceOf(IllegalStateException.class);

        verifyNoInteractions(interventionService);
    }

    @Test
    void whenAssigningATeam_thenItReachesTheInterventionService() {
        queueHolds(ActionItemKind.INTERVENTION_UNASSIGNED, 55L, ORG);

        service.act(41L, ORG, "assign", 3L, jwt);

        verify(interventionService).assign(55L, null, 3L, jwt);
    }

    @Test
    void whenCancellingAnIntervention_thenItGoesThroughTheLifecycleGuards() {
        // `updateStatus` refuse l'annulation aux roles non plateforme : le geste
        // ne doit pas court-circuiter cette regle en ecrivant le statut lui-meme.
        queueHolds(ActionItemKind.INTERVENTION_OVERDUE, 73L, ORG);

        service.act(41L, ORG, "cancelIntervention", jwt);

        verify(interventionLifecycleService).updateStatus(73L, "CANCELLED", jwt);
    }

    @Test
    void whenReschedulingWithoutADate_thenTheServiceRefuses() {
        queueHolds(ActionItemKind.INTERVENTION_OVERDUE, 73L, ORG);

        service.act(41L, ORG, "rescheduleIntervention", null, null, jwt);

        // La date nulle est refusee par le service de cycle de vie, pas ici :
        // c'est lui qui porte la regle, et il la porte pour tous ses appelants.
        verify(interventionLifecycleService).reschedule(73L, null, jwt);
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
