package com.clenzy.service.automation;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

/** Permanent database fences for legacy lock and report effects. Never retries a provider. */
@Component
public class BaitlyExternalEffectJournal {
    public enum Kind { LOCK, REPORT }
    public enum Operation { CREATE, ROTATE, REVOKE, SEND }
    public record Scope(long org, Kind kind, long resource, Operation operation, String occurrence) {
        public Scope {
            if (org <= 0 || resource <= 0 || kind == null || operation == null || occurrence == null
                    || !occurrence.matches("(?:[0-9]+|once|reservation:[0-9]+(?::[0-9a-f-]{36})?|manual:[0-9a-f-]{36})")
                    || (kind == Kind.REPORT && operation != Operation.SEND)
                    || (kind == Kind.LOCK && operation == Operation.SEND))
                throw new IllegalArgumentException("EXTERNAL_EFFECT_SCOPE_INVALID");
        }
    }
    public record Ticket(Scope scope, UUID token, boolean done, Long reference) {}
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;

    public BaitlyExternalEffectJournal(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db = db;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(10);
    }

    public Ticket claim(Scope scope) {
        return claim(scope, () -> {});
    }

    public Ticket claim(Scope scope, Runnable validate) {
        return transaction.execute(status -> {
            lock(scope);
            validate.run();
            if (db.queryForObject("SELECT count(*) FROM baitly_external_effect_attempts WHERE organization_id=? AND kind=? AND resource_id=? AND state IN ('STARTED','UNKNOWN')",
                    Long.class, scope.org(), scope.kind().name(), scope.resource()) != 0)
                throw new IllegalStateException("EXTERNAL_EFFECT_RECONCILIATION_REQUIRED");
            var existing = db.query("SELECT attempt_token,effect_ref_id FROM baitly_external_effect_attempts WHERE organization_id=? AND kind=? AND resource_id=? AND operation=? AND occurrence=? AND state='DONE'",
                (rs, index) -> new Ticket(scope, rs.getObject(1, UUID.class), true, rs.getObject(2, Long.class)),
                scope.org(), scope.kind().name(), scope.resource(), scope.operation().name(), scope.occurrence());
            if (!existing.isEmpty()) return existing.getFirst();
            UUID token = UUID.randomUUID();
            db.update("INSERT INTO baitly_external_effect_attempts(organization_id,kind,resource_id,operation,occurrence,attempt_token,state,attempted_at) VALUES (?,?,?,?,?,?,'STARTED',?)",
                scope.org(), scope.kind().name(), scope.resource(), scope.operation().name(), scope.occurrence(), token, LocalDateTime.now());
            return new Ticket(scope, token, false, null);
        });
    }

    public void deleteIfUnused(Scope scope, Runnable delete) {
        transaction.executeWithoutResult(status -> {
            lock(scope);
            if (hasHistory(scope.org(), scope.kind(), scope.resource()))
                throw new IllegalStateException("EXTERNAL_EFFECT_HISTORY_PROTECTED");
            delete.run();
        });
    }

    private void lock(Scope scope) {
        db.update("INSERT INTO baitly_external_effect_guards VALUES (?,?,?) ON CONFLICT DO NOTHING",
            scope.org(), scope.kind().name(), scope.resource());
        db.queryForObject("SELECT resource_id FROM baitly_external_effect_guards WHERE organization_id=? AND kind=? AND resource_id=? FOR UPDATE",
            Long.class, scope.org(), scope.kind().name(), scope.resource());
    }

    /** Business result and DONE commit atomically; callback MUST contain database work only. */
    public <T> T complete(Ticket ticket, Supplier<T> save, Function<T, Long> reference) {
        if (ticket.done()) throw new IllegalStateException("EXTERNAL_EFFECT_ALREADY_COMPLETED");
        return transaction.execute(status -> {
            // Lock and validate before touching the business row. Stale tickets cannot mutate it.
            var states = db.queryForList("SELECT state FROM baitly_external_effect_attempts WHERE attempt_token=? AND organization_id=? AND kind=? AND resource_id=? AND operation=? AND occurrence=? FOR UPDATE",
                String.class, ticket.token(), ticket.scope().org(), ticket.scope().kind().name(), ticket.scope().resource(),
                ticket.scope().operation().name(), ticket.scope().occurrence());
            if (states.size() != 1 || !"STARTED".equals(states.getFirst()))
                throw new IllegalStateException("EXTERNAL_EFFECT_RECONCILIATION_REQUIRED");
            T result = save.get();
            db.update("UPDATE baitly_external_effect_attempts SET state='DONE',completed_at=?,effect_ref_id=? WHERE attempt_token=?",
                LocalDateTime.now(), reference.apply(result), ticket.token());
            return result;
        });
    }

    /** Observed accepted recipients only; no address or payload is retained. Never authorizes resending. */
    public void progress(Ticket ticket) {
        transaction.executeWithoutResult(status -> {
            if (db.update("UPDATE baitly_external_effect_attempts SET completed_count=completed_count+1 WHERE attempt_token=? AND organization_id=? AND kind=? AND resource_id=? AND operation=? AND occurrence=? AND state='STARTED'",
                    ticket.token(), ticket.scope().org(), ticket.scope().kind().name(), ticket.scope().resource(),
                    ticket.scope().operation().name(), ticket.scope().occurrence()) != 1)
                throw new IllegalStateException("EXTERNAL_EFFECT_RECONCILIATION_REQUIRED");
        });
    }

    public void uncertain(Ticket ticket) {
        transaction.executeWithoutResult(status -> db.update(
            "UPDATE baitly_external_effect_attempts SET state='UNKNOWN' WHERE attempt_token=? AND organization_id=? AND kind=? AND resource_id=? AND operation=? AND occurrence=? AND state='STARTED'",
            ticket.token(), ticket.scope().org(), ticket.scope().kind().name(), ticket.scope().resource(), ticket.scope().operation().name(), ticket.scope().occurrence()));
    }

    public boolean hasHistory(long org, Kind kind, long resource) {
        return db.queryForObject("SELECT count(*) FROM baitly_external_effect_attempts WHERE organization_id=? AND kind=? AND resource_id=?",
            Long.class, org, kind.name(), resource) > 0;
    }
}
