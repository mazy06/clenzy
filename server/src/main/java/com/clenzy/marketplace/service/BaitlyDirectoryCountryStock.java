package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.clenzy.service.BaitlyCrmIdentity;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.time.Instant;
import java.util.*;

/** Authorized projection adapter, not an invented OMPIC bulk endpoint or a scraper. */
@Component
public class BaitlyDirectoryCountryStock {
    static final String OVERTURE_URL="https://docs.overturemaps.org/guides/places/";
    static final String PUBLIC_LICENCE="ODbL 1.0; CDLA-Permissive-2.0; Apache-2.0; CC0-1.0";
    private final Environment config;private final ObjectMapper json;private final BaitlyWathqClient wathq;
    private BaitlySaudiOsmStock saudiOsm;
    private BaitlyMoroccoPublicStock morocco;
    @org.springframework.beans.factory.annotation.Autowired
    public void morocco(BaitlyMoroccoPublicStock source){this.morocco=source;}
    @org.springframework.beans.factory.annotation.Autowired
    public void saudiOsm(BaitlySaudiOsmStock source){this.saudiOsm=source;}
    public BaitlyDirectoryCountryStock(Environment config,ObjectMapper json,BaitlyWathqClient wathq){this.config=config;this.json=json;this.wathq=wathq;}
    public record Manifest(String country,String source,String mode,String version,String sha256,long count,
                           String sourceUrl,String licence,Instant retrievedAt,boolean complete,boolean publishable) {}
    public record Stock(Path path,Manifest manifest) {}
    public record Entry(BaitlyDirectoryCountry.Identity identity,String name,String address,String city,String postalCode,
                        String activity,String service,Double latitude,Double longitude,String phone,String email,String website,
                        Map<String,String> identifiers,JsonNode raw,@com.fasterxml.jackson.annotation.JsonFormat(shape=com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING) Instant retrievedAt) {}
    public Optional<Stock> open(String country)throws IOException {
        country=BaitlyDirectoryCountry.country(country);if(country.equals("FR"))throw new IllegalArgumentException("Use Sirene stock");
        String prefix="baitly.directory."+country.toLowerCase(Locale.ROOT)+".";
        if(!config.getProperty(prefix+"enabled",Boolean.class,false)){
            var source=country.equals("SA")?saudiOsm:morocco;
            return source!=null&&source.enabled()?Optional.of(source.refresh()):Optional.empty();
        }
        if(!config.getProperty(prefix+"reuse-authorized",Boolean.class,false))throw new IOException("Missing source reuse authorization");
        Path file=Path.of(config.getProperty(prefix+"manifest",""));
        if(!Files.isRegularFile(file)||Files.size(file)>32000)throw new IOException("Missing authorized country manifest");
        Manifest m=json.readValue(Files.readAllBytes(file),Manifest.class);
        if(!country.equals(m.country())||!Objects.equals(m.source(),country.equals("MA")?"OMPIC":"WATHQ")
            ||!Set.of("projection","wathq-seeds").contains(m.mode())||country.equals("MA")&&!m.mode().equals("projection")
            ||m.version()==null||!m.version().matches("[a-zA-Z0-9._-]{1,128}")||m.count()<1||m.count()>10_000_000
            ||m.sha256()==null||!m.sha256().matches("[a-f0-9]{64}")||m.licence()==null||m.licence().isBlank()||m.licence().length()>80
            ||BaitlyProfessionalData.website(Objects.toString(m.sourceUrl(),"")).isBlank()||m.sourceUrl().length()>500
            ||m.retrievedAt()==null||m.retrievedAt().isAfter(Instant.now().plusSeconds(300))||!m.publishable()
            ||m.mode().equals("wathq-seeds")&&m.complete())throw new IOException("Invalid authorized country manifest");
        Path path=Path.of(config.getProperty(prefix+"snapshot",""));if(!Files.isRegularFile(path))throw new IOException("Missing country snapshot");
        try(var input=Files.newInputStream(path)){
            var digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];int n;
            while((n=input.read(buffer))>=0){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();digest.update(buffer,0,n);}
            if(!HexFormat.of().formatHex(digest.digest()).equals(m.sha256()))throw new IOException("Country snapshot checksum mismatch");
        }catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
        return Optional.of(new Stock(path,m));
    }
    public Entry entry(Manifest manifest,String line)throws IOException {
        if(line.length()>64000)throw new IOException("Country row size exceeded");JsonNode row=json.readTree(line);
        if(row==null||!row.isObject())throw new IOException("Invalid country row");
        Instant retrievedAt=manifest.retrievedAt();
        if(manifest.mode().equals("wathq-seeds")){
            var requested=new BaitlyDirectoryCountry.Identity("SA",text(row,"identifierType",12,true),text(row,"identifier",80,true));
            if(!"production".equals(config.getProperty("baitly.directory.sa.wathq.environment","sandbox")))throw new IOException("Sandbox cannot publish to the shared directory");
            var reply=wathq.lookup(requested);if(!reply.environment().equals("production"))throw new IOException("Sandbox cannot publish");
            retrievedAt=reply.retrievedAt();
            row=wathqProjection(reply.body(),requested,text(row,"service",30,true));
        }
        boolean combined=(manifest.country()+"_PUBLIC").equals(manifest.source())&&(manifest.country().toLowerCase(Locale.ROOT)+"-public").equals(manifest.mode())&&Set.of("MA","SA").contains(manifest.country());
        if(combined)validatePublic(row,manifest.country());
        if(!combined&&"OVERTURE".equals(row.path("identifierType").asText()))throw new IOException("Overture requires a verified combined edition");
        if(!combined&&row.has("baseSource"))throw new IOException("Unexpected source override");
        boolean osm=combined||"OSM".equals(manifest.source())&&"osm".equals(manifest.mode())&&Set.of("MA","SA").contains(manifest.country());
        var entry=projection(manifest.country(),row,osm);
        return new Entry(entry.identity(),entry.name(),entry.address(),entry.city(),entry.postalCode(),entry.activity(),entry.service(),entry.latitude(),entry.longitude(),entry.phone(),entry.email(),entry.website(),entry.identifiers(),entry.raw(),retrievedAt);
    }
    static Entry projection(String country,JsonNode row)throws IOException {
        return projection(country,row,false);
    }
    private static Entry projection(String country,JsonNode row,boolean osm)throws IOException {
        if(!row.path("active").isBoolean()||!row.path("active").asBoolean())throw new IOException("Country projection must contain explicitly active enterprises only");
        var id=new BaitlyDirectoryCountry.Identity(country,text(row,"identifierType",12,true),text(row,"identifier",80,true));
        if(osm&&!Set.of("OSM","OVERTURE").contains(id.type()))throw new IOException("Public publication requires a source-scoped identity");
        if(country.equals("SA")&&!(osm?Set.of("OSM","OVERTURE").contains(id.type()):id.type().equals("UNN")))throw new IOException("Saudi publication requires a source-scoped identity");
        String service=text(row,"service",30,true);if(!BaitlyProfessionalSearchFilters.SERVICES.containsKey(service))throw new IOException("Invalid service mapping");
        Map<String,String> aliases=new TreeMap<>();aliases.put(id.type(),id.value());
        if(osm&&row.path("identifiers").hasNonNull("OVERTURE"))aliases.put("OVERTURE",new BaitlyDirectoryCountry.Identity(country,"OVERTURE",text(row.path("identifiers"),"OVERTURE",80,true)).value());
        if(!osm&&row.path("identifiers").isObject()){
            var fields=row.path("identifiers").fields();while(fields.hasNext()){
                var alias=fields.next();String value=alias.getValue().asText();
                if(!Set.of("ICE","RC","COURT","IF","CNSS","UNN","CR").contains(alias.getKey())||value.length()>80||value.isBlank())throw new IOException("Invalid identifier alias");
                if(Set.of("ICE","RC","UNN","CR").contains(alias.getKey()))value=new BaitlyDirectoryCountry.Identity(country,alias.getKey(),value).value();
                if(alias.getKey().equals(id.type())&&!value.equals(id.value()))throw new IOException("Conflicting country identity");aliases.put(alias.getKey(),value);
            }
        }
        Double lat=coordinate(row,"latitude",90),lon=coordinate(row,"longitude",180);String address=text(row,"address",500,false);
        if((lat==null)!=(lon==null)||lat!=null&&(lat==0&&lon==0||!osm&&address.isBlank())||osm&&(lat==null||(country.equals("MA")?(lat<20||lat>36.5||lon< -18||lon> -0.5):(lat<16||lat>33||lon<34||lon>56))))throw new IOException("Invalid source position");
        String phone=null,email=null,rawPhone=optional(row,"phone",80);
        try{phone=BaitlyCrmIdentity.phone(rawPhone);if(phone!=null&&(rawPhone.startsWith("+")||rawPhone.startsWith("00")))phone="+"+phone;}catch(IllegalArgumentException invalid){}
        try{email=BaitlyCrmIdentity.email(optional(row,"email",254));}catch(IllegalArgumentException invalid){}
        String website=BaitlyProfessionalData.website(optional(row,"website",500));
        return new Entry(id,text(row,"name",200,true),address,text(row,"city",120,!osm),text(row,"postalCode",10,false),
            text(row,"activity",10,false),service,lat,lon,phone,email,website,Map.copyOf(aliases),row.deepCopy(),null);
    }
    private static void validatePublic(JsonNode row,String country)throws IOException {
        String type=text(row,"identifierType",12,true),source=text(row,"baseSource",10,true),url=text(row,"sourceUrl",500,true);
        if(!type.equals(source)||!Set.of("OSM","OVERTURE").contains(type))throw new IOException("Invalid public source identity");
        if(type.equals("OSM")&&!url.equals("https://www.openstreetmap.org/"+text(row,"identifier",80,true))
            ||type.equals("OVERTURE")&&!url.equals(OVERTURE_URL))throw new IOException("Invalid public source URL");
        String licence=text(row,"sourceLicence",80,true);
        if(type.equals("OSM")&&!Set.of("ODbL 1.0",PUBLIC_LICENCE).contains(licence))throw new IOException("Invalid OSM licence");
        if(type.equals("OVERTURE")){
            for(String item:licence.split("; "))if(!Set.of("CDLA-Permissive-2.0","Apache-2.0","CC0-1.0").contains(item))throw new IOException("Unknown Overture licence");
            double confidence=row.path("overture").path("confidence").asDouble(0);
            if(!Double.isFinite(confidence)||confidence<0.5||confidence>1)throw new IOException("Unverified Overture position");
        }
        var evidence=row.path("sourceEvidence");
        if(!evidence.isArray()||evidence.isEmpty()||evidence.size()>3)throw new IOException("Missing public source evidence");
        boolean website=false;
        for(var item:evidence){
            String kind=text(item,"source",10,true),link=text(item,"url",500,true),lic=text(item,"licence",80,true);
            if(kind.equals("WEBSITE")){
                if(website||!country.equals("MA"))throw new IOException("Invalid website scope");
                validateWebsite(row,item);website=true;continue;
            }
            new BaitlyDirectoryCountry.Identity(country,kind,text(item,"identifier",80,true));
            if(kind.equals("OSM")){
                if(!link.equals("https://www.openstreetmap.org/"+item.path("identifier").asText())||!lic.equals("ODbL 1.0"))throw new IOException("Invalid OSM evidence");
            }else if(kind.equals("OVERTURE")){
                if(!link.equals(OVERTURE_URL))throw new IOException("Invalid Overture evidence");
                for(String token:lic.split("; "))if(!Set.of("CDLA-Permissive-2.0","Apache-2.0","CC0-1.0").contains(token))throw new IOException("Unknown evidence licence");
            }else throw new IOException("Invalid evidence source");
        }
        if(!website&&row.has("websiteServices"))throw new IOException("Services require website evidence");
    }
    private static void validateWebsite(JsonNode row,JsonNode proof)throws IOException {
        if(!"Public business facts; reviewed website conditions".equals(proof.path("licence").asText())
            ||!"REVIEWED_PUBLIC_BUSINESS_FACTS".equals(proof.path("reuseBasis").asText())
            ||!row.path("identifier").equals(proof.path("identifier"))
            ||!proof.path("policyId").asText().matches("[a-z0-9-]{1,80}")
            ||!proof.path("policyRevision").asText().matches("[a-zA-Z0-9._-]{1,80}"))throw new IOException("Unreviewed website evidence");
        try{
            Instant reviewed=Instant.parse(text(proof,"reviewedAt",40,true)),observed=Instant.parse(text(proof,"retrievedAt",40,true)),expires=Instant.parse(text(proof,"expiresAt",40,true));
            if(observed.isBefore(reviewed)||!observed.isBefore(expires)||observed.isAfter(Instant.now().plusSeconds(300))
                ||expires.isAfter(reviewed.plusSeconds(90L*86400)))throw new IOException("Expired website review");
        }catch(java.time.format.DateTimeParseException invalid){throw new IOException("Invalid website review date",invalid);}
        sameWebsite(row,proof.path("url").asText());
        var fields=proof.path("fields");if(!fields.isObject()||fields.size()>2)throw new IOException("Invalid website fields");
        var names=fields.fieldNames();while(names.hasNext()){
            String key=names.next();if(!Set.of("phone","email").contains(key)||!row.path(key).asText().equals(fields.path(key).path("value").asText())
                ||!row.path(key).asText().equals(proof.path(key).asText()))throw new IOException("Conflicting website field");
            sameWebsite(row,fields.path(key).path("url").asText());
        }
        var services=proof.path("services");var published=row.path("websiteServices");
        if(!services.isObject()||!published.isArray()||services.size()!=published.size()||services.size()>11)throw new IOException("Invalid website services");
        var seen=new HashSet<String>();for(var service:published){
            String key=service.asText();if(!seen.add(key)||!BaitlyProfessionalSearchFilters.SERVICES.containsKey(key)||!services.has(key))throw new IOException("Unknown website service");
            sameWebsite(row,services.path(key).asText());
        }
        var offerings=proof.path("offerings");if(!offerings.isArray()||offerings.size()>20)throw new IOException("Invalid website offerings");
        for(var offering:offerings){
            if(!services.has(text(offering,"service",30,true)))throw new IOException("Unknown website offering service");
            text(offering,"label",80,true);sameWebsite(row,offering.path("url").asText());
        }
        var checks=proof.path("checks");if(!checks.isArray()||checks.isEmpty()||checks.size()>12)throw new IOException("Missing website checks");
        for(var check:checks){sameWebsite(row,check.path("url").asText());if(!check.path("sha256").asText().matches("[a-f0-9]{64}"))throw new IOException("Invalid website content hash");}
    }
    private static void sameWebsite(JsonNode row,String url)throws IOException {
        if(url.isBlank()||url.length()>500||BaitlyProfessionalData.website(url).isBlank())throw new IOException("Invalid website evidence URL");
        try{
            var source=java.net.URI.create(row.path("website").asText());var target=java.net.URI.create(url);
            String host=Objects.toString(source.getHost(),"").replaceFirst("^www\\.","");
            if(host.isBlank()||!host.equals(Objects.toString(target.getHost(),"").replaceFirst("^www\\.","")))throw new IOException("Cross-domain website evidence");
        }catch(IllegalArgumentException invalid){throw new IOException("Invalid website URL",invalid);}
    }
    static JsonNode wathqProjection(JsonNode body,BaitlyDirectoryCountry.Identity requested,String service)throws IOException {
        String unn=text(body,"crNationalNumber",10,true),cr=text(body,"crNumber",10,true);
        new BaitlyDirectoryCountry.Identity("SA","UNN",unn);new BaitlyDirectoryCountry.Identity("SA","CR",cr);
        if(!requested.value().equals(requested.type().equals("UNN")?unn:cr)||body.path("status").path("id").asInt(-1)!=1)throw new IOException("Wathq identity/status requires review");
        var row=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        row.put("active",true);
        row.put("identifierType","UNN").put("identifier",unn).put("name",text(body,"name",200,true));
        row.put("city",text(body,"headquarterCityName",120,true)).put("address","").put("postalCode","").put("activity","").put("service",service);
        row.putObject("identifiers").put("UNN",unn).put("CR",cr);
        // /info has no contacts. Never infer an email, private mobile, street or coordinate.
        var contact=body.path("contactInfo");row.put("phone",optional(contact,"phoneNo",80)).put("email",optional(contact,"email",254));
        String site=optional(contact,"websiteUrl",500);row.put("website",site.isBlank()?"":site.contains("://")?site:"https://"+site);
        ObjectNode response=((ObjectNode)body.deepCopy()).retain("crNationalNumber","crNumber","name","headquarterCityName","status","contactInfo","activities");
        if(response.path("contactInfo") instanceof ObjectNode contacts)contacts.retain("phoneNo","email","websiteUrl");
        row.set("sourceResponse",response);return row;
    }
    private static String text(JsonNode row,String field,int max,boolean required)throws IOException {
        JsonNode node=row.path(field);String value=node.isValueNode()&&!node.isNull()?node.asText().strip():"";
        if(value.length()>max||value.chars().anyMatch(c->c<32)||required&&value.isBlank())throw new IOException("Invalid country field: "+field);return value;
    }
    private static String optional(JsonNode row,String field,int max){try{return text(row,field,max,false);}catch(IOException invalid){return "";}}
    private static Double coordinate(JsonNode row,String field,int max)throws IOException {
        if(!row.hasNonNull(field))return null;double value=row.path(field).asDouble(Double.NaN);
        if(!Double.isFinite(value)||Math.abs(value)>max)throw new IOException("Invalid country coordinate");return value;
    }
}
