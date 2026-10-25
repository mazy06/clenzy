package com.clenzy.service.automation;

import java.util.UUID;
import java.util.function.Supplier;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Unit-test wiring only. SQL fencing and commit behaviour use the real journal in integration tests. */
public final class BaitlyExternalEffectTestSupport {
    private BaitlyExternalEffectTestSupport() {}
    public static BaitlyExternalEffectJournal journal() {
        var journal = mock(BaitlyExternalEffectJournal.class);
        lenient().when(journal.claim(any())).thenAnswer(call ->
            new BaitlyExternalEffectJournal.Ticket(call.getArgument(0), UUID.randomUUID(), false, null));
        lenient().when(journal.claim(any(), any())).thenAnswer(call -> {
            call.getArgument(1, Runnable.class).run();
            return new BaitlyExternalEffectJournal.Ticket(call.getArgument(0), UUID.randomUUID(), false, null);
        });
        lenient().when(journal.complete(any(), any(), any())).thenAnswer(call -> call.getArgument(1, Supplier.class).get());
        lenient().doAnswer(call -> { call.getArgument(1, Runnable.class).run(); return null; })
            .when(journal).deleteIfUnused(any(), any());
        return journal;
    }
}
