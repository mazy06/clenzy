package com.clenzy.service.agent.kb;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VoyageRateThrottleTest {

    @Test
    void notThrottled_awaitSlotIsInstant() {
        VoyageRateThrottle throttle = new VoyageRateThrottle();
        long start = System.nanoTime();
        throttle.awaitSlot();
        throttle.awaitSlot();
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        assertFalse(throttle.isThrottled());
        assertTrue(elapsedMs < 100, "awaitSlot doit etre un no-op hors throttle : " + elapsedMs + "ms");
    }

    @Test
    void onRateLimited_activatesThrottle_thenExpires() throws InterruptedException {
        // Fenetre courte pour le test : 150ms de throttle, creneaux de 50ms
        VoyageRateThrottle throttle = new VoyageRateThrottle(150, 50);
        assertFalse(throttle.isThrottled());

        throttle.onRateLimited();
        assertTrue(throttle.isThrottled());

        Thread.sleep(200);
        assertFalse(throttle.isThrottled(), "le mode ralenti doit expirer apres la fenetre");
    }

    @Test
    void throttled_awaitSlot_pacesSuccessiveCalls() {
        VoyageRateThrottle throttle = new VoyageRateThrottle(60_000, 120);
        throttle.onRateLimited();

        long start = System.nanoTime();
        throttle.awaitSlot(); // 1er creneau : immediat
        throttle.awaitSlot(); // 2e : ~120ms plus tard
        throttle.awaitSlot(); // 3e : ~240ms apres le debut
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(elapsedMs >= 200,
                "3 creneaux a 120ms doivent prendre >= ~240ms, mesure : " + elapsedMs + "ms");
    }
}
