package com.clenzy.service.agent;

import com.clenzy.dto.AgentRunReplayDto;
import com.clenzy.model.AgentRun;
import com.clenzy.model.AgentStep;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AgentStepRepository;
import com.clenzy.exception.NotFoundException;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Lecture des runs d'agents pour le replay Constellation (campagne T-05).
 *
 * <p>{@link AgentRun} n'a pas de filtre tenant Hibernate : l'ownership est
 * valide ICI, explicitement, pour chaque acces (pattern requireSameOrganization
 * — bypass platform staff inclus via {@link OrganizationAccessGuard}).</p>
 */
@Service
public class AgentRunQueryService {

    private final AgentRunRepository runRepository;
    private final AgentStepRepository stepRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public AgentRunQueryService(AgentRunRepository runRepository,
                                AgentStepRepository stepRepository,
                                OrganizationAccessGuard organizationAccessGuard) {
        this.runRepository = runRepository;
        this.stepRepository = stepRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Run + etapes ordonnees. {@link NotFoundException} si inconnu (→ 404),
     * {@code AccessDeniedException} si cross-org (→ 403).
     */
    @Transactional(readOnly = true)
    public AgentRunReplayDto getReplay(UUID runId) {
        AgentRun run = runRepository.findById(runId)
                .orElseThrow(() -> new NotFoundException("Run inconnu : " + runId));
        organizationAccessGuard.requireSameOrganization(run.getOrganizationId(), "agent_run");
        var steps = stepRepository.findByRunIdOrderByStepSeqAsc(runId).stream()
                .map(AgentRunQueryService::toStepDto)
                .toList();
        return new AgentRunReplayDto(run.getId(), run.getConversationId(), run.getOrigin(),
                run.getStatus(), run.getError(), run.getStartedAt(), run.getFinishedAt(), steps);
    }

    private static AgentRunReplayDto.StepDto toStepDto(AgentStep s) {
        return new AgentRunReplayDto.StepDto(s.getStepSeq(), s.getKind(), s.getAgent(),
                s.getToolName(), s.getDetail(), s.getStatus(), s.getModel(),
                s.getPromptTokens(), s.getCompletionTokens(), s.getCachedPromptTokens(),
                s.getCreatedAt());
    }
}
