package com.clenzy.service.agent;

import com.clenzy.dto.AgentRunReplayDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.AgentRun;
import com.clenzy.model.AgentStep;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AgentStepRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

/**
 * Replay d'un run (T-05) : ownership org valide explicitement (AgentRun n'a pas
 * de filtre tenant Hibernate — c'est CE service qui porte la garde), 404 sur
 * run inconnu, steps ordonnes mappes.
 */
@ExtendWith(MockitoExtension.class)
class AgentRunQueryServiceTest {

    @Mock private AgentRunRepository runRepository;
    @Mock private AgentStepRepository stepRepository;
    @Mock private OrganizationAccessGuard organizationAccessGuard;

    private AgentRunQueryService service() {
        return new AgentRunQueryService(runRepository, stepRepository, organizationAccessGuard);
    }

    @Test
    void unknownRun_throwsNotFound() {
        UUID runId = UUID.randomUUID();
        when(runRepository.findById(runId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().getReplay(runId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void crossOrgRun_throwsAccessDenied_fromGuard() {
        UUID runId = UUID.randomUUID();
        when(runRepository.findById(runId))
                .thenReturn(Optional.of(new AgentRun(runId, 99L, "kc-x", null, "chat")));
        doThrow(new AccessDeniedException("cross-org"))
                .when(organizationAccessGuard).requireSameOrganization(eq(99L), anyString());

        assertThatThrownBy(() -> service().getReplay(runId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void ownRun_returnsRunWithOrderedSteps() {
        UUID runId = UUID.randomUUID();
        when(runRepository.findById(runId))
                .thenReturn(Optional.of(new AgentRun(runId, 42L, "kc-1", 7L, "chat")));
        when(stepRepository.findByRunIdOrderByStepSeqAsc(runId)).thenReturn(List.of(
                new AgentStep(runId, 1, AgentStep.KIND_LLM_CALL, "mono", null, "tool_use",
                        AgentStep.STATUS_SUCCESS, "claude-sonnet-4", 100, 20, 0),
                new AgentStep(runId, 2, AgentStep.KIND_TOOL_CALL, "mono", "list_reservations",
                        null, AgentStep.STATUS_SUCCESS, null, 0, 0, 0)));

        AgentRunReplayDto replay = service().getReplay(runId);

        assertThat(replay.runId()).isEqualTo(runId);
        assertThat(replay.conversationId()).isEqualTo(7L);
        assertThat(replay.steps()).hasSize(2);
        assertThat(replay.steps().get(0).kind()).isEqualTo(AgentStep.KIND_LLM_CALL);
        assertThat(replay.steps().get(1).toolName()).isEqualTo("list_reservations");
    }
}
