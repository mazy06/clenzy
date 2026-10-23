package com.clenzy.integration.minut.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;

import static com.clenzy.integration.minut.service.BaitlyMinutEventParser.*;

/** Independent commits fence every external attempt; no automatic rearm of uncertainty. */
@Service
public class BaitlyMinutEventJournal {
    public enum Step { REALTIME, AUTOMATION, EVALUATION, NOISE_PUBLISH }
    public record Event(UUID id, Long organization, Long device, Long property, Kind kind,
                        Double measuredDb, boolean transitioned, int nextStep, String state, Instant createdAt, Instant occurredAt) {
        public List<Step> plan() {
            if (kind == Kind.DISTURBANCE) return List.of(Step.EVALUATION, Step.NOISE_PUBLISH);
            if (!transitioned) return List.of();
            return kind == Kind.OFFLINE ? List.of(Step.REALTIME, Step.AUTOMATION) : List.of(Step.REALTIME);
        }
    }
    public record Ticket(Event event, Step step, UUID attempt, String deviceName) {}
    private final JdbcTemplate db;
    private final TransactionTemplate tx;

    public BaitlyMinutEventJournal(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db;
        tx = new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.setTimeout(10);
    }

    public UUID admit(Input input) {
        return safe(() -> tx.execute(status -> {
            if (input == null || input.key() == null || !input.key().matches("[a-f0-9]{64}")
                    || input.fingerprint() == null || !input.fingerprint().matches("[a-f0-9]{64}") || input.kind() == null || input.occurredAt() == null)
                throw unavailable();
            var devices = db.queryForList("""
                SELECT id, organization_id, property_id, online FROM noise_devices
                WHERE external_device_id=? AND device_type='MINUT' AND status='ACTIVE' AND simulation=false
                FOR UPDATE
                """, input.externalDevice());
            if (devices.size() != 1) throw unavailable();
            var device = devices.getFirst();
            Long id = ((Number) device.get("id")).longValue();
            Long org = ((Number) device.get("organization_id")).longValue();
            Long property = ((Number) device.get("property_id")).longValue();
            UUID eventId = UUID.randomUUID();
            Instant boundary=db.queryForObject("SELECT not_before FROM baitly_minut_recovery_boundary WHERE id=1",Timestamp.class).toInstant();
            var positions=db.queryForList("SELECT occurred_at FROM baitly_minut_device_cursor WHERE device_id=?",id);
            boolean review=input.occurredAt().isBefore(boundary) || (input.kind()!=Kind.DISTURBANCE && !positions.isEmpty()
                    && input.occurredAt().isBefore(((Timestamp)positions.getFirst().get("occurred_at")).toInstant()));
            boolean transition = input.kind() == Kind.OFFLINE ? !Boolean.FALSE.equals(device.get("online"))
                    : input.kind() == Kind.ONLINE && !Boolean.TRUE.equals(device.get("online"));
            if (review) transition=false;
            int inserted = db.update("""
                INSERT INTO baitly_minut_events
                (id,event_key,fingerprint,organization_id,device_id,property_id,event_type,measured_db,transitioned,state,occurred_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (event_key) DO NOTHING
                """, eventId,input.key(),input.fingerprint(),org,id,property,input.kind().name(),input.measuredDb(),transition,
                    review ? "REVIEW" : input.kind() != Kind.DISTURBANCE && !transition ? "DONE" : "READY",Timestamp.from(input.occurredAt()));
            if (inserted == 0) {
                var existing = db.queryForList("SELECT id,fingerprint,organization_id,device_id,property_id FROM baitly_minut_events WHERE event_key=?", input.key()).getFirst();
                if (!input.fingerprint().equals(existing.get("fingerprint")) || !org.equals(((Number)existing.get("organization_id")).longValue())
                        || !id.equals(((Number)existing.get("device_id")).longValue()) || !property.equals(((Number)existing.get("property_id")).longValue()))
                    throw unavailable();
                return (UUID) existing.get("id");
            }
            if (review) return eventId;
            // Device mutation and the intent to notify are committed together.
            if (input.kind() == Kind.OFFLINE) db.update("UPDATE noise_devices SET online=false WHERE id=? AND organization_id=?",id,org);
            if (input.kind() == Kind.ONLINE) db.update("UPDATE noise_devices SET online=true,last_seen_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?",id,org);
            if (transition) db.update("""
                INSERT INTO baitly_minut_device_cursor (device_id,organization_id,property_id,event_id,occurred_at) VALUES (?,?,?,?,?)
                ON CONFLICT (device_id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
                    property_id=EXCLUDED.property_id,event_id=EXCLUDED.event_id,occurred_at=EXCLUDED.occurred_at
                """,id,org,property,eventId,Timestamp.from(input.occurredAt()));
            return eventId;
        }));
    }

    public Optional<Ticket> claim(UUID id) {
        return safe(() -> tx.execute(status -> {
            var rows = db.query("SELECT * FROM baitly_minut_events WHERE id=? FOR UPDATE", BaitlyMinutEventJournal::read, id);
            if (rows.isEmpty()) throw unavailable();
            Event event = rows.getFirst();
            if (!event.state().equals("READY")) return Optional.empty();
            var names = db.queryForList("""
                SELECT name FROM noise_devices WHERE id=? AND organization_id=? AND property_id=?
                AND device_type='MINUT' AND status='ACTIVE' AND simulation=false
                """, event.device(),event.organization(),event.property());
            if (names.size() != 1 || event.nextStep() >= event.plan().size()) throw unavailable();
            if (event.kind() != Kind.DISTURBANCE && !Objects.equals(event.id(),db.queryForObject("""
                    SELECT event_id FROM baitly_minut_device_cursor WHERE device_id=? AND organization_id=? AND property_id=?
                    """,UUID.class,event.device(),event.organization(),event.property()))) {
                db.update("UPDATE baitly_minut_events SET state='SUPERSEDED',updated_at=CURRENT_TIMESTAMP WHERE id=?",id);
                return Optional.empty();
            }
            UUID attempt = UUID.randomUUID();
            db.update("UPDATE baitly_minut_events SET state='STARTED',attempt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",attempt,id);
            return Optional.of(new Ticket(event,event.plan().get(event.nextStep()),attempt,(String)names.getFirst().get("name")));
        }));
    }

    public void complete(Ticket ticket) {
        safe(() -> tx.execute(status -> {
            int next = ticket.event().nextStep() + 1;
            int updated = db.update("""
                UPDATE baitly_minut_events SET state=?,next_step=?,attempt=NULL,updated_at=CURRENT_TIMESTAMP
                WHERE id=? AND state='STARTED' AND attempt=? AND next_step=? AND organization_id=? AND device_id=? AND property_id=?
                """, next == ticket.event().plan().size() ? "DONE" : "READY",next,ticket.event().id(),ticket.attempt(),ticket.event().nextStep(),
                    ticket.event().organization(),ticket.event().device(),ticket.event().property());
            if (updated != 1) throw unavailable();
            return true;
        }));
    }

    public void uncertain(Ticket ticket) {
        safe(() -> tx.execute(status -> db.update("""
            UPDATE baitly_minut_events SET state='UNKNOWN',updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND state='STARTED' AND attempt=? AND next_step=? AND organization_id=? AND device_id=? AND property_id=?
            """,ticket.event().id(),ticket.attempt(),ticket.event().nextStep(),ticket.event().organization(),ticket.event().device(),ticket.event().property())));
    }

    public List<UUID> ready() {
        return safe(() -> db.queryForList("SELECT id FROM baitly_minut_events WHERE state='READY' ORDER BY updated_at,id LIMIT 50",UUID.class));
    }
    private static Event read(ResultSet row, int index) throws SQLException {
        return new Event(row.getObject("id",UUID.class),row.getLong("organization_id"),row.getLong("device_id"),row.getLong("property_id"),
                Kind.valueOf(row.getString("event_type")),row.getObject("measured_db",Double.class),row.getBoolean("transitioned"),
                row.getInt("next_step"),row.getString("state"),row.getTimestamp("created_at").toInstant(),row.getTimestamp("occurred_at").toInstant());
    }
    private <T> T safe(Supplier<T> work) {
        try { return work.get(); } catch (RuntimeException failure) { throw unavailable(); }
    }
}
