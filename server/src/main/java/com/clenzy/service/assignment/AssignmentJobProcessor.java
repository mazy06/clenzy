package com.clenzy.service.assignment;

import java.time.Clock;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssignmentJobProcessor {
    private final AssignmentJobStore jobs;
    private final ServiceAssignmentService assignments;
    private final AssignmentNotificationDelivery delivery;
    private final TenantContext tenant;
    private final Clock clock;
    private final AssignmentRealtime realtime;
    public AssignmentJobProcessor(AssignmentJobStore jobs,ServiceAssignmentService assignments,
            AssignmentNotificationDelivery delivery,TenantContext tenant,Clock clock,AssignmentRealtime realtime) {
        this.jobs=jobs; this.assignments=assignments; this.delivery=delivery; this.tenant=tenant; this.clock=clock;
        this.realtime=realtime;
    }
    @Transactional
    public void process(long id) {
        var snapshot=jobs.pending(id).orElse(null);
        if (snapshot==null) return;
        // Même ordre de verrous que les mutations métier et leurs triggers : besoin, puis tâche.
        Long org=jobs.lockRequest(snapshot.requestId());
        if (org==null) return;
        var job=jobs.lock(id).orElse(null);
        if (job==null || clock.instant().isBefore(job.dueAt())) return;
        try {
            tenant.setOrganizationId(org);
            switch (job.kind()) {
                case "TICK" -> assignments.tick(job.requestId());
                case "NOTIFY" -> delivery.send(job.notificationId());
                case "REFRESH" -> realtime.changed(job.requestId());
                default -> throw new IllegalArgumentException("Type de tâche inconnu");
            }
            jobs.complete(id);
        } finally { tenant.clear(); }
    }
}
