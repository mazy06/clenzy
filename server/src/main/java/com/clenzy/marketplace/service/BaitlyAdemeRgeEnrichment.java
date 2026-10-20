package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Exact-SIRET enrichment of existing public references only. Never writes prospects or contact authorizations. */
@Service
public class BaitlyAdemeRgeEnrichment {
    public static final String ACTOR="baitly:ademe-rge";
    private final JdbcTemplate db;
    private final BaitlyAdemeRgeClient client;
    private final TransactionTemplate tx;
    private final ObjectMapper mapper;
    private final boolean enabled;
    public record Report(long matched,long retired) {}
    public BaitlyAdemeRgeEnrichment(JdbcTemplate db,BaitlyAdemeRgeClient client,PlatformTransactionManager manager,ObjectMapper mapper,
        @Value("${baitly.directory.ademe.enabled:true}") boolean enabled){this.db=db;this.client=client;this.tx=new TransactionTemplate(manager);this.mapper=mapper;this.enabled=enabled;}

    public Report enrich()throws Exception {
        if(!enabled)return new Report(0,0);
        db.update("INSERT INTO baitly_directory_rge_sync(id) VALUES(true) ON CONFLICT DO NOTHING");
        // Claim the retry window in autocommit, releasing the connection before downloading.
        var claimed=db.queryForList("UPDATE baitly_directory_rge_sync SET next_check=now()+interval '15 minutes' WHERE id=true AND next_check<=now() RETURNING next_check");
        if(claimed.isEmpty())return new Report(0,0);
        Object lease=claimed.getFirst().get("next_check");
        try {
            if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_professionals WHERE source_active AND NOT suppressed)",Boolean.class)))return new Report(0,0);
            var snapshot=client.download();
            if(snapshot.contacts().isEmpty()||snapshot.contacts().size()>1_000_000)throw new java.io.IOException("Invalid ADEME snapshot size");
            if(Thread.currentThread().isInterrupted())throw new InterruptedException();
            return tx.execute(t->{
                if(db.queryForList("SELECT id FROM baitly_directory_rge_sync WHERE id=true AND next_check=? AND next_check>=now() FOR UPDATE",lease).isEmpty())return new Report(0,0);
                // Sirene/OSM exclude publication, not the HTTP download. Released automatically on commit/rollback.
                if(!Boolean.TRUE.equals(db.queryForObject("SELECT pg_try_advisory_xact_lock(1875440583)",Boolean.class)))return new Report(0,0);
                return publish(snapshot);
            });
        }catch(Exception failure){
            db.update("UPDATE baitly_directory_rge_sync SET next_check=now()+interval '15 minutes' WHERE id=true AND next_check=?",lease);
            if(failure instanceof InterruptedException)Thread.currentThread().interrupt();
            throw failure;
        }
    }
    private Report publish(BaitlyAdemeRgeClient.Snapshot snapshot){
        // A partial download is never published. This staging table exists only inside this transaction.
        db.execute("CREATE TEMP TABLE baitly_rge_stage(siret varchar(14) PRIMARY KEY,phone varchar(80),email varchar(254),website varchar(500),proof jsonb NOT NULL) ON COMMIT DROP");
        db.batchUpdate("INSERT INTO baitly_rge_stage VALUES(?,?,?,?,?::jsonb)",snapshot.contacts(),1000,(s,c)->{
            s.setString(1,c.siret());s.setString(2,c.phone());s.setString(3,c.email());s.setString(4,c.website());
            var proof=mapper.createObjectNode().put("siret",c.siret()).put("version",snapshot.version()).put("phone",c.phone()).put("email",c.email()).put("website",c.website());
            s.setString(5,proof.toString());
        });
        db.execute("ANALYZE baitly_rge_stage");
        // Serialize publication with explicit withdrawals and manual choices, not just other feed workers.
        db.queryForList("SELECT p.id FROM baitly_directory_professionals p WHERE p.rge_retrieved_at IS NOT NULL OR EXISTS(SELECT 1 FROM baitly_rge_stage s WHERE s.siret=p.siret) ORDER BY p.id FOR UPDATE OF p");
        db.update("""
            INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot)
            SELECT p.id,'ADEME',?,'Licence Ouverte 2.0',now(),?,s.proof
            FROM baitly_directory_professionals p JOIN baitly_rge_stage s ON s.siret=p.siret
            WHERE p.source_active AND NOT p.suppressed AND NOT EXISTS(
                SELECT 1 FROM baitly_directory_source_evidence e WHERE e.id=(SELECT max(last.id) FROM baitly_directory_source_evidence last WHERE last.professional_id=p.id AND last.source='ADEME') AND e.snapshot=s.proof)
            """,BaitlyAdemeRgeClient.SOURCE,ACTOR);
        long matched=db.update("""
            UPDATE baitly_directory_professionals p SET rge_phone=s.phone,rge_email=s.email,rge_website=s.website,rge_retrieved_at=now(),updated_at=now()
            FROM baitly_rge_stage s WHERE p.siret=s.siret AND p.source_active AND NOT p.suppressed
            """);
        db.update("""
            INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot)
            SELECT p.id,'ADEME',?,'Licence Ouverte 2.0',now(),?,jsonb_build_object('siret',p.siret,'version',?::text,'state','REMOVED')
            FROM baitly_directory_professionals p WHERE p.rge_retrieved_at IS NOT NULL
                AND (p.suppressed OR NOT p.source_active OR NOT EXISTS(SELECT 1 FROM baitly_rge_stage s WHERE s.siret=p.siret))
            """,BaitlyAdemeRgeClient.SOURCE,ACTOR,snapshot.version());
        long retired=db.update("""
            UPDATE baitly_directory_professionals p SET rge_phone=NULL,rge_email=NULL,rge_website=NULL,rge_retrieved_at=NULL,updated_at=now()
            WHERE p.rge_retrieved_at IS NOT NULL AND (p.suppressed OR NOT p.source_active OR NOT EXISTS(SELECT 1 FROM baitly_rge_stage s WHERE s.siret=p.siret))
            """);
        db.update("UPDATE baitly_directory_rge_sync SET source_version=?,applied_at=now(),next_check=now()+interval '24 hours',matched=?,retired=? WHERE id=true",snapshot.version(),matched,retired);
        return new Report(matched,retired);
    }
}
