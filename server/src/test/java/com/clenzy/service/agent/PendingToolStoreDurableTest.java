package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.MessageAttachment;
import com.clenzy.model.AgentPendingAction;
import com.clenzy.repository.AgentPendingActionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Journal durable des pauses HITL (X1) : persistance a la pause (images
 * strippees, jamais de base64 en DB), reprise post-reboot du flux MONO,
 * refus de reprise multi-agent (etat moteur volatil), outcomes
 * CONFIRMED/REFUSED (donnee X2) et fallback d'affichage sans Redis.
 */
@ExtendWith(MockitoExtension.class)
class PendingToolStoreDurableTest {

    @Mock private AgentPendingActionRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    private PendingToolStore store() {
        return new PendingToolStore(null, objectMapper, repository);
    }

    private static List<ChatMessage> historyWithImage() {
        return List.of(
                ChatMessage.user("voici le frigo",
                        List.of(MessageAttachment.imageBase64("image/jpeg", "QUJD"))),
                ChatMessage.assistant("Le joint est use."));
    }

    @Test
    void put_persistsDurableRow_withStrippedAttachments() {
        store().put("tc-1", 7L, 42L, "kc-1", "cancel_reservation", "{\"id\":3}",
                historyWithImage(), null, "Annuler la reservation");

        ArgumentCaptor<AgentPendingAction> captor = ArgumentCaptor.forClass(AgentPendingAction.class);
        verify(repository).save(captor.capture());
        AgentPendingAction row = captor.getValue();
        assertThat(row.getToolCallId()).isEqualTo("tc-1");
        assertThat(row.getStatus()).isEqualTo(AgentPendingAction.STATUS_PENDING);
        assertThat(row.isMultiAgent()).isFalse();
        // Jamais de base64 en DB : image remplacee par le placeholder T-04.
        assertThat(row.getPayloadHistoryJson()).doesNotContain("QUJD");
        assertThat(row.getPayloadHistoryJson())
                .contains(ConversationHistoryMapper.PAST_IMAGE_PLACEHOLDER);
    }

    @Test
    void consume_memoryMiss_recoversMonoFromDatabase() throws Exception {
        String historyJson = objectMapper.writeValueAsString(
                List.of(ChatMessage.user("annule la resa 3")));
        AgentPendingAction row = new AgentPendingAction("tc-2", 42L, "kc-1", 7L,
                "cancel_reservation", "{\"id\":3}", "desc", null, false,
                historyJson, Instant.now().plusSeconds(600));
        when(repository.findById("tc-2")).thenReturn(Optional.of(row));

        Optional<PendingToolStore.PendingTool> recovered = store().consume("tc-2", "kc-1");

        assertThat(recovered).isPresent();
        assertThat(recovered.get().toolName()).isEqualTo("cancel_reservation");
        assertThat(recovered.get().pendingHistory()).hasSize(1);
        assertThat(recovered.get().isMultiAgent()).isFalse();
        assertThat(recovered.get().organizationId()).isEqualTo(42L);
    }

    @Test
    void consume_recovery_refusesCrossUser() {
        AgentPendingAction row = new AgentPendingAction("tc-3", 42L, "kc-OWNER", 7L,
                "cancel_reservation", "{}", null, null, false,
                "[]", Instant.now().plusSeconds(600));
        when(repository.findById("tc-3")).thenReturn(Optional.of(row));

        assertThat(store().consume("tc-3", "kc-ATTACKER")).isEmpty();
    }

    @Test
    void consume_recovery_refusesMultiAgentRows() {
        AgentPendingAction row = new AgentPendingAction("tc-4", 42L, "kc-1", 7L,
                "block_calendar_day", "{}", null, "operations", true,
                null, Instant.now().plusSeconds(600));
        when(repository.findById("tc-4")).thenReturn(Optional.of(row));

        assertThat(store().consume("tc-4", "kc-1")).isEmpty();
    }

    @Test
    void markResolved_recordsOutcome_forTrustRules() {
        AgentPendingAction row = new AgentPendingAction("tc-5", 42L, "kc-1", 7L,
                "initiate_refund", "{}", null, null, false, "[]",
                Instant.now().plusSeconds(600));
        when(repository.findById("tc-5")).thenReturn(Optional.of(row));

        store().markResolved("tc-5", true);
        assertThat(row.getStatus()).isEqualTo(AgentPendingAction.STATUS_CONFIRMED);
        assertThat(row.getResolvedAt()).isNotNull();

        // Deja resolue : pas de double transition.
        store().markResolved("tc-5", false);
        assertThat(row.getStatus()).isEqualTo(AgentPendingAction.STATUS_CONFIRMED);
    }

    @Test
    void listForUser_withoutRedis_fallsBackToDatabase() {
        AgentPendingAction row = new AgentPendingAction("tc-6", 42L, "kc-1", 7L,
                "send_guest_message", "{\"reservationId\":9}", "Envoyer le message",
                "communication", true, null, Instant.now().plusSeconds(600));
        when(repository.findByKeycloakUserIdAndStatusAndExpiresAtAfterOrderByCreatedAtAsc(
                any(), any(), any())).thenReturn(List.of(row));

        // redisTemplate = null → le journal durable fait autorite (X1) : fin de la
        // « perte silencieuse » relevee par l'audit Phase 0.
        List<PendingActionDto> pending = store().listForUser("kc-1");

        assertThat(pending).hasSize(1);
        assertThat(pending.get(0).toolCallId()).isEqualTo("tc-6");
        assertThat(pending.get(0).specialistName()).isEqualTo("communication");
    }
}
