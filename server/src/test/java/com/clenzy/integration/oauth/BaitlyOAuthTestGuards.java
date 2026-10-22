package com.clenzy.integration.oauth;

import java.util.function.Supplier;
import static org.mockito.Mockito.*;

/** Garde simulé pour les tests métier ; les verrous réels ont leurs tests PostgreSQL dédiés. */
public final class BaitlyOAuthTestGuards {
    private BaitlyOAuthTestGuards() {}
    public static BaitlyOAuthConnectionGuard passthrough() {
        var guard = mock(BaitlyOAuthConnectionGuard.class);
        lenient().when(guard.execute(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeRefresh(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeForUser(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        lenient().when(guard.executeUserRefresh(anyString(), any(), any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(2)).get());
        return guard;
    }
}
