package com.clenzy.service.agent.supervision;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code markDirtyAfterCommit} : le marquage attend la validation de la
 * transaction appelante, et part immediatement quand il n'y en a aucune.
 *
 * <p>Sans cette attente, une transaction qui echoue laisserait un logement
 * marque pour un evenement qui n'a jamais eu lieu.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SupervisionTriggerServiceAfterCommitTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 3L;

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private SetOperations<String, String> setOperations;

    private SupervisionTriggerService service() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        return new SupervisionTriggerService(redisTemplate);
    }

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void whenNoTransaction_thenMarkedImmediately() {
        service().markDirtyAfterCommit(ORG, PROP);

        verify(setOperations).add(anyString(), eq("3"));
    }

    @Test
    void whenTransactionActive_thenNothingUntilCommit() {
        TransactionSynchronizationManager.initSynchronization();

        service().markDirtyAfterCommit(ORG, PROP);

        verify(setOperations, never()).add(anyString(), any(String[].class));
        verify(setOperations, never()).add(anyString(), anyString());
    }

    @Test
    void whenTransactionCommits_thenMarked() {
        TransactionSynchronizationManager.initSynchronization();
        service().markDirtyAfterCommit(ORG, PROP);

        TransactionSynchronizationManager.getSynchronizations()
                .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);

        verify(setOperations).add(anyString(), eq("3"));
    }

    @Test
    void whenPropertyUnknown_thenNoMarking() {
        service().markDirtyAfterCommit(ORG, null);

        verify(setOperations, never()).add(anyString(), anyString());
    }
}
