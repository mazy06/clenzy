package com.clenzy.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Supplier;

/** Baitly: committed intent before effect; uncertainty never expires or rearms itself. */
@Service
public class BaitlyNoiseWarningJournal {
    public enum Channel {
        EMAIL, WHATSAPP_META, WHATSAPP_OPENWA;
        public String publicName() { return this == EMAIL ? "email" : "whatsapp"; }
    }
    public record Scope(Long alert, Long organization, Long property, Long reservation, Long guest,
                        LocalDateTime guestVersion, Channel channel, double measuredDb, int thresholdDb, String severity) {}
    public record Ticket(Scope scope, UUID attempt) {}
    private final JdbcTemplate db;
    private final TransactionTemplate tx;

    public BaitlyNoiseWarningJournal(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db;
        tx = new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.setTimeout(10);
    }

    public Optional<Ticket> claim(Scope scope) {
        return safe(() -> tx.execute(status -> {
            validate(scope);
            // Reservation then alert: one short lock order for every guest-warning source.
            var stays=db.queryForList("""
                SELECT id,check_in,check_out FROM reservations WHERE id=? AND organization_id=? AND property_id=? AND guest_id=?
                  AND status='confirmed' AND check_in<=? AND check_out>=? FOR UPDATE
                """, scope.reservation(),scope.organization(),scope.property(),scope.guest(),
                    LocalDate.now(),LocalDate.now());
            if(stays.size()!=1) throw unavailable();
            if (db.queryForList("SELECT id FROM properties WHERE id=? AND organization_id=?",
                    scope.property(),scope.organization()).size()!=1) throw unavailable();
            if (db.queryForList("""
                SELECT id FROM guests WHERE id=? AND organization_id=? AND updated_at IS NOT DISTINCT FROM CAST(? AS TIMESTAMP(6))
                """,scope.guest(),scope.organization(),stamp(scope.guestVersion())).size()!=1) throw unavailable();
            var alerts=db.queryForList("""
                SELECT measured_db,threshold_db,severity,created_at,notified_guest,notified_whatsapp FROM noise_alerts
                WHERE id=? AND organization_id=? AND property_id=? FOR UPDATE
                """,scope.alert(),scope.organization(),scope.property());
            if (alerts.size()!=1) throw unavailable();
            var alert=alerts.getFirst();
            if (Double.compare(((Number)alert.get("measured_db")).doubleValue(),scope.measuredDb())!=0
                    || ((Number)alert.get("threshold_db")).intValue()!=scope.thresholdDb()
                    || !scope.severity().equals(alert.get("severity"))) throw unavailable();
            var existing=db.queryForList("SELECT organization_id,property_id FROM baitly_noise_warning_attempts WHERE alert_id=?",scope.alert());
            if (!existing.isEmpty()) {
                var old=existing.getFirst();
                if (!scope.organization().equals(((Number)old.get("organization_id")).longValue())
                        || !scope.property().equals(((Number)old.get("property_id")).longValue())) throw unavailable();
                return Optional.empty();
            }
            var date=((Timestamp)alert.get("created_at")).toLocalDateTime().toLocalDate();
            var checkIn=((java.sql.Date)stays.getFirst().get("check_in")).toLocalDate();
            var checkOut=((java.sql.Date)stays.getFirst().get("check_out")).toLocalDate();
            if(date.isBefore(checkIn) || date.isAfter(checkOut)) throw unavailable();
            Long legacy=db.queryForObject("SELECT last_legacy_alert_id FROM baitly_noise_warning_boundary WHERE id=1",Long.class);
            if (legacy==null) throw unavailable();
            boolean review=scope.alert()<=legacy || Boolean.TRUE.equals(alert.get("notified_guest"))
                    || Boolean.TRUE.equals(alert.get("notified_whatsapp"));
            if (!review) {
                // A STARTED/UNKNOWN warning blocks this stay even after Redis loss or a new day.
                Boolean pending=db.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM baitly_noise_warning_attempts WHERE reservation_id=?
                       AND (state IN ('STARTED','UNKNOWN') OR (state='ACCEPTED' AND accepted_at>CURRENT_TIMESTAMP-INTERVAL '24' HOUR)))
                    """,Boolean.class,scope.reservation());
                Boolean legacyWindow=db.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM noise_alerts WHERE organization_id=? AND property_id=?
                        AND created_at>LOCALTIMESTAMP-INTERVAL '24' HOUR AND (notified_guest=true OR notified_whatsapp=true))
                    """,Boolean.class,scope.organization(),scope.property());
                if (Boolean.TRUE.equals(pending) || Boolean.TRUE.equals(legacyWindow)) return Optional.empty();
            }
            UUID attempt=review ? null : UUID.randomUUID();
            int inserted=db.update("""
                INSERT INTO baitly_noise_warning_attempts
                  (alert_id,organization_id,property_id,reservation_id,guest_id,channel,state,attempt)
                VALUES (?,?,?,?,?,?,?,?)
                """,scope.alert(),scope.organization(),scope.property(),scope.reservation(),scope.guest(),
                scope.channel().name(),review ? "REVIEW" : "STARTED",attempt);
            return inserted==1 && !review ? Optional.of(new Ticket(scope,attempt)) : Optional.empty();
        }));
    }

    /** A normal email return proves delegation only; WhatsApp also requires a nonblank receipt. */
    public void accepted(Ticket ticket, String receipt) {
        safe(() -> tx.execute(status -> {
            validate(ticket.scope());
            if (ticket.attempt()==null) throw unavailable();
            String hash=null;
            if (ticket.scope().channel()!=Channel.EMAIL) {
                if (receipt==null || receipt.isBlank()) throw unavailable();
                hash=hash(receipt);
            }
            int changed=db.update("""
                UPDATE baitly_noise_warning_attempts SET state='ACCEPTED',receipt_hash=?,
                    accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
                WHERE alert_id=? AND organization_id=? AND property_id=? AND reservation_id=? AND guest_id=?
                    AND channel=? AND state='STARTED' AND attempt=?
                """,hash,ticket.scope().alert(),ticket.scope().organization(),ticket.scope().property(),
                ticket.scope().reservation(),ticket.scope().guest(),ticket.scope().channel().name(),ticket.attempt());
            if(changed!=1) throw unavailable();
            return true;
        }));
    }

    /** Partial local repair from the committed proof; never sends anything or merges a stale entity. */
    public Optional<Channel> repairAccepted(Long organization, Long alertId) {
        return safe(() -> tx.execute(status -> {
            var rows=db.queryForList("""
                SELECT property_id,channel FROM baitly_noise_warning_attempts
                WHERE alert_id=? AND organization_id=? AND state='ACCEPTED'
                """,alertId,organization);
            if(rows.isEmpty()) return Optional.empty();
            var row=rows.getFirst();
            Channel channel=Channel.valueOf((String)row.get("channel"));
            String column=channel==Channel.EMAIL ? "notified_guest" : "notified_whatsapp";
            if(db.update("UPDATE noise_alerts SET "+column+"=true WHERE id=? AND organization_id=? AND property_id=?",
                    alertId,organization,row.get("property_id"))!=1) throw unavailable();
            return Optional.of(channel);
        }));
    }

    public void uncertain(Ticket ticket) {
        safe(() -> tx.execute(status -> db.update("""
            UPDATE baitly_noise_warning_attempts SET state='UNKNOWN',updated_at=CURRENT_TIMESTAMP
            WHERE alert_id=? AND organization_id=? AND property_id=? AND reservation_id=? AND guest_id=?
                AND channel=? AND state='STARTED' AND attempt=?
            """,ticket.scope().alert(),ticket.scope().organization(),ticket.scope().property(),
                ticket.scope().reservation(),ticket.scope().guest(),ticket.scope().channel().name(),ticket.attempt())));
    }

    public record Repair(Long organization,Long alert) {}
    public List<Repair> repairQueue() {
        return safe(() -> tx.execute(status -> db.query("""
            SELECT w.organization_id,w.alert_id FROM baitly_noise_warning_attempts w
            JOIN noise_alerts a ON a.id=w.alert_id AND a.organization_id=w.organization_id AND a.property_id=w.property_id
            WHERE w.state='ACCEPTED' AND ((w.channel='EMAIL' AND a.notified_guest=false)
                 OR (w.channel<>'EMAIL' AND a.notified_whatsapp=false))
            ORDER BY w.updated_at,w.alert_id LIMIT 50
            """,(row,index) -> new Repair(row.getLong(1),row.getLong(2)))));
    }

    public void deferRepair(Repair repair) {
        safe(() -> tx.execute(status -> db.update("""
            UPDATE baitly_noise_warning_attempts SET updated_at=CURRENT_TIMESTAMP
            WHERE alert_id=? AND organization_id=? AND state='ACCEPTED'
            """,repair.alert(),repair.organization())));
    }

    private static void validate(Scope s) {
        if(s==null || !positive(s.alert()) || !positive(s.organization()) || !positive(s.property())
                || !positive(s.reservation()) || !positive(s.guest()) || s.channel()==null
                || !Double.isFinite(s.measuredDb()) || s.measuredDb()<=0 || s.thresholdDb()<=0
                || !Set.of("WARNING","CRITICAL").contains(s.severity()==null ? "" : s.severity())) throw unavailable();
    }
    private static boolean positive(Long n) { return n!=null && n>0; }
    private static Timestamp stamp(LocalDateTime at) { return at==null ? null : Timestamp.valueOf(at); }
    private static String hash(String receipt) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(receipt.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception failure) { throw unavailable(); }
    }
    private <T> T safe(Supplier<T> call) {
        try { return call.get(); } catch (RuntimeException failure) { throw unavailable(); }
    }
    private static IllegalStateException unavailable() {
        return new IllegalStateException("Avertissement voyageur non confirme");
    }
}
