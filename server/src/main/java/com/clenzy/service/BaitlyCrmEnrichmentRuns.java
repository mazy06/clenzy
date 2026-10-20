package com.clenzy.service;

import com.clenzy.tenant.TenantScopedExecutor;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Durable execution of the existing imported-professional pipeline, independent of HTTP clients. */
@Service
public class BaitlyCrmEnrichmentRuns {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmLocationReview review;
    private final BaitlyCrmExactOsmEnrichment enrichment;
    private final OrganizationService organizations;
    private final PermissionService permissions;
    private final TenantScopedExecutor tenants;
    private final TransactionTemplate tx;
    public record Start(@Size(max=5000) List<@NotNull @Positive Long> ids,boolean locationOnly) {}
    public record Run(UUID id,String status,boolean locationOnly,long total,long confirmed,long review,long pending,long unavailable,long failed) {}
    public record Progress(Run run) {}
    public BaitlyCrmEnrichmentRuns(JdbcTemplate db,BaitlyCrmAccess access,BaitlyCrmLocationReview review,
        BaitlyCrmExactOsmEnrichment enrichment,OrganizationService organizations,PermissionService permissions,
        TenantScopedExecutor tenants,PlatformTransactionManager transactions) {
        this.db=db;this.access=access;this.review=review;this.enrichment=enrichment;this.organizations=organizations;
        this.permissions=permissions;this.tenants=tenants;this.tx=new TransactionTemplate(transactions);
    }
    public Progress start(String actor,Start input) {
        if(input.ids()!=null&&(input.ids().size()>5000||input.ids().stream().anyMatch(id->id==null||id<=0)))throw new IllegalArgumentException("Sélection invalide");
        return tx.execute(transaction->{
            writeLock();
            long org=access.lock(actor);
            var active=db.queryForList("SELECT id FROM baitly_crm_enrichment_runs WHERE organization_id=? AND created_by=? AND status='RUNNING'",org,actor);
            if(!active.isEmpty()&&input.ids()==null)return progress(org,actor,(UUID)active.getFirst().get("id"));
            var rows=db.queryForList("""
                SELECT p.id,p.archived,i.prospect_id AS imported FROM prospects p LEFT JOIN baitly_crm_professional_imports i
                ON i.organization_id=p.organization_id AND i.prospect_id=p.id WHERE p.organization_id=?
                """,org);
            Set<Long> selected=input.ids()==null?null:new HashSet<>(input.ids());
            if(selected!=null&&!rows.stream().map(row->((Number)row.get("id")).longValue()).collect(java.util.stream.Collectors.toSet()).containsAll(selected))
                throw new AccessDeniedException("Contact inaccessible");
            var prepared=review.prepareImported(actor);Set<Long> eligible=new HashSet<>();prepared.forEach(item->eligible.add(item.id()));
            UUID run=active.isEmpty()?UUID.randomUUID():(UUID)active.getFirst().get("id");
            if(active.isEmpty())db.update("INSERT INTO baitly_crm_enrichment_runs(id,organization_id,created_by,location_only) VALUES(?,?,?,?)",run,org,actor,input.locationOnly());
            else if(!input.locationOnly())db.update("UPDATE baitly_crm_enrichment_runs SET location_only=false,updated_at=now() WHERE organization_id=? AND id=?",org,run);
            for(var row:rows) {
                long id=((Number)row.get("id")).longValue();
                if(selected!=null?!selected.contains(id):row.get("imported")==null||Boolean.TRUE.equals(row.get("archived")))continue;
                boolean located=located(org,id);
                String status=Boolean.TRUE.equals(row.get("archived"))?"SKIPPED":located&&input.locationOnly()?"CONFIRMED":
                    eligible.contains(id)?"QUEUED":located?"CONFIRMED":"NEEDS_DATA";
                db.update("INSERT INTO baitly_crm_enrichment_items(organization_id,run_id,prospect_id,status) VALUES(?,?,?,?) ON CONFLICT(run_id,prospect_id) DO NOTHING",org,run,id,status);
            }
            complete(org,run);return progress(org,actor,run);
        });
    }
    public Progress latest(String actor) {
        long org=access.require(actor);
        var rows=db.queryForList("SELECT id FROM baitly_crm_enrichment_runs WHERE organization_id=? AND created_by=? ORDER BY created_at DESC,id DESC LIMIT 1",org,actor);
        return rows.isEmpty()?new Progress(null):progress(org,actor,(UUID)rows.getFirst().get("id"));
    }
    public void cancel(String actor,UUID run) {
        tx.executeWithoutResult(transaction->{writeLock();long org=access.lock(actor);progress(org,actor,run);cancel(org,run);});
    }
    private void cancel(long org,UUID run) {
        writeLock();
        db.update("UPDATE baitly_crm_enrichment_runs SET status='CANCELLED',updated_at=now() WHERE organization_id=? AND id=? AND status='RUNNING'",org,run);
        db.update("UPDATE baitly_crm_enrichment_items SET status='SKIPPED',lease=NULL,updated_at=now() WHERE organization_id=? AND run_id=? AND status IN ('QUEUED','PROCESSING')",org,run);
    }
    private Progress progress(long org,String actor,UUID id) {
        var rows=db.queryForList("SELECT status,location_only FROM baitly_crm_enrichment_runs WHERE organization_id=? AND created_by=? AND id=?",org,actor,id);
        if(rows.isEmpty())throw new AccessDeniedException("Traitement inaccessible");
        Map<String,Long> counts=new HashMap<>();
        db.queryForList("SELECT status,count(*) AS count FROM baitly_crm_enrichment_items WHERE organization_id=? AND run_id=? GROUP BY status",org,id)
            .forEach(row->counts.put((String)row.get("status"),((Number)row.get("count")).longValue()));
        return new Progress(new Run(id,(String)rows.getFirst().get("status"),Boolean.TRUE.equals(rows.getFirst().get("location_only")),
            counts.values().stream().mapToLong(Long::longValue).sum(),counts.getOrDefault("CONFIRMED",0L),counts.getOrDefault("REVIEW",0L),
            counts.getOrDefault("QUEUED",0L)+counts.getOrDefault("PROCESSING",0L),counts.getOrDefault("SKIPPED",0L)+counts.getOrDefault("NEEDS_DATA",0L),counts.getOrDefault("FAILED",0L)));
    }
    private boolean located(long org,long id) {
        return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_crm_contact_locations l JOIN prospects p ON p.organization_id=l.organization_id AND p.id=l.prospect_id WHERE l.organization_id=? AND l.prospect_id=? AND NOT p.archived AND l.contact_city IS NOT DISTINCT FROM p.city)",Boolean.class,org,id));
    }
    private void complete(long org,UUID run) {
        db.update("""
            UPDATE baitly_crm_enrichment_runs r SET status='COMPLETED',updated_at=now() WHERE organization_id=? AND id=? AND status='RUNNING'
            AND NOT EXISTS(SELECT 1 FROM baitly_crm_enrichment_items i WHERE i.organization_id=r.organization_id AND i.run_id=r.id AND i.status IN ('QUEUED','PROCESSING'))
            """,org,run);
    }
    private record Work(long org,UUID run,long prospect,String actor,boolean locationOnly,int attempts,UUID lease) {}
    private void writeLock(){db.queryForObject("SELECT pg_advisory_xact_lock(1875440582)",Object.class);}
    private Work claim() {
        return tx.execute(transaction->{
            if(!Boolean.TRUE.equals(db.queryForObject("SELECT pg_try_advisory_xact_lock(1875440582)",Boolean.class)))return null;
            db.update("UPDATE baitly_crm_enrichment_items SET status=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'QUEUED' END,lease=NULL WHERE status='PROCESSING' AND available_at<now()");
            db.update("UPDATE baitly_crm_enrichment_runs r SET status='COMPLETED',updated_at=now() WHERE status='RUNNING' AND NOT EXISTS(SELECT 1 FROM baitly_crm_enrichment_items i WHERE i.organization_id=r.organization_id AND i.run_id=r.id AND i.status IN ('QUEUED','PROCESSING'))");
            if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_crm_enrichment_items WHERE status='PROCESSING' OR updated_at>now()-interval '6 seconds' AND status IN ('CONFIRMED','REVIEW','FAILED'))",Boolean.class)))return null;
            var rows=db.queryForList("""
                SELECT i.organization_id,i.run_id,i.prospect_id,i.attempts,r.created_by,r.location_only FROM baitly_crm_enrichment_items i
                JOIN baitly_crm_enrichment_runs r ON r.organization_id=i.organization_id AND r.id=i.run_id
                WHERE r.status='RUNNING' AND i.status='QUEUED' AND i.available_at<=now()
                ORDER BY i.available_at,r.created_at,i.prospect_id LIMIT 1 FOR UPDATE OF i,r SKIP LOCKED
                """);
            if(rows.isEmpty())return null;
            var row=rows.getFirst();long org=((Number)row.get("organization_id")).longValue(),id=((Number)row.get("prospect_id")).longValue();
            UUID run=(UUID)row.get("run_id"),lease=UUID.randomUUID();
            db.update("UPDATE baitly_crm_enrichment_items SET status='PROCESSING',lease=?,attempts=attempts+1,available_at=now()+interval '2 minutes',updated_at=now() WHERE organization_id=? AND run_id=? AND prospect_id=?",lease,org,run,id);
            return new Work(org,run,id,(String)row.get("created_by"),Boolean.TRUE.equals(row.get("location_only")),((Number)row.get("attempts")).intValue()+1,lease);
        });
    }
    /** A short durable claim, network outside SQL transactions, then a fenced completion. */
    public void tick() {
        Work work=claim();if(work==null)return;
        String status;
        try {
            status=tenants.callAsOrganization(work.org(),()->{
                if(!organizations.canManageOrg(work.actor(),work.org())||!permissions.checkUserPermission(work.actor(),"baitly-crm:view")||!permissions.checkUserPermission(work.actor(),"baitly-crm:manage")) {
                    tx.executeWithoutResult(transaction->cancel(work.org(),work.run()));return "SKIPPED";
                }
                if(work.locationOnly()&&located(work.org(),work.prospect()))return "CONFIRMED";
                var result=enrichment.enrich(work.actor(),work.prospect());
                return switch(result.status()){case "CONFIRMED","ALREADY_LOCATED"->"CONFIRMED";case "REVIEW","NOT_FOUND"->"REVIEW";default->"SKIPPED";};
            });
        } catch(ResponseStatusException e) {
            status=e.getStatusCode().value()==409?"REVIEW":(e.getStatusCode().value()==429||e.getStatusCode().is5xxServerError())&&work.attempts()<3?"QUEUED":"FAILED";
        } catch(AccessDeniedException e){status="SKIPPED";}
        catch(Exception e){status=work.attempts()<3?"QUEUED":"FAILED";}
        String outcome=status;
        tx.executeWithoutResult(transaction->{
            writeLock();
            db.update("""
                UPDATE baitly_crm_enrichment_items SET status=?,lease=NULL,available_at=now()+interval '60 seconds',updated_at=now()
                WHERE organization_id=? AND run_id=? AND prospect_id=? AND status='PROCESSING' AND lease=?
                """,outcome,work.org(),work.run(),work.prospect(),work.lease());
            complete(work.org(),work.run());
        });
    }
}
