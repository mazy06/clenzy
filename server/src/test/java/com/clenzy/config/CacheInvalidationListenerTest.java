package com.clenzy.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.Message;

import java.nio.charset.StandardCharsets;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CacheInvalidationListener")
class CacheInvalidationListenerTest {

    private static final String SELF_ID = "node-self";

    @Mock private TwoLayerCacheManager cacheManager;
    private CacheInvalidationListener listener;

    @BeforeEach
    void setUp() {
        listener = new CacheInvalidationListener(cacheManager, SELF_ID);
    }

    private Message message(String payload) {
        Message m = mock(Message.class);
        when(m.getBody()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        return m;
    }

    @Test void whenMessageFromOtherNode_thenEvictsLocalCache() {
        String payload = new CacheInvalidationMessage("node-other", "properties", "42").serialize();

        listener.onMessage(message(payload), null);

        verify(cacheManager).evictLocal("properties");
    }

    @Test void whenClearMessageFromOtherNode_thenEvictsLocalCache() {
        String payload = CacheInvalidationMessage.clear("node-other", "permissions").serialize();

        listener.onMessage(message(payload), null);

        verify(cacheManager).evictLocal("permissions");
    }

    @Test void whenMessageFromSelf_thenIgnored() {
        // Redis livre aussi a l'emetteur : on doit ignorer nos propres messages (pas de boucle).
        String payload = new CacheInvalidationMessage(SELF_ID, "properties", "42").serialize();

        listener.onMessage(message(payload), null);

        verifyNoInteractions(cacheManager);
    }

    @Test void whenPayloadMalformed_thenIgnoredWithoutThrowing() {
        listener.onMessage(message("garbage-without-separators"), null);

        verifyNoInteractions(cacheManager);
    }
}
