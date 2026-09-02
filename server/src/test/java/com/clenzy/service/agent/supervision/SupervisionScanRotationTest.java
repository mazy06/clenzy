package com.clenzy.service.agent.supervision;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tour de role du balayage periodique : qui repasse, dans quel ordre.
 *
 * <p>Le point sensible est l'ordre — un logement jamais scanne doit passer
 * devant un logement vu il y a longtemps, sans quoi les logements ajoutes apres
 * l'activation attendraient derriere tout le parc.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SupervisionScanRotationTest {

    private static final Long ORG = 4L;
    private static final Instant NOW = Instant.parse("2026-08-31T12:00:00Z");
    private static final Duration SIX_HOURS = Duration.ofHours(6);

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ZSetOperations<String, String> zSetOperations;

    private SupervisionScanRotation rotation() {
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        return new SupervisionScanRotation(redisTemplate, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    /** Dernier passage d'un logement, tel que le sorted set le stocke. */
    private static ZSetOperations.TypedTuple<String> lastScan(long propertyId, Instant at) {
        return ZSetOperations.TypedTuple.of(String.valueOf(propertyId),
                (double) at.getEpochSecond());
    }

    @SafeVarargs
    private void lastScans(ZSetOperations.TypedTuple<String>... tuples) {
        Set<ZSetOperations.TypedTuple<String>> set = new LinkedHashSet<>(List.of(tuples));
        when(zSetOperations.rangeWithScores(anyString(), eq(0L), eq(-1L))).thenReturn(set);
    }

    @Test
    void whenNeverScanned_thenComesFirst() {
        lastScans(lastScan(10L, NOW.minus(Duration.ofDays(2))));

        List<Long> due = rotation().dueForScan(ORG, List.of(10L, 11L), SIX_HOURS, 5);

        assertThat(due).containsExactly(11L, 10L);
    }

    @Test
    void whenSeenRecently_thenSkipped() {
        lastScans(lastScan(10L, NOW.minus(Duration.ofHours(1))),
                lastScan(11L, NOW.minus(Duration.ofHours(9))));

        List<Long> due = rotation().dueForScan(ORG, List.of(10L, 11L), SIX_HOURS, 5);

        assertThat(due).containsExactly(11L);
    }

    @Test
    void whenMoreDueThanMax_thenOldestOnly() {
        lastScans(lastScan(10L, NOW.minus(Duration.ofDays(1))),
                lastScan(11L, NOW.minus(Duration.ofDays(3))),
                lastScan(12L, NOW.minus(Duration.ofDays(2))));

        List<Long> due = rotation().dueForScan(ORG, List.of(10L, 11L, 12L), SIX_HOURS, 2);

        assertThat(due).containsExactly(11L, 12L);
    }

    @Test
    void whenRedisFails_thenNobodyIsDesignated() {
        when(zSetOperations.rangeWithScores(anyString(), anyLong(), anyLong()))
                .thenThrow(new IllegalStateException("redis down"));

        List<Long> due = rotation().dueForScan(ORG, List.of(10L), SIX_HOURS, 5);

        // Fail-closed : sans memoire du dernier passage, designer reviendrait a
        // rescanner les memes logements a chaque cycle.
        assertThat(due).isEmpty();
    }

    @Test
    void whenNoCandidate_thenNoRedisCall() {
        List<Long> due = rotation().dueForScan(ORG, List.of(), SIX_HOURS, 5);

        assertThat(due).isEmpty();
        verify(zSetOperations, never()).rangeWithScores(anyString(), anyLong(), anyLong());
    }

    @Test
    void whenMarkedScanned_thenScoreIsNowAndKeyExpires() {
        rotation().markScanned(ORG, 10L);

        verify(zSetOperations).add("supervision:lastscan:org:4", "10",
                (double) NOW.getEpochSecond());
        verify(redisTemplate).expire("supervision:lastscan:org:4", Duration.ofDays(30));
    }
}
