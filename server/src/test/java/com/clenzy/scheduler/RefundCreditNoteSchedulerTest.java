package com.clenzy.scheduler;

import com.clenzy.service.RefundCreditNoteService;
import com.clenzy.tenant.TenantScopedExecutor;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;

class RefundCreditNoteSchedulerTest {
    @Test void failureAndDiagnosticFailureDoNotPreventNextTenantFromResuming() {
        var notes=mock(RefundCreditNoteService.class);
        var tenants=mock(TenantScopedExecutor.class);
        when(notes.candidates()).thenReturn(List.of(new RefundCreditNoteService.Candidate("REF-first",7L),
            new RefundCreditNoteService.Candidate("REF-next",8L)));
        doAnswer(call -> { ((Runnable)call.getArgument(1)).run(); return null; }).when(tenants).runAsOrganization(anyLong(),any());
        when(notes.reconcile("REF-first")).thenThrow(new IllegalStateException("invoice mismatch"));
        doThrow(new IllegalStateException("unavailable diagnostic")).when(notes).recordFailure("REF-first");
        new RefundCreditNoteScheduler(notes,tenants).resume();
        var order=inOrder(tenants,notes);
        order.verify(tenants).runAsOrganization(eq(7L),any());
        order.verify(notes).reconcile("REF-first");
        order.verify(notes).recordFailure("REF-first");
        order.verify(tenants).runAsOrganization(eq(8L),any());
        order.verify(notes).reconcile("REF-next");
        verify(notes,never()).recordFailure("REF-next");
    }
}
