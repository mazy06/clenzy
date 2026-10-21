package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.*;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Existing staged JDBC publication, extended with country fencing and scoped retirement. */
@Service
public class BaitlyDirectoryCountrySync {
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(BaitlyDirectoryCountrySync.class);
    private final java.util.Set<String> legacyPublicNotices=java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final JdbcTemplate db;private final TransactionTemplate tx;private final StringRedisTemplate redis;
    private final BaitlyDirectoryCountryStock stock;private final ObjectMapper json;private final Environment config;
    public BaitlyDirectoryCountrySync(JdbcTemplate db,PlatformTransactionManager manager,StringRedisTemplate redis,
                                     BaitlyDirectoryCountryStock stock,ObjectMapper json,Environment config){
        this.db=db;tx=new TransactionTemplate(manager);tx.setTimeout(60);this.redis=redis;this.stock=stock;this.json=json;this.config=config;
    }
    public Map<String,Object> status(String country){
        country=foreign(country);var rows=db.queryForList("SELECT country_code,phase,scanned,selected,published,failures,source_error,retry_at,updated_at,completed_at FROM baitly_directory_sync WHERE country_code=?",country);
        var result=rows.isEmpty()?new LinkedHashMap<String,Object>():new LinkedHashMap<>(rows.getFirst());result.put("enabled",enabled(country));return result;
    }
    private boolean enabled(String country){return config.getProperty("baitly.directory."+country.toLowerCase(Locale.ROOT)+".enabled",Boolean.class,false)
        ||java.util.Set.of("MA","SA").contains(country)&&config.getProperty("baitly.directory."+country.toLowerCase(java.util.Locale.ROOT)+".osm.enabled",Boolean.class,true);}
    public void synchronize(String country)throws IOException {synchronize(country,false);}
    /** Only the one-shot operator rechecks a newly published source before an existing retry deadline. */
    public void synchronize(String country,boolean recheckSource)throws IOException {
        country=foreign(country);if(!enabled(country))return;
        String lease="baitly:directory:stock:"+country,token=UUID.randomUUID().toString();
        if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(lease,token,Duration.ofSeconds(90))))return;
        final String scope=country;
        try{
            var runs=db.queryForList("SELECT * FROM baitly_directory_sync WHERE country_code=?",country);
            if(!recheckSource&&!runs.isEmpty()&&runs.getFirst().get("retry_at") instanceof Timestamp retry&&retry.toInstant().isAfter(Instant.now()))return;
            var opened=stock.open(country);if(opened.isEmpty())return;var input=opened.get();var manifest=input.manifest();
            String signature=signature(manifest);
            if(manifest.source().equals("OSM")&&!runs.isEmpty()
                &&(country+"_PUBLIC").equals(json.readTree(Objects.toString(runs.getFirst().get("source_manifest"),"{}")).path("source").asText())){
                if(legacyPublicNotices.add(country))log.info("Baitly {}: legacy OSM edition ignored; combined directory retained",country);
                return;
            }
            if(manifest.source().equals(country+"_PUBLIC"))legacyPublicNotices.remove(country);
            if(runs.isEmpty()||!signature.equals(runs.getFirst().get("establishments_etag"))){
                renew(lease,token);
                tx.executeWithoutResult(s->{
                    lock(scope);db.update("DELETE FROM baitly_directory_sync_stage WHERE country_code=?",scope);db.update("DELETE FROM baitly_directory_sync WHERE country_code=?",scope);
                    db.update("INSERT INTO baitly_directory_sync(country_code,revision,establishments_url,units_url,establishments_etag,phase,source_manifest) VALUES(?,?,?,'',?,'ESTABLISHMENTS',?::jsonb)",scope,UUID.randomUUID(),input.path().toString(),signature,encode(manifest));
                });runs=db.queryForList("SELECT * FROM baitly_directory_sync WHERE country_code=?",country);
            }
            var run=runs.getFirst();if("COMPLETED".equals(run.get("phase"))){
                if(run.get("source_error")!=null)db.update("UPDATE baitly_directory_sync SET failures=0,source_error=NULL,retry_at=NULL,updated_at=now() WHERE country_code=? AND revision=? AND phase='COMPLETED'",country,run.get("revision"));
                return;
            }
            if(((Number)run.get("failures")).intValue()>=3)return;
            UUID revision=(UUID)run.get("revision");long cursor=((Number)run.get("cursor")).longValue();
            if("ESTABLISHMENTS".equals(run.get("phase"))){
                long lineNumber=0,saved=cursor;int processed=0;var batch=new ArrayList<BaitlyDirectoryCountryStock.Entry>();
                try(var lines=Files.newBufferedReader(input.path())){
                    String line;while((line=readLine(lines))!=null){
                        if(++lineNumber<=cursor)continue;if(lineNumber>manifest.count())throw new IOException("Country snapshot exceeds manifest count");renew(lease,token);
                        batch.add(stock.entry(manifest,line));
                        // Match the French stock's 1,000-row batches. Successful paid calls are durable immediately.
                        if(batch.size()>=(manifest.mode().equals("wathq-seeds")?1:1000)){save(scope,revision,saved,lineNumber,batch);saved=lineNumber;batch.clear();}
                        if(++processed>=(manifest.mode().equals("wathq-seeds")?100:5000))return;
                    }
                }
                if(!batch.isEmpty())save(scope,revision,saved,lineNumber,batch);
                if(lineNumber!=manifest.count())throw new IOException("Incomplete country snapshot");renew(lease,token);
                var end=stock.open(country).orElseThrow();if(!end.manifest().equals(manifest))throw new IOException("Country edition changed during collection");
                tx.executeWithoutResult(s->{fence(scope,revision,"ESTABLISHMENTS",manifest.count());db.update("UPDATE baitly_directory_sync SET phase='PUBLISH',cursor=0 WHERE country_code=?",scope);});
            }
            publish(scope,revision,manifest,lease,token);
        }catch(IOException|RuntimeException failure){
            // A worker that lost its lease must not alter a successor's checkpoint or retry policy.
            if(!Objects.equals(redis.opsForValue().get(lease),token)){
                if(failure instanceof IOException io)throw io;throw failure;
            }
            long delay=failure instanceof BaitlyWathqClient.SourceFailure f?f.retrySeconds():60;
            boolean terminal=failure instanceof BaitlyWathqClient.SourceFailure f&&Set.of(400,401,403,404).contains(f.status());
            boolean throttled=failure instanceof BaitlyWathqClient.SourceFailure f&&f.status()==429;
            String reason=sourceFailureCode(failure);
            db.update("INSERT INTO baitly_directory_sync(country_code,revision,establishments_url,units_url,phase) VALUES(?,?,'','','ESTABLISHMENTS') ON CONFLICT(country_code) DO NOTHING",country,UUID.randomUUID());
            db.update("UPDATE baitly_directory_sync SET failures=CASE WHEN ? THEN 3 WHEN ? THEN failures ELSE failures+1 END,source_error=?,retry_at=now()+make_interval(secs=>greatest(?::double precision,least(3600,power(2,least(failures,6))*60))),updated_at=now() WHERE country_code=?",terminal,throttled,reason,delay,country);
            if(failure instanceof IOException io)throw io;throw failure;
        }finally{redis.execute(new DefaultRedisScript<>("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",Long.class),List.of(lease),token);}
    }
    public static String sourceFailureCode(Throwable failure){
        return failure instanceof BaitlyPublicCountryStock.SourceUnavailable f?"PUBLIC_HTTP_"+f.status():
            failure instanceof BaitlyWathqClient.SourceFailure f?"WATHQ_HTTP_"+f.status():
            failure instanceof IOException?"SOURCE_CONTRACT_OR_IO":"SOURCE_VALIDATION_OR_DATABASE";
    }
    private void publish(String country,UUID revision,BaitlyDirectoryCountryStock.Manifest m,String lease,String token)throws IOException {
        renew(lease,token);tx.executeWithoutResult(s->{
            db.queryForObject("SELECT pg_advisory_xact_lock(1875440589)",Object.class);lock(country);
            var run=db.queryForMap("SELECT phase,revision FROM baitly_directory_sync WHERE country_code=? FOR UPDATE",country);
            if(!"PUBLISH".equals(run.get("phase"))||!revision.equals(run.get("revision")))throw new IllegalStateException("Stale country publisher");
            long count=Objects.requireNonNull(db.queryForObject("SELECT count(*) FROM baitly_directory_sync_stage WHERE country_code=?",Long.class,country));
            if(count!=m.count())throw new IllegalStateException("Incomplete country staging");
            boolean combined=(country+"_PUBLIC").equals(m.source());
            String sourceScope=combined?"base_source IN ('OSM','OVERTURE')":"base_source=?";
            Object[] scopeArgs=combined?new Object[]{country}:new Object[]{country,m.source()};
            Long previous=db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE country_code=? AND "+sourceScope+" AND source_active",Long.class,scopeArgs);
            if(m.complete()&&previous!=null&&previous>100&&count<previous/2)throw new IllegalStateException("Snapshot shrink requires review");
            if(combined){
                // Release source aliases only for rows absent from this complete edition, inside the publication transaction.
                db.update("""
                    UPDATE baitly_directory_professionals p SET source_active=false,phone=NULL,email=NULL,website=NULL
                    WHERE p.country_code=? AND p.base_source IN ('OSM','OVERTURE') AND NOT EXISTS(
                        SELECT 1 FROM baitly_directory_sync_stage s WHERE s.country_code=p.country_code
                        AND s.identifier_type=p.identifier_type AND s.identifier=p.identifier)
                    """,country);
            }
            // Physical sirene_* columns retain compatibility with the existing generated PostGIS column.
            // base_source determines their actual provenance; no foreign row is labelled SIRENE.
            db.update("""
                INSERT INTO baitly_directory_professionals(country_code,identifier_type,identifier,identifiers,service,base_source,source_url,source_licence,
                    name,address,city,postal_code,activity,sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by,phone,email,website,national_revision,website_services)
                SELECT country_code,identifier_type,identifier,payload->'identifiers',payload->>'service',
                    coalesce(payload->'raw'->>'baseSource',?),coalesce(payload->'raw'->>'sourceUrl',?),coalesce(payload->'raw'->>'sourceLicence',?),trade_name,address,city,postal_code,activity,
                    (payload->>'latitude')::double precision,(payload->>'longitude')::double precision,coalesce((payload->>'retrievedAt')::timestamptz,?),'baitly:country-stock',payload->>'phone',payload->>'email',payload->>'website',?,coalesce(payload->'raw'->'websiteServices','[]'::jsonb)
                FROM baitly_directory_sync_stage s WHERE country_code=? AND NOT EXISTS(
                    SELECT 1 FROM baitly_directory_professionals removed WHERE removed.country_code=s.country_code
                    AND removed.suppressed AND removed.identifiers->>'OVERTURE'=s.payload->'identifiers'->>'OVERTURE')
                ON CONFLICT(country_code,identifier_type,identifier) DO UPDATE SET
                    name=excluded.name,address=excluded.address,city=excluded.city,postal_code=excluded.postal_code,activity=excluded.activity,
                    identifiers=excluded.identifiers,service=excluded.service,website_services=excluded.website_services,source_url=excluded.source_url,source_licence=excluded.source_licence,
                    sirene_latitude=excluded.sirene_latitude,sirene_longitude=excluded.sirene_longitude,sirene_retrieved_at=excluded.sirene_retrieved_at,
                    phone=CASE WHEN baitly_directory_professionals.osm_key IS NOT NULL AND $SAME_ADDRESS THEN baitly_directory_professionals.phone ELSE excluded.phone END,
                    email=CASE WHEN baitly_directory_professionals.osm_key IS NOT NULL AND $SAME_ADDRESS THEN baitly_directory_professionals.email ELSE excluded.email END,
                    website=CASE WHEN baitly_directory_professionals.osm_key IS NOT NULL AND $SAME_ADDRESS THEN baitly_directory_professionals.website ELSE excluded.website END,
                    osm_key=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.osm_key END,
                    osm_name=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.osm_name END,
                    osm_address=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.osm_address END,
                    latitude=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.latitude END,
                    longitude=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.longitude END,
                    osm_confirmed_at=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.osm_confirmed_at END,
                    osm_confirmed_by=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.osm_confirmed_by END,
                    osm_retrieved_at=CASE WHEN $SAME_ADDRESS THEN baitly_directory_professionals.osm_retrieved_at END,
                    national_revision=excluded.national_revision,source_active=true,updated_at=now()
                WHERE NOT baitly_directory_professionals.suppressed AND baitly_directory_professionals.base_source=excluded.base_source
                """.replace("$SAME_ADDRESS","(baitly_directory_professionals.address=excluded.address AND baitly_directory_professionals.city=excluded.city AND baitly_directory_professionals.postal_code=excluded.postal_code)"),m.source(),m.sourceUrl(),m.licence(),Timestamp.from(m.retrievedAt()),revision,country);
            if(m.source().equals("OSM"))db.update("UPDATE baitly_directory_professionals SET source_url='https://www.openstreetmap.org/'||identifier WHERE country_code=? AND national_revision=? AND base_source='OSM'",country,revision);
            if(combined)db.update("DELETE FROM baitly_directory_source_evidence e USING baitly_directory_professionals p WHERE e.professional_id=p.id AND p.country_code=? AND p.national_revision=? AND e.source IN ('OSM','OVERTURE','WEBSITE')",country,revision);
            else db.update("DELETE FROM baitly_directory_source_evidence e USING baitly_directory_professionals p WHERE e.professional_id=p.id AND p.country_code=? AND p.national_revision=? AND e.source=?",country,revision,m.source());
            db.update("""
                INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot)
                SELECT p.id,coalesce(s.payload->'raw'->>'baseSource',?),p.source_url,coalesce(s.payload->'raw'->>'sourceLicence',?),coalesce((s.payload->>'retrievedAt')::timestamptz,?),'baitly:country-stock',s.payload FROM baitly_directory_professionals p JOIN baitly_directory_sync_stage s
                    ON s.country_code=p.country_code AND s.identifier_type=p.identifier_type AND s.identifier=p.identifier
                WHERE p.country_code=? AND p.national_revision=? AND NOT p.suppressed
                """,m.source(),m.licence(),Timestamp.from(m.retrievedAt()),country,revision);
            if(combined)db.update("""
                INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot)
                SELECT p.id,e->>'source',e->>'url',e->>'licence',coalesce((e->>'retrievedAt')::timestamptz,?),'baitly:country-stock',e
                FROM baitly_directory_professionals p JOIN baitly_directory_sync_stage s
                  ON s.country_code=p.country_code AND s.identifier_type=p.identifier_type AND s.identifier=p.identifier
                CROSS JOIN LATERAL jsonb_array_elements(s.payload->'raw'->'sourceEvidence') e
                WHERE p.country_code=? AND p.national_revision=? AND NOT p.suppressed AND e->>'source'<>p.base_source
                """,Timestamp.from(m.retrievedAt()),country,revision);
            if(combined)db.update("UPDATE baitly_directory_professionals SET source_active=false,phone=NULL,email=NULL,website=NULL,updated_at=now() WHERE country_code=? AND base_source IN ('OSM','OVERTURE') AND national_revision IS DISTINCT FROM ?",country,revision);
            else if(m.complete())db.update("UPDATE baitly_directory_professionals SET source_active=false,phone=NULL,email=NULL,website=NULL,updated_at=now() WHERE country_code=? AND base_source=? AND national_revision IS DISTINCT FROM ?",country,m.source(),revision);
            db.update("DELETE FROM baitly_directory_sync_stage WHERE country_code=?",country);
            Long published=db.queryForObject("SELECT count(*) FROM baitly_directory_professionals WHERE country_code=? AND national_revision=? AND source_active AND NOT suppressed",Long.class,country,revision);
            db.update("UPDATE baitly_directory_sync SET phase='COMPLETED',published=?,completed_at=now(),updated_at=now(),failures=0,source_error=NULL,retry_at=NULL WHERE country_code=?",published,country);
        });
    }
    private void fence(String country,UUID revision,String phase,long cursor){
        lock(country);var row=db.queryForMap("SELECT revision,phase,cursor FROM baitly_directory_sync WHERE country_code=? FOR UPDATE",country);
        if(!revision.equals(row.get("revision"))||!phase.equals(row.get("phase"))||cursor!=((Number)row.get("cursor")).longValue())throw new IllegalStateException("Stale country checkpoint");
    }
    private void save(String country,UUID revision,long previous,long next,List<BaitlyDirectoryCountryStock.Entry> batch){
        tx.executeWithoutResult(s->{
            fence(country,revision,"ESTABLISHMENTS",previous);
            db.batchUpdate("INSERT INTO baitly_directory_sync_stage(country_code,identifier_type,identifier,trade_name,address,city,postal_code,activity,payload) VALUES(?,?,?,?,?,?,?,?,?::jsonb)",batch,1000,(statement,entry)->{
                statement.setString(1,country);statement.setString(2,entry.identity().type());statement.setString(3,entry.identity().value());
                statement.setString(4,entry.name());statement.setString(5,entry.address());statement.setString(6,entry.city());
                statement.setString(7,entry.postalCode());statement.setString(8,entry.activity());statement.setString(9,encode(entry));
            });
            db.update("UPDATE baitly_directory_sync SET cursor=?,scanned=?,selected=selected+?,failures=0,source_error=NULL,retry_at=NULL,updated_at=now() WHERE country_code=?",next,next,batch.size(),country);
        });
    }
    private void lock(String country){db.queryForObject("SELECT pg_advisory_xact_lock(?,?)",Object.class,589,country.equals("MA")?1:2);}
    private void renew(String key,String token)throws IOException {
        if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
        if(!Objects.equals(redis.execute(new DefaultRedisScript<>("if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('EXPIRE',KEYS[1],90);return 1 else return 0 end",Long.class),List.of(key),token),1L))throw new IOException("Country worker lease lost");
    }
    private String encode(Object value){try{return json.writeValueAsString(value);}catch(IOException invalid){throw new IllegalArgumentException("Invalid country source",invalid);}}
    private String signature(Object value){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(encode(value).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
    private static String foreign(String country){country=BaitlyDirectoryCountry.country(country);if(country.equals("FR"))throw new IllegalArgumentException("Use Sirene for France");return country;}
    private static String readLine(Reader reader)throws IOException {
        var line=new StringBuilder();int c;while((c=reader.read())!=-1&&c!='\n'){if(line.length()>=64000)throw new IOException("Country row size exceeded");if(c!='\r')line.append((char)c);}return c==-1&&line.isEmpty()?null:line.toString();
    }
}
