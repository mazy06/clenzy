package com.clenzy.service.agent;

import com.clenzy.model.AgentPendingAction;
import com.clenzy.repository.AgentPendingActionRepository;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Strict, read-only restoration. Redis absence is never an execution proof. */
@Service
public class BaitlyChatRecoveryService {
    private final AgentPendingActionRepository pending;
    private final AssistantConversationRepository conversations;
    private final AssistantMessageRepository messages;
    private final AgentRunRepository runs;
    private final PendingToolStore store;

    public BaitlyChatRecoveryService(AgentPendingActionRepository pending,
            AssistantConversationRepository conversations, AssistantMessageRepository messages,
            AgentRunRepository runs, PendingToolStore store) {
        this.pending = pending; this.conversations = conversations; this.messages = messages;
        this.runs = runs; this.store = store;
    }

    public record Action(String toolCallId, String toolName, String description,
                         Instant expiresAt, boolean resumable) {}
    public record Recovery(int version, String resumePolicy, Long conversationId,
                           boolean canStart, List<Action> actions) {}

    @Transactional(readOnly = true)
    public Recovery read(Long conversationId, String userId, Long organizationId) {
        var conversation = conversations.findByIdAndUser(conversationId, userId)
                .orElseThrow(() -> new AccessDeniedException("Conversation unavailable"));
        if (!organizationId.equals(conversation.getOrganizationId()) || conversation.getArchivedAt() != null) {
            throw new AccessDeniedException("Conversation unavailable");
        }
        var rows = pending.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(
                organizationId, userId, conversationId);
        Instant now = Instant.now();
        var actions = rows.stream()
                .filter(a -> AgentPendingAction.STATUS_PENDING.equals(a.getStatus()) && now.isBefore(a.getExpiresAt()))
                .map(a -> new Action(a.getToolCallId(), a.getToolName(), a.getDescription(), a.getExpiresAt(), store.canResume(a)))
                .toList();
        // Empty pending alone is NOT evidence that a previous request never ran.
        // Only an untouched conversation may start without reviewing server history.
        boolean canStart = rows.isEmpty()
                && !messages.existsByOrganizationIdAndConversationId(organizationId, conversationId)
                && !runs.existsByOrganizationIdAndConversationId(organizationId, conversationId);
        return new Recovery(1, "durable-decision-v1", conversationId, canStart, actions);
    }
}
