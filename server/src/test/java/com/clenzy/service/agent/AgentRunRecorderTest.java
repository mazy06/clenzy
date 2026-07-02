package com.clenzy.service.agent;

import com.clenzy.model.AgentRun;
import com.clenzy.model.AgentStep;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AgentStepRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Trace de run (T-05) : cycle startRun → steps sequences → finishRun,
 * statut PAUSED si une pause HITL a ete enregistree, no-op hors run actif,
 * et nettoyage du ThreadLocal apres cloture.
 *
 * <p>Executor synchrone ({@code Runnable::run}) : en production les ecritures
 * partent sur un thread dedie best-effort ; ici on veut des assertions
 * deterministes.</p>
 */
@ExtendWith(MockitoExtension.class)
class AgentRunRecorderTest {

    @Mock private AgentRunRepository runRepository;
    @Mock private AgentStepRepository stepRepository;

    private AgentRunRecorder recorder;

    private AgentRunRecorder recorder() {
        if (recorder == null) {
            recorder = new AgentRunRecorder(runRepository, stepRepository, Runnable::run);
        }
        return recorder;
    }

    @AfterEach
    void cleanupThreadLocal() {
        if (recorder != null) {
            recorder.finishRun(null); // no-op si deja clos — protege les tests suivants du thread
        }
    }

    @Test
    void startRun_persistsRunningRun_andExposesRunId() {
        UUID runId = recorder().startRun(42L, "kc-1", 7L, "chat");

        assertThat(runId).isNotNull();
        assertThat(recorder().currentRunId()).isEqualTo(runId);
        ArgumentCaptor<AgentRun> captor = ArgumentCaptor.forClass(AgentRun.class);
        verify(runRepository).save(captor.capture());
        AgentRun run = captor.getValue();
        assertThat(run.getId()).isEqualTo(runId);
        assertThat(run.getOrganizationId()).isEqualTo(42L);
        assertThat(run.getStatus()).isEqualTo(AgentRun.STATUS_RUNNING);
        assertThat(run.getOrigin()).isEqualTo("chat");
    }

    @Test
    void steps_areSequencedFromOne() {
        UUID runId = recorder().startRun(42L, "kc-1", 7L, "chat");
        recorder().recordLlmStep("mono", "claude-sonnet-4", 100, 20, 5, "tool_use");
        recorder().recordToolStep("mono", "list_reservations", true);
        recorder().recordDelegationStep("finance", "bilan du mois", 500, 80, true);

        ArgumentCaptor<AgentStep> captor = ArgumentCaptor.forClass(AgentStep.class);
        verify(stepRepository, org.mockito.Mockito.times(3)).save(captor.capture());
        var steps = captor.getAllValues();
        assertThat(steps).extracting(AgentStep::getStepSeq).containsExactly(1, 2, 3);
        assertThat(steps).allSatisfy(s -> assertThat(s.getRunId()).isEqualTo(runId));
        assertThat(steps.get(0).getKind()).isEqualTo(AgentStep.KIND_LLM_CALL);
        assertThat(steps.get(0).getCachedPromptTokens()).isEqualTo(5);
        assertThat(steps.get(1).getToolName()).isEqualTo("list_reservations");
        assertThat(steps.get(2).getAgent()).isEqualTo("specialist:finance");
    }

    @Test
    void finishRun_completed_whenNoErrorNoPause() {
        UUID runId = recorder().startRun(42L, "kc-1", 7L, "chat");
        AgentRun stored = new AgentRun(runId, 42L, "kc-1", 7L, "chat");
        when(runRepository.findById(runId)).thenReturn(Optional.of(stored));

        recorder().finishRun(null);

        assertThat(stored.getStatus()).isEqualTo(AgentRun.STATUS_COMPLETED);
        assertThat(stored.getFinishedAt()).isNotNull();
        assertThat(recorder().currentRunId()).isNull(); // ThreadLocal nettoye
    }

    @Test
    void finishRun_paused_whenPauseRecorded() {
        UUID runId = recorder().startRun(42L, "kc-1", 7L, "chat");
        recorder().recordPause("mono", "cancel_reservation");
        AgentRun stored = new AgentRun(runId, 42L, "kc-1", 7L, "chat");
        when(runRepository.findById(runId)).thenReturn(Optional.of(stored));

        recorder().finishRun(null);

        assertThat(stored.getStatus()).isEqualTo(AgentRun.STATUS_PAUSED);
    }

    @Test
    void finishRun_error_takesPrecedence() {
        UUID runId = recorder().startRun(42L, "kc-1", 7L, "chat");
        AgentRun stored = new AgentRun(runId, 42L, "kc-1", 7L, "chat");
        when(runRepository.findById(runId)).thenReturn(Optional.of(stored));

        recorder().finishRun("boom");

        assertThat(stored.getStatus()).isEqualTo(AgentRun.STATUS_ERROR);
        assertThat(stored.getError()).isEqualTo("boom");
    }

    @Test
    void withoutActiveRun_stepsAndFinishAreNoOps() {
        recorder().recordLlmStep("mono", "m", 1, 1, 0, "stop");
        recorder().recordToolStep("mono", "t", true);
        recorder().finishRun(null);

        verify(stepRepository, never()).save(any());
        verify(runRepository, never()).save(any());
        assertThat(recorder().currentRunId()).isNull();
    }

    @Test
    void repositoryFailure_isSwallowed_neverPropagates() {
        when(runRepository.save(any())).thenThrow(new RuntimeException("db down"));

        // startRun ne doit pas lever malgre l'echec d'ecriture (best-effort).
        UUID runId = recorder().startRun(42L, "kc-1", 7L, "chat");

        assertThat(runId).isNotNull();
        assertThat(recorder().currentRunId()).isEqualTo(runId);
    }
}
