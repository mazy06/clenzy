package com.clenzy.service.ai;

import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CreditBalanceServiceTest {
    StringRedisTemplate redis=mock(StringRedisTemplate.class);
    BaitlyCreditWallet wallet=mock(BaitlyCreditWallet.class);
    CreditBalanceService balance=new CreditBalanceService(redis,wallet);
    @AfterEach void clear() { if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.clearSynchronization(); }
    @Test void cacheFailureCannotForgetInflightReservations() {
        doThrow(new IllegalStateException("Redis indisponible")).when(redis).delete(anyString());
        var id=UUID.randomUUID();when(wallet.reserve(42L,id,2000)).thenReturn(false);
        balance.invalidate(42L);assertThat(balance.tryReserve(42L,id,2000)).isFalse();
    }
    @Test void invalidationWaitsForCommit() {
        TransactionSynchronizationManager.initSynchronization();balance.invalidate(42L);
        verifyNoInteractions(redis);
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());
        verify(redis).delete("ai:credits:balance:42");
    }
    @Test void rollbackDoesNotInvalidateCache() {
        TransactionSynchronizationManager.initSynchronization();balance.invalidate(42L);
        TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCompletion(1));
        verifyNoInteractions(redis);
    }
}
