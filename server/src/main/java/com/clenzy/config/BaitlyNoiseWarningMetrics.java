package com.clenzy.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Private platform aggregates, without guest, organization, contact or receipt labels. */
@Component
public class BaitlyNoiseWarningMetrics {
    private final JdbcTemplate db;
    private final MeterRegistry registry;
    private volatile Snapshot snapshot=new Snapshot(0,0,0);
    private volatile double lastSuccess;
    private volatile boolean healthy;
    record Snapshot(long uncertain,double age,long repair) {}

    public BaitlyNoiseWarningMetrics(JdbcTemplate source,MeterRegistry registry) {
        db=new JdbcTemplate(java.util.Objects.requireNonNull(source.getDataSource()));
        db.setQueryTimeout(5);db.setMaxRows(1);
        this.registry=registry;
        gauge("uncertain",() -> snapshot.uncertain());
        gauge("oldest.uncertain.seconds",() -> snapshot.age());
        gauge("repair.pending",() -> snapshot.repair());
        gauge("snapshot.healthy",() -> healthy?1:0);
        gauge("snapshot.last.success.timestamp.seconds",() -> lastSuccess);
    }
    private void gauge(String suffix,java.util.function.DoubleSupplier value) {
        Gauge.builder("baitly.noise.warning."+suffix,value,java.util.function.DoubleSupplier::getAsDouble)
            .description("Baitly noise warning aggregate; no customer labels").strongReference(true).register(registry);
    }

    /** SELECT outside the scrape; a failed refresh never publishes a fresh zero. */
    @Scheduled(fixedDelayString="${baitly.noise.warning.metrics-ms:60000}",
               initialDelayString="${baitly.noise.warning.metrics-initial-ms:30000}")
    public void refresh() {
        try {
            Snapshot next=db.queryForObject("""
                SELECT
                  (SELECT COUNT(*) FROM baitly_noise_warning_attempts WHERE state IN ('STARTED','UNKNOWN')),
                  (SELECT COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-MIN(created_at))),0)
                     FROM baitly_noise_warning_attempts WHERE state IN ('STARTED','UNKNOWN')),
                  (SELECT COUNT(*) FROM baitly_noise_warning_attempts w
                     JOIN noise_alerts a ON a.id=w.alert_id AND a.organization_id=w.organization_id AND a.property_id=w.property_id
                     WHERE w.state='ACCEPTED' AND ((w.channel='EMAIL' AND a.notified_guest=false)
                       OR (w.channel<>'EMAIL' AND a.notified_whatsapp=false)))
                """,(row,index) -> new Snapshot(row.getLong(1),Math.max(0,row.getDouble(2)),row.getLong(3)));
            snapshot=java.util.Objects.requireNonNull(next);
            lastSuccess=registry.config().clock().wallTime()/1000.0;
            healthy=true;
        } catch(RuntimeException failure) {healthy=false;}
    }
}
