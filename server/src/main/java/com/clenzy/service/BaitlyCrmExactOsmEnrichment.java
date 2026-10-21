package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyProfessionalData;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;

/** Network reads precede the transaction; map, identity, evidence and queue commit together. */
@Service
public class BaitlyCrmExactOsmEnrichment {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmImportedOsmSearch source;
    private final BaitlyCrmOsmMatching matching;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;
    private final BaitlyCrmAddressGeocoding addresses;
    public record Outcome(String status,List<String> copiedFields,BaitlyCrmOsmMatching.Results proposal) {
        public Outcome(String status,List<String> copiedFields){this(status,copiedFields,null);}
    }
    public BaitlyCrmExactOsmEnrichment(JdbcTemplate db,BaitlyCrmAccess access,BaitlyCrmImportedOsmSearch source,
        BaitlyCrmOsmMatching matching,ObjectMapper mapper,PlatformTransactionManager transactions,BaitlyCrmAddressGeocoding addresses){
        this.db=db;this.access=access;this.source=source;this.matching=matching;this.mapper=mapper;this.tx=new TransactionTemplate(transactions);
        this.addresses=addresses;
    }
    public Outcome enrich(String actor,long id){
        long org=access.require(actor);
        String state=state(org,actor,id);
        String location=locationState(org,id);
        if(state.equals("CONFIRMED")&&!location.equals("VALID"))return new Outcome("REVIEW",List.of());
        if(!Set.of("PENDING","CONFIRMED").contains(state))return new Outcome(state,List.of());
        if(location.equals("STALE"))return new Outcome("REVIEW",List.of());
        if(location.equals("VALID")&&!needsContactData(org,id))return new Outcome("ALREADY_LOCATED",List.of());
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_crm_professional_imports WHERE organization_id=? AND prospect_id=? AND country_code<>'FR')",Boolean.class,org,id)))
            return new Outcome(location.equals("VALID")?"ALREADY_LOCATED":"REVIEW",List.of());
        BaitlyCrmImportedOsmSearch.Exact exact;
        try { exact=source.exact(actor,id); }
        catch(ResponseStatusException unavailable) {
            if(location.equals("NONE")&&Set.of(429,503).contains(unavailable.getStatusCode().value())) {
                var addressed=addresses.locate(actor,id);
                if(addressed!=null)return addressed;
            }
            throw unavailable;
        }
        if(exact.place()==null){
            if(location.equals("VALID"))return new Outcome("ALREADY_LOCATED",List.of());
            var addressed=addresses.locate(actor,id);
            if(addressed!=null)return addressed;
            var candidates=exact.candidates().stream().limit(5).map(this::candidate).toList();
            return new Outcome("REVIEW",List.of(),candidates.isEmpty()?null:matching.proposeImported(actor,id,exact.business().name(),exact.business().city(),candidates));
        }
        var place=exact.place();var candidate=candidate(place);
        var proposal=matching.proposeImported(actor,id,exact.business().name(),exact.business().city(),List.of(candidate));
        return tx.execute(transaction->{
            if(access.lock(actor)!=org)throw new AccessDeniedException("Organisation inaccessible");
            String current=state(org,actor,id);
            if(!Set.of("PENDING","CONFIRMED").contains(current))return new Outcome(current,List.of());
            String existing=locationState(org,id);
            if(existing.equals("STALE")||(current.equals("CONFIRMED")&&existing.equals("NONE")))return new Outcome("REVIEW",List.of());
            // Recheck immutable provenance and the contact after the external lookup.
            var business=source.business(actor,id);
            if(!business.equals(exact.business()))throw new ResponseStatusException(HttpStatus.CONFLICT,"La provenance a changé. Relancez la recherche.");
            if(existing.equals("NONE"))matching.confirm(actor,id,new BaitlyCrmOsmMatching.Confirmation(proposal.ticket(),0,false));
            var rows=db.queryForList("SELECT email,phone,website FROM prospects WHERE organization_id=? AND id=? AND NOT archived",org,id);
            if(rows.isEmpty())throw new AccessDeniedException("Contact inaccessible");
            var row=rows.getFirst();var copied=new ArrayList<String>();
            String email=blank(row.get("email"))?email(place.email()):null;
            String phone=blank(row.get("phone"))?phone(place.phone()):null;
            String website=blank(row.get("website"))?BaitlyProfessionalData.website(place.website()):"";
            if(email!=null&&!duplicate(org,id,"normalized_email",email))copied.add("EMAIL");else email=null;
            if(phone!=null&&!duplicate(org,id,"normalized_phone",phone))copied.add("PHONE");else phone=null;
            if(!website.isBlank())copied.add("WEBSITE");
            if(email!=null)db.update("UPDATE prospects SET email=?,normalized_email=? WHERE organization_id=? AND id=?",email,email,org,id);
            if(phone!=null)db.update("UPDATE prospects SET phone=?,normalized_phone=? WHERE organization_id=? AND id=?",place.phone(),phone,org,id);
            if(!website.isBlank())db.update("UPDATE prospects SET website=? WHERE organization_id=? AND id=?",website,org,id);
            db.update("""
                UPDATE prospects SET identity_version=identity_version+?,updated_at=now(),
                source_detail=CASE WHEN position('OpenStreetMap' in coalesce(source_detail,''))>0 THEN source_detail
                ELSE coalesce(source_detail,'')||? END WHERE organization_id=? AND id=?
                """,email!=null||phone!=null?1:0," · OpenStreetMap · ODbL 1.0 · https://www.openstreetmap.org/"+place.key(),org,id);
            db.update("UPDATE baitly_crm_professional_imports SET licence='Licence Ouverte 2.0; ODbL 1.0' WHERE organization_id=? AND prospect_id=?",org,id);
            try{
                db.update("""
                    INSERT INTO baitly_crm_osm_enrichments(organization_id,prospect_id,siret,osm_key,method,recorded_by,evidence,copied_fields)
                    VALUES(?,?,?,?,'EXACT_SIRET',?,CAST(? AS jsonb),CAST(? AS jsonb))
                    ON CONFLICT(organization_id,prospect_id) DO UPDATE SET siret=excluded.siret,osm_key=excluded.osm_key,
                    recorded_by=excluded.recorded_by,retrieved_at=now(),evidence=excluded.evidence,copied_fields=excluded.copied_fields
                    """,org,id,business.siret(),place.key(),actor,mapper.writeValueAsString(place),mapper.writeValueAsString(copied));
            }catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid OSM evidence",e);}
            db.update("UPDATE baitly_crm_location_review SET status='CONFIRMED',updated_at=now() WHERE organization_id=? AND actor=? AND prospect_id=?",org,actor,id);
            return new Outcome("CONFIRMED",List.copyOf(copied));
        });
    }
    private String state(long org,String actor,long id){
        var rows=db.queryForList("""
            SELECT r.status FROM baitly_crm_location_review r JOIN prospects p ON p.organization_id=r.organization_id AND p.id=r.prospect_id
            WHERE r.organization_id=? AND r.actor=? AND r.prospect_id=? AND NOT p.archived
            """,org,actor,id);
        if(rows.isEmpty())throw new AccessDeniedException("File de localisation inaccessible");return (String)rows.getFirst().get("status");
    }
    private BaitlyCrmOsmMatching.Candidate candidate(BaitlyProfessionalData.Place place){
        String[] key=place.key().split("/");return new BaitlyCrmOsmMatching.Candidate(key[0],Long.parseLong(key[1]),place.name(),
            place.address().isBlank()?place.name():place.address(),place.latitude(),place.longitude(),place.signals(),"ADDRESS");
    }
    private String locationState(long org,long id){return db.queryForObject("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM baitly_crm_contact_locations WHERE organization_id=? AND prospect_id=?) THEN 'NONE' WHEN EXISTS(SELECT 1 FROM baitly_crm_contact_locations l JOIN prospects p ON p.organization_id=l.organization_id AND p.id=l.prospect_id WHERE l.organization_id=? AND l.prospect_id=? AND l.contact_city IS NOT DISTINCT FROM p.city) THEN 'VALID' ELSE 'STALE' END",String.class,org,id,org,id);}
    private boolean needsContactData(long org,long id){return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM prospects WHERE organization_id=? AND id=? AND (nullif(btrim(email),'') IS NULL OR nullif(btrim(phone),'') IS NULL OR nullif(btrim(website),'') IS NULL))",Boolean.class,org,id));}
    private boolean duplicate(long org,long id,String column,String value){
        // Column names are fixed callers, never request input; include archived and historic destinations.
        return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM prospects p WHERE p.organization_id=? AND p.id<>? AND (p."+column+"=? OR EXISTS(SELECT 1 FROM baitly_crm_contact_authorizations a WHERE a.organization_id=p.organization_id AND a.prospect_id=p.id AND a.destination_hash=?)))",Boolean.class,org,id,value,BaitlyCrmIdentity.hash(value)));
    }
    private static boolean blank(Object value){return value==null||value.toString().isBlank();}
    private static String email(String value){try{return BaitlyCrmIdentity.email(value);}catch(IllegalArgumentException e){return null;}}
    private static String phone(String value){try{return BaitlyCrmIdentity.phone(value);}catch(IllegalArgumentException e){return null;}}
}
