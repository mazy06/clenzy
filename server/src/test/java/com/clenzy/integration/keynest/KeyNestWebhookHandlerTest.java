package com.clenzy.integration.keynest;

import com.clenzy.model.KeyExchangeCode;
import com.clenzy.model.KeyExchangeCode.CodeStatus;
import com.clenzy.model.KeyExchangeEvent;
import com.clenzy.model.KeyExchangeEvent.EventSource;
import com.clenzy.model.KeyExchangeEvent.EventType;
import com.clenzy.repository.KeyExchangeCodeRepository;
import com.clenzy.repository.KeyExchangeEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KeyNestWebhookHandlerTest {

    @Mock private KeyExchangeCodeRepository codeRepo;
    @Mock private KeyExchangeEventRepository eventRepo;

    private KeyNestConfig config;
    private KeyNestWebhookHandler handler;

    @BeforeEach
    void setUp() throws Exception {
        config = new KeyNestConfig();
        java.lang.reflect.Field secretField = KeyNestConfig.class.getDeclaredField("webhookSecret");
        secretField.setAccessible(true);
        secretField.set(config, "test-secret");
        handler = new KeyNestWebhookHandler(config, codeRepo, eventRepo);
    }

    private static String hmac(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }

    private static KeyExchangeCode code(Long id, String providerId) {
        KeyExchangeCode c = new KeyExchangeCode();
        c.setId(id);
        c.setOrganizationId(7L);
        c.setPointId(11L);
        c.setPropertyId(22L);
        c.setCode("ABC123");
        c.setProviderCodeId(providerId);
        c.setStatus(CodeStatus.ACTIVE);
        return c;
    }

    @Test
    void verifySignature_validHmac_returnsTrue() throws Exception {
        String payload = "{\"event\":\"key_collected\"}";
        String signature = hmac(payload, "test-secret");
        assertThat(handler.verifySignature(payload, signature)).isTrue();
    }

    @Test
    void verifySignature_validHmacUppercase_returnsTrue() throws Exception {
        String payload = "{\"e\":1}";
        String signature = hmac(payload, "test-secret").toUpperCase();
        assertThat(handler.verifySignature(payload, signature)).isTrue();
    }

    @Test
    void verifySignature_wrongSignature_returnsFalse() {
        assertThat(handler.verifySignature("payload", "abcdef")).isFalse();
    }

    @Test
    void verifySignature_blankSecret_returnsTrue() throws Exception {
        java.lang.reflect.Field f = KeyNestConfig.class.getDeclaredField("webhookSecret");
        f.setAccessible(true);
        f.set(config, "");
        assertThat(handler.verifySignature("anything", "whatever")).isTrue();
    }

    @Test
    void verifySignature_nullSecret_returnsTrue() throws Exception {
        java.lang.reflect.Field f = KeyNestConfig.class.getDeclaredField("webhookSecret");
        f.setAccessible(true);
        f.set(config, null);
        assertThat(handler.verifySignature("p", "s")).isTrue();
    }

    @Test
    void handleWebhookEvent_keyCollected_updatesCodeAndCreatesEvent() {
        when(codeRepo.findByProviderCodeId("PRV-1"))
                .thenReturn(Optional.of(code(1L, "PRV-1")));
        Map<String, Object> payload = Map.of(
                "event", "key_collected",
                "code_id", "PRV-1",
                "actor_name", "John Guest"
        );

        handler.handleWebhookEvent(payload);

        ArgumentCaptor<KeyExchangeCode> codeCap = ArgumentCaptor.forClass(KeyExchangeCode.class);
        verify(codeRepo).save(codeCap.capture());
        assertThat(codeCap.getValue().getStatus()).isEqualTo(CodeStatus.USED);
        assertThat(codeCap.getValue().getCollectedAt()).isNotNull();

        ArgumentCaptor<KeyExchangeEvent> evtCap = ArgumentCaptor.forClass(KeyExchangeEvent.class);
        verify(eventRepo).save(evtCap.capture());
        KeyExchangeEvent saved = evtCap.getValue();
        assertThat(saved.getEventType()).isEqualTo(EventType.KEY_COLLECTED);
        assertThat(saved.getActorName()).isEqualTo("John Guest");
        assertThat(saved.getSource()).isEqualTo(EventSource.WEBHOOK);
        assertThat(saved.getNotes()).contains("Webhook KeyNest");
    }

    @Test
    void handleWebhookEvent_keyReturned_updatesReturnedAtAndCreatesEvent() {
        when(codeRepo.findByProviderCodeId("R-1"))
                .thenReturn(Optional.of(code(2L, "R-1")));
        Map<String, Object> payload = Map.of(
                "event", "key_returned",
                "code_id", "R-1",
                "actor_name", "Jane"
        );

        handler.handleWebhookEvent(payload);

        ArgumentCaptor<KeyExchangeCode> codeCap = ArgumentCaptor.forClass(KeyExchangeCode.class);
        verify(codeRepo).save(codeCap.capture());
        assertThat(codeCap.getValue().getReturnedAt()).isNotNull();

        ArgumentCaptor<KeyExchangeEvent> evtCap = ArgumentCaptor.forClass(KeyExchangeEvent.class);
        verify(eventRepo).save(evtCap.capture());
        assertThat(evtCap.getValue().getEventType()).isEqualTo(EventType.KEY_RETURNED);
    }

    @Test
    void handleWebhookEvent_keyDeposited_createsEventNoCodeMutation() {
        KeyExchangeCode c = code(3L, "D-1");
        when(codeRepo.findByProviderCodeId("D-1")).thenReturn(Optional.of(c));
        Map<String, Object> payload = Map.of(
                "event", "deposited",
                "code_id", "D-1"
        );

        handler.handleWebhookEvent(payload);

        ArgumentCaptor<KeyExchangeEvent> evtCap = ArgumentCaptor.forClass(KeyExchangeEvent.class);
        verify(eventRepo).save(evtCap.capture());
        assertThat(evtCap.getValue().getEventType()).isEqualTo(EventType.KEY_DEPOSITED);
    }

    @Test
    void handleWebhookEvent_unknownCode_skipsSilently() {
        when(codeRepo.findByProviderCodeId("X")).thenReturn(Optional.empty());

        handler.handleWebhookEvent(Map.of("event", "key_collected", "code_id", "X"));

        verify(codeRepo, never()).save(any());
        verify(eventRepo, never()).save(any());
    }

    @Test
    void handleWebhookEvent_unknownEventType_skipsSilently() {
        lenient().when(codeRepo.findByProviderCodeId("C-1"))
                .thenReturn(Optional.of(code(5L, "C-1")));

        handler.handleWebhookEvent(Map.of("event", "unknown_event", "code_id", "C-1"));

        verify(eventRepo, never()).save(any());
    }

    @Test
    void handleWebhookEvent_collectedAlias_alsoWorks() {
        when(codeRepo.findByProviderCodeId("A-1"))
                .thenReturn(Optional.of(code(6L, "A-1")));

        handler.handleWebhookEvent(Map.of("event", "collected", "code_id", "A-1"));

        verify(codeRepo).save(any());
    }

    @Test
    void handleWebhookEvent_returnedAlias_alsoWorks() {
        when(codeRepo.findByProviderCodeId("R-2"))
                .thenReturn(Optional.of(code(7L, "R-2")));

        handler.handleWebhookEvent(Map.of("event", "returned", "code_id", "R-2"));

        verify(codeRepo).save(any());
    }
}
