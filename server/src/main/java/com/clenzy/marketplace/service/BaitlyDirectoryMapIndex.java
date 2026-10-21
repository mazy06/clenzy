package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.*;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Duration;
import java.util.*;
import java.util.function.Supplier;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/** Versioned public directory read model. Contains no organization contacts or contact permissions. */
@Service
public class BaitlyDirectoryMapIndex {
    private final JdbcTemplate db;
    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final MeterRegistry metrics;
    private final TransactionTemplate tx;
    private final Cache<String,String> local=Caffeine.newBuilder().maximumWeight(16*1024*1024)
        .weigher((String k,String v)->k.length()*2+v.length()*2).expireAfterWrite(Duration.ofSeconds(30)).build();
    // Candidate lookups are nested inside list loads. Separate maps avoid ConcurrentHashMap recursive-compute failures.
    private final Cache<String,String> nearbyLocal=Caffeine.newBuilder().maximumWeight(4*1024*1024)
        .weigher((String k,String v)->k.length()*2+v.length()*2).expireAfterWrite(Duration.ofSeconds(30)).build();
    private final Cache<String,State> stateCache=Caffeine.newBuilder().maximumSize(1).expireAfterWrite(Duration.ofSeconds(2)).build();
    public record State(long revision,long indexedRevision,boolean spatial) {
        public boolean ready(){return revision==indexedRevision;}
        public boolean tiles(){return ready()&&spatial;}
    }
    public BaitlyDirectoryMapIndex(JdbcTemplate db,StringRedisTemplate redis,ObjectMapper json,MeterRegistry metrics,PlatformTransactionManager manager){
        this.db=db;this.redis=redis;this.json=json;this.metrics=metrics;tx=new TransactionTemplate(manager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.setTimeout(300);
    }
    public State state(){return stateCache.get("state",key->db.queryForObject("""
        SELECT revision,indexed_revision,EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema=current_schema() AND table_name='baitly_directory_professionals' AND column_name='map_position') AS spatial
        FROM baitly_directory_map_state WHERE id=true
        """,(r,n)->new State(r.getLong(1),r.getLong(2),r.getBoolean(3))));}
    /** Local single-flight prevents identical requests from simultaneously rebuilding the same payload. */
    public <T>T cached(String operation,Object key,Class<T> type,Supplier<T> load){
        long started=System.nanoTime();
        try{
            long revision=state().revision();
            String digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(key)));
            String cacheKey="baitly:directory:map:v3:"+revision+":"+operation+":"+digest;
            Cache<String,String> memory=operation.equals("nearby")?nearbyLocal:local;
            if(memory.getIfPresent(cacheKey)!=null)metrics.counter("baitly.directory.cache","layer","local").increment();
            String payload=memory.get(cacheKey,k->{
                try{String hit=redis.opsForValue().get(k);if(hit!=null){metrics.counter("baitly.directory.cache","layer","redis").increment();return hit;}}
                catch(RuntimeException ignored){metrics.counter("baitly.directory.cache","layer","redis_unavailable").increment();}
                T value=load.get();
                try{
                    String encoded=json.writeValueAsString(value);
                    // A source publication during the read must not populate the old revision.
                    if(revision==freshRevision())try{redis.opsForValue().set(k,encoded,Duration.ofMinutes(5));}catch(RuntimeException ignored){}
                    metrics.counter("baitly.directory.cache","layer","database").increment();return encoded;
                }catch(Exception e){throw new IllegalStateException("Cannot encode Baitly map result",e);}
            });
            return json.readerFor(type).with(com.fasterxml.jackson.databind.DeserializationFeature.USE_LONG_FOR_INTS).readValue(payload);
        }catch(RuntimeException e){throw e;}catch(Exception e){throw new IllegalStateException("Cannot read Baitly map cache",e);}
        finally{io.micrometer.core.instrument.Timer.builder("baitly.directory.map").tag("operation",operation)
            .publishPercentileHistogram().serviceLevelObjectives(Duration.ofMillis(50),Duration.ofMillis(100),Duration.ofMillis(300),Duration.ofSeconds(1),Duration.ofSeconds(3))
            .register(metrics).record(Duration.ofNanos(System.nanoTime()-started));}
    }
    private long freshRevision(){return Objects.requireNonNull(db.queryForObject("SELECT revision FROM baitly_directory_map_state WHERE id=true",Long.class));}
    /** A single scan at the finest level, then inexpensive roll-ups. Publication is atomic and fenced. */
    public boolean rebuild(){
        long started=System.nanoTime();
        boolean[] rebuilding={false};
        try{return Boolean.TRUE.equals(tx.execute(status->{
            // Works with both JDBC and JPA transaction managers, without requiring a custom Hibernate isolation dialect.
            db.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
            if(!Boolean.TRUE.equals(db.queryForObject("SELECT pg_try_advisory_xact_lock(1875440589)",Boolean.class)))return false;
            if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_sync WHERE phase='PUBLISH')",Boolean.class)))return false;
            long revision=freshRevision();
            Long previous=db.queryForObject("SELECT indexed_revision FROM baitly_directory_map_state WHERE id=true",Long.class);
            if(Objects.equals(previous,revision))return false;
            rebuilding[0]=true;
            db.update("DELETE FROM baitly_directory_map_cells WHERE revision=?",revision);
            db.update("""
                INSERT INTO baitly_directory_map_cells
                SELECT ?,12,
                    least(4095,greatest(0,floor((coalesce(longitude,sirene_longitude)+180)/360*4096)))::int,
                    least(4095,greatest(0,floor((1-ln(tan(pi()/4+radians(least(85.05112878,greatest(-85.05112878,coalesce(latitude,sirene_latitude))))/2))/pi())/2*4096)))::int,
                    activity,
                    (CASE WHEN nullif(btrim(coalesce(nullif(phone,''),rge_phone)),'') IS NOT NULL THEN 1 ELSE 0 END
                    + CASE WHEN nullif(btrim(coalesce(nullif(email,''),rge_email)),'') IS NOT NULL THEN 2 ELSE 0 END),
                    count(*),sum(coalesce(latitude,sirene_latitude)),sum(coalesce(longitude,sirene_longitude)),
                    min(coalesce(longitude,sirene_longitude)),min(coalesce(latitude,sirene_latitude)),
                    max(coalesce(longitude,sirene_longitude)),max(coalesce(latitude,sirene_latitude)),min(id),country_code,coalesce(service,'')
                FROM baitly_directory_professionals
                WHERE NOT suppressed AND source_active AND coalesce(latitude,sirene_latitude) BETWEEN -90 AND 90
                    AND coalesce(longitude,sirene_longitude) BETWEEN -180 AND 180
                GROUP BY 3,4,5,6,country_code,service
                """,revision);
            for(int level=11;level>=0;level--)db.update("""
                INSERT INTO baitly_directory_map_cells
                SELECT revision,?,x/2,y/2,activity,contact_mask,sum(count),sum(sum_lat),sum(sum_lon),
                    min(west),min(south),max(east),max(north),min(representative_id),country_code,service
                FROM baitly_directory_map_cells WHERE revision=? AND level=?
                GROUP BY revision,x/2,y/2,activity,contact_mask,country_code,service
                """,level,revision,level+1);
            // Under REPEATABLE READ a concurrent publication raises a serialization failure here; no partial generation is committed.
            db.update("UPDATE baitly_directory_map_state SET indexed_revision=?,indexed_at=now() WHERE id=true",revision);
            db.update("DELETE FROM baitly_directory_map_cells WHERE revision<>?",revision);
            db.execute("ANALYZE baitly_directory_map_cells");
            db.execute("ANALYZE baitly_directory_professionals");
            return true;
        }));}finally{stateCache.invalidateAll();if(rebuilding[0])metrics.timer("baitly.directory.index.build").record(Duration.ofNanos(System.nanoTime()-started));}
    }
    static String cellFilters(String service,String contacts,List<Object> args){return cellFilters(service,contacts,args,"FR");}
    static String cellFilters(String service,String contacts,List<Object> args,String country){
        String where=" AND "+BaitlyDirectoryCountry.readFilter(country,args);
        where+=BaitlyDirectoryCountry.serviceFilter(country,service,args);
        return where+switch(Objects.toString(contacts,"")){
            case "" -> "";case "ANY" -> " AND contact_mask<>0";case "EMAIL" -> " AND contact_mask IN(2,3)";
            case "PHONE" -> " AND contact_mask IN(1,3)";case "BOTH" -> " AND contact_mask=3";case "NONE" -> " AND contact_mask=0";
            default -> throw new IllegalArgumentException("Filtre de coordonnées invalide");
        };
    }
    /** Only whole source extents can be answered from aggregates without approximating viewport counts. */
    public BaitlyProfessionalDirectory.MapCoverage coverage(String service,String contacts,double west,double south,double east,double north){return coverage(service,contacts,west,south,east,north,"FR");}
    public BaitlyProfessionalDirectory.MapCoverage coverage(String service,String contacts,double west,double south,double east,double north,String country){
        State state=state();if(!state.ready()||west>east)return null;
        double width=Math.max(0.00001,east-west),height=Math.max(0.00001,north-south);
        int level=Math.max(0,Math.min(12,(int)Math.floor(Math.min(Math.log(360/width*12)/Math.log(2),Math.log(170/height*8)/Math.log(2)))));
        var args=new ArrayList<Object>(List.of(state.revision(),level));String filter=cellFilters(service,contacts,args,country);
        int scale=1<<level;
        int minX=Math.max(0,Math.min(scale-1,(int)Math.floor((west+180)/360*scale)));
        int maxX=Math.max(0,Math.min(scale-1,(int)Math.floor((east+180)/360*scale)));
        var cells=db.queryForList("SELECT * FROM baitly_directory_map_cells WHERE revision=? AND level=?"+filter+
            " AND x BETWEEN ? AND ? AND y BETWEEN ? AND ? AND east>=? AND west<=? AND north>=? AND south<=?",
            append(args,minX,maxX,tileY(north,scale),tileY(south,scale),west,east,south,north));
        // Boundary groups use the live spatial query. Fully contained views stay a tiny indexed read.
        for(var c:cells)if(num(c,"west")<west||num(c,"east")>east||num(c,"south")<south||num(c,"north")>north)return null;
        var grouped=new LinkedHashMap<String,double[]>();
        for(var c:cells){
            String key=c.get("x")+":"+c.get("y");
            double[] g=grouped.computeIfAbsent(key,k->new double[]{0,0,0,180,90,-180,-90,Double.MAX_VALUE});
            g[0]+=num(c,"count");g[1]+=num(c,"sum_lat");g[2]+=num(c,"sum_lon");
            g[3]=Math.min(g[3],num(c,"west"));g[4]=Math.min(g[4],num(c,"south"));g[5]=Math.max(g[5],num(c,"east"));g[6]=Math.max(g[6],num(c,"north"));g[7]=Math.min(g[7],num(c,"representative_id"));
        }
        var clusters=new ArrayList<BaitlyProfessionalDirectory.MapCluster>();
        grouped.forEach((key,g)->clusters.add(new BaitlyProfessionalDirectory.MapCluster(level+":"+key,(long)g[0],g[1]/g[0],g[2]/g[0],g[3],g[4],g[5],g[6],(long)g[7])));
        return new BaitlyProfessionalDirectory.MapCoverage(clusters,clusters.stream().mapToLong(BaitlyProfessionalDirectory.MapCluster::count).sum());
    }
    public byte[] tile(int z,int x,int y,String service,String contacts,long revision){return tile(z,x,y,service,contacts,revision,"FR");}
    public byte[] tile(int z,int x,int y,String service,String contacts,long revision,String country){
        if(z<0||z>9||x<0||y<0||x>=(1<<z)||y>=(1<<z))throw new IllegalArgumentException("Tuile invalide");
        cellFilters(service,contacts,new ArrayList<>(),country);
        State state=state();
        if(!state.tiles()||revision!=state.revision())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"L’index cartographique est en cours d’actualisation");
        return cached("tile",List.of(country,z,x,y,service,contacts,revision),byte[].class,()->{
            int level=Math.min(12,z+3),factor=1<<(level-z);
            var args=new ArrayList<Object>(List.of(revision,level,x*factor,(x+1)*factor-1,y*factor,(y+1)*factor-1));
            String filter=cellFilters(service,contacts,args,country);args.add(z);args.add(x);args.add(y);
            return db.queryForObject("""
                WITH grouped AS (
                    SELECT x,y,sum(count)::bigint AS count,sum(sum_lon)/sum(count) AS lon,sum(sum_lat)/sum(count) AS lat,
                        min(west) AS west,min(south) AS south,max(east) AS east,max(north) AS north,min(representative_id) AS id
                    FROM baitly_directory_map_cells WHERE revision=? AND level=? AND x BETWEEN ? AND ? AND y BETWEEN ? AND ?
                """+filter+"""
                    GROUP BY x,y
                ), features AS (
                    SELECT id,count,west,south,east,north,
                        public.ST_AsMVTGeom(public.ST_Transform(public.ST_SetSRID(public.ST_MakePoint(lon,lat),4326),3857),
                            public.ST_TileEnvelope(?,?,?),4096,64,true) AS geom
                    FROM grouped
                ) SELECT coalesce(public.ST_AsMVT(features,'professionals',4096,'geom'),'') FROM features
                """,byte[].class,args.toArray());
        });
    }
    private static int tileY(double latitude,int scale){
        double lat=Math.max(-85.05112878,Math.min(85.05112878,latitude));
        return Math.max(0,Math.min(scale-1,(int)Math.floor((1-Math.log(Math.tan(Math.PI/4+Math.toRadians(lat)/2))/Math.PI)/2*scale)));
    }
    private static double num(Map<String,Object> row,String key){return ((Number)row.get(key)).doubleValue();}
    private static Object[] append(List<Object> args,Object... values){var all=new ArrayList<>(args);Collections.addAll(all,values);return all.toArray();}
}
