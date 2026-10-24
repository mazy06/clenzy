package com.clenzy.service;

import com.clenzy.model.NoiseAlert.AlertSeverity;
import com.clenzy.model.NoiseAlertTimeWindow;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.sql.Time;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

/** Baitly: one configuration lock for every noise source, held only until alert/outbox commit. */
@Service
public class BaitlyNoiseAlertAdmission {
    public record Admission(Long config,AlertSeverity severity,int threshold,String label) {}
    private final JdbcTemplate db;
    public BaitlyNoiseAlertAdmission(JdbcTemplate db) {this.db=db;}

    public Optional<Admission> admit(Long organization,Long property,double measured) {
        if(!Double.isFinite(measured) || measured<=0) return Optional.empty();
        try {
            if(!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException();
            var configs=db.queryForList("""
                SELECT id,enabled,cooldown_minutes FROM noise_alert_configs c WHERE c.organization_id=? AND c.property_id=?
                    AND EXISTS (SELECT 1 FROM properties p WHERE p.id=c.property_id AND p.organization_id=c.organization_id)
                FOR UPDATE
                """,organization,property);
            if(configs.isEmpty() || !Boolean.TRUE.equals(configs.getFirst().get("enabled"))) return Optional.empty();
            var config=configs.getFirst();
            int cooldown=((Number)config.get("cooldown_minutes")).intValue();
            if(cooldown<0) throw new IllegalStateException();
            Long id=((Number)config.get("id")).longValue();
            // Read after acquiring the lock; an earlier managed JPA snapshot is never authoritative.
            var windows=db.query("""
                SELECT start_time,end_time,warning_threshold_db,critical_threshold_db,label
                FROM noise_alert_time_windows WHERE config_id=? ORDER BY id
                """,(r,n) -> {
                    var w=new NoiseAlertTimeWindow();
                    w.setStartTime(((Time)r.getObject(1)).toLocalTime());w.setEndTime(((Time)r.getObject(2)).toLocalTime());
                    w.setWarningThresholdDb(r.getInt(3));w.setCriticalThresholdDb(r.getInt(4));w.setLabel(r.getString(5));return w;
                },id);
            var window=NoiseAlertService.findMatchingWindow(windows,LocalTime.now());
            if(window==null) return Optional.empty();
            AlertSeverity severity=NoiseAlertService.determineSeverity(measured,window);
            if(severity==null) return Optional.empty();
            boolean recent=Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM noise_alerts WHERE organization_id=? AND property_id=? AND severity=? AND created_at>?)
                """,Boolean.class,organization,property,severity.name(),LocalDateTime.now().minusMinutes(cooldown)));
            if(recent) return Optional.empty();
            return Optional.of(new Admission(id,severity,severity==AlertSeverity.CRITICAL ? window.getCriticalThresholdDb() : window.getWarningThresholdDb(),window.getLabel()));
        } catch(RuntimeException failure) {throw new IllegalStateException("Admission bruit non confirmee");}
    }
}
