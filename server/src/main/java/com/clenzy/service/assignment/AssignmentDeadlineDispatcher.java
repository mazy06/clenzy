package com.clenzy.service.assignment;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ScheduledFuture;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.slf4j.LoggerFactory;

/** Réveils ponctuels, reconstruits depuis la file durable après démarrage ou rebalance Kafka. */
@Component
public class AssignmentDeadlineDispatcher {
    public record RecoveryRequested() {}
    private final AssignmentJobStore jobs;
    private final AssignmentJobProcessor processor;
    private final Clock clock;
    private final ThreadPoolTaskScheduler timer;
    private final Map<Long,ScheduledFuture<?>> alarms=new HashMap<>();
    @org.springframework.beans.factory.annotation.Autowired
    public AssignmentDeadlineDispatcher(AssignmentJobStore jobs,AssignmentJobProcessor processor,Clock clock) {
        this(jobs,processor,clock,newTimer());
    }
    AssignmentDeadlineDispatcher(AssignmentJobStore jobs,AssignmentJobProcessor processor,Clock clock,ThreadPoolTaskScheduler timer) {
        this.jobs=jobs; this.processor=processor; this.clock=clock; this.timer=timer;
    }
    private static ThreadPoolTaskScheduler newTimer() {
        var timer=new ThreadPoolTaskScheduler();
        timer.setPoolSize(2); timer.setThreadNamePrefix("baitly-assignment-");
        timer.setRemoveOnCancelPolicy(true); timer.initialize(); return timer;
    }
    public void wake(long id) { jobs.pending(id).ifPresent(job -> arm(id,job.dueAt())); }
    private synchronized void arm(long id,Instant at) {
        var previous=alarms.remove(id);
        if (previous!=null) previous.cancel(false);
        alarms.put(id,timer.schedule(() -> run(id),at));
    }
    private void run(long id) {
        synchronized (this) { alarms.remove(id); }
        try {
            processor.process(id);
            wake(id);
        } catch (Exception error) {
            LoggerFactory.getLogger(getClass()).error("Tâche d'attribution {} à retenter",id,error);
            try { jobs.retry(id,clock.instant(),error); wake(id); }
            catch (Exception unavailable) { arm(id,clock.instant().plusSeconds(30)); }
        }
    }
    @EventListener({ApplicationReadyEvent.class,RecoveryRequested.class})
    public void recover() { timer.execute(this::recoverPending); }
    private void recoverPending() {
        try {
            long after=0;
            for (;;) {
                var batch=jobs.recover(after);
                if (batch.isEmpty()) return;
                for (var job:batch) arm(job.id(),job.dueAt());
                after=batch.getLast().id();
            }
        } catch (Exception unavailable) {
            LoggerFactory.getLogger(getClass()).error("Reprise des tâches d'attribution différée",unavailable);
            timer.schedule(this::recoverPending,clock.instant().plusSeconds(30));
        }
    }
    @PreDestroy public void stop() { timer.shutdown(); }
}
