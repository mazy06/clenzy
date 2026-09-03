package com.clenzy.service.device;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeviceSseRegistryTest {

    /** Émetteur qui retient ce qu'on lui envoie, au lieu d'écrire sur une réponse HTTP. */
    private static final class RecordingEmitter extends SseEmitter {
        private final List<Object> sent = new ArrayList<>();

        @Override
        public void send(SseEventBuilder builder) {
            sent.add(builder);
        }
    }

    /** Émetteur dont l'envoi échoue, comme un client qui a fermé son onglet. */
    private static final class BrokenEmitter extends SseEmitter {
        @Override
        public void send(SseEventBuilder builder) throws IOException {
            throw new IOException("client parti");
        }
    }

    @Test
    void whenDiffusionSurUneOrganisation_thenLesAutresNeRecoiventRien() {
        // Le hub affiche un parc entier : une fuite entre organisations exposerait
        // les appareils d'un autre client.
        DeviceSseRegistry registry = new DeviceSseRegistry();
        RecordingEmitter mien = new RecordingEmitter();
        RecordingEmitter autre = new RecordingEmitter();
        registry.register(2L, mien);
        registry.register(7L, autre);

        registry.broadcast(2L, "{\"type\":\"device.changed\"}");

        assertEquals(1, mien.sent.size());
        assertTrue(autre.sent.isEmpty());
    }

    @Test
    void whenAucunEcranOuvert_thenDiffusionSansEffet() {
        DeviceSseRegistry registry = new DeviceSseRegistry();

        registry.broadcast(2L, "{\"type\":\"device.changed\"}");

        assertEquals(0, registry.openStreams(2L));
    }

    @Test
    void whenEmetteurRompu_thenIlEstRetireDuRegistre() {
        // Un onglet fermé ne doit pas rester dans le registre à recevoir des
        // événements pour l'éternité.
        DeviceSseRegistry registry = new DeviceSseRegistry();
        registry.register(2L, new BrokenEmitter());
        assertEquals(1, registry.openStreams(2L));

        registry.broadcast(2L, "{\"type\":\"device.changed\"}");

        assertEquals(0, registry.openStreams(2L));
    }

    @Test
    void whenPlusieursEcransSurLaMemeOrganisation_thenTousRecoivent() {
        DeviceSseRegistry registry = new DeviceSseRegistry();
        RecordingEmitter premier = new RecordingEmitter();
        RecordingEmitter second = new RecordingEmitter();
        registry.register(2L, premier);
        registry.register(2L, second);

        registry.broadcast(2L, "{\"type\":\"device.changed\"}");

        assertEquals(1, premier.sent.size());
        assertEquals(1, second.sent.size());
    }
}
