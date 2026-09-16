package com.clenzy.service.assignment;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** File différée persistée ; Kafka transporte uniquement les identifiants de réveil. */
@Repository
public class AssignmentJobStore {
    public record Job(long id, long requestId, String kind, Long notificationId, Instant dueAt) {}
    private final JdbcTemplate db;
    private static final RowMapper<Job> ROW = (r,n) -> new Job(r.getLong("id"),r.getLong("request_id"),
        r.getString("kind"),r.getObject("notification_id",Long.class),r.getTimestamp("due_at").toInstant());
    public AssignmentJobStore(JdbcTemplate db) { this.db=db; }
    public Optional<Job> pending(long id) {
        return db.query("SELECT * FROM baitly_assignment_jobs WHERE id=? AND completed_at IS NULL",ROW,id).stream().findFirst();
    }
    public List<Job> recover(long afterId) {
        return db.query("SELECT * FROM baitly_assignment_jobs WHERE completed_at IS NULL AND id>? ORDER BY id LIMIT 500",ROW,afterId);
    }
    public Long lockRequest(long requestId) {
        return db.query("SELECT organization_id FROM service_requests WHERE id=? FOR UPDATE",(r,n)->r.getLong(1),requestId).stream().findFirst().orElse(null);
    }
    public Optional<Job> lock(long id) {
        return db.query("SELECT * FROM baitly_assignment_jobs WHERE id=? AND completed_at IS NULL FOR UPDATE",ROW,id).stream().findFirst();
    }
    public void complete(long id) {
        db.update("UPDATE baitly_assignment_jobs SET completed_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?",id);
    }
    public void retry(long id, Instant now, Exception error) {
        db.update("""
            UPDATE baitly_assignment_jobs SET attempts=attempts+1,last_error=?,
              due_at=?::timestamptz + INTERVAL '1 second' * LEAST(300,5*power(2,LEAST(attempts,6)))
            WHERE id=? AND completed_at IS NULL
            """,error.getClass().getSimpleName(),Timestamp.from(now),id);
    }
}
