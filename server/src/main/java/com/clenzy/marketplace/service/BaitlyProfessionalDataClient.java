package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/** Explicit bounded discovery, never a national crawl on public servers. */
@Service
public class BaitlyProfessionalDataClient {
    private final ObjectMapper mapper;
    private final StringRedisTemplate redis;
    private final String sirene,overpass;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public BaitlyProfessionalDataClient(ObjectMapper mapper,StringRedisTemplate redis,
        @Value("${baitly.directory.sirene-url:https://recherche-entreprises.api.gouv.fr/search}") String sirene,
        @Value("${baitly.directory.overpass-url:https://overpass-api.de/api/interpreter}") String overpass){
        this.mapper=mapper;this.redis=redis;this.sirene=sirene;this.overpass=overpass;
    }
    public JsonNode search(String query,String postal,int page){return fetch("sirene",sirene+"?q="+encode(query)+"&code_postal="+postal+"&etat_administratif=A&per_page=10&page="+page,null);}
    public JsonNode search(String query,String postal,String communes,String activities,int page){
        return fetch("sirene",sirene+"?etat_administratif=A&per_page=10&page="+page
            +(query.isBlank()?"":"&q="+encode(query))+(postal.isBlank()?"":"&code_postal="+encode(postal))
            +(communes.isBlank()?"":"&code_commune="+encode(communes))
            +(activities.isBlank()?"":"&activite_principale="+encode(activities)),null);
    }
    public JsonNode cities(String name){
        if(name==null||name.strip().length()<2||name.length()>80)throw new IllegalArgumentException("Saisissez au moins deux caractères pour la ville");
        return fetch("geo","https://geo.api.gouv.fr/communes?nom="+encode(name.strip())+"&fields=nom,code,codesPostaux&boost=population&limit=10",null);
    }
    public JsonNode match(BaitlyProfessionalData.Business business){
        if(business.latitude()==null||business.longitude()==null)throw new IllegalArgumentException("Coordonnées Sirene manquantes pour rechercher à proximité");
        String area="(around:1500,"+business.latitude()+","+business.longitude()+")";
        String query="[out:json][timeout:15];(nwr[office]"+area+";nwr[craft]"+area+";nwr[shop]"+area+";nwr[tourism]"+area+";nwr[\"ref:FR:SIRET\"=\""+business.siret()+"\"]"+area+";);out center tags 100;";
        return fetch("osm",overpass,"data="+encode(query));
    }
    /** Exact, indexed identifier lookup. Three results suffice to reject a non-unique SIRET. */
    public JsonNode matchExactSiret(String siret){
        if(siret==null||!siret.matches("[0-9]{14}"))throw new IllegalArgumentException("SIRET invalide");
        return fetch("osm",overpass,"data="+encode("[out:json][timeout:15];nwr[\"ref:FR:SIRET\"=\""+siret+"\"];out center tags 3;"));
    }
    private JsonNode fetch(String source,String url,String body){
        try{
            URI uri=URI.create(url);
            if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw new IllegalArgumentException("Endpoint HTTPS requis");
            String cache="baitly:directory:cache:v2:"+UUID.nameUUIDFromBytes((url+body).getBytes(StandardCharsets.UTF_8));
            String cached=redis.opsForValue().get(cache);if(cached!=null)return mapper.readTree(cached);
            if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent("baitly:directory:rate:"+source,"1",Duration.ofSeconds(source.equals("osm")?5:1))))
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Patientez avant de relancer la recherche");
            boolean publicOsm=source.equals("osm")&&"overpass-api.de".equalsIgnoreCase(uri.getHost());
            if(publicOsm){
                Long count=redis.opsForValue().increment("baitly:directory:osm:daily-requests");
                if(count!=null&&count==1)redis.expire("baitly:directory:osm:daily-requests",Duration.ofHours(24));
                String used=redis.opsForValue().get("baitly:directory:osm:daily-bytes");
                if(count==null||count>60||(used!=null&&Long.parseLong(used)>8_000_000))
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Quota de découverte OSM atteint. Configurez une instance dédiée pour poursuivre.");
            }
            var builder=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(22)).header("User-Agent","Baitly-Directory/1.0").header("Accept","application/json");
            if(body==null)builder.GET();else builder.header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body));
            var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofInputStream());
            try(var stream=response.body()){
                if(response.statusCode()==429){
                    long pause=response.headers().firstValue("Retry-After").filter(v->v.matches("[0-9]{1,6}")).map(Long::parseLong).orElse(60L);
                    redis.opsForValue().set("baitly:directory:rate:"+source,"1",Duration.ofSeconds(Math.max(60,Math.min(86400,pause))));
                }
                if(response.statusCode()!=200)throw unavailable();
                byte[] bytes=stream.readNBytes(2_000_001);if(bytes.length>2_000_000)throw new IllegalStateException("Response too large");
                if(publicOsm){redis.opsForValue().increment("baitly:directory:osm:daily-bytes",bytes.length);redis.expire("baitly:directory:osm:daily-bytes",Duration.ofHours(24));}
                String raw=new String(bytes,StandardCharsets.UTF_8);var json=mapper.readTree(raw);
                if(source.equals("osm")&&!json.path("remark").asText("").isBlank())throw new IllegalStateException("Incomplete OSM response");
                if(source.equals("geo")?!json.isArray():!json.isObject()||!json.path(source.equals("osm")?"elements":"results").isArray())throw new IllegalStateException("Unexpected source response");
                // The search response also includes directors and financial data; never cache them.
                if(source.equals("sirene")){
                    var minimal=mapper.createObjectNode();
                    for(String key:java.util.List.of("page","total_pages"))if(json.has(key))minimal.set(key,json.get(key));
                    var results=minimal.putArray("results");
                    for(var company:json.path("results")){
                        var item=results.addObject();
                        for(String key:java.util.List.of("nom_complet","statut_diffusion","etat_administratif"))if(company.has(key))item.set(key,company.get(key));
                        var sites=new java.util.ArrayList<JsonNode>();company.path("matching_etablissements").forEach(sites::add);
                        if(sites.isEmpty())sites.add(company.path("siege"));
                        var array=item.putArray("matching_etablissements");
                        for(var site:sites){var filtered=array.addObject();for(String key:java.util.List.of("siret","statut_diffusion_etablissement","etat_administratif","nom_commercial","adresse","libelle_commune","commune","code_postal","activite_principale","latitude","longitude"))if(site.has(key))filtered.set(key,site.get(key));}
                    }
                    json=minimal;raw=mapper.writeValueAsString(minimal);
                }
                redis.opsForValue().set(cache,raw,Duration.ofHours(24));return json;
            }
        }catch(ResponseStatusException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw unavailable();}catch(Exception e){throw unavailable();}
    }
    private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
    private static ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Source indisponible. Aucune donnée importée.");}
}
