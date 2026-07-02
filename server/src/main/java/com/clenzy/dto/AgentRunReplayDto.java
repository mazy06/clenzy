package com.clenzy.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Replay d'un run d'agent (campagne T-05) : le run + ses etapes ordonnees.
 * Shape stable consommee par la Constellation (time-travel).
 */
public record AgentRunReplayDto(
        UUID runId,
        Long conversationId,
        String origin,
        String status,
        String error,
        Instant startedAt,
        Instant finishedAt,
        List<StepDto> steps
) {
    public record StepDto(
            int seq,
            String kind,
            String agent,
            String toolName,
            String detail,
            String status,
            String model,
            int promptTokens,
            int completionTokens,
            int cachedPromptTokens,
            Instant at
    ) {}
}
