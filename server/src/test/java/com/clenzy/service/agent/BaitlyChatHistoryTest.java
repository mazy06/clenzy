package com.clenzy.service.agent;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BaitlyChatHistoryTest {
    private final AgentPendingActionRepository pending = mock(AgentPendingActionRepository.class);
    private final AssistantConversationRepository conversations = mock(AssistantConversationRepository.class);
    private final AssistantMessageRepository messages = mock(AssistantMessageRepository.class);
    private final AgentRunRepository runs = mock(AgentRunRepository.class);
    private final PendingToolStore store = new PendingToolStore(null, new ObjectMapper(), pending, messages);
    private final BaitlyChatRecoveryService service = new BaitlyChatRecoveryService(pending, conversations, messages, runs, store);

    @BeforeEach void owned() {
        when(conversations.findByIdAndUser(9L, "recipe-user"))
                .thenReturn(Optional.of(new AssistantConversation(7L, "recipe-user")));
    }
    private AgentPendingAction action(String status) {
        var row = new AgentPendingAction("fixture", 7L, "recipe-user", 9L, "synthetic_tool",
                "private-args-canary", "Synthetic action", null, false, "[]", Instant.now().plusSeconds(600));
        if (!"PENDING".equals(status)) row.resolve(status);
        when(pending.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(7L,"recipe-user",9L))
                .thenReturn(List.of(row));
        when(pending.findById("fixture")).thenReturn(Optional.of(row));
        return row;
    }
    private AssistantMessage result(long id, String content) {
        var result = AssistantMessage.tool(9L, 7L, "fixture", content); result.setId(id); return result;
    }
    private void history(AssistantMessage... rows) {
        when(messages.findByOrganizationIdAndConversationIdOrderByCreatedAtAscIdAsc(7L,9L)).thenReturn(List.of(rows));
    }
    private BaitlyChatRecoveryService.Recovery read() { return service.read(9L, "recipe-user", 7L); }

    @Test void restoresTextAndStableIdsWithoutArgumentsAttachmentUrlsOrRawToolPayloads() throws Exception {
        action("CONFIRMED");
        var question = AssistantMessage.user(9L,7L,"Question de recette", "[{\"url\":\"private-url-canary\"}]"); question.setId(1L);
        var answer = AssistantMessage.assistant(9L,7L,"Réponse العربية", "private-history-canary"); answer.setId(2L);
        history(question,answer,result(3,"private-result-canary"));
        var proof = read();
        assertThat(proof.history()).extracting(BaitlyChatRecoveryService.HistoryEntry::id)
                .containsExactly("history-1","history-2","history-3");
        assertThat(proof.history().getFirst().hasAttachments()).isTrue();
        assertThat(proof.history().getLast().content()).isNull();
        String json = new ObjectMapper().findAndRegisterModules().writeValueAsString(proof);
        assertThat(json).contains("Question de recette", "Réponse العربية")
                .doesNotContain("private-args-canary","private-url-canary","private-history-canary","private-result-canary");
        assertThat(proof.canStart()).isFalse();
        verify(pending,never()).claimDecision(any(),any(),any(),any(),any());
    }
    @Test void pendingWithRecordedResultIsConflictAndNeverOfferedForResume() {
        action("PENDING"); history(result(1,"Synthetic result"));
        var proof = read();
        assertThat(proof.actions()).isEmpty();
        assertThat(proof.reconciliation().getFirst().evidence()).isEqualTo(BaitlyChatRecoveryService.Evidence.CONFLICT);
    }
    @Test void confirmedWithoutResultRemainsUncertainEvenWhenTraceExists() {
        action("CONFIRMED");
        when(runs.existsByOrganizationIdAndConversationId(7L,9L)).thenReturn(true);
        var proof = read();
        assertThat(proof.reconciliation().getFirst().evidence()).isEqualTo(BaitlyChatRecoveryService.Evidence.UNCERTAIN);
        assertThat(proof.canStart()).isFalse(); assertThat(proof.actions()).isEmpty();
    }
    @Test void recordedResultIsOnlyPresenceEvidenceNotSuccessAndDuplicatesConflict() {
        action("CONFIRMED"); history(result(1,"Synthetic error or success, neither inferred"));
        var proof = read();
        assertThat(proof.reconciliation().getFirst().evidence()).isEqualTo(BaitlyChatRecoveryService.Evidence.RESULT_RECORDED);
        assertThat(proof.reconciliation().getFirst().resultMessageId()).isEqualTo("history-1");
        assertThat(proof.canStart()).isFalse();
        history(result(1,"Synthetic result"),result(2,"Synthetic result"));
        assertThat(read().reconciliation().getFirst().evidence()).isEqualTo(BaitlyChatRecoveryService.Evidence.CONFLICT);
    }
    @Test void declinedAndBlankResultsDoNotBecomeProofOfExternalSuccess() {
        action("REFUSED"); history(result(1,"Synthetic refusal"));
        assertThat(read().reconciliation().getFirst().evidence()).isEqualTo(BaitlyChatRecoveryService.Evidence.DECLINED);
        action("CONFIRMED"); history(result(1," "));
        assertThat(read().reconciliation().getFirst().evidence()).isEqualTo(BaitlyChatRecoveryService.Evidence.UNCERTAIN);
    }
    @Test void rejectsForeignAndDuplicateHistoryBeforeReturningContent() {
        var foreign = result(1,"private-foreign-canary"); foreign.setOrganizationId(8L); history(foreign);
        assertThatThrownBy(this::read).hasMessage("Baitly chat history unavailable");
        history(result(1,"Synthetic result"),result(1,"Synthetic duplicate"));
        assertThatThrownBy(this::read).hasMessage("Baitly chat history unavailable");
    }
    @Test void productionResumeBlocksAnyRecordedResultBeforeClaimingOrReturningTool() {
        action("PENDING");
        when(messages.existsByOrganizationIdAndConversationIdAndRoleAndToolCallId(7L,9L,"tool","fixture")).thenReturn(true);
        assertThat(store.consume("fixture","recipe-user",7L,true)).isEmpty();
        verify(pending,never()).claimDecision(any(),any(),any(),any(),any());
    }
    @Test void resultLookupOutageDoesNotPermitExecution() {
        action("PENDING");
        when(messages.existsByOrganizationIdAndConversationIdAndRoleAndToolCallId(7L,9L,"tool","fixture"))
                .thenThrow(new IllegalStateException("private-storage-canary"));
        assertThat(store.consume("fixture","recipe-user",7L,true)).isEmpty();
        verify(pending,never()).claimDecision(any(),any(),any(),any(),any());
    }
    @Test void missingResultStillRequiresWinningDurableDecisionForNormalResume() {
        action("PENDING");
        when(pending.claimDecision(eq("fixture"),eq(7L),eq("recipe-user"),eq("CONFIRMED"),any())).thenReturn(1);
        assertThat(store.consume("fixture","recipe-user",7L,true)).isPresent();
        verify(messages).existsByOrganizationIdAndConversationIdAndRoleAndToolCallId(7L,9L,"tool","fixture");
        verify(pending).claimDecision(eq("fixture"),eq(7L),eq("recipe-user"),eq("CONFIRMED"),any());
    }
}
