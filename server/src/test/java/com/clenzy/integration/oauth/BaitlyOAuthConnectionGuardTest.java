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
        when(db.update(anyString(), any(Object[].class))).thenReturn(1);
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
        verify(manager, atLeastOnce()).commit(status);
    }

    @Test void exchangeFailureRollsBack() {
        lock(true);
        assertThatThrownBy(() -> guard.execute("test", 7L, () -> {throw new IllegalStateException("synthetic");}))
                .hasMessage("synthetic");
        verify(manager).rollback(status);
        verify(manager, never()).commit(any());
    }
    @Test void newAuthorizationFailureRollsBackAndNeverClearsTheFence() {
        lock(true);
        assertThatThrownBy(() -> guard.executeAuthorization("test",7L,() -> {throw new IllegalStateException("synthetic");})).hasMessage("synthetic");
        verify(manager).rollback(status);
        verify(manager).commit(status); // Intention indépendante, avant l'opération.
        verify(db,never()).update(startsWith("DELETE"),any(Object[].class));
    }
    @Test void legacyAuthorizationErrorContractDoesNotClearTheFence() {
        lock(true);
        assertThatThrownBy(() -> guard.executeUserLegacyAuthorization("airbnb","synthetic-user",() -> {throw new IllegalStateException("synthetic");})).hasMessage("synthetic");
        verify(manager,times(2)).commit(status);
        verify(db,never()).update(startsWith("DELETE"),any(Object[].class));
    }

    @Test void unavailableAuthorizationJournalNeverCallsProviderAndHidesDatabaseDetails() {
        lock(true);
        when(db.update(startsWith("INSERT"),any(Object[].class)))
                .thenThrow(new IllegalStateException("synthetic-private-database-detail"));
        var operation = mock(java.util.function.Supplier.class);
        assertThatThrownBy(() -> guard.executeAuthorization("test",7L,operation))
                .hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        verifyNoInteractions(operation);
    }

    @Test void successfulRevocationNeverRemovesDurableFence() {
        lock(true);
        assertThat(guard.executeRevocation("test",7L,() -> "disconnected")).isEqualTo("disconnected");
        verify(manager,times(2)).commit(status);
        verify(db,never()).update(startsWith("DELETE"),any(Object[].class));
    }

    @Test void authorizationCannotClearAnotherAttempt() {
        lock(true);
        when(db.update(startsWith("DELETE"),any(Object[].class))).thenReturn(0);
        assertThatThrownBy(() -> guard.executeAuthorization("test",7L,() -> "must-not-succeed"))
                .hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        verify(manager).rollback(status);
    }

    @Test void storageFailureAfterRemoteGrantHasNoPrivateDiagnostic() {
        lock(true);
        assertThatThrownBy(() -> guard.executeAuthorization("test",7L,() -> {
            var failure = new org.springframework.dao.DataIntegrityViolationException("synthetic-private-sql-value",
                    new IllegalStateException("synthetic-private-cause"));
            failure.addSuppressed(new IllegalStateException("synthetic-private-suppressed"));
            throw failure;
        })).isInstanceOfSatisfying(IllegalStateException.class, this::assertPrivateDiagnosticRemoved);
    }

    @Test void storageCommitFailureHasNoPrivateDiagnostic() {
        lock(true);
        doThrow(new org.springframework.transaction.TransactionSystemException("synthetic-private-commit",
                new IllegalStateException("synthetic-private-secret"))).when(manager).commit(status);
        assertThatThrownBy(() -> guard.execute("test",7L,() -> "unsafe"))
                .isInstanceOfSatisfying(IllegalStateException.class, this::assertPrivateDiagnosticRemoved);
    }

    @Test void legacyErrorCommitCannotExposeDeferredStorageFailure() {
        lock(true);
        assertThatThrownBy(() -> guard.executeLegacyAuthorization("test",7L,() -> {
            throw new org.springframework.dao.DataIntegrityViolationException("synthetic-private-deferred");
        })).isInstanceOfSatisfying(IllegalStateException.class, this::assertPrivateDiagnosticRemoved);
        verify(manager,times(2)).commit(status);
        verify(db,never()).update(startsWith("DELETE"),any(Object[].class));
    }

    private void assertPrivateDiagnosticRemoved(IllegalStateException failure) {
        assertThat(failure).hasMessage("Rotation OAuth non confirmée ; reconnexion requise").hasNoCause();
        assertThat(failure.getSuppressed()).isEmpty();
        var printed = new java.io.StringWriter(); failure.printStackTrace(new java.io.PrintWriter(printed));
        assertThat(printed.toString()).doesNotContain("synthetic-private");
    }
    @Test void returnedErrorCommitsTheLocalStateButKeepsTheDurableIntent() {
        lock(true);
        assertThat(guard.executeUserRefresh("minut","synthetic-user",() -> "ERROR",value -> false)).isEqualTo("ERROR");
        verify(manager,times(2)).commit(status);
        verify(db,never()).update(startsWith("DELETE"),any(Object[].class));
    }

    @Test void operationalRefreshErrorCommitsBeforePropagating() {
        lock(true);
        assertThatThrownBy(() -> guard.executeRefresh("test", 7L, () -> {throw new IllegalStateException("synthetic");}))
                .hasMessage("synthetic");
        verify(manager, atLeastOnce()).commit(status);
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
