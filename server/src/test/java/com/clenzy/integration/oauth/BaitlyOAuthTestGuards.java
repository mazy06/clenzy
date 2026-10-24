package com.clenzy.integration.oauth;

import java.util.function.Supplier;
import static org.mockito.Mockito.*;

/** Garde simulé pour les tests métier ; les verrous réels ont leurs tests PostgreSQL dédiés. */
public final class BaitlyOAuthTestGuards {
    private BaitlyOAuthTestGuards() {}
    public static void installRefreshJournal(javax.sql.DataSource source) {
        new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(new org.springframework.core.io.ClassPathResource("db/changelog/changes/0598__baitly_oauth_refresh_attempts.sql")).execute(source);
    }
    public static BaitlyOAuthConnectionGuard passthrough() {
        var guard = mock(BaitlyOAuthConnectionGuard.class);
        lenient().when(guard.execute(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeRefresh(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeForUser(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeUserRefresh(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeUserRefresh(anyString(), any(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeAuthorization(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeUserAuthorization(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeLegacyAuthorization(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeUserLegacyAuthorization(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeRevocation(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeUserRevocation(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        return guard;
    }
}
