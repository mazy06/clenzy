package com.clenzy.service.ai;

import com.clenzy.model.AiCreditGrant;
import com.clenzy.repository.AiCreditGrantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Solde de credits (T-06b) : application de la consommation aux poches dans
 * l'ordre D-102 (SUBSCRIPTION d'abord, puis expiration croissante, remplissages
 * partiels), et fail-closed de la reservation quand Redis est indisponible.
 */
@ExtendWith(MockitoExtension.class)
class CreditBalanceServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private AiCreditGrantRepository grantRepository;

    private CreditBalanceService service() {
        return new CreditBalanceService(redisTemplate, grantRepository);
    }

    private static AiCreditGrant grant(String source, long granted, Instant expiresAt) {
        return new AiCreditGrant(42L, source, granted, expiresAt, null);
    }

    @Test
    void consumption_fillsSubscriptionFirst_thenTopupByExpiry() {
        // Le repository retourne deja l'ordre du tri JPQL : SUBSCRIPTION puis FIFO expiration.
        AiCreditGrant subscription = grant(AiCreditGrant.SOURCE_SUBSCRIPTION, 1000,
                Instant.now().plusSeconds(86400));
        AiCreditGrant topupEarly = grant(AiCreditGrant.SOURCE_TOPUP, 5000,
                Instant.now().plusSeconds(2 * 86400));
        AiCreditGrant topupLate = grant(AiCreditGrant.SOURCE_TOPUP, 5000,
                Instant.now().plusSeconds(30 * 86400));
        when(grantRepository.lockActiveGrants(any(), any()))
                .thenReturn(List.of(subscription, topupEarly, topupLate));

        long applied = service().applyConsumptionToGrants(42L, 3500L);

        assertThat(applied).isEqualTo(3500L);
        assertThat(subscription.getMillicreditsConsumed()).isEqualTo(1000L); // videe d'abord
        assertThat(topupEarly.getMillicreditsConsumed()).isEqualTo(2500L);   // puis FIFO expiration
        assertThat(topupLate.getMillicreditsConsumed()).isZero();
    }

    @Test
    void consumption_beyondAllPockets_reportsPartialApplication() {
        AiCreditGrant only = grant(AiCreditGrant.SOURCE_SUBSCRIPTION, 1000,
                Instant.now().plusSeconds(86400));
        when(grantRepository.lockActiveGrants(any(), any())).thenReturn(List.of(only));

        long applied = service().applyConsumptionToGrants(42L, 4000L);

        assertThat(applied).isEqualTo(1000L); // le surplus reste au ledger (verite)
        assertThat(only.remaining()).isZero();
    }

    @Test
    @SuppressWarnings("unchecked")
    void tryReserve_coldCache_seedsFromDatabase_thenRetries() {
        // 1er essai : -1 (compteur inconnu) → seed DB → 2e essai : 1 (reserve).
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(), any()))
                .thenReturn(-1L, 1L);
        when(grantRepository.availableMillicredits(any(), any())).thenReturn(7000L);
        var valueOps = org.mockito.Mockito.mock(org.springframework.data.redis.core.ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        boolean reserved = service().tryReserve(42L, 2000L);

        assertThat(reserved).isTrue();
        org.mockito.Mockito.verify(valueOps).setIfAbsent(anyString(), org.mockito.ArgumentMatchers.eq("7000"), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void tryReserve_insufficientBalance_refuses() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(), any()))
                .thenReturn(0L);

        assertThat(service().tryReserve(42L, 2000L)).isFalse();
    }

    @Test
    @SuppressWarnings("unchecked")
    void tryReserve_redisDown_failsClosed() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(), any()))
                .thenThrow(new RuntimeException("redis down"));

        assertThat(service().tryReserve(42L, 2000L)).isFalse();
    }
}
