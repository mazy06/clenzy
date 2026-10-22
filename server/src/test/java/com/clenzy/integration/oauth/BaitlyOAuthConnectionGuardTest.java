package com.clenzy.integration.oauth;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyOAuthConnectionGuardTest {
    final JdbcTemplate db = mock(JdbcTemplate.class);
    final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    final SimpleTransactionStatus status = new SimpleTransactionStatus();
    final BaitlyOAuthConnectionGuard guard = new BaitlyOAuthConnectionGuard(db, manager);

    void lock(boolean granted) {
        when(manager.getTransaction(any())).thenReturn(status);
        when(db.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(granted);
        when(db.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
    }

    @Test void contentionNeverRunsOperation() {
        lock(false);
        var operation = mock(java.util.function.Supplier.class);
        assertThatThrownBy(() -> guard.execute("test", 7L, operation))
                .isInstanceOf(BaitlyOAuthBusyException.class).hasMessageContaining("déjà en cours");
        verifyNoInteractions(operation);
        verify(manager).rollback(status);
    }

    @Test void storageFailureNeverRunsOperation() {
        when(manager.getTransaction(any())).thenReturn(status);
        when(db.queryForObject(anyString(), eq(Boolean.class), any(Object[].class)))
                .thenThrow(new IllegalStateException("Synthetic database failure"));
        var operation = mock(java.util.function.Supplier.class);
        assertThatThrownBy(() -> guard.execute("test", 7L, operation)).isInstanceOf(RuntimeException.class);
        verifyNoInteractions(operation);
    }

    @Test void successCommitsBeforeReturning() {
        lock(true);
        assertThat(guard.execute("test", 7L, () -> "ok")).isEqualTo("ok");
        verify(manager).commit(status);
    }

    @Test void exchangeFailureRollsBack() {
        lock(true);
        assertThatThrownBy(() -> guard.execute("test", 7L, () -> {throw new IllegalStateException("synthetic");}))
                .hasMessage("synthetic");
        verify(manager).rollback(status);
        verify(manager, never()).commit(any());
    }

    @Test void operationalRefreshErrorCommitsBeforePropagating() {
        lock(true);
        assertThatThrownBy(() -> guard.executeRefresh("test", 7L, () -> {throw new IllegalStateException("synthetic");}))
                .hasMessage("synthetic");
        verify(manager).commit(status);
    }

    @Test void condemnedTransactionCannotCommitError() {
        lock(true);
        assertThatThrownBy(() -> guard.executeRefresh("test", 7L, () -> {
            status.setRollbackOnly();
            throw new IllegalStateException("synthetic");
        })).hasMessage("synthetic");
        verify(manager).rollback(status);
    }

    @Test void swallowedFailureCannotReturnSuccessFromRollbackOnlyTransaction() {
        lock(true);
        assertThatThrownBy(() -> guard.executeRefresh("test", 7L, () -> {
            status.setRollbackOnly();
            return "must-not-succeed";
        })).hasMessage("Transaction OAuth non confirmée");
        verify(manager).rollback(status);
    }

    @Test void commitFailureCannotReturnSuccess() {
        lock(true);
        doThrow(new IllegalStateException("Synthetic commit failure")).when(manager).commit(status);
        assertThatThrownBy(() -> guard.execute("test", 7L, () -> "ok")).hasMessage("Synthetic commit failure");
    }

    @Test void invalidScopeNeverAccessesDatabase() {
        assertThatThrownBy(() -> guard.execute("invalid:private", 7L, () -> "ok"))
                .hasMessage("Périmètre OAuth invalide");
        assertThatThrownBy(() -> guard.execute("test", 0L, () -> "ok"))
                .hasMessage("Périmètre OAuth invalide");
        verifyNoInteractions(db, manager);
    }

    @Test void userKeysAreStableAndDoNotTransmitRawIdentity() {
        lock(true);
        guard.executeForUser("minut", "synthetic-user@example.invalid", () -> "ok");
        guard.executeUserRefresh("minut", "synthetic-user@example.invalid", () -> "ok");
        guard.executeForUser("minut", "different-user", () -> "ok");
        var keys = org.mockito.ArgumentCaptor.forClass(Object[].class);
        verify(db, times(3)).queryForObject(anyString(), eq(Boolean.class), keys.capture());
        String first = keys.getAllValues().get(0)[0].toString();
        assertThat(first).matches("baitly:oauth:user:minut:[a-f0-9]{64}").doesNotContain("synthetic-user", "example.invalid");
        assertThat(keys.getAllValues().get(1)[0]).isEqualTo(first);
        assertThat(keys.getAllValues().get(2)[0]).isNotEqualTo(first);
    }

    @Test void invalidUserScopeNeverAccessesDatabase() {
        assertThatThrownBy(() -> guard.executeForUser("minut", " ", () -> "ok"))
                .hasMessage("Périmètre OAuth invalide");
        verifyNoInteractions(db, manager);
    }
}
