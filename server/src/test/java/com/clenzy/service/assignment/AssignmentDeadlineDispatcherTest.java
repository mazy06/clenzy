package com.clenzy.service.assignment;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;

class AssignmentDeadlineDispatcherTest {
    final AssignmentJobStore jobs=mock(AssignmentJobStore.class);
    final AssignmentJobProcessor processor=mock(AssignmentJobProcessor.class);
    final ThreadPoolTaskScheduler timer=mock(ThreadPoolTaskScheduler.class);
    final Instant now=Instant.parse("2026-09-16T10:00:00Z");
    final AssignmentDeadlineDispatcher dispatcher=new AssignmentDeadlineDispatcher(jobs,processor,Clock.fixed(now,ZoneOffset.UTC),timer);
    final AssignmentJobStore.Job job=new AssignmentJobStore.Job(7L,1L,"TICK",null,now.plusSeconds(2400));

    @Test void messageArmsExactDeadlineWithoutPolling() {
        when(jobs.pending(7)).thenReturn(Optional.of(job),Optional.empty());
        dispatcher.wake(7);
        var task=org.mockito.ArgumentCaptor.forClass(Runnable.class);
        verify(timer).schedule(task.capture(),eq(job.dueAt()));
        verifyNoInteractions(processor);
        task.getValue().run();
        verify(processor).process(7);
        verify(timer,times(1)).schedule(any(Runnable.class),any(Instant.class));
    }
    @Test void duplicateMessageReplacesLocalAlarm() {
        when(jobs.pending(7)).thenReturn(Optional.of(job));
        var future=mock(java.util.concurrent.ScheduledFuture.class);
        doReturn(future).when(timer).schedule(any(Runnable.class),any(Instant.class));
        dispatcher.wake(7); dispatcher.wake(7);
        verify(future).cancel(false);
    }
    @Test void startupOrRebalanceRecoversPersistedJobsInBatches() {
        doAnswer(i->{ ((Runnable)i.getArgument(0)).run(); return null; }).when(timer).execute(any(Runnable.class));
        when(jobs.recover(0)).thenReturn(List.of(job));
        when(jobs.recover(7)).thenReturn(List.of());
        dispatcher.recover();
        verify(timer).schedule(any(Runnable.class),eq(job.dueAt()));
        verify(jobs).recover(7);
    }
    @Test void businessFailurePersistsRetryAndRearmsOnlyThatJob() {
        var error=new IllegalStateException("temporary");
        var retry=new AssignmentJobStore.Job(7,1,"TICK",null,now.plusSeconds(5));
        when(jobs.pending(7)).thenReturn(Optional.of(job),Optional.of(retry));
        doThrow(error).when(processor).process(7);
        dispatcher.wake(7);
        var task=org.mockito.ArgumentCaptor.forClass(Runnable.class);
        verify(timer).schedule(task.capture(),eq(job.dueAt()));
        task.getValue().run();
        verify(jobs).retry(7,now,error);
        verify(timer).schedule(any(Runnable.class),eq(retry.dueAt()));
    }
}
