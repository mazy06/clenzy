package com.clenzy.service.assignment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/** Accès aux propositions ; toutes les mutations sont sérialisées par le verrou du besoin. */
@Repository
public class AssignmentProposalStore {
    public record Proposal(Long id, Long requestId, Long organizationId, int cycle, String targetType,
                           Long targetId, String origin, String status, Instant createdAt, Instant expiresAt,
                           Instant respondedAt, String reason) {}
    private final JdbcTemplate db;
    public AssignmentProposalStore(JdbcTemplate db) { this.db=db; }
    private static final RowMapper<Proposal> ROW = (r,n) -> new Proposal(r.getLong("id"),r.getLong("request_id"),
        r.getLong("organization_id"),r.getInt("cycle"),r.getString("target_type"),r.getLong("target_id"),
        r.getString("origin"),r.getString("status"),r.getTimestamp("created_at").toInstant(),
        r.getTimestamp("expires_at").toInstant(),r.getTimestamp("responded_at")==null?null:r.getTimestamp("responded_at").toInstant(),r.getString("reason"));
    public Optional<Proposal> active(Long request) {
        return db.query("SELECT * FROM service_assignment_proposals WHERE request_id=? AND status='PENDING'",ROW,request).stream().findFirst();
    }
    public Optional<Proposal> get(Long id) {
        return db.query("SELECT * FROM service_assignment_proposals WHERE id=?",ROW,id).stream().findFirst();
    }
    public List<Proposal> history(Long request) {
        return db.query("SELECT * FROM service_assignment_proposals WHERE request_id=? ORDER BY id DESC LIMIT 200",ROW,request);
    }
    public Set<Long> excludedTeams(Long request, int cycle) {
        return new HashSet<>(db.queryForList("""
            SELECT DISTINCT t.id FROM service_assignment_proposals p JOIN teams t
              ON (p.target_type='team' AND t.id=p.target_id)
              OR (p.target_type='user' AND t.personal_user_id=p.target_id)
            WHERE p.request_id=? AND p.cycle=? AND p.status IN ('DECLINED','EXPIRED')
            """,Long.class,request,cycle));
    }
    public Proposal create(Long request, Long org, int cycle, String kind, Long target, String origin,
                           Instant now, Instant deadline, String policy) {
        return db.query("""
            INSERT INTO service_assignment_proposals(request_id,organization_id,cycle,target_type,target_id,origin,status,created_at,expires_at,policy_snapshot)
            VALUES (?,?,?,?,?,?,'PENDING',?,?,?) RETURNING *
            """,ROW,request,org,cycle,kind,target,origin,Timestamp.from(now),Timestamp.from(deadline),policy).getFirst();
    }
    public void close(Proposal proposal, String status, Instant now, String reason) {
        if (!Set.of("ACCEPTED","QUOTED","DECLINED","EXPIRED","WITHDRAWN").contains(status)) throw new IllegalArgumentException("État invalide");
        if (db.update("UPDATE service_assignment_proposals SET status=?,responded_at=?,reason=? WHERE id=? AND status='PENDING'",
            status,Timestamp.from(now),reason,proposal.id()) != 1) throw new IllegalStateException("Proposition déjà traitée");
    }
    public void event(Long request, Long proposal, String kind, String key) {
        db.update("INSERT INTO service_assignment_notifications(request_id,proposal_id,kind,event_key) VALUES (?,?,?,?) ON CONFLICT(event_key) DO NOTHING",request,proposal,kind,key);
    }
    public void deferContact(Long request, Instant at) {
        db.update("""
            INSERT INTO baitly_assignment_jobs(event_key,request_id,kind,due_at)
            VALUES (?,?,'TICK',?) ON CONFLICT(event_key) DO NOTHING
            ""","contact:"+request+":"+at,request,Timestamp.from(at));
    }
    public void remind(Proposal proposal, Instant now) {
        if (db.update("UPDATE service_assignment_proposals SET reminder_at=? WHERE id=? AND reminder_at IS NULL AND status='PENDING'",Timestamp.from(now),proposal.id()) == 1)
            event(proposal.requestId(),proposal.id(),"REMINDER","REMINDER:"+proposal.id());
    }
    public Map<Long,Instant> activeDeadlines(List<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        var result=new HashMap<Long,Instant>();
        new org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate(db).query("""
            SELECT p.request_id,p.expires_at FROM service_assignment_proposals p
            JOIN service_requests r ON r.id=p.request_id AND r.assignment_cycle=p.cycle
            WHERE p.request_id IN (:ids) AND p.status='PENDING' AND r.assignment_phase='PROPOSED'
            """,Map.of("ids",ids),(org.springframework.jdbc.core.RowCallbackHandler) r ->
                result.put(r.getLong(1),r.getTimestamp(2).toInstant()));
        return result;
    }
    public List<Proposal> inbox(Long user, int page) {
        return db.query("""
            SELECT p.* FROM service_assignment_proposals p WHERE p.status='PENDING' AND
            (p.target_type='user' AND p.target_id=? OR p.target_type='team' AND EXISTS
              (SELECT 1 FROM team_members m WHERE m.team_id=p.target_id AND m.user_id=?))
            ORDER BY p.expires_at,p.id LIMIT 20 OFFSET ?
            """,ROW,user,user,page*20);
    }
    public record PricedProposal(Proposal proposal, AssignmentCommercialTerms.Terms terms) {}
    public List<PricedProposal> forCards(Long user,List<Long> ids) {
        return new org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate(db).query("""
            SELECT p.* FROM service_assignment_proposals p JOIN service_requests r ON r.id=p.request_id
            WHERE p.request_id IN (:ids) AND p.cycle=r.assignment_cycle AND p.status='PENDING'
            AND r.status IN ('PENDING','ASSIGNED') AND r.assignment_phase='PROPOSED' AND r.converted_intervention_id IS NULL
            AND ((p.target_type='user' AND p.target_id=:user) OR (p.target_type='team' AND EXISTS
              (SELECT 1 FROM team_members m WHERE m.team_id=p.target_id AND m.user_id=:user)))
            """,Map.of("user",user,"ids",ids),(r,n)->new PricedProposal(ROW.mapRow(r,n),
                r.getBigDecimal("agreed_amount")==null?null:new AssignmentCommercialTerms.Terms(
                    r.getBigDecimal("agreed_amount"),r.getString("agreed_currency"),r.getObject("tariff_id",Long.class))));
    }
}
