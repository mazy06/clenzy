package com.clenzy.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Supplier;

/** Baitly: queued work is not an external attempt. Only confirmed local work may be retried. */
@Service
public class BaitlyNoiseDeliveryOutbox {
    public record Work(Long alert, Long organization, String channel, int ordinal) {}
    public record Snapshot(Long config, Long reservation, Long guest, LocalDateTime guestVersion) {}
    private final JdbcTemplate db;
    private final TransactionTemplate tx;

    public BaitlyNoiseDeliveryOutbox(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db=db;
        tx=new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.setTimeout(10);
    }

    /** MUST join the alert transaction: an enqueue failure must roll the alert back. */
    public void enqueue(Long alert, Long organization, Long config) {
        try {
            if (!TransactionSynchronizationManager.isActualTransactionActive()) throw unavailable();
            if(db.queryForList("SELECT id FROM noise_alerts WHERE id=? AND organization_id=? FOR UPDATE",alert,organization).size()!=1)
                throw unavailable();
            if (!db.queryForList("SELECT alert_id FROM baitly_noise_deliveries WHERE alert_id=?",alert).isEmpty()) return;
            Long boundary=db.queryForObject("SELECT last_legacy_alert_id FROM baitly_noise_delivery_boundary WHERE id=1",Long.class);
            if(boundary==null) throw unavailable();
            if(alert<=boundary) return; // No backfill of historical notifications at cutover.
            var scopes=db.queryForList("""
                SELECT a.property_id,a.measured_db,a.threshold_db,a.severity,c.id config_id,c.updated_at config_version,
                    c.notify_in_app,c.notify_email,c.notify_guest_message,c.email_recipients,
                    p.updated_at property_version,p.owner_id,u.updated_at owner_version
                FROM noise_alerts a JOIN properties p ON p.id=a.property_id AND p.organization_id=a.organization_id
                JOIN noise_alert_configs c ON c.id=? AND c.organization_id=a.organization_id AND c.property_id=a.property_id
                LEFT JOIN users u ON u.id=p.owner_id
                WHERE a.id=? AND a.organization_id=? AND c.enabled=true
                """,config,alert,organization);
            if(scopes.size()!=1) throw unavailable();
            var s=scopes.getFirst();
            var stays=db.queryForList("""
                SELECT r.id,r.guest_id,g.updated_at FROM reservations r JOIN guests g ON g.id=r.guest_id
                    AND g.organization_id=r.organization_id
                WHERE r.organization_id=? AND r.property_id=? AND r.status='confirmed' AND r.check_in<=? AND r.check_out>=?
                ORDER BY r.id LIMIT 2
                """,organization,s.get("property_id"),LocalDate.now(),LocalDate.now());
            Map<String,Object> stay=stays.size()==1 ? stays.getFirst() : Map.of();
            db.update("""
                INSERT INTO baitly_noise_deliveries (alert_id,organization_id,property_id,config_id,config_version,
                    property_version,owner_id,owner_version,reservation_id,guest_id,guest_version,measured_db,threshold_db,severity)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,alert,organization,s.get("property_id"),config,s.get("config_version"),s.get("property_version"),
                s.get("owner_id"),s.get("owner_version"),stay.get("id"),stay.get("guest_id"),stay.get("updated_at"),
                s.get("measured_db"),s.get("threshold_db"),s.get("severity"));
            if(Boolean.TRUE.equals(s.get("notify_in_app"))) insert(alert,"OWNER_IN_APP",0,false);
            if(Boolean.TRUE.equals(s.get("notify_email"))) {
                int count=recipients((String)s.get("email_recipients")).size();
                for(int i=0;i<Math.max(1,count);i++) insert(alert,"OWNER_EMAIL",i,false);
            }
            if(Boolean.TRUE.equals(s.get("notify_guest_message"))) insert(alert,"GUEST",0,stay.isEmpty());
        } catch(RuntimeException failure) {throw unavailable();}
    }

    public static List<String> recipients(String configured) {
        if(configured==null || configured.isBlank()) return List.of();
        var unique=new LinkedHashMap<String,String>();
        for(String recipient:configured.trim().split("[,;\\s]+")) {
            if(!recipient.isBlank()) unique.putIfAbsent(recipient.toLowerCase(Locale.ROOT),recipient);
        }
        return List.copyOf(unique.values());
    }
    private void insert(Long alert,String channel,int ordinal,boolean skipped) {
        db.update("INSERT INTO baitly_noise_delivery_items(alert_id,channel,ordinal,state) VALUES (?,?,?,?)",
            alert,channel,ordinal,skipped ? "SKIPPED" : "PENDING");
    }
    public List<Work> pending() {
        return safe(() -> db.query("""
            SELECT i.alert_id,h.organization_id,i.channel,i.ordinal FROM baitly_noise_delivery_items i
            JOIN baitly_noise_deliveries h ON h.alert_id=i.alert_id
            WHERE i.state='PENDING' AND i.next_at<=CURRENT_TIMESTAMP ORDER BY i.next_at,i.alert_id,i.channel,i.ordinal LIMIT 25
            """,(r,n) -> new Work(r.getLong(1),r.getLong(2),r.getString(3),r.getInt(4))));
    }
    public Optional<Snapshot> snapshot(Work work) {
        return safe(() -> {
            if(!valid(work) || !fresh(work)) return Optional.empty();
            var rows=db.queryForList("SELECT config_id,reservation_id,guest_id,guest_version FROM baitly_noise_deliveries WHERE alert_id=? AND organization_id=?",
                work.alert(),work.organization());
            if(rows.size()!=1) return Optional.empty();
            var h=rows.getFirst();
            return Optional.of(new Snapshot(number(h.get("config_id")),number(h.get("reservation_id")),number(h.get("guest_id")),date(h.get("guest_version"))));
        });
    }
    private boolean valid(Work w) {
        Boolean base=db.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM baitly_noise_deliveries h
                JOIN noise_alerts a ON a.id=h.alert_id AND a.organization_id=h.organization_id AND a.property_id=h.property_id
                JOIN properties p ON p.id=h.property_id AND p.organization_id=h.organization_id
                JOIN noise_alert_configs c ON c.id=h.config_id AND c.organization_id=h.organization_id AND c.property_id=h.property_id
                WHERE h.alert_id=? AND h.organization_id=? AND c.enabled=true
                AND c.updated_at IS NOT DISTINCT FROM h.config_version AND p.updated_at IS NOT DISTINCT FROM h.property_version
                AND a.measured_db=h.measured_db AND a.threshold_db=h.threshold_db AND a.severity=h.severity
                AND ((?='GUEST' AND c.notify_guest_message=true) OR (?='OWNER_EMAIL' AND c.notify_email=true)
                    OR (?='OWNER_IN_APP' AND c.notify_in_app=true)))
            """,Boolean.class,w.alert(),w.organization(),w.channel(),w.channel(),w.channel());
        if(!Boolean.TRUE.equals(base)) return false;
        if("GUEST".equals(w.channel())) return Boolean.TRUE.equals(db.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM baitly_noise_deliveries h JOIN reservations r ON r.id=h.reservation_id
                AND r.organization_id=h.organization_id AND r.property_id=h.property_id AND r.guest_id=h.guest_id
                JOIN guests g ON g.id=h.guest_id AND g.organization_id=h.organization_id
                WHERE h.alert_id=? AND h.organization_id=? AND r.status='confirmed' AND r.check_in<=? AND r.check_out>=?
                AND g.updated_at IS NOT DISTINCT FROM h.guest_version)
            """,Boolean.class,w.alert(),w.organization(),LocalDate.now(),LocalDate.now()));
        return Boolean.TRUE.equals(db.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM baitly_noise_deliveries h JOIN properties p ON p.id=h.property_id
                JOIN users u ON u.id=h.owner_id AND p.owner_id=u.id
                WHERE h.alert_id=? AND h.organization_id=? AND u.status='ACTIVE'
                AND (u.organization_id=h.organization_id OR u.role IN ('SUPER_ADMIN','SUPER_MANAGER'))
                AND u.updated_at IS NOT DISTINCT FROM h.owner_version)
            """,Boolean.class,w.alert(),w.organization()));
    }
    private boolean fresh(Work w) {
        return Boolean.TRUE.equals(db.queryForObject("SELECT expires_at>CURRENT_TIMESTAMP FROM baitly_noise_deliveries WHERE alert_id=? AND organization_id=?",
            Boolean.class,w.alert(),w.organization()));
    }
    private boolean lockPending(Work w) {
        return db.queryForList("""
            SELECT i.alert_id FROM baitly_noise_delivery_items i JOIN baitly_noise_deliveries h ON h.alert_id=i.alert_id
            WHERE i.alert_id=? AND h.organization_id=? AND i.channel=? AND i.ordinal=? AND i.state='PENDING' FOR UPDATE
            """,w.alert(),w.organization(),w.channel(),w.ordinal()).size()==1;
    }
    private void state(Work w,String state) {
        db.update("UPDATE baitly_noise_delivery_items SET state=?,updated_at=CURRENT_TIMESTAMP WHERE alert_id=? AND channel=? AND ordinal=?",
            state,w.alert(),w.channel(),w.ordinal());
    }
    public void skip(Work w) {
        safe(() -> tx.execute(status -> {if(lockPending(w)) state(w,"SKIPPED"); return true;}));
    }
    public void defer(Work w) {
        safe(() -> tx.execute(status -> db.update("""
            UPDATE baitly_noise_delivery_items SET next_at=CURRENT_TIMESTAMP+INTERVAL '30' SECOND,updated_at=CURRENT_TIMESTAMP
            WHERE alert_id=? AND channel=? AND ordinal=? AND state='PENDING'
                AND EXISTS (SELECT 1 FROM baitly_noise_deliveries h WHERE h.alert_id=? AND h.organization_id=?)
            """,w.alert(),w.channel(),w.ordinal(),w.alert(),w.organization())));
    }
    public Optional<UUID> startEmail(Work w) {
        return safe(() -> tx.execute(status -> {
            if(!"OWNER_EMAIL".equals(w.channel()) || !lockPending(w)) return Optional.empty();
            if(!valid(w) || !fresh(w)) {state(w,"SKIPPED"); return Optional.empty();}
            UUID attempt=UUID.randomUUID();
            db.update("UPDATE baitly_noise_delivery_items SET state='STARTED',attempt=?,updated_at=CURRENT_TIMESTAMP WHERE alert_id=? AND channel=? AND ordinal=?",
                attempt,w.alert(),w.channel(),w.ordinal());
            return Optional.of(attempt);
        }));
    }
    public void finishEmail(Work w,UUID attempt,boolean accepted) {
        safe(() -> tx.execute(status -> {
            int n=db.update("""
                UPDATE baitly_noise_delivery_items SET state=?,updated_at=CURRENT_TIMESTAMP
                WHERE alert_id=? AND channel='OWNER_EMAIL' AND ordinal=? AND attempt=? AND state='STARTED'
                    AND EXISTS (SELECT 1 FROM baitly_noise_deliveries h WHERE h.alert_id=? AND h.organization_id=?)
                """,accepted ? "ACCEPTED" : "UNKNOWN",w.alert(),w.ordinal(),attempt,w.alert(),w.organization());
            if(accepted && n!=1) throw unavailable();
            return true;
        }));
    }
    /** The strict notification method is DB-only; notification and proof share this transaction. */
    public void persistInApp(Work w,Supplier<Boolean> persist) {
        safe(() -> tx.execute(status -> {
            if(!"OWNER_IN_APP".equals(w.channel()) || !lockPending(w)) return false;
            if(!valid(w) || !fresh(w)) {state(w,"SKIPPED"); return false;}
            state(w,persist.get() ? "ACCEPTED" : "SKIPPED");
            return true;
        }));
    }
    public void finishGuest(Work w) {
        safe(() -> tx.execute(status -> {
            if(!"GUEST".equals(w.channel())) throw unavailable();
            if(!lockPending(w)) return false;
            var proof=db.queryForList("SELECT state FROM baitly_noise_warning_attempts WHERE alert_id=? AND organization_id=?",
                w.alert(),w.organization());
            if(proof.isEmpty()) return false;
            String s=(String)proof.getFirst().get("state");
            state(w,"ACCEPTED".equals(s) ? "ACCEPTED" : "REVIEW".equals(s) ? "SKIPPED" : "UNKNOWN");
            return true;
        }));
    }
    /** Local proof repair only; no owner/guest/provider lookup or delegation. */
    public void repair() {
        safe(() -> tx.execute(status -> {
            db.update("""
                UPDATE baitly_noise_delivery_items SET state='ACCEPTED',updated_at=CURRENT_TIMESTAMP
                WHERE channel='GUEST' AND state IN ('PENDING','UNKNOWN') AND alert_id IN (
                    SELECT i.alert_id FROM baitly_noise_delivery_items i
                    JOIN baitly_noise_deliveries h ON h.alert_id=i.alert_id
                    JOIN baitly_noise_warning_attempts w ON w.alert_id=h.alert_id AND w.organization_id=h.organization_id AND w.property_id=h.property_id
                    WHERE i.channel='GUEST' AND i.state IN ('PENDING','UNKNOWN') AND w.state='ACCEPTED'
                    ORDER BY i.updated_at,i.alert_id LIMIT 25)
                """);
            for(String channel:List.of("OWNER_IN_APP","OWNER_EMAIL")) {
                String column=channel.equals("OWNER_EMAIL") ? "notified_email" : "notified_in_app";
                db.update("UPDATE noise_alerts SET "+column+"=true WHERE id IN ("
                    +"SELECT a.id FROM noise_alerts a JOIN baitly_noise_deliveries h ON h.alert_id=a.id AND h.organization_id=a.organization_id "
                    +"AND h.property_id=a.property_id WHERE a."+column+"=false AND EXISTS (SELECT 1 FROM baitly_noise_delivery_items i WHERE i.alert_id=h.alert_id AND i.channel=? AND i.state='ACCEPTED') "
                    +"AND NOT EXISTS (SELECT 1 FROM baitly_noise_delivery_items i WHERE i.alert_id=h.alert_id AND i.channel=? AND i.state<>'ACCEPTED') ORDER BY a.id LIMIT 25)",channel,channel);

            }
            return true;
        }));
    }
    private static Long number(Object n) {return n==null ? null : ((Number)n).longValue();}
    private static LocalDateTime date(Object n) {return n==null ? null : ((Timestamp)n).toLocalDateTime();}
    private <T> T safe(Supplier<T> call) {try{return call.get();}catch(RuntimeException failure){throw unavailable();}}
    private static IllegalStateException unavailable() {return new IllegalStateException("Delegation bruit non confirmee");}
}
