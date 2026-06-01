package com.clenzy.service;

import com.clenzy.config.SyncMetrics;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link OutboxRelay}.
 *
 * <p>On utilise un vrai {@link ObjectMapper} pour eviter de mocker readValue,
 * un vrai {@link SyncMetrics} (avec {@link SimpleMeterRegistry}) pour observer
 * les timers, et on mocke le repository + le KafkaTemplate.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OutboxRelay")
class OutboxRelayTest {

    @Mock private OutboxEventRepository repo;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;

    private ObjectMapper objectMapper;
    private SyncMetrics syncMetrics;
    private OutboxRelay relay;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        MeterRegistry registry = new SimpleMeterRegistry();
        syncMetrics = new SyncMetrics(registry);
        relay = new OutboxRelay(repo, kafkaTemplate, objectMapper, syncMetrics);
    }

    private OutboxEvent event(Long id, String topic, String partitionKey, String payload) {
        OutboxEvent e = new OutboxEvent();
        e.setId(id);
        e.setTopic(topic);
        e.setPartitionKey(partitionKey);
        e.setPayload(payload);
        return e;
    }

    private CompletableFuture<SendResult<String, Object>> okFuture() {
        @SuppressWarnings("unchecked")
        SendResult<String, Object> result = mock(SendResult.class);
        return CompletableFuture.completedFuture(result);
    }

    private CompletableFuture<SendResult<String, Object>> errorFuture(String message) {
        CompletableFuture<SendResult<String, Object>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new ExecutionException(new RuntimeException(message)));
        return failed;
    }

    // ─── relayPendingEvents ─────────────────────────────────────────────────

    @Test
    @DisplayName("relayPendingEvents: aucune event PENDING -> ne fait rien (early return)")
    void relayPending_empty() {
        when(repo.findPendingEvents()).thenReturn(List.of());

        relay.relayPendingEvents();

        verify(repo, never()).markAsSent(any(), any());
        verify(repo, never()).markAsFailed(any(), any());
    }

    @Test
    @DisplayName("relayPendingEvents: send OK -> markAsSent + payload Map deserialise")
    void relayPending_sendOk_marksAsSent() {
        OutboxEvent e = event(1L, "topic-1", "key-1", "{\"foo\":\"bar\"}");
        when(repo.findPendingEvents()).thenReturn(List.of(e));
        when(kafkaTemplate.send(eq("topic-1"), eq("key-1"), any())).thenReturn(okFuture());

        relay.relayPendingEvents();

        verify(kafkaTemplate).send(eq("topic-1"), eq("key-1"), any());
        verify(repo).markAsSent(eq(1L), any(LocalDateTime.class));
        verify(repo, never()).markAsFailed(any(), any());
    }

    @Test
    @DisplayName("relayPendingEvents: payload non-JSON -> fallback string brut + markAsSent")
    void relayPending_nonJsonPayload_fallbacksToString() {
        OutboxEvent e = event(2L, "topic-x", "key-x", "not a json !!");
        when(repo.findPendingEvents()).thenReturn(List.of(e));
        when(kafkaTemplate.send(eq("topic-x"), eq("key-x"), any())).thenReturn(okFuture());

        relay.relayPendingEvents();

        verify(kafkaTemplate).send(eq("topic-x"), eq("key-x"), any());
        verify(repo).markAsSent(eq(2L), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("relayPendingEvents: send fail -> markAsFailed avec message tronque")
    void relayPending_sendFail_marksAsFailed() {
        OutboxEvent e = event(3L, "topic-fail", "key-fail", "{}");
        when(repo.findPendingEvents()).thenReturn(List.of(e));
        when(kafkaTemplate.send(eq("topic-fail"), eq("key-fail"), any()))
            .thenReturn(errorFuture("broker down"));

        relay.relayPendingEvents();

        verify(repo).markAsFailed(eq(3L), org.mockito.ArgumentMatchers.contains("broker down"));
        verify(repo, never()).markAsSent(any(), any());
    }

    @Test
    @DisplayName("relayPendingEvents: send fail avec message > 500 chars -> tronque a 500")
    void relayPending_truncatesLongErrorMessage() {
        OutboxEvent e = event(4L, "t", "k", "{}");
        when(repo.findPendingEvents()).thenReturn(List.of(e));
        String longMsg = "x".repeat(600);
        when(kafkaTemplate.send(eq("t"), eq("k"), any())).thenReturn(errorFuture(longMsg));

        relay.relayPendingEvents();

        // Le code tronque a 500 chars max.
        org.mockito.ArgumentCaptor<String> captor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(repo).markAsFailed(eq(4L), captor.capture());
        assertThat(captor.getValue().length()).isLessThanOrEqualTo(500);
    }

    @Test
    @DisplayName("relayPendingEvents: send fail sans message -> utilise className")
    void relayPending_failWithoutMessage_usesClassName() {
        OutboxEvent e = event(5L, "t", "k", "{}");
        when(repo.findPendingEvents()).thenReturn(List.of(e));

        CompletableFuture<SendResult<String, Object>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new ExecutionException(new IllegalStateException((String) null)));
        when(kafkaTemplate.send(eq("t"), eq("k"), any())).thenReturn(failed);

        relay.relayPendingEvents();

        org.mockito.ArgumentCaptor<String> captor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(repo).markAsFailed(eq(5L), captor.capture());
        // Le message recupere par OutboxRelay est celui du ExecutionException, sinon le className.
        assertThat(captor.getValue()).isNotBlank();
    }

    @Test
    @DisplayName("relayPendingEvents: plusieurs events -> traite chacun individuellement")
    void relayPending_multipleEvents() {
        OutboxEvent a = event(10L, "t1", "k1", "{\"a\":1}");
        OutboxEvent b = event(11L, "t2", "k2", "{\"b\":2}");
        when(repo.findPendingEvents()).thenReturn(List.of(a, b));
        when(kafkaTemplate.send(any(String.class), any(String.class), any())).thenReturn(okFuture());

        relay.relayPendingEvents();

        verify(kafkaTemplate, times(2)).send(any(String.class), any(String.class), any());
        verify(repo).markAsSent(eq(10L), any(LocalDateTime.class));
        verify(repo).markAsSent(eq(11L), any(LocalDateTime.class));
    }

    // ─── retryFailedEvents ──────────────────────────────────────────────────

    @Test
    @DisplayName("retryFailedEvents: aucune event FAILED -> early return")
    void retryFailed_empty() {
        when(repo.findRetryableEvents(5)).thenReturn(List.of());

        relay.retryFailedEvents();

        verify(repo, never()).markAsSent(any(), any());
    }

    @Test
    @DisplayName("retryFailedEvents: retry success -> markAsSent")
    void retryFailed_retrySucceeds() {
        OutboxEvent e = event(20L, "topic-r", "k", "{}");
        when(repo.findRetryableEvents(5)).thenReturn(List.of(e));
        when(kafkaTemplate.send(eq("topic-r"), eq("k"), any())).thenReturn(okFuture());

        relay.retryFailedEvents();

        verify(repo).markAsSent(eq(20L), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("retryFailedEvents: retry fail -> markAsFailed (compteur d'attempts gere par le repo)")
    void retryFailed_retryFailsAgain() {
        OutboxEvent e = event(21L, "t", "k", "{}");
        when(repo.findRetryableEvents(5)).thenReturn(List.of(e));
        when(kafkaTemplate.send(eq("t"), eq("k"), any())).thenReturn(errorFuture("still down"));

        relay.retryFailedEvents();

        verify(repo).markAsFailed(eq(21L), org.mockito.ArgumentMatchers.contains("still down"));
    }

    // ─── cleanupSentEvents ──────────────────────────────────────────────────

    @Test
    @DisplayName("cleanupSentEvents: 0 supprime -> pas de log info")
    void cleanup_nothingDeleted() {
        when(repo.deleteSentBefore(any(LocalDateTime.class))).thenReturn(0);

        relay.cleanupSentEvents();

        verify(repo).deleteSentBefore(any(LocalDateTime.class));
    }

    @Test
    @DisplayName("cleanupSentEvents: > 0 supprime -> log au niveau info")
    void cleanup_someDeleted() {
        when(repo.deleteSentBefore(any(LocalDateTime.class))).thenReturn(42);

        relay.cleanupSentEvents();

        verify(repo).deleteSentBefore(any(LocalDateTime.class));
    }
}
