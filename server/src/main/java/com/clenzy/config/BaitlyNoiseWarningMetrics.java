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
    private volatile Snapshot snapshot=new Snapshot(0,0,0,0,0);
    private volatile double lastSuccess;
    private volatile boolean healthy;
    record Snapshot(long uncertain,double age,long repair,long expired,long recentlyExpired) {}

    public BaitlyNoiseWarningMetrics(JdbcTemplate source,MeterRegistry registry) {
        db=new JdbcTemplate(java.util.Objects.requireNonNull(source.getDataSource()));
        db.setQueryTimeout(5);db.setMaxRows(1);
        this.registry=registry;
        gauge("uncertain",() -> snapshot.uncertain());
        gauge("oldest.uncertain.seconds",() -> snapshot.age());
        gauge("repair.pending",() -> snapshot.repair());
        gauge("expired.unattempted",() -> snapshot.expired());
        gauge("expired.unattempted.recent",() -> snapshot.recentlyExpired());
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
                WITH expired AS (
                    SELECT h.expires_at FROM baitly_noise_delivery_items i
                    JOIN baitly_noise_deliveries h ON h.alert_id=i.alert_id
                    WHERE h.expires_at<=CURRENT_TIMESTAMP
                        AND (i.expired_unattempted=true OR (i.state='PENDING' AND i.attempt IS NULL))
                        AND (i.channel<>'GUEST' OR NOT EXISTS (SELECT 1 FROM baitly_noise_warning_attempts w
                            WHERE w.alert_id=i.alert_id))
                ) SELECT
                  ((SELECT COUNT(*) FROM baitly_noise_warning_attempts WHERE state IN ('STARTED','UNKNOWN'))
                    +(SELECT COUNT(*) FROM baitly_noise_delivery_items WHERE channel='OWNER_EMAIL' AND state IN ('STARTED','UNKNOWN'))),
                  (SELECT COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-MIN(created_at))),0) FROM (
                    SELECT created_at FROM baitly_noise_warning_attempts WHERE state IN ('STARTED','UNKNOWN')
                    UNION ALL SELECT updated_at AS created_at FROM baitly_noise_delivery_items WHERE channel='OWNER_EMAIL' AND state IN ('STARTED','UNKNOWN')
                  ) uncertain),
                  ((SELECT COUNT(*) FROM baitly_noise_warning_attempts w
                     JOIN noise_alerts a ON a.id=w.alert_id AND a.organization_id=w.organization_id AND a.property_id=w.property_id
                     WHERE w.state='ACCEPTED' AND ((w.channel='EMAIL' AND a.notified_guest=false)
                       OR (w.channel<>'EMAIL' AND a.notified_whatsapp=false)))
                    +(SELECT COUNT(*) FROM (
                        SELECT DISTINCT h.alert_id,i.channel FROM baitly_noise_deliveries h
                        JOIN noise_alerts a ON a.id=h.alert_id AND a.organization_id=h.organization_id AND a.property_id=h.property_id
                        JOIN baitly_noise_delivery_items i ON i.alert_id=h.alert_id AND i.state='ACCEPTED'
                        WHERE ((i.channel='OWNER_EMAIL' AND a.notified_email=false) OR (i.channel='OWNER_IN_APP' AND a.notified_in_app=false))
                        AND NOT EXISTS (SELECT 1 FROM baitly_noise_delivery_items other WHERE other.alert_id=i.alert_id AND other.channel=i.channel AND other.state<>'ACCEPTED')
                    ) ready)),
                  (SELECT COUNT(*) FROM expired),
                  (SELECT COUNT(*) FROM expired WHERE expires_at>CURRENT_TIMESTAMP-INTERVAL '15' MINUTE)
                """,(row,index) -> new Snapshot(row.getLong(1),Math.max(0,row.getDouble(2)),row.getLong(3),row.getLong(4),row.getLong(5)));
            snapshot=java.util.Objects.requireNonNull(next);
            lastSuccess=registry.config().clock().wallTime()/1000.0;
            healthy=true;
        } catch(RuntimeException failure) {healthy=false;}
    }
}
