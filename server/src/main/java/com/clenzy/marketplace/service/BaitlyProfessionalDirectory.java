package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import static com.clenzy.marketplace.service.BaitlyProfessionalData.*;

/** Shared references, deliberately isolated from private tenant CRM and account activation. */
@Service
public class BaitlyProfessionalDirectory {
    private final JdbcTemplate db;
    private final BaitlyProfessionalDataClient client;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    public BaitlyProfessionalDirectory(JdbcTemplate db,BaitlyProfessionalDataClient client,StringRedisTemplate redis,ObjectMapper mapper){this.db=db;this.client=client;this.redis=redis;this.mapper=mapper;}
    public record Search(@Size(max=120) String query,@Pattern(regexp="[0-9]{5}|^$") String postalCode,@Min(1) @Max(100) int page,
                         @Pattern(regexp="[0-9AB]{5}|^$") String communeCode,@Size(max=30) String service) {
        public Search(String query,String postalCode,int page){this(query,postalCode,page,"","");}
    }
    public record Choice(@NotNull UUID ticket,@Min(0) @Max(29) int index) {}
    public record BulkChoices(@NotEmpty @Size(max=100) List<@NotNull @Valid Choice> choices) {}
    public record ImportResult(String siret,String name,String status,Long id) {}
    public record SelectedBusiness(Business business,Instant retrievedAt) {}
    public record ReferenceLocation(String label,double latitude,double longitude,String osmConfirmedAt) {}
    public record ContactEvidence(String source,String url,String licence,Instant retrievedAt) {}
    public record ReferencedSource(SelectedBusiness identity,String phone,String email,String website,String osmKey,Instant osmRetrievedAt,ReferenceLocation location,List<ContactEvidence> contactSources) {
        public ReferencedSource(SelectedBusiness identity,String phone,String email,String website,String osmKey,Instant osmRetrievedAt,ReferenceLocation location){this(identity,phone,email,website,osmKey,osmRetrievedAt,location,List.of());}
        public ReferencedSource(SelectedBusiness identity,String phone,String email,String website,String osmKey,Instant osmRetrievedAt){this(identity,phone,email,website,osmKey,osmRetrievedAt,null);}
    }
    public record Preview(UUID ticket,List<Business> candidates,boolean hasNext) {}
    public record Matches(UUID ticket,List<Place> candidates) {}
    public record Ticket(String actor,String kind,Long id,String version,Instant retrievedAt,List<Business> businesses,List<Place> places) {}
    public record Page(List<Map<String,Object>> items,long total,int page) {}
    public record MapPage(List<Map<String,Object>> items,Long nextCursor) {}
    public record MapCluster(String key,long count,double latitude,double longitude,double west,double south,double east,double north,long representativeId) {}
    public record MapCoverage(List<MapCluster> clusters,long total) {}
    /** Baitly: complete visible coverage, independent of the detail-list cursor. */
    @Transactional(readOnly=true)
    public MapCoverage clusters(String city,String service,String query,double west,double south,double east,double north,String contacts){
        var scope=mapScope(city,service,query,west,south,east,north,0,contacts);
        if(west==east)throw new IllegalArgumentException("Emprise de carte invalide");
        double width=east>west?east-west:360-west+east;
        var args=new ArrayList<Object>(List.of(west,width,south,north-south));args.addAll(scope.args());
        var clusters=db.query("""
            WITH viewport AS (SELECT ?::float8 AS west,?::float8 AS width,?::float8 AS south,?::float8 AS height),
            positioned AS (
                SELECT id,coalesce(latitude,sirene_latitude) AS lat,coalesce(longitude,sirene_longitude) AS lon
                FROM baitly_directory_professionals
            """+scope.where()+"""
            ), cells AS (
                SELECT id,lat,CASE WHEN lon<v.west THEN lon+360 ELSE lon END AS lng,
                    least(11,greatest(0,floor((CASE WHEN lon<v.west THEN lon+360 ELSE lon END-v.west)/v.width*12)))::int AS x,
                    least(7,greatest(0,floor((lat-v.south)/v.height*8)))::int AS y
                FROM positioned CROSS JOIN viewport v
            )
            SELECT x,y,count(*) AS count,avg(lat) AS lat,avg(lng) AS lng,
                min(lng) AS west,min(lat) AS south,max(lng) AS east,max(lat) AS north,min(id) AS representative_id
            FROM cells GROUP BY x,y ORDER BY y,x
            """,(rs,index)->new MapCluster(rs.getInt("x")+":"+rs.getInt("y"),rs.getLong("count"),rs.getDouble("lat"),wrapLongitude(rs.getDouble("lng")),
                wrapLongitude(rs.getDouble("west")),rs.getDouble("south"),wrapLongitude(rs.getDouble("east")),rs.getDouble("north"),rs.getLong("representative_id")),args.toArray());
        return new MapCoverage(clusters,clusters.stream().mapToLong(MapCluster::count).sum());
    }
    private static double wrapLongitude(double value){return value>180?value-360:value;}
    /** Read only, bounded/keyset access to shared positions; never creates tenant contacts. */
    @Transactional(readOnly=true)
    public MapPage map(String city,String service,String query,double west,double south,double east,double north,long after) {
        return map(city,service,query,west,south,east,north,after,"");
    }
    @Transactional(readOnly=true)
    public MapPage map(String city,String service,String query,double west,double south,double east,double north,long after,String contacts) {
        var scope=mapScope(city,service,query,west,south,east,north,after,contacts);
        var args=scope.args();String where=scope.where();
        var rows=db.queryForList("""
            SELECT id,siret,name,address,city,postal_code,activity,coalesce(latitude,sirene_latitude) AS latitude,coalesce(longitude,sirene_longitude) AS longitude,
                coalesce(nullif(phone,''),rge_phone) AS phone,coalesce(nullif(email,''),rge_email) AS email,coalesce(nullif(website,''),rge_website) AS website,rge_retrieved_at,sirene_retrieved_at,osm_key,osm_name,osm_confirmed_at,
                coalesce(osm_key,(SELECT e.snapshot->>'key' FROM baitly_directory_source_evidence e WHERE e.professional_id=baitly_directory_professionals.id AND e.source='OSM' AND e.confirmed_by='baitly:osm-stock' ORDER BY e.id DESC LIMIT 1)) AS osm_contact_key,
                CASE WHEN osm_confirmed_at IS NOT NULL THEN 'OSM' ELSE 'SIRENE' END AS location_source
            FROM baitly_directory_professionals
            """+where+" ORDER BY id LIMIT 201",args.toArray());
        boolean more=rows.size()>200;var items=List.copyOf(rows.subList(0,Math.min(200,rows.size())));
        return new MapPage(items,more?((Number)items.getLast().get("id")).longValue():null);
    }
    private record MapScope(String where,List<Object> args) {}
    /** Global ranking precedes pagination; the last ID anchors a full ranking tuple, not an ID order. */
    @Transactional(readOnly=true)
    public MapPage rankedMap(String city,String service,String query,double west,double south,double east,double north,long after,String contacts,String sort) {
        var scope=mapScope(city,service,query,west,south,east,north,0,contacts);
        if(after<0)throw new IllegalArgumentException("Curseur invalide");
        String order=switch(sort){
            case "PROXIMITY" -> "distance,contact_rank,name_rank,id";
            case "CONTACTS" -> "contact_rank,distance,name_rank,id";
            case "NAME" -> "name_rank,id";
            default -> throw new IllegalArgumentException("Tri invalide");
        };
        double centerLat=(south+north)/2,centerLon=wrapLongitude(west+(east>=west?east-west:360-west+east)/2);
        var args=new ArrayList<Object>(List.of(centerLat,centerLat,centerLon));args.addAll(scope.args());
        String cursor="";
        if(after>0){cursor=" WHERE ("+order+") > (SELECT "+order+" FROM ranked WHERE id=?)";args.add(after);}
        var rows=db.queryForList("""
            WITH ranked AS NOT MATERIALIZED (
                SELECT id,siret,name,address,city,postal_code,activity,
                    coalesce(latitude,sirene_latitude) AS latitude,coalesce(longitude,sirene_longitude) AS longitude,
                    coalesce(nullif(phone,''),rge_phone) AS phone,coalesce(nullif(email,''),rge_email) AS email,
                    coalesce(nullif(website,''),rge_website) AS website,rge_retrieved_at,sirene_retrieved_at,osm_key,osm_name,osm_confirmed_at,
                    coalesce(osm_key,(SELECT e.snapshot->>'key' FROM baitly_directory_source_evidence e WHERE e.professional_id=baitly_directory_professionals.id AND e.source='OSM' AND e.confirmed_by='baitly:osm-stock' ORDER BY e.id DESC LIMIT 1)) AS osm_contact_key,
                    CASE WHEN osm_confirmed_at IS NOT NULL THEN 'OSM' ELSE 'SIRENE' END AS location_source,
                    lower(name) COLLATE "C" AS name_rank,
                    -(CASE WHEN nullif(btrim(coalesce(nullif(phone,''),rge_phone)),'') IS NOT NULL THEN 1 ELSE 0 END
                     + CASE WHEN nullif(btrim(coalesce(nullif(email,''),rge_email)),'') IS NOT NULL THEN 1 ELSE 0 END) AS contact_rank,
                    (sin(radians(coalesce(latitude,sirene_latitude)-?)/2)^2
                     +cos(radians(?))*cos(radians(coalesce(latitude,sirene_latitude)))
                     *sin(radians(coalesce(longitude,sirene_longitude)-?)/2)^2) AS distance
                FROM baitly_directory_professionals
            """+scope.where()+") SELECT * FROM ranked"+cursor+" ORDER BY "+order+" LIMIT 201",args.toArray());
        boolean more=rows.size()>200;var items=new ArrayList<>(rows.subList(0,Math.min(200,rows.size())));
        for(var row:items){row.remove("distance");row.remove("contact_rank");row.remove("name_rank");}
        return new MapPage(List.copyOf(items),more?((Number)items.getLast().get("id")).longValue():null);
    }
    private static MapScope mapScope(String city,String service,String query,double west,double south,double east,double north,long after,String contacts){
        if(!Double.isFinite(west)||!Double.isFinite(east)||!Double.isFinite(south)||!Double.isFinite(north)||west< -180||west>180||east< -180||east>180||south< -90||north>90||south>=north||after<0)
            throw new IllegalArgumentException("Emprise de carte invalide");
        String cityValue=Objects.toString(city,"").strip(),search=Objects.toString(query,"").strip();
        if(cityValue.length()>120||search.length()>120)throw new IllegalArgumentException("Recherche invalide");
        var args=new ArrayList<Object>();
        String where=" WHERE suppressed=false AND source_active=true AND id>? AND coalesce(latitude,sirene_latitude) BETWEEN ? AND ? AND ";
        args.add(after);args.add(south);args.add(north);
        where+=west<=east?"coalesce(longitude,sirene_longitude) BETWEEN ? AND ?":"(coalesce(longitude,sirene_longitude)>=? OR coalesce(longitude,sirene_longitude)<=?)";
        args.add(west);args.add(east);
        where+=contactFilter(contacts);
        if(!cityValue.isBlank()){where+=" AND city ILIKE ? ESCAPE '!'";args.add(escapePattern(cityValue));}
        if(!search.isBlank()){where+=" AND (name ILIKE ? ESCAPE '!' OR city ILIKE ? ESCAPE '!' OR postal_code ILIKE ? ESCAPE '!' OR siret ILIKE ? ESCAPE '!')";for(int i=0;i<4;i++)args.add(escapePattern(search));}
        var activities=BaitlyProfessionalSearchFilters.activities(service);
        if(!activities.isEmpty()){where+=" AND activity IN ("+String.join(",",Collections.nCopies(activities.size(),"?"))+")";args.addAll(activities);}
        return new MapScope(where,args);
    }
    private static String escapePattern(String value){return "%"+value.replace("!","!!").replace("%","!%").replace("_","!_")+"%";}
    public Preview search(String actor,Search input){
        String query=Objects.toString(input.query(),"").strip(),postal=Objects.toString(input.postalCode(),"");
        var communes=BaitlyProfessionalSearchFilters.communes(input.communeCode());
        var activities=BaitlyProfessionalSearchFilters.activities(input.service());
        if(communes.isEmpty()&&(query.length()<3||!postal.matches("[0-9]{5}")))throw new IllegalArgumentException("Choisissez une ville ou indiquez un nom et un code postal");
        var response=communes.isEmpty()&&activities.isEmpty()?client.search(query,postal,input.page()):
            client.search(query,postal,BaitlyProfessionalSearchFilters.csv(communes),BaitlyProfessionalSearchFilters.csv(activities),input.page());
        var candidates=businesses(response,communes,activities,postal);
        return new Preview(store(new Ticket(actor,"SIRENE",null,null,Instant.now(),candidates,List.of())),candidates,
            input.page()<response.path("total_pages").asInt(input.page()));
    }
    public com.fasterxml.jackson.databind.JsonNode cities(String name){return client.cities(name);}
    /** Read-only source resolution, also reused by scoped CRM imports without publishing global references. */
    public List<SelectedBusiness> selectedBusinesses(String actor,BulkChoices input){
        if(input.choices()==null||input.choices().isEmpty()||input.choices().size()>100)throw new IllegalArgumentException("Sélectionnez entre 1 et 100 établissements");
        var selected=new LinkedHashMap<String,SelectedBusiness>();
        for(Choice choice:input.choices()){
            Ticket ticket=ticket(actor,"SIRENE",null,choice);
            if(choice.index()<0||choice.index()>=ticket.businesses().size())throw new IllegalArgumentException("Établissement invalide");
            Business b=ticket.businesses().get(choice.index());selected.putIfAbsent(b.siret(),new SelectedBusiness(b,ticket.retrievedAt()));
        }
        return List.copyOf(selected.values());
    }
    public ReferencedSource referencedSource(long id){
        var row=require(id,false);boolean confirmed=row.get("osm_key")!=null&&row.get("osm_confirmed_at")!=null;
        var identity=new SelectedBusiness(business(row),((java.sql.Timestamp)row.get("sirene_retrieved_at")).toInstant());
        Double lat=number(row.get(confirmed?"latitude":"sirene_latitude")),lon=number(row.get(confirmed?"longitude":"sirene_longitude"));
        String label=Objects.toString(confirmed?row.get("osm_address"):row.get("address"),"").strip();if(label.isBlank())label=identity.business().address();
        var location=lat!=null&&lon!=null&&Double.isFinite(lat)&&Double.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&(lat!=0||lon!=0)?
            new ReferenceLocation(label,lat,lon,confirmed?((java.sql.Timestamp)row.get("osm_confirmed_at")).toInstant().toString():null):null;
        var sources=new ArrayList<ContactEvidence>();
        if(row.get("rge_retrieved_at") instanceof java.sql.Timestamp ts)sources.add(new ContactEvidence("ADEME",BaitlyAdemeRgeClient.SOURCE,"Licence Ouverte 2.0",ts.toInstant()));
        if(confirmed&&row.get("osm_retrieved_at") instanceof java.sql.Timestamp ts)sources.add(new ContactEvidence("OSM","https://www.openstreetmap.org/"+row.get("osm_key"),"ODbL 1.0",ts.toInstant()));
        return new ReferencedSource(identity,contactValue(row,"phone",confirmed),contactValue(row,"email",confirmed),
            contactValue(row,"website",confirmed),confirmed?(String)row.get("osm_key"):null,
            row.get("osm_retrieved_at") instanceof java.sql.Timestamp ts?ts.toInstant():null,location,List.copyOf(sources));
    }
    private static String contactValue(Map<String,Object> row,String field,boolean confirmed){
        String osm=confirmed?(String)row.get(field):null;return osm!=null&&!osm.isBlank()?osm:(String)row.get("rge_"+field);
    }
    public Matches match(String actor,long id){
        var row=require(id,false);var candidates=places(client.match(business(row)),business(row));
        return new Matches(store(new Ticket(actor,"OSM",id,row.get("updated_at").toString(),Instant.now(),List.of(),candidates)),candidates);
    }
    @Transactional
    public Map<String,Object> confirmBusiness(String actor,Choice choice){
        Ticket ticket=ticket(actor,"SIRENE",null,choice);
        if(choice.index()<0||choice.index()>=ticket.businesses().size())throw new IllegalArgumentException("Établissement invalide");
        lockImports();var result=importBusiness(actor,ticket,ticket.businesses().get(choice.index()));
        if(result.status().equals("REMOVED"))throw conflict("Cette fiche a été retirée de l’annuaire et ne peut pas être réimportée.");
        if(result.status().equals("CATALOGUE"))throw conflict("Ce professionnel existe déjà dans le catalogue. Sa fiche est conservée.");
        return require(result.id(),false);
    }
    @Transactional
    public List<ImportResult> confirmBusinesses(String actor,BulkChoices input){
        if(input.choices()==null||input.choices().isEmpty()||input.choices().size()>100)throw new IllegalArgumentException("Sélectionnez entre 1 et 100 établissements");
        // Validate the entire selection before writing anything, including actor-bound tickets from previous pages.
        var selected=new LinkedHashMap<String,Map.Entry<Ticket,Business>>();
        for(Choice choice:input.choices()){
            Ticket ticket=ticket(actor,"SIRENE",null,choice);
            if(choice.index()<0||choice.index()>=ticket.businesses().size())throw new IllegalArgumentException("Établissement invalide");
            Business b=ticket.businesses().get(choice.index());selected.putIfAbsent(b.siret(),Map.entry(ticket,b));
        }
        lockImports();var results=new ArrayList<ImportResult>();
        for(var item:selected.values())results.add(importBusiness(actor,item.getKey(),item.getValue()));
        return List.copyOf(results);
    }
    private ImportResult importBusiness(String actor,Ticket ticket,Business b){
        // A possible existing account is never automatically merged or overwritten.
        var duplicate=db.queryForList("SELECT id FROM marketplace_providers WHERE regexp_replace(coalesce(registration_number,''),'[^0-9]','','g')=? OR (lower(display_name)=lower(?) AND lower(coalesce(base_city,''))=lower(?)) LIMIT 1",b.siret(),b.name(),b.city());
        if(!duplicate.isEmpty())return new ImportResult(b.siret(),b.name(),"CATALOGUE",null);
        var old=db.queryForList("SELECT * FROM baitly_directory_professionals WHERE siret=? FOR UPDATE",b.siret());
        if(!old.isEmpty()){
            if(Boolean.TRUE.equals(old.getFirst().get("suppressed")))return new ImportResult(b.siret(),b.name(),"REMOVED",null);
            return new ImportResult(b.siret(),b.name(),"EXISTING",((Number)old.getFirst().get("id")).longValue());
        }
        Long id=db.queryForObject("""
            INSERT INTO baitly_directory_professionals(siret,name,address,city,postal_code,activity,
                sirene_latitude,sirene_longitude,sirene_retrieved_at,recorded_by)
            VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id
            """,Long.class,b.siret(),b.name(),b.address(),b.city(),b.postalCode(),b.activity(),b.latitude(),b.longitude(),java.sql.Timestamp.from(ticket.retrievedAt()),actor);
        evidence(id,"SIRENE","https://annuaire-entreprises.data.gouv.fr/etablissement/"+b.siret(),"Licence Ouverte 2.0",ticket.retrievedAt(),actor,b);
        return new ImportResult(b.siret(),b.name(),"CREATED",id);
    }
    @Transactional
    public Map<String,Object> confirmPlace(String actor,long id,Choice choice){
        Ticket ticket=ticket(actor,"OSM",id,choice);lockImports();var row=require(id,true);
        if(!row.get("updated_at").toString().equals(ticket.version()))throw conflict("La fiche a changé. Relancez la recherche.");
        if(choice.index()<0||choice.index()>=ticket.places().size())throw new IllegalArgumentException("Correspondance invalide");
        Place place=ticket.places().get(choice.index());
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_professionals WHERE osm_key=? AND id<>?)",Boolean.class,place.key(),id)))
            throw conflict("Ce lieu OpenStreetMap est déjà associé à un autre établissement.");
        db.update("""
            UPDATE baitly_directory_professionals SET osm_key=?,osm_name=?,osm_address=?,latitude=?,longitude=?,
                phone=?,email=?,website=?,osm_retrieved_at=?,osm_confirmed_at=now(),osm_confirmed_by=?,updated_at=now() WHERE id=?
            """,place.key(),place.name(),place.address(),place.latitude(),place.longitude(),place.phone(),place.email(),place.website(),java.sql.Timestamp.from(ticket.retrievedAt()),actor,id);
        evidence(id,"OSM","https://www.openstreetmap.org/"+place.key(),"ODbL 1.0",ticket.retrievedAt(),actor,place);
        return require(id,false);
    }
    @Transactional(readOnly=true)
    public Page list(String query,int page){
        return list(query,page,"");
    }
    @Transactional(readOnly=true)
    public Page list(String query,int page,String service){
        return list(query,page,service,"");
    }
    @Transactional(readOnly=true)
    public Page list(String query,int page,String service,String contacts){
        String safe=Objects.toString(query,"").strip();if(safe.length()>120||page<0||page>100000)throw new IllegalArgumentException("Recherche invalide");
        String pattern="%"+safe.replace("!","!!").replace("%","!%").replace("_","!_")+"%";
        String where=" WHERE suppressed=false AND source_active=true AND (name ILIKE ? ESCAPE '!' OR city ILIKE ? ESCAPE '!' OR postal_code ILIKE ? ESCAPE '!')";
        where+=contactFilter(contacts);
        var parameters=new ArrayList<Object>(List.of(pattern,pattern,pattern));
        var activities=BaitlyProfessionalSearchFilters.activities(service);
        if(!activities.isEmpty()){where+=" AND activity IN ("+String.join(",",Collections.nCopies(activities.size(),"?"))+")";parameters.addAll(activities);}
        var total=db.queryForObject("SELECT count(*) FROM baitly_directory_professionals"+where,Long.class,parameters.toArray());
        parameters.add(page*30);
        var items=db.queryForList("""
            SELECT id,siret,name,address,city,postal_code,activity,coalesce(latitude,sirene_latitude) AS latitude,coalesce(longitude,sirene_longitude) AS longitude,
                coalesce(nullif(phone,''),rge_phone) AS phone,coalesce(nullif(email,''),rge_email) AS email,coalesce(nullif(website,''),rge_website) AS website,rge_retrieved_at,
                CASE WHEN osm_confirmed_at IS NOT NULL THEN 'OSM' WHEN sirene_latitude IS NOT NULL AND sirene_longitude IS NOT NULL THEN 'SIRENE' END AS location_source,
                sirene_retrieved_at,osm_key,osm_name,osm_address,osm_retrieved_at,osm_confirmed_at,
                coalesce(osm_key,(SELECT e.snapshot->>'key' FROM baitly_directory_source_evidence e WHERE e.professional_id=baitly_directory_professionals.id AND e.source='OSM' AND e.confirmed_by='baitly:osm-stock' ORDER BY e.id DESC LIMIT 1)) AS osm_contact_key
            FROM baitly_directory_professionals
            """+where+" ORDER BY name,id LIMIT 30 OFFSET ?",parameters.toArray());
        return new Page(items,total==null?0:total,page);
    }
    @Transactional
    public void suppress(long id){
        require(id,true);db.update("DELETE FROM baitly_directory_source_evidence WHERE professional_id=?",id);
        db.update("UPDATE baitly_directory_professionals SET suppressed=true,phone=NULL,email=NULL,website=NULL,rge_phone=NULL,rge_email=NULL,rge_website=NULL,rge_retrieved_at=NULL,updated_at=now() WHERE id=?",id);
    }
    private void lockImports(){db.queryForObject("SELECT pg_advisory_xact_lock(?,?)",Object.class,577,1);}
    private void evidence(long id,String source,String url,String licence,Instant retrieved,String actor,Object snapshot){
        String json;try{json=mapper.writeValueAsString(snapshot);}catch(Exception e){throw new IllegalStateException("Invalid source evidence",e);}
        db.update("INSERT INTO baitly_directory_source_evidence(professional_id,source,source_url,licence,retrieved_at,confirmed_by,snapshot) VALUES(?,?,?,?,?,?,CAST(? AS jsonb))",id,source,url,licence,java.sql.Timestamp.from(retrieved),actor,json);
    }
    private Map<String,Object> require(long id,boolean lock){
        var rows=db.queryForList("SELECT * FROM baitly_directory_professionals WHERE id=? AND suppressed=false AND source_active=true"+(lock?" FOR UPDATE":""),id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Fiche introuvable");return rows.getFirst();
    }
    private Business business(Map<String,Object> r){return new Business((String)r.get("siret"),(String)r.get("name"),(String)r.get("address"),(String)r.get("city"),(String)r.get("postal_code"),(String)r.get("activity"),number(r.get("sirene_latitude")),number(r.get("sirene_longitude")));}
    private static Double number(Object v){return v instanceof Number n?n.doubleValue():null;}
    private static String contactFilter(String contacts){
        String email="nullif(btrim(coalesce(nullif(email,''),rge_email)),'') IS NOT NULL";
        String phone="nullif(btrim(coalesce(nullif(phone,''),rge_phone)),'') IS NOT NULL";
        return switch(Objects.toString(contacts,"")){
            case "" -> "";
            case "ANY" -> " AND ("+email+" OR "+phone+")";
            case "EMAIL" -> " AND ("+email+")";
            case "PHONE" -> " AND ("+phone+")";
            case "BOTH" -> " AND ("+email+" AND "+phone+")";
            case "NONE" -> " AND NOT ("+email+" OR "+phone+")";
            default -> throw new IllegalArgumentException("Filtre de coordonnées invalide");
        };
    }
    private UUID store(Ticket ticket){try{UUID id=UUID.randomUUID();redis.opsForValue().set(key(id),mapper.writeValueAsString(ticket),Duration.ofMinutes(10));return id;}catch(Exception e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Impossible de préparer la validation");}}
    private Ticket ticket(String actor,String kind,Long id,Choice choice){
        Ticket t;try{String raw=redis.opsForValue().get(key(choice.ticket()));t=raw==null?null:mapper.readValue(raw,Ticket.class);}catch(Exception e){throw conflict("Proposition indisponible. Relancez la recherche.");}
        if(t==null||!actor.equals(t.actor())||!kind.equals(t.kind())||!Objects.equals(id,t.id()))throw conflict("Proposition expirée ou inaccessible");return t;
    }
    private static String key(UUID token){return "baitly:directory:ticket:"+token;}
    private static ResponseStatusException conflict(String text){return new ResponseStatusException(HttpStatus.CONFLICT,text);}
}
