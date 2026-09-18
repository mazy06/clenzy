package com.clenzy.service.assignment;

import com.clenzy.tenant.TenantContext;
import java.time.*;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class AssignmentJobProcessorTest {
    final AssignmentJobStore jobs=mock(AssignmentJobStore.class);
    final ServiceAssignmentService assignments=mock(ServiceAssignmentService.class);
    final AssignmentNotificationDelivery delivery=mock(AssignmentNotificationDelivery.class);
    final AssignmentRealtime realtime=mock(AssignmentRealtime.class);
    final TenantContext tenant=new TenantContext();
    final Instant now=Instant.parse("2026-09-16T10:00:00Z");
    final AssignmentJobProcessor processor=new AssignmentJobProcessor(jobs,assignments,delivery,tenant,Clock.fixed(now,ZoneOffset.UTC),realtime);
    void job(String kind,Instant due) {
        var job=new AssignmentJobStore.Job(7,1,kind,9L,due);
        when(jobs.pending(7)).thenReturn(Optional.of(job));
        when(jobs.lockRequest(1)).thenReturn(2L);
        when(jobs.lock(7)).thenReturn(Optional.of(job));
    }
    @Test void locksRequestBeforeJobAndCommitsDecisionWithCompletion() {
        job("TICK",now);
        doAnswer(i->{assertThat(tenant.getOrganizationId()).isEqualTo(2L);return null;}).when(assignments).tick(1L);
        processor.process(7);
        var order=inOrder(jobs,assignments);
        order.verify(jobs).pending(7); order.verify(jobs).lockRequest(1); order.verify(jobs).lock(7);
        order.verify(assignments).tick(1L); order.verify(jobs).complete(7);
        assertThat(tenant.getOrganizationId()).isNull();
    }
    @Test void concurrentWinnerOrDuplicateDoesNotRepeatDecision() {
        job("TICK",now); when(jobs.lock(7)).thenReturn(Optional.empty());
        processor.process(7);
        verifyNoInteractions(assignments); verify(jobs,never()).complete(7);
    }
    @Test void delayedJobNeverRunsEarly() {
        job("TICK",now.plusSeconds(60)); processor.process(7);
        verifyNoInteractions(assignments); verify(jobs,never()).complete(7);
    }
    @Test void failurePropagatesForRollbackAndClearsTenant() {
        job("NOTIFY",now); doThrow(new IllegalStateException()).when(delivery).send(9L);
        assertThatThrownBy(()->processor.process(7)).isInstanceOf(IllegalStateException.class);
        verify(jobs,never()).complete(7); assertThat(tenant.getOrganizationId()).isNull();
    }
    @Test void refreshPublishesOnlyAfterTheOriginalBusinessTransaction() {
        job("REFRESH",now); processor.process(7);
        verify(realtime).changed(1); verify(jobs).complete(7);
    }
}
