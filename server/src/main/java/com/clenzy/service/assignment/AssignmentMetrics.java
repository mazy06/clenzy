package com.clenzy.service.assignment;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Mesures dérivées des événements persistés : un redémarrage ne remet pas l'historique à zéro. */
@Component
public class AssignmentMetrics implements MeterBinder {
    private final JdbcTemplate db;
    public AssignmentMetrics(JdbcTemplate db) { this.db=db; }
    @Override public void bindTo(MeterRegistry registry) {
        gauge(registry,"baitly.assignment.expired", "SELECT count(*) FROM service_assignment_proposals WHERE status='EXPIRED'");
        gauge(registry,"baitly.assignment.public_needs", "SELECT count(*) FROM service_requests WHERE assignment_phase='PUBLIC'");
        gauge(registry,"baitly.assignment.manual_needs", "SELECT count(*) FROM service_requests WHERE assignment_phase='MANUAL'");
        gauge(registry,"baitly.assignment.overdue_proposals", "SELECT count(*) FROM service_assignment_proposals WHERE status='PENDING' AND expires_at<CURRENT_TIMESTAMP");
        gauge(registry,"baitly.assignment.notification_failures", "SELECT count(*) FROM baitly_assignment_jobs WHERE kind='NOTIFY' AND completed_at IS NULL AND attempts>0");
        gauge(registry,"baitly.assignment.jobs_retrying", "SELECT count(*) FROM baitly_assignment_jobs WHERE completed_at IS NULL AND attempts>0");
        gauge(registry,"baitly.assignment.jobs_overdue", "SELECT count(*) FROM baitly_assignment_jobs WHERE completed_at IS NULL AND due_at<CURRENT_TIMESTAMP-interval '30 seconds'");
        gauge(registry,"baitly.assignment.response_seconds", "SELECT coalesce(avg(extract(epoch FROM responded_at-created_at)),0) FROM service_assignment_proposals WHERE status IN ('ACCEPTED','DECLINED','QUOTED') AND responded_at>CURRENT_TIMESTAMP-interval '30 days'");
    }
    private void gauge(MeterRegistry registry,String name,String sql) {
        Gauge.builder(name,db, jdbc -> {
            try { Number value=jdbc.queryForObject(sql,Number.class); return value==null?0:value.doubleValue(); }
            catch (org.springframework.dao.DataAccessException unavailable) { return Double.NaN; }
        }).register(registry);
    }
}
