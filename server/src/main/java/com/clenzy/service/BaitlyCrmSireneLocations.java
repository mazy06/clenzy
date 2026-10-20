package com.clenzy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Objects;

/** Reuses Sirene coordinates or an already validated directory OSM position, without granting consent. */
final class BaitlyCrmSireneLocations {
    private static final ObjectMapper JSON = new ObjectMapper();
    private BaitlyCrmSireneLocations() {}

    /** Caller holds the organization lock and transaction. Existing positions are never replaced. */
    static void restore(JdbcTemplate db, long org, String actor, Long id) {
        var rows = db.queryForList("""
            SELECT i.prospect_id,i.siret,i.snapshot,p.name,p.city FROM baitly_crm_professional_imports i
            JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            WHERE i.organization_id=? AND NOT p.archived AND p.contact_type='PROVIDER' AND p.contact_nature='PROFESSIONAL'
            AND NOT EXISTS(SELECT 1 FROM baitly_crm_contact_locations l WHERE l.organization_id=i.organization_id AND l.prospect_id=i.prospect_id)
            AND NOT EXISTS(SELECT 1 FROM baitly_directory_professionals d WHERE d.siret=i.siret AND d.suppressed=true)
            AND NOT EXISTS(SELECT 1 FROM baitly_crm_location_review r WHERE r.organization_id=i.organization_id
                AND r.prospect_id=i.prospect_id AND r.actor=? AND r.status='SKIPPED')
            """ + (id == null ? "" : " AND i.prospect_id=?"), id == null ? new Object[]{org,actor} : new Object[]{org,actor,id});
        for (var row : rows) {
            JsonNode business,reference=null;
            try {
                var snapshot=JSON.readTree(Objects.toString(row.get("snapshot"),"{}"));
                if (snapshot==null) continue;
                reference=snapshot.has("directoryReference")?snapshot.path("directoryReference"):snapshot.has("identity")?snapshot:null;
                business=reference!=null?reference.path("identity").path("business"):snapshot;
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) { continue; }
            String siret=business.path("siret").asText("");
            if (!siret.matches("[0-9]{14}") || !siret.equals(row.get("siret"))
                || !Objects.equals(business.path("name").asText(null),row.get("name"))
                || !Objects.equals(business.path("city").asText(null),row.get("city"))) continue;
            var point=reference==null?null:reference.path("location");boolean sharedPoint=point!=null&&point.isObject();
            Double lat=coordinate(sharedPoint?point.path("latitude"):business.path("latitude"),90), lon=coordinate(sharedPoint?point.path("longitude"):business.path("longitude"),180);
            String address=(sharedPoint?point.path("label"):business.path("address")).asText("").strip();
            if (lat==null || lon==null || (lat==0 && lon==0) || address.isEmpty() || address.length()>500) continue;
            String osmKey=reference==null?"":reference.path("osmKey").asText("");String osmType=null;Long osmId=null;java.sql.Timestamp confirmed=null;
            if(sharedPoint&&!osmKey.isBlank()){
                try{
                    if(!osmKey.matches("(node|way|relation)/[1-9][0-9]*"))continue;
                    var key=osmKey.split("/");osmType=key[0];osmId=Long.parseLong(key[1]);confirmed=java.sql.Timestamp.from(java.time.Instant.parse(point.path("osmConfirmedAt").asText("")));
                }catch(IllegalArgumentException|java.time.DateTimeException e){continue;}
            }
            db.update("""
                INSERT INTO baitly_crm_contact_locations(organization_id,prospect_id,label,latitude,longitude,precision,recorded_by,contact_city,osm_type,osm_id,osm_query,osm_confirmed_at)
                VALUES(?,?,?,?,?,'ADDRESS',?,?,?,?,?,?) ON CONFLICT(organization_id,prospect_id) DO NOTHING
                """,org,row.get("prospect_id"),address,lat,lon,actor,row.get("city"),osmType,osmId,osmId==null?null:"Annuaire Baitly · "+siret,confirmed);
        }
    }
    private static Double coordinate(JsonNode node,int max) {
        try { double value=Double.parseDouble(node.asText(""));return Double.isFinite(value)&&Math.abs(value)<=max?value:null; }
        catch (NumberFormatException e) { return null; }
    }
}
