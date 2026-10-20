package com.clenzy.service;

import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class BaitlyCrmLocations {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    public BaitlyCrmLocations(JdbcTemplate db,BaitlyCrmAccess access){this.db=db;this.access=access;}
    public record Location(@NotBlank @Size(max=500) String label,
        @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
        @NotBlank @Pattern(regexp="CITY|ADDRESS") String precision) {}

    @Transactional(readOnly=true)
    public List<Map<String,Object>> list(String actor){
        return db.queryForList("""
            SELECT l.prospect_id,l.label,l.latitude,l.longitude,l.precision,l.osm_type,l.osm_id,l.osm_confirmed_at,l.recorded_by FROM baitly_crm_contact_locations l
            JOIN prospects p ON p.organization_id=l.organization_id AND p.id=l.prospect_id
            WHERE l.organization_id=? AND p.archived=false AND l.contact_city IS NOT DISTINCT FROM p.city ORDER BY l.prospect_id
            """,access.require(actor));
    }
    public void save(String actor,long id,Location location){
        long org=access.lock(actor);var contact=require(org,id);
        if(location.latitude()==null || location.longitude()==null || !Double.isFinite(location.latitude()) || !Double.isFinite(location.longitude())
            || Math.abs(location.latitude())>90 || Math.abs(location.longitude())>180 || !List.of("CITY","ADDRESS").contains(location.precision()))
            throw new IllegalArgumentException("Localisation invalide");
        String label=BaitlyCrmIdentity.text(location.label(),500);
        if(label==null)throw new IllegalArgumentException("Libellé obligatoire");
        db.update("""
            INSERT INTO baitly_crm_contact_locations(organization_id,prospect_id,label,latitude,longitude,precision,recorded_by,contact_city)
            VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,prospect_id) DO UPDATE SET
            label=excluded.label,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,
            recorded_by=excluded.recorded_by,contact_city=excluded.contact_city,updated_at=now(),
            osm_type=NULL,osm_id=NULL,osm_query=NULL,osm_confirmed_at=NULL
            """,org,id,label,location.latitude(),location.longitude(),location.precision(),actor,contact.get("city"));
    }
    public void remove(String actor,long id){long org=access.lock(actor);require(org,id);db.update("DELETE FROM baitly_crm_contact_locations WHERE organization_id=? AND prospect_id=?",org,id);}
    private Map<String,Object> require(long org,long id){
        var rows=db.queryForList("SELECT id,city FROM prospects WHERE organization_id=? AND id=? AND archived=false",org,id);
        if(rows.isEmpty())throw new AccessDeniedException("Contact inaccessible");
        return rows.getFirst();
    }
}
