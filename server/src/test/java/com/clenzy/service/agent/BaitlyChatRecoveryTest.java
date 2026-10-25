package com.clenzy.service.agent;

import com.clenzy.model.AgentPendingAction;
import com.clenzy.model.AssistantConversation;
import com.clenzy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BaitlyChatRecoveryTest {
    private final AgentPendingActionRepository repository = mock(AgentPendingActionRepository.class);
    private final AssistantConversationRepository conversations = mock(AssistantConversationRepository.class);
    private final AssistantMessageRepository messages = mock(AssistantMessageRepository.class);
    private final AgentRunRepository runs = mock(AgentRunRepository.class);
    private final PendingToolStore store = new PendingToolStore(null, new ObjectMapper(), repository);
    private final BaitlyChatRecoveryService service = new BaitlyChatRecoveryService(repository, conversations, messages, runs, store);
    private AgentPendingAction row(String id) {
        return new AgentPendingAction(id, 7L, "synthetic-user", 9L, "synthetic_tool", "{}",
                "Synthetic action", null, false, "[]", Instant.now().plusSeconds(600));
    }
    private void owned() {
        when(conversations.findByIdAndUser(9L, "synthetic-user"))
                .thenReturn(Optional.of(new AssistantConversation(7L, "synthetic-user")));
    }
    @Test void restoresPendingFromJournalWithoutConsumingOrClaiming() {
        owned();
        var pending = row("fixture");
        when(repository.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(7L,"synthetic-user",9L))
                .thenReturn(List.of(pending));
        var proof = service.read(9L,"synthetic-user",7L);
        assertThat(proof.resumePolicy()).isEqualTo("durable-decision-v1");
        assertThat(proof.actions()).hasSize(1);
        assertThat(proof.actions().getFirst().resumable()).isTrue();
        assertThat(proof.canStart()).isFalse();
        verify(repository, never()).claimDecision(any(),any(),any(),any(),any());
        assertThat(pending.getStatus()).isEqualTo("PENDING");
    }
    @Test void recordedDecisionIsNotShownAsPendingOrProofOfSuccessfulExecution() {
        owned(); var decided = row("decided"); decided.resolve("CONFIRMED");
        when(repository.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(7L,"synthetic-user",9L))
                .thenReturn(List.of(decided));
        var proof = service.read(9L,"synthetic-user",7L);
        assertThat(proof.actions()).isEmpty(); assertThat(proof.canStart()).isFalse();
    }
    @Test void emptyPendingDoesNotClearHistoryOrRunUncertainty() {
        owned();
        when(messages.existsByOrganizationIdAndConversationId(7L,9L)).thenReturn(true);
        assertThat(service.read(9L,"synthetic-user",7L).canStart()).isFalse();
        when(messages.existsByOrganizationIdAndConversationId(7L,9L)).thenReturn(false);
        when(runs.existsByOrganizationIdAndConversationId(7L,9L)).thenReturn(true);
        assertThat(service.read(9L,"synthetic-user",7L).canStart()).isFalse();
    }
    @Test void untouchedOwnedConversationCanStartButStorageFailureIsNotEmptyProof() {
        owned(); assertThat(service.read(9L,"synthetic-user",7L).canStart()).isTrue();
        when(repository.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(7L,"synthetic-user",9L))
                .thenThrow(new IllegalStateException("synthetic-private-storage-detail"));
        assertThatThrownBy(() -> service.read(9L,"synthetic-user",7L)).isInstanceOf(IllegalStateException.class);
    }
    @Test void deniesForeignUserAndOrganizationBeforeReadingJournal() {
        assertThatThrownBy(() -> service.read(9L,"foreign",7L)).isInstanceOf(AccessDeniedException.class);
        owned(); assertThatThrownBy(() -> service.read(9L,"synthetic-user",8L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(repository);
    }
    @Test void coldMultiAgentWithoutContextIsVisibleButNotResumable() {
        owned();
        var multi = new AgentPendingAction("multi",7L,"synthetic-user",9L,"synthetic_tool","{}",null,"fixture",true,null,Instant.now().plusSeconds(600));
        when(repository.findByOrganizationIdAndKeycloakUserIdAndConversationIdOrderByCreatedAtAsc(7L,"synthetic-user",9L))
                .thenReturn(List.of(multi));
        assertThat(service.read(9L,"synthetic-user",7L).actions().getFirst().resumable()).isFalse();
    }
    @Test void durableDecisionAdmitsOnlyOneRecoveryAcrossStoreInstances() {
        var pending = row("fixture");
        when(repository.findById("fixture")).thenReturn(Optional.of(pending));
        var won = new AtomicBoolean();
        when(repository.claimDecision(eq("fixture"),eq(7L),eq("synthetic-user"),eq("CONFIRMED"),any()))
                .thenAnswer(call -> won.compareAndSet(false,true) ? 1 : 0);
        assertThat(store.consume("fixture","synthetic-user",7L,true)).isPresent();
        var rebooted = new PendingToolStore(null,new ObjectMapper(),repository);
        assertThat(rebooted.consume("fixture","synthetic-user",7L,true)).isEmpty();
    }
    @Test void ambiguousClaimNeverReturnsAToolForExecution() {
        when(repository.findById("fixture")).thenReturn(Optional.of(row("fixture")));
        when(repository.claimDecision(any(),any(),any(),any(),any())).thenThrow(new IllegalStateException("synthetic-private-payload"));
        assertThat(store.consume("fixture","synthetic-user",7L,true)).isEmpty();
    }
    @Test void scopeAndExpiryAreCheckedBeforeClaim() {
        when(repository.findById("fixture")).thenReturn(Optional.of(row("fixture")));
        assertThat(store.consume("fixture","foreign",7L,true)).isEmpty();
        assertThat(store.consume("fixture","synthetic-user",8L,true)).isEmpty();
        var expired = new AgentPendingAction("expired",7L,"synthetic-user",9L,"synthetic_tool","{}",null,null,false,"[]",Instant.now().minusSeconds(1));
        when(repository.findById("expired")).thenReturn(Optional.of(expired));
        assertThat(store.consume("expired","synthetic-user",7L,true)).isEmpty();
        verify(repository,never()).claimDecision(any(),any(),any(),any(),any());
    }
}
