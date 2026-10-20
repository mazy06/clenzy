package com.clenzy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.util.*;

/** Explicit, cached business searches. Candidates never become CRM locations without confirmation. */
@Service
public class BaitlyCrmOsmMatching {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmLocations locations;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final String endpoint;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public BaitlyCrmOsmMatching(JdbcTemplate db,BaitlyCrmAccess access,BaitlyCrmLocations locations,
        StringRedisTemplate redis,ObjectMapper mapper,@Value("${baitly.crm.osm.search-url:https://nominatim.openstreetmap.org/search}") String endpoint){
        this.db=db;this.access=access;this.locations=locations;this.redis=redis;this.mapper=mapper;this.endpoint=endpoint;
    }
    public record Search(@NotBlank @Size(min=3,max=160) String business,
        @Size(max=120) String city,@NotBlank @Pattern(regexp="[A-Z]{2}") String country,@AssertTrue boolean publicBusiness) {}
    public record Confirmation(@NotNull UUID ticket,@Min(0) @Max(4) int index,boolean replace) {}
    public record Candidate(String osmType,long osmId,String name,String label,double latitude,double longitude,List<String> signals,String precision,
                            String source,String reference,Double score) {
        public Candidate(String osmType,long osmId,String name,String label,double latitude,double longitude,List<String> signals,String precision) {
            this(osmType,osmId,name,label,latitude,longitude,signals,precision,null,null,null);
        }
    }
    public record Results(UUID ticket,List<Candidate> candidates) {}
    public record Ticket(long org,long prospect,String actor,String snapshot,String locationVersion,String query,List<Candidate> candidates) {}

    public Results search(String actor,long id,Search input){
        long org=access.require(actor);var contact=contact(org,id);requireBusiness(contact);
        Ticket prepared=prepare(org,actor,id,input,false);
        try{UUID token=UUID.randomUUID();redis.opsForValue().set(key(token),mapper.writeValueAsString(prepared),Duration.ofMinutes(10));return new Results(token,prepared.candidates());}
        catch(Exception e){throw unavailable();}
    }
    /** Source-specific adapters reuse the same scoped, versioned confirmation tickets. */
    public Results proposeImported(String actor,long id,String name,String city,List<Candidate> candidates){
        long org=access.require(actor);var contact=contact(org,id);requireBusiness(contact);
        if(!"PROFESSIONAL".equals(contact.get("contact_nature")))throw new ResponseStatusException(HttpStatus.CONFLICT,"La nature du contact a changé. Relancez la recherche après vérification.");
        if(!normalize(name).equals(normalize(Objects.toString(contact.get("name"),"")))
            ||!normalize(city).equals(normalize(Objects.toString(contact.get("city"),""))))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Le contact a changé. Vérifiez sa provenance avant de relancer la recherche.");
        var prepared=new Ticket(org,id,actor,snapshot(contact),version(org,id),
            (candidates.stream().anyMatch(c->"BAN".equals(c.source()))?"Sirene / BAN : ":"Sirene / OSM : ")+name+", "+city,List.copyOf(candidates));
        try{UUID token=UUID.randomUUID();redis.opsForValue().set(key(token),mapper.writeValueAsString(prepared),Duration.ofMinutes(10));return new Results(token,prepared.candidates());}
        catch(Exception e){throw unavailable();}
    }
    /** Called only by the batch worker, after rechecking its creator's organization and permissions. */
    Ticket prepare(long org,String actor,long id,Search input,boolean cityOnly){
        var contact=contact(org,id);
        if(!cityOnly)requireBusiness(contact);
        if(!input.publicBusiness())throw new IllegalArgumentException("Nom commercial public requis");
        String city=Objects.toString(contact.get("city"),"").strip();
        if(cityOnly&&city.isEmpty())throw new IllegalArgumentException("Ville manquante");
        String query=cityOnly?city:input.business().strip()+(input.city()==null||input.city().isBlank()?"":", "+input.city().strip());
        List<Candidate> candidates;
        try{
            String cache="baitly:crm:osm:cache:"+UUID.nameUUIDFromBytes((input.country()+":"+query.toLowerCase(Locale.ROOT)).getBytes(StandardCharsets.UTF_8));
            String raw=redis.opsForValue().get(cache);
            if(raw==null){
                if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent("baitly:crm:osm:rate","1",Duration.ofSeconds(2))))
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Patientez quelques secondes avant de rechercher à nouveau");
                URI uri=URI.create(endpoint+"?format=jsonv2&addressdetails=1&namedetails=1&extratags=1&limit=5&countrycodes="+input.country().toLowerCase(Locale.ROOT)+"&q="+URLEncoder.encode(query,StandardCharsets.UTF_8));
                var request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(12)).header("User-Agent","Baitly-PMS/1.0 (contact@clenzy.fr)").header("Accept","application/json").GET().build();
                var response=http.send(request,HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if(response.statusCode()==429){
                    long seconds=60;
                    try{seconds=Math.max(60,Math.min(86400,Long.parseLong(response.headers().firstValue("Retry-After").orElse("60"))));}catch(NumberFormatException ignored){/* HTTP-date: retain a conservative cooldown. */}
                    redis.opsForValue().set("baitly:crm:osm:rate","1",Duration.ofSeconds(seconds));
                }
                if(response.statusCode()!=200)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Recherche OpenStreetMap indisponible");
                raw=response.body();
                if(!mapper.readTree(raw).isArray())throw new IllegalStateException("Invalid OSM response");
                redis.opsForValue().set(cache,raw,Duration.ofHours(24));
            }
            candidates=cityOnly?mapCities(mapper.readTree(raw),city,input.country()):map(mapper.readTree(raw),input,contact);
            return new Ticket(org,id,actor,snapshot(contact),version(org,id),query,candidates);
        }catch(ResponseStatusException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw unavailable();}
        catch(Exception e){throw unavailable();}
    }

    @Transactional
    public void confirm(String actor,long id,Confirmation confirmation){
        long org=access.lock(actor);
        Ticket ticket;
        try{String raw=redis.opsForValue().get(key(confirmation.ticket()));ticket=raw==null?null:mapper.readValue(raw,Ticket.class);}
        catch(Exception e){throw unavailable();}
        confirmPrepared(org,actor,id,ticket,confirmation.index(),confirmation.replace());
    }
    /** Batch candidates come from the scoped database item, never from a client payload. */
    void confirmPrepared(long org,String actor,long id,Ticket ticket,int index,boolean replace){
        var contact=contact(org,id);
        if(ticket==null||ticket.org()!=org||ticket.prospect()!=id||!ticket.actor().equals(actor))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Proposition expirée ou inaccessible. Relancez la recherche.");
        if(!ticket.snapshot().equals(snapshot(contact))||!Objects.equals(ticket.locationVersion(),version(org,id)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Le contact ou sa localisation a changé. Relancez la recherche.");
        if(index<0||index>=ticket.candidates().size())throw new IllegalArgumentException("Proposition invalide");
        if(ticket.locationVersion()!=null&&!replace)throw new ResponseStatusException(HttpStatus.CONFLICT,"Confirmez le remplacement du repère existant");
        Candidate candidate=ticket.candidates().get(index);
        if(!"CITY".equals(candidate.precision()))requireBusiness(contact);
        locations.save(actor,id,new BaitlyCrmLocations.Location(candidate.label(),candidate.latitude(),candidate.longitude(),"CITY".equals(candidate.precision())?"CITY":"ADDRESS"));
        if("BAN".equals(candidate.source())) {
            try {
                db.update("""
                    INSERT INTO baitly_crm_address_geocodings(organization_id,prospect_id,provider,reference,recorded_by,evidence)
                    VALUES(?,?,'BAN',?,?,CAST(? AS jsonb)) ON CONFLICT(organization_id,prospect_id)
                    DO UPDATE SET reference=excluded.reference,recorded_by=excluded.recorded_by,evidence=excluded.evidence,recorded_at=now()
                    """,org,id,candidate.reference(),actor,mapper.writeValueAsString(candidate));
            } catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid address evidence",e);}
            return;
        }
        db.update("UPDATE baitly_crm_contact_locations SET osm_type=?,osm_id=?,osm_query=?,osm_confirmed_at=now() WHERE organization_id=? AND prospect_id=?",
            candidate.osmType(),candidate.osmId(),ticket.query(),org,id);
        // A second confirmation is rejected by the persisted location version, including concurrent requests.
    }
    private Map<String,Object> contact(long org,long id){
        var rows=db.queryForList("SELECT name,city,website,contact_type,contact_nature FROM prospects WHERE organization_id=? AND id=? AND archived=false",org,id);
        if(rows.isEmpty())throw new org.springframework.security.access.AccessDeniedException("Contact inaccessible");return rows.getFirst();
    }
    private static void requireBusiness(Map<String,Object> contact){
        if(!"PROVIDER".equals(contact.get("contact_type"))||"PRIVATE".equals(contact.get("contact_nature")))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Recherchez une ville ou une adresse pour ce contact privé");
    }
    private String version(long org,long id){var rows=db.queryForList("SELECT updated_at::text AS version FROM baitly_crm_contact_locations WHERE organization_id=? AND prospect_id=?",org,id);return rows.isEmpty()?null:(String)rows.getFirst().get("version");}
    private static String snapshot(Map<String,Object> contact){return List.of("name","city","website","contact_type","contact_nature").stream().map(k->Objects.toString(contact.get(k),"")).collect(java.util.stream.Collectors.joining("\u001f"));}
    private static String key(UUID token){return "baitly:crm:osm:ticket:"+token;}
    private static ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Recherche OpenStreetMap indisponible. Réessayez plus tard.");}
    static List<Candidate> map(JsonNode rows,Search input,Map<String,Object> contact){
        List<Candidate> out=new ArrayList<>();Set<String> seen=new HashSet<>();
        for(JsonNode row:rows){
            String type=row.path("osm_type").asText(),name=row.path("name").asText(),label=row.path("display_name").asText();long id=row.path("osm_id").asLong();
            String category=row.path("category").asText(row.path("class").asText());
            if(!List.of("node","way","relation").contains(type)||id<=0||name.isBlank()||label.isBlank()||label.length()>500
                ||List.of("place","boundary","highway","waterway").contains(category)||!seen.add(type+":"+id))continue;
            double lat=row.path("lat").asDouble(Double.NaN),lon=row.path("lon").asDouble(Double.NaN);
            if(!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
            if(!input.country().equalsIgnoreCase(row.path("address").path("country_code").asText()))continue;
            List<String> signals=new ArrayList<>();
            if(normalize(name).equals(normalize(input.business())))signals.add("NAME");
            JsonNode address=row.path("address");
            if(input.city()!=null&&!input.city().isBlank()&&List.of("city","town","village","municipality").stream().anyMatch(k->normalize(input.city()).equals(normalize(address.path(k).asText()))))signals.add("CITY");
            String website=website(Objects.toString(contact.get("website"),""));
            if(!website.isEmpty()&&List.of("website","contact:website").stream().anyMatch(k->website.equals(website(row.path("extratags").path(k).asText()))))signals.add("WEBSITE");
            out.add(new Candidate(type,id,name,label,lat,lon,List.copyOf(signals),"ADDRESS"));
        }
        out.sort(Comparator.comparingInt((Candidate c)->c.signals().size()).reversed());return List.copyOf(out.subList(0,Math.min(5,out.size())));
    }
    static List<Candidate> mapCities(JsonNode rows,String city,String country){
        List<Candidate> out=new ArrayList<>();
        for(JsonNode row:rows){
            String type=row.path("osm_type").asText(),name=row.path("name").asText(),label=row.path("display_name").asText();long id=row.path("osm_id").asLong();
            if(!List.of("node","way","relation").contains(type)||id<=0||label.isBlank()||label.length()>500||!normalize(name).equals(normalize(city))
                ||!List.of("city","town","village","municipality","hamlet").contains(row.path("addresstype").asText(row.path("type").asText()))
                ||!country.equalsIgnoreCase(row.path("address").path("country_code").asText()))continue;
            double lat=row.path("lat").asDouble(Double.NaN),lon=row.path("lon").asDouble(Double.NaN);
            if(Double.isFinite(lat)&&Double.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)out.add(new Candidate(type,id,name,label,lat,lon,List.of("CITY"),"CITY"));
        }
        return List.copyOf(out.subList(0,Math.min(5,out.size())));
    }
    private static String normalize(String value){return Normalizer.normalize(value,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]","");}
    private static String website(String value){
        try{URI uri=URI.create(value.contains("://")?value:"https://"+value);String host=uri.getHost();
            if(host==null||!List.of("http","https").contains(uri.getScheme()))return "";
            return host.toLowerCase(Locale.ROOT).replaceFirst("^www\\.","")+Objects.toString(uri.getPath(),"").replaceFirst("/+$","");
        }catch(Exception e){return "";}
    }
}
