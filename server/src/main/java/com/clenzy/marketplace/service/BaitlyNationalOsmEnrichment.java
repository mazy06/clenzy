package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.Connection;
import java.util.*;

/** Offline OSM stock join. No per-company requests to public Overpass, no tenant CRM writes. */
@Service
public class BaitlyNationalOsmEnrichment {
    public static final String ACTOR="baitly:osm-stock";
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;
    private volatile String lastApplied;
    private volatile Report lastReport;
    public BaitlyNationalOsmEnrichment(JdbcTemplate db,ObjectMapper mapper,PlatformTransactionManager manager){this.db=db;this.mapper=mapper;this.tx=new TransactionTemplate(manager);}
    public record Report(long candidates,long matched,long enriched,long ambiguous,long unchanged,long retired) {}
    /** A complete local snapshot is fingerprinted before any publication. Replays are idempotent. */
    public Report enrich(Path snapshot)throws Exception {
        String fingerprint;
        try(var input=Files.newInputStream(snapshot)){var digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];for(int n;(n=input.read(buffer))>=0;)digest.update(buffer,0,n);fingerprint=HexFormat.of().formatHex(digest.digest());}
        long matched=0,enriched=0,ambiguous=0,unchanged=0;
        try(Connection lock=Objects.requireNonNull(db.getDataSource()).getConnection()){
            try(var s=lock.createStatement();var r=s.executeQuery("SELECT pg_try_advisory_lock(1875440583)")){r.next();if(!r.getBoolean(1))throw new IllegalStateException("Sirene or OSM directory worker already running");}
            try {
                if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_sync WHERE phase='COMPLETED')",Boolean.class)))throw new IllegalStateException("Sirene national publication must complete before OSM enrichment");
                String signature=fingerprint+db.queryForObject("SELECT revision::text FROM baitly_directory_sync WHERE id=true",String.class);
                if(signature.equals(lastApplied))return lastReport;
                var candidates=read(snapshot);
                for(var entry:candidates.entrySet()){
                    if(Thread.currentThread().isInterrupted()||!lock.isValid(5))throw new IOException("OSM directory worker interrupted");
                    var rows=db.queryForList("SELECT * FROM baitly_directory_professionals WHERE siret=? AND source_active AND NOT suppressed",entry.getKey());
                    if(rows.isEmpty())continue;matched++;
                    // A SIRET shared by distinct OSM objects is deliberately left untouched.
                    if(entry.getValue().size()!=1){ambiguous++;continue;}
                    var row=rows.getFirst();long id=((Number)row.get("id")).longValue();
                    if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_source_evidence WHERE professional_id=? AND source='OSM' AND confirmed_by=? AND snapshot->>'fingerprint'=? AND retrieved_at>=?)",Boolean.class,id,ACTOR,fingerprint,row.get("sirene_retrieved_at")))){unchanged++;continue;}
                    // Keep explicitly confirmed source choices. An automatic feed never replaces them.
                    if(row.get("osm_confirmed_by")!=null&&!ACTOR.equals(row.get("osm_confirmed_by"))){unchanged++;continue;}
                    JsonNode element=entry.getValue().values().iterator().next();
                    String key=element.path("type").asText()+"/"+element.path("id").asLong();
                    if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_professionals WHERE osm_key=? AND id<>?)",Boolean.class,key,id))){ambiguous++;continue;}
                    var tags=element.path("tags");String phone=contact(tags,"phone",80);if(phone.isBlank())phone=contact(tags,"mobile",80);
                    String email=contact(tags,"email",254);if(!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))email="";
                    String website=BaitlyProfessionalData.website(contact(tags,"website",500));
                    final String p=phone,e=email,w=website;
                    var proof=mapper.createObjectNode().put("siret",entry.getKey()).put("key",key).put("fingerprint",fingerprint).put("phone",p).put("email",e).put("website",w);
                    Double lat=coordinate(element.path("lat"),90),lon=coordinate(element.path("lon"),180);
                    boolean point="node".equals(element.path("type").asText())&&lat!=null&&lon!=null&&(lat!=0||lon!=0);
                    if(point){proof.put("latitude",lat);proof.put("longitude",lon);}
                    boolean saved=Boolean.TRUE.equals(tx.execute(t->{
                        // Fence against a source refresh, withdrawal or manual match during preparation.
                        var current=db.queryForList("SELECT id FROM baitly_directory_professionals WHERE id=? AND siret=? AND source_active AND NOT suppressed AND (osm_confirmed_by IS NULL OR osm_confirmed_by=?) FOR UPDATE",id,entry.getKey(),ACTOR);
                        if(current.isEmpty())return false;
                        db.update("UPDATE baitly_directory_professionals SET phone=nullif(?,''),email=nullif(?,''),website=nullif(?,''),osm_retrieved_at=now(),updated_at=now() WHERE id=?",p,e,w,id);
                        if(point)db.update("UPDATE baitly_directory_professionals SET osm_key=?,osm_name=name,osm_address=NULL,latitude=?,longitude=?,osm_confirmed_at=now(),osm_confirmed_by=? WHERE id=?",key,lat,lon,ACTOR,id);
                        else clearAutomaticPoint(id);
                        db.update("INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot) VALUES(?,'OSM',?,'ODbL 1.0',now(),?,?::jsonb)",id,"https://www.openstreetmap.org/"+key,ACTOR,proof.toString());
                        return true;
                    }));if(saved)enriched++;else unchanged++;
                    if(enriched%1000==0)System.out.println("OSM enriched="+enriched+" matched="+matched+" ambiguous="+ambiguous);
                }
                long retired=retireUnavailable(candidates,fingerprint);
                lastReport=new Report(candidates.size(),matched,enriched,ambiguous,unchanged,retired);lastApplied=signature;
                return lastReport;
            } finally {try(var s=lock.createStatement()){s.execute("SELECT pg_advisory_unlock(1875440583)");}}
        }
    }
    static Map<String,Map<String,JsonNode>> read(Path snapshot)throws IOException {
        var result=new TreeMap<String,Map<String,JsonNode>>();var mapper=new ObjectMapper();long count=0;
        try(var reader=Files.newBufferedReader(snapshot)){
            for(String line;(line=reader.readLine())!=null;){
                if(line.length()>16384||++count>2_000_000)throw new IOException("OSM snapshot bounds exceeded");
                var row=mapper.readTree(line);String siret=row.path("tags").path("ref:FR:SIRET").asText("").strip(),type=row.path("type").asText();long id=row.path("id").asLong();
                if(!siret.matches("[0-9]{14}")||!Set.of("node","way","relation").contains(type)||id<=0)throw new IOException("Invalid OSM snapshot identity");
                var objects=result.computeIfAbsent(siret,k->new TreeMap<>());String key=type+"/"+id;
                // Ignore overlap between regional extracts; keep at most two objects to flag ambiguity.
                if(objects.size()<2||objects.containsKey(key))objects.put(key,row);
            }
        }
        if(result.isEmpty())throw new IOException("Empty OSM snapshot; directory unchanged");return result;
    }
    private static String contact(JsonNode tags,String key,int max){String value=tags.path("contact:"+key).asText("").strip();if(value.isBlank())value=tags.path(key).asText("").strip();return value.length()<=max?value:"";}
    private static Double coordinate(JsonNode value,int max){double number=value.isNumber()?value.asDouble():Double.NaN;return Double.isFinite(number)&&Math.abs(number)<=max?number:null;}
    private void clearAutomaticPoint(long id){db.update("UPDATE baitly_directory_professionals SET osm_key=NULL,osm_name=NULL,osm_address=NULL,latitude=NULL,longitude=NULL,osm_confirmed_at=NULL,osm_confirmed_by=NULL WHERE id=? AND osm_confirmed_by=?",id,ACTOR);}
    /** Removed or newly ambiguous stock identities must not keep stale automatic contact data. */
    private long retireUnavailable(Map<String,Map<String,JsonNode>> candidates,String fingerprint)throws IOException {
        var prior=db.queryForList("""
            SELECT p.id,p.siret,e.snapshot AS proof,e.source_url FROM baitly_directory_professionals p
            JOIN LATERAL (SELECT snapshot,source_url FROM baitly_directory_source_evidence
                WHERE professional_id=p.id AND source='OSM' AND confirmed_by=? ORDER BY id DESC LIMIT 1) e ON true
            WHERE p.source_active AND NOT p.suppressed AND (p.osm_confirmed_by IS NULL OR p.osm_confirmed_by=?)
            """,ACTOR,ACTOR);
        long retired=0;
        for(var row:prior){
            String siret=(String)row.get("siret");var objects=candidates.get(siret);
            if(objects!=null&&objects.size()==1)continue;
            var previous=mapper.readTree(row.get("proof").toString());if(fingerprint.equals(previous.path("fingerprint").asText()))continue;
            long id=((Number)row.get("id")).longValue();
            var proof=mapper.createObjectNode().put("siret",siret).put("fingerprint",fingerprint).put("state",objects==null?"REMOVED":"AMBIGUOUS");
            boolean saved=Boolean.TRUE.equals(tx.execute(t->{
                if(db.queryForList("SELECT id FROM baitly_directory_professionals WHERE id=? AND source_active AND NOT suppressed AND (osm_confirmed_by IS NULL OR osm_confirmed_by=?) FOR UPDATE",id,ACTOR).isEmpty())return false;
                db.update("UPDATE baitly_directory_professionals SET phone=NULL,email=NULL,website=NULL,osm_retrieved_at=now(),updated_at=now() WHERE id=?",id);clearAutomaticPoint(id);
                db.update("INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot) VALUES(?,'OSM',?,'ODbL 1.0',now(),?,?::jsonb)",id,row.get("source_url"),ACTOR,proof.toString());return true;
            }));if(saved)retired++;
        }
        return retired;
    }
}
