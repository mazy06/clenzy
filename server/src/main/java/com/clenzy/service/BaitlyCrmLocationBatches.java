package com.clenzy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.util.*;

@Service
public class BaitlyCrmLocationBatches {
    private final JdbcTemplate db;private final BaitlyCrmAccess access;private final BaitlyCrmOsmMatching matching;
    private final ObjectMapper mapper;private final OrganizationService organizations;private final PermissionService permissions;
    private final boolean enabled;
    public BaitlyCrmLocationBatches(JdbcTemplate db,BaitlyCrmAccess access,BaitlyCrmOsmMatching matching,ObjectMapper mapper,
        OrganizationService organizations,PermissionService permissions,@Value("${baitly.crm.osm.batch-enabled:false}") boolean enabled,
        @Value("${baitly.crm.osm.search-url:https://nominatim.openstreetmap.org/search}") String endpoint){
        this.db=db;this.access=access;this.matching=matching;this.mapper=mapper;this.organizations=organizations;this.permissions=permissions;
        String host=Objects.toString(URI.create(endpoint).getHost(),"").toLowerCase(Locale.ROOT);
        this.enabled=enabled&&!host.isBlank()&&!host.equals("nominatim.openstreetmap.org")&&!host.endsWith(".nominatim.openstreetmap.org");
    }
    public record Start(@NotBlank @Pattern(regexp="[A-Z]{2}") String country,@AssertTrue boolean publicBusinesses) {}
    public record Choice(@Min(0) @Max(4) int index) {}
    public Map<String,Object> config(String actor){access.require(actor);return Map.of("enabled",enabled);}

    @Transactional
    public Map<String,Object> start(String actor,Start input){
        long org=access.lock(actor);
        if(!enabled)throw new ResponseStatusException(HttpStatus.CONFLICT,"La localisation groupée nécessite un service de géocodage dédié activé par votre administrateur");
        if(!input.publicBusinesses())throw new IllegalArgumentException("Confirmation des noms commerciaux publics requise");
        if(!db.queryForList("SELECT id FROM baitly_crm_location_batches WHERE organization_id=? AND status='RUNNING'",org).isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Une localisation groupée est déjà en cours");
        if(!db.queryForList("SELECT prospect_id FROM baitly_crm_location_batch_items WHERE organization_id=? AND status='PROPOSED' LIMIT 1",org).isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Validez ou passez les propositions du lot précédent avant de relancer");
        UUID id=UUID.randomUUID();db.update("INSERT INTO baitly_crm_location_batches(id,organization_id,created_by,country) VALUES(?,?,?,?)",id,org,actor,input.country());
        db.update("""
            INSERT INTO baitly_crm_location_batch_items(organization_id,batch_id,prospect_id,status)
            SELECT p.organization_id,?,p.id,CASE
              WHEN l.prospect_id IS NOT NULL AND l.contact_city IS NOT DISTINCT FROM p.city THEN 'SKIPPED'
              WHEN (p.contact_type='OWNER' OR p.contact_nature='PRIVATE') AND nullif(btrim(p.city),'') IS NULL THEN 'NEEDS_DATA'
              ELSE 'QUEUED' END
            FROM prospects p LEFT JOIN baitly_crm_contact_locations l ON l.organization_id=p.organization_id AND l.prospect_id=p.id
            WHERE p.organization_id=? AND p.archived=false
            """,id,org);
        complete(org,id);return Map.of("id",id);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> latest(String actor,int page){
        long org=access.require(actor);var jobs=db.queryForList("SELECT * FROM baitly_crm_location_batches WHERE organization_id=? ORDER BY created_at DESC,id DESC LIMIT 1",org);
        if(jobs.isEmpty())return Map.of();
        var job=jobs.getFirst();UUID id=(UUID)job.get("id");
        var counts=db.queryForList("SELECT status,count(*) AS count FROM baitly_crm_location_batch_items WHERE organization_id=? AND batch_id=? GROUP BY status",org,id);
        var content=db.queryForList("""
            SELECT i.prospect_id,i.status,i.proposal::text,p.name,p.city,p.contact_type,p.category
            FROM baitly_crm_location_batch_items i JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            WHERE i.organization_id=? AND i.batch_id=? AND i.status IN ('PROPOSED','NOT_FOUND','NEEDS_DATA','FAILED')
            AND p.archived=false ORDER BY CASE i.status WHEN 'PROPOSED' THEN 0 ELSE 1 END,p.name,p.id LIMIT 10 OFFSET ?
            """,org,id,Math.max(0,Math.min(100000,page))*10);
        for(var item:content){String raw=(String)item.remove("proposal");item.put("candidates",raw==null?List.of():read(raw).candidates());}
        long total=db.queryForObject("""
            SELECT count(*) FROM baitly_crm_location_batch_items i JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            WHERE i.organization_id=? AND i.batch_id=? AND i.status IN ('PROPOSED','NOT_FOUND','NEEDS_DATA','FAILED') AND p.archived=false
            """,Long.class,org,id);
        return Map.of("job",job,"counts",counts,"content",content,"totalElements",total);
    }
    @Transactional
    public void cancel(String actor,UUID id){long org=access.lock(actor);require(org,id);db.update("UPDATE baitly_crm_location_batches SET status='CANCELLED',updated_at=now() WHERE organization_id=? AND id=? AND status='RUNNING'",org,id);}
    @Transactional
    public void skip(String actor,UUID id,long prospect){long org=access.lock(actor);require(org,id);db.update("UPDATE baitly_crm_location_batch_items SET status='SKIPPED',updated_at=now() WHERE organization_id=? AND batch_id=? AND prospect_id=? AND status<>'CONFIRMED'",org,id,prospect);complete(org,id);}
    @Transactional
    public void confirm(String actor,UUID id,long prospect,Choice choice){
        long org=access.lock(actor);require(org,id);
        var items=db.queryForList("SELECT proposal::text FROM baitly_crm_location_batch_items WHERE organization_id=? AND batch_id=? AND prospect_id=? AND status='PROPOSED' FOR UPDATE",org,id,prospect);
        if(items.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"Proposition inaccessible ou déjà traitée");
        var saved=read((String)items.getFirst().get("proposal"));
        // Another authorized organization manager may validate, but may not change candidate coordinates.
        var ticket=new BaitlyCrmOsmMatching.Ticket(saved.org(),saved.prospect(),actor,saved.snapshot(),saved.locationVersion(),saved.query(),saved.candidates());
        matching.confirmPrepared(org,actor,prospect,ticket,choice.index(),false);
        db.update("UPDATE baitly_crm_location_batch_items SET status='CONFIRMED',updated_at=now() WHERE organization_id=? AND batch_id=? AND prospect_id=?",org,id,prospect);
    }
    private void require(long org,UUID id){if(db.queryForList("SELECT id FROM baitly_crm_location_batches WHERE organization_id=? AND id=?",org,id).isEmpty())throw new AccessDeniedException("Traitement inaccessible");}
    private BaitlyCrmOsmMatching.Ticket read(String raw){try{return mapper.readValue(raw,BaitlyCrmOsmMatching.Ticket.class);}catch(Exception e){throw new IllegalStateException("Proposition illisible",e);}}
    private void complete(long org,UUID id){db.update("""
        UPDATE baitly_crm_location_batches b SET status='COMPLETED',updated_at=now() WHERE organization_id=? AND id=? AND status='RUNNING'
        AND NOT EXISTS(SELECT 1 FROM baitly_crm_location_batch_items i WHERE i.organization_id=b.organization_id AND i.batch_id=b.id AND i.status='QUEUED')
        """,org,id);}

    /** One item per tick, serialized across instances. No tenant context is fabricated on scheduler threads. */
    @Transactional
    public void tick(){
        if(!enabled||!Boolean.TRUE.equals(db.queryForObject("SELECT pg_try_advisory_xact_lock(1875440576)",Boolean.class)))return;
        var rows=db.queryForList("""
            SELECT i.organization_id,i.batch_id,i.prospect_id,i.attempts,b.created_by,b.country,p.name,p.city,p.contact_type,p.contact_nature,
              l.prospect_id AS located,l.contact_city
            FROM baitly_crm_location_batch_items i JOIN baitly_crm_location_batches b ON b.organization_id=i.organization_id AND b.id=i.batch_id
            JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            LEFT JOIN baitly_crm_contact_locations l ON l.organization_id=p.organization_id AND l.prospect_id=p.id
            WHERE b.status='RUNNING' AND i.status='QUEUED' AND i.available_at<=now() ORDER BY i.available_at,b.created_at,i.prospect_id LIMIT 1 FOR UPDATE OF i,b
            """);
        if(rows.isEmpty())return;var item=rows.getFirst();long org=((Number)item.get("organization_id")).longValue(),prospect=((Number)item.get("prospect_id")).longValue();UUID batch=(UUID)item.get("batch_id");String actor=(String)item.get("created_by");
        if(!organizations.canManageOrg(actor,org)||!permissions.checkUserPermission(actor,"baitly-crm:view")||!permissions.checkUserPermission(actor,"baitly-crm:manage")){
            db.update("UPDATE baitly_crm_location_batches SET status='CANCELLED',updated_at=now() WHERE organization_id=? AND id=?",org,batch);return;
        }
        String status="FAILED",proposal=null;int attempts=((Number)item.get("attempts")).intValue()+1;
        try{
            boolean archived=Boolean.TRUE.equals(db.queryForObject("SELECT archived FROM prospects WHERE organization_id=? AND id=?",Boolean.class,org,prospect));
            if(archived||item.get("located")!=null&&Objects.equals(item.get("city"),item.get("contact_city")))status="SKIPPED";
            else{
                boolean cityOnly="OWNER".equals(item.get("contact_type"))||"PRIVATE".equals(item.get("contact_nature"));
                String city=Objects.toString(item.get("city"),"");
                if(cityOnly&&city.isBlank())status="NEEDS_DATA";
                else{var ticket=matching.prepare(org,actor,prospect,new BaitlyCrmOsmMatching.Search((String)item.get("name"),city,(String)item.get("country"),true),cityOnly);
                    proposal=mapper.writeValueAsString(ticket);status=ticket.candidates().isEmpty()?"NOT_FOUND":"PROPOSED";}
            }
        }catch(ResponseStatusException e){if((e.getStatusCode().value()==429||e.getStatusCode().is5xxServerError())&&attempts<3)status="QUEUED";}
        catch(Exception e){status="FAILED";}
        db.update("""
            UPDATE baitly_crm_location_batch_items SET status=?,proposal=?::jsonb,attempts=?,available_at=now()+interval '60 seconds',updated_at=now()
            WHERE organization_id=? AND batch_id=? AND prospect_id=?
            """,status,proposal,attempts,org,batch,prospect);
        complete(org,batch);
    }
}
