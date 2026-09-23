package com.clenzy.integration.regulatory.ntmp;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NtmpTokenProviderTest {

    private static final Instant T0 = Instant.parse("2026-09-23T10:00:00Z");

    /** Horloge qu'on avance a la main : aucun test ne depend de l'heure reelle. */
    private static final class MovableClock extends Clock {
        private Instant now;

        MovableClock(Instant now) { this.now = now; }
        void advance(Duration by) { now = now.plus(by); }

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private NtmpAccessToken tokenLasting(Duration ttl, MovableClock clock, String value) {
        return new NtmpAccessToken(value, clock.instant().plus(ttl));
    }

    @Test
    void whenTokenIsStillFresh_thenTheGatewayIsNotCalledAgain() {
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange exchange = (id, licence) -> {
            calls.incrementAndGet();
            return tokenLasting(Duration.ofHours(1), clock, "jeton");
        };

        provider.get(1L, "50123456", exchange);
        provider.get(1L, "50123456", exchange);
        provider.get(1L, "50123456", exchange);

        assertThat(calls).hasValue(1);
    }

    @Test
    void whenTokenEntersTheSafetyMargin_thenItIsRenewedBeforeExpiry() {
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange exchange = (id, licence) -> {
            calls.incrementAndGet();
            return tokenLasting(Duration.ofMinutes(10), clock, "jeton-" + calls.get());
        };

        provider.get(1L, "50123456", exchange);
        // Le jeton vaut encore 30 s, mais on est DANS la marge : on renouvelle
        // plutot que d'attendre le 401.
        clock.advance(Duration.ofSeconds(570));
        var second = provider.get(1L, "50123456", exchange);

        assertThat(calls).hasValue(2);
        assertThat(second.value()).isEqualTo("jeton-2");
    }

    @Test
    void whenTokenIsOutsideTheSafetyMargin_thenItIsStillServed() {
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange exchange = (id, licence) -> {
            calls.incrementAndGet();
            return tokenLasting(Duration.ofMinutes(10), clock, "jeton");
        };

        provider.get(1L, "50123456", exchange);
        clock.advance(Duration.ofMinutes(8));
        provider.get(1L, "50123456", exchange);

        assertThat(calls).hasValue(1);
    }

    @Test
    void whenLicenceDiffers_thenEachOneGetsItsOwnToken() {
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange exchange = (id, licence) -> {
            calls.incrementAndGet();
            return tokenLasting(Duration.ofHours(1), clock, "jeton-" + licence);
        };

        assertThat(provider.get(1L, "50000001", exchange).value()).isEqualTo("jeton-50000001");
        assertThat(provider.get(1L, "50000002", exchange).value()).isEqualTo("jeton-50000002");
        assertThat(calls).hasValue(2);
    }

    @Test
    void whenExchangeFails_thenNothingIsCachedAndTheNextCallRetries() {
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange failing = (id, licence) -> {
            calls.incrementAndGet();
            throw new IllegalStateException("passerelle indisponible");
        };

        assertThatThrownBy(() -> provider.get(1L, "50123456", failing))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> provider.get(1L, "50123456", failing))
                .isInstanceOf(IllegalStateException.class);

        assertThat(calls).hasValue(2);
    }

    @Test
    void whenTheSecretChanges_thenEvictForcesAFreshExchange() {
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange exchange = (id, licence) -> {
            calls.incrementAndGet();
            return tokenLasting(Duration.ofHours(1), clock, "jeton");
        };

        provider.get(1L, "50123456", exchange);
        provider.evict(1L);
        provider.get(1L, "50123456", exchange);

        assertThat(calls).hasValue(2);
    }

    @Test
    void whenManyThreadsAskAtOnce_thenTheGatewayIsCalledOnce() throws Exception {
        // Le quota est compte par integrateur : dix appels concurrents sur la
        // meme licence ne doivent pas declencher dix echanges.
        var clock = new MovableClock(T0);
        var provider = new NtmpTokenProvider(clock);
        var calls = new AtomicInteger();

        NtmpTokenProvider.Exchange slow = (id, licence) -> {
            calls.incrementAndGet();
            try {
                Thread.sleep(40);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return tokenLasting(Duration.ofHours(1), clock, "jeton");
        };

        int threads = 10;
        var start = new CountDownLatch(1);
        var done = new CountDownLatch(threads);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    start.await();
                    provider.get(1L, "50123456", slow);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
        pool.shutdownNow();

        assertThat(calls).hasValue(1);
    }
}
