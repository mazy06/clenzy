package com.clenzy.service.agent;

import com.clenzy.model.AgentPendingAction;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AgentPendingActionRepository;
import com.clenzy.repository.AgentRunRepository;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.stream.Collectors;

/** Strict, read-only restoration. Redis absence is never an execution proof. */
@Service
public class BaitlyChatRecoveryService {
    private final AgentPendingActionRepository pending;
    private final AssistantConversationRepository conversations;
    private final AssistantMessageRepository messages;
    private final AgentRunRepository runs;
    private final PendingToolStore store;
    private final BaitlyChatCompletionJournal completionJournal;

    @org.springframework.beans.factory.annotation.Autowired
    public BaitlyChatRecoveryService(AgentPendingActionRepository pending,
            AssistantConversationRepository conversations, AssistantMessageRepository messages,
            AgentRunRepository runs, PendingToolStore store, BaitlyChatCompletionJournal completionJournal) {
        this.pending = pending; this.conversations = conversations; this.messages = messages;
        this.runs = runs; this.store = store;
        this.completionJournal=completionJournal;
    }
    public BaitlyChatRecoveryService(AgentPendingActionRepository pending,
            AssistantConversationRepository conversations, AssistantMessageRepository messages,
            AgentRunRepository runs, PendingToolStore store) {
        this(pending,conversations,messages,runs,store,null);
    }

    public record Action(String toolCallId, String toolName, String description,
                         Instant expiresAt, boolean resumable) {}
    /** Presentation only: no tool arguments, auth or attachment URLs. */
    public record HistoryEntry(String id, String role, String content, String toolCallId,
                               boolean hasAttachments) {}
    public enum Evidence { AWAITING_DECISION, EXPIRED, DECLINED, RESULT_RECORDED, UNCERTAIN, CONFLICT }
    public record Reconciliation(String toolCallId, String toolName, Evidence evidence, String resultMessageId) {}
    public record Recovery(int version, String resumePolicy, Long conversationId,
                           boolean canStart, List<Action> actions, List<HistoryEntry> history,
                           List<Reconciliation> reconciliation, BaitlyChatCompletionJournal.Proof completion,
                           List<BaitlyChatCompletionJournal.ToolEvidence> toolEvidence,
                           List<BaitlyChatCompletionJournal.WriteEvidence> writeEvidence,
                           List<BaitlyChatCompletionJournal.WriteTurnEvidence> writeTurnEvidence) {
        public Recovery(int version,String policy,Long conversation,boolean canStart,List<Action> actions,
                        List<HistoryEntry> history,List<Reconciliation> reconciliation,BaitlyChatCompletionJournal.Proof completion,
                        List<BaitlyChatCompletionJournal.ToolEvidence> tools,List<BaitlyChatCompletionJournal.WriteEvidence> writes) {
            this(version,policy,conversation,canStart,actions,history,reconciliation,completion,tools,writes,List.of());
        }
        public Recovery(int version,String policy,Long conversation,boolean canStart,List<Action> actions,
                        List<HistoryEntry> history,List<Reconciliation> reconciliation,BaitlyChatCompletionJournal.Proof completion,
                        List<BaitlyChatCompletionJournal.ToolEvidence> tools) {
            this(version,policy,conversation,canStart,actions,history,reconciliation,completion,tools,List.of());
        }
        public Recovery(int version, String resumePolicy, Long conversationId, boolean canStart, List<Action> actions,
                        List<HistoryEntry> history, List<Reconciliation> reconciliation,
                        BaitlyChatCompletionJournal.Proof completion) {
            this(version,resumePolicy,conversationId,canStart,actions,history,reconciliation,completion,List.of());
        }
        public Recovery(int version, String resumePolicy, Long conversationId, boolean canStart, List<Action> actions) {
            this(version, resumePolicy, conversationId, canStart, actions, List.of(), List.of(),null,List.of());
        }
    }

    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Recovery read(Long conversationId, String userId, Long organizationId) {
        var conversation = conversations.findByIdAndUser(conversationId, userId)
                .orElseThrow(() -> new AccessDeniedException("Conversation unavailable"));
        if (!organizationId.equals(conversation.getOrganizationId()) || conversation.getArchivedAt() != null) {
            throw new AccessDeniedException("Conversation unavailable");
        }
        var rows = pending.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(
                organizationId, userId, conversationId);
        var history = messages.findByOrganizationIdAndConversationIdOrderByCreatedAtAscIdAsc(organizationId, conversationId);
        var ids = new HashSet<Long>();
        for (var message : history) {
            if (!organizationId.equals(message.getOrganizationId()) || !conversationId.equals(message.getConversationId())
                    || message.getId() == null || !ids.add(message.getId())
                    || message.getRole() == null || !List.of("user", "assistant", "tool").contains(message.getRole())) {
                throw new IllegalStateException("Baitly chat history unavailable");
            }
        }
        Map<String, List<AssistantMessage>> results = history.stream()
                .filter(m -> "tool".equals(m.getRole()) && m.getToolCallId() != null)
                .collect(Collectors.groupingBy(AssistantMessage::getToolCallId));
        Instant now = Instant.now();
        var actions = rows.stream()
                .filter(a -> AgentPendingAction.STATUS_PENDING.equals(a.getStatus()) && now.isBefore(a.getExpiresAt()))
                .filter(a -> !results.containsKey(a.getToolCallId()))
                .map(a -> new Action(a.getToolCallId(), a.getToolName(), a.getDescription(), a.getExpiresAt(), store.canResume(a)))
                .toList();
        // Empty pending alone is NOT evidence that a previous request never ran.
        // Only an untouched conversation may start without reviewing server history.
        var completion=completionJournal==null?null:completionJournal.proof(organizationId,userId,conversationId,history);
        boolean canStart = rows.isEmpty() && ((completion!=null && List.of("SAFE_TEXT","SAFE_TOOLS").contains(completion.status()))
                || (completion==null && history.isEmpty()
                && !messages.existsByOrganizationIdAndConversationId(organizationId, conversationId)
                && !runs.existsByOrganizationIdAndConversationId(organizationId, conversationId)));
        var transcript = history.stream().map(m -> new HistoryEntry("history-" + m.getId(), m.getRole(),
                "tool".equals(m.getRole()) ? null : m.getContent(), m.getToolCallId(),
                m.getAttachments() != null && !"[]".equals(m.getAttachments()))).toList();
        var evidence = rows.stream().map(a -> reconcile(a, results.getOrDefault(a.getToolCallId(), List.of()), now)).toList();
        var toolEvidence=completionJournal==null?List.<BaitlyChatCompletionJournal.ToolEvidence>of()
                :completionJournal.toolEvidence(organizationId,userId,conversationId);
        var writeEvidence=completionJournal==null?List.<BaitlyChatCompletionJournal.WriteEvidence>of()
                :completionJournal.writeEvidence(organizationId,userId,conversationId);
        var writeTurns=completionJournal==null?List.<BaitlyChatCompletionJournal.WriteTurnEvidence>of()
                :completionJournal.writeTurnEvidence(organizationId,userId,conversationId);
        return new Recovery(1, "durable-decision-v1", conversationId, canStart, actions, transcript, evidence,completion,toolEvidence,writeEvidence,writeTurns);
    }

    private Reconciliation reconcile(AgentPendingAction row, List<AssistantMessage> results, Instant now) {
        Evidence evidence;
        if (results.size() > 1 || (!results.isEmpty() && AgentPendingAction.STATUS_PENDING.equals(row.getStatus()))) {
            evidence = Evidence.CONFLICT;
        } else if (AgentPendingAction.STATUS_REFUSED.equals(row.getStatus())) {
            evidence = Evidence.DECLINED;
        } else if (results.size() == 1 && results.getFirst().getContent() != null
                && !results.getFirst().getContent().isBlank()) {
            // A stored result is not proof of external success, regardless of its text.
            evidence = Evidence.RESULT_RECORDED;
        } else if (AgentPendingAction.STATUS_PENDING.equals(row.getStatus()) && now.isBefore(row.getExpiresAt())) {
            evidence = Evidence.AWAITING_DECISION;
        } else if (AgentPendingAction.STATUS_EXPIRED.equals(row.getStatus())
                || AgentPendingAction.STATUS_PENDING.equals(row.getStatus())) {
            evidence = Evidence.EXPIRED;
        } else {
            evidence = Evidence.UNCERTAIN;
        }
        return new Reconciliation(row.getToolCallId(), row.getToolName(), evidence,
                results.size() == 1 ? "history-" + results.getFirst().getId() : null);
    }
}
