package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyProfessionalData;
import com.clenzy.marketplace.service.BaitlyProfessionalData.Business;
import com.clenzy.marketplace.service.BaitlyProfessionalDataClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** One displayed imported professional at a time, using the shared bounded Overpass adapter. */
@Service
public class BaitlyCrmImportedOsmSearch {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyProfessionalDataClient client;
    private final BaitlyCrmOsmMatching matching;
    private final ObjectMapper mapper;
    public BaitlyCrmImportedOsmSearch(JdbcTemplate db,BaitlyCrmAccess access,BaitlyProfessionalDataClient client,BaitlyCrmOsmMatching matching,ObjectMapper mapper){
        this.db=db;this.access=access;this.client=client;this.matching=matching;this.mapper=mapper;
    }
    Business business(String actor,long id){
        long org=access.require(actor);
        var rows=db.queryForList("""
            SELECT i.siret,i.snapshot,p.name,p.city,p.contact_type,p.contact_nature FROM baitly_crm_professional_imports i
            JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            WHERE i.organization_id=? AND i.prospect_id=? AND p.archived=false
            """,org,id);
        if(rows.isEmpty())throw new AccessDeniedException("Contact importé inaccessible");
        var row=rows.getFirst();
        if(!"PROVIDER".equals(row.get("contact_type"))||!"PROFESSIONAL".equals(row.get("contact_nature")))
            throw conflict("Ce contact n’est plus un établissement professionnel");
        Business business;
        try{
            var snapshot=mapper.readTree(row.get("snapshot").toString());
            business=mapper.treeToValue(snapshot.has("identity")?snapshot.path("identity").path("business"):snapshot,Business.class);
        }catch(Exception e){throw conflict("Provenance Sirene indisponible");}
        if(business==null||business.siret()==null||!business.siret().matches("[0-9]{14}")||!Objects.equals(business.siret(),row.get("siret"))||!Objects.equals(business.name(),row.get("name"))||!Objects.equals(business.city(),row.get("city")))
            throw conflict("Le contact a changé. Vérifiez sa provenance avant de relancer la recherche.");
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_professionals WHERE siret=? AND suppressed=true)",Boolean.class,business.siret())))
            throw conflict("Cette référence a été retirée de l’annuaire");
        // Reuse a public validated reference for this SIRET before spending an external request.
        return business;
    }
    public record Exact(Business business,BaitlyProfessionalData.Place place,List<BaitlyProfessionalData.Place> candidates) {}
    public Exact exact(String actor,long id){
        Business business=business(actor,id);var raw=client.matchExactSiret(business.siret());
        if(raw==null||!raw.path("elements").isArray()||!raw.path("remark").asText("").isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Réponse OSM incomplète. Réessayez plus tard.");
        long exact=java.util.stream.StreamSupport.stream(raw.path("elements").spliterator(),false)
            .filter(row->business.siret().equals(row.path("tags").path("ref:FR:SIRET").asText("").strip())).count();
        var places=BaitlyProfessionalData.places(raw,business).stream().filter(place->place.signals().contains("SIRET")).toList();
        return new Exact(business,exact==1&&places.size()==1?places.getFirst():null,places);
    }
    public BaitlyCrmOsmMatching.Results search(String actor,long id){
        Business business=business(actor,id);
        var references=db.queryForList("""
            SELECT osm_key,coalesce(osm_name,name) AS name,coalesce(osm_address,address) AS label,latitude,longitude
            FROM baitly_directory_professionals WHERE siret=? AND suppressed=false AND osm_confirmed_at IS NOT NULL
            """,business.siret());
        if(!references.isEmpty()){
            var r=references.getFirst();String key=Objects.toString(r.get("osm_key"),"");
            if(key.matches("(node|way|relation)/[1-9][0-9]*")&&r.get("latitude") instanceof Number lat&&r.get("longitude") instanceof Number lon
                &&Double.isFinite(lat.doubleValue())&&Double.isFinite(lon.doubleValue())&&Math.abs(lat.doubleValue())<=90&&Math.abs(lon.doubleValue())<=180){
                String[] parts=key.split("/");String label=Objects.toString(r.get("label"),business.address());if(label.isBlank())label=business.name();
                var candidate=new BaitlyCrmOsmMatching.Candidate(parts[0],Long.parseLong(parts[1]),Objects.toString(r.get("name"),business.name()),label,lat.doubleValue(),lon.doubleValue(),List.of("SIRET"),"ADDRESS");
                return matching.proposeImported(actor,id,business.name(),business.city(),List.of(candidate));
            }
        }
        if(business.latitude()==null||business.longitude()==null||!Double.isFinite(business.latitude())||!Double.isFinite(business.longitude())||Math.abs(business.latitude())>90||Math.abs(business.longitude())>180)
            throw conflict("Coordonnées Sirene absentes : utilisez la recherche manuelle par adresse");
        var candidates=BaitlyProfessionalData.places(client.match(business),business).stream().limit(5).map(place->{
            String[] key=place.key().split("/");
            return new BaitlyCrmOsmMatching.Candidate(key[0],Long.parseLong(key[1]),place.name(),place.address().isBlank()?place.name():place.address(),place.latitude(),place.longitude(),place.signals(),"ADDRESS");
        }).toList();
        return matching.proposeImported(actor,id,business.name(),business.city(),candidates);
    }
    private static ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
}
