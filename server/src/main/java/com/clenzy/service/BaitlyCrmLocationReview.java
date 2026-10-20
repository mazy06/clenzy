package com.clenzy.service;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import com.clenzy.marketplace.service.BaitlyProfessionalDirectory.ImportResult;

/** Durable, actor-owned assisted review. It does not schedule external searches. */
@Service
public class BaitlyCrmLocationReview {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmImportedOsmSearch osm;
    public record Item(long id, String status) {}
    public record Progress(List<Item> items, long remaining, long confirmed, long skipped, long notFound) {}
    public BaitlyCrmLocationReview(JdbcTemplate db, BaitlyCrmAccess access, BaitlyCrmImportedOsmSearch osm) {
        this.db=db;this.access=access;this.osm=osm;
    }
    /** Reuse existing imports, including older ones without a review item. Never creates a prospect. */
    @Transactional
    public List<ImportResult> prepareImported(String actor){
        long org=access.lock(actor);
        BaitlyCrmSireneLocations.restore(db,org,actor,null);
        db.update("""
            INSERT INTO baitly_crm_location_review(organization_id,actor,prospect_id)
            SELECT i.organization_id,?,i.prospect_id FROM baitly_crm_professional_imports i
            JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            WHERE i.organization_id=? AND NOT p.archived AND p.contact_type='PROVIDER' AND p.contact_nature='PROFESSIONAL'
            ON CONFLICT DO NOTHING
            """,actor,org);
        progress(actor);
        // An explicit enrichment run may retry an unsuccessful lookup. User skips stay excluded.
        db.update("""
            UPDATE baitly_crm_location_review r SET status='PENDING',updated_at=now()
            WHERE r.organization_id=? AND r.actor=? AND r.status='NOT_FOUND' AND EXISTS(
                SELECT 1 FROM baitly_crm_professional_imports i JOIN prospects p
                ON p.organization_id=i.organization_id AND p.id=i.prospect_id
                WHERE i.organization_id=r.organization_id AND i.prospect_id=r.prospect_id AND NOT p.archived
                AND p.contact_type='PROVIDER' AND p.contact_nature='PROFESSIONAL')
            """,org,actor);
        return db.query("""
            SELECT p.id,p.name,i.siret FROM baitly_crm_professional_imports i
            JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            JOIN baitly_crm_location_review r ON r.organization_id=p.organization_id AND r.prospect_id=p.id AND r.actor=?
            WHERE i.organization_id=? AND NOT p.archived AND p.contact_type='PROVIDER' AND p.contact_nature='PROFESSIONAL'
            AND (r.status='PENDING' OR (r.status='CONFIRMED' AND
                (nullif(btrim(p.email),'') IS NULL OR nullif(btrim(p.phone),'') IS NULL OR nullif(btrim(p.website),'') IS NULL)))
            ORDER BY r.created_at,p.id
            """,(rs,n)->new ImportResult(rs.getString("siret"),rs.getString("name"),"EXISTING",rs.getLong("id")),actor,org);
    }
    @Transactional
    public Progress enqueue(String actor, List<Long> ids) {
        long org=access.lock(actor);
        if(ids==null||ids.isEmpty()||ids.size()>100||ids.stream().anyMatch(id->id==null||id<=0))
            throw new ResponseStatusException(BAD_REQUEST,"Sélection invalide (100 contacts maximum)");
        for(long id:ids.stream().distinct().toList()) {
            if(db.queryForObject("SELECT count(*) FROM baitly_crm_professional_imports i JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id WHERE i.organization_id=? AND i.prospect_id=? AND NOT p.archived",Long.class,org,id)!=1)
                throw new AccessDeniedException("Contact importé inaccessible");
            db.update("INSERT INTO baitly_crm_location_review(organization_id,actor,prospect_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",org,actor,id);
        }
        return progress(actor);
    }
    @Transactional
    public Progress progress(String actor) {
        long org=access.lock(actor);
        // Confirmations from any screen are reflected, including manual address saves.
        db.update("""
            UPDATE baitly_crm_location_review r SET status='CONFIRMED',updated_at=now()
            WHERE r.organization_id=? AND r.actor=? AND r.status<>'CONFIRMED' AND EXISTS (
                SELECT 1 FROM baitly_crm_contact_locations l JOIN prospects p
                ON p.organization_id=l.organization_id AND p.id=l.prospect_id
                WHERE l.organization_id=r.organization_id AND l.prospect_id=r.prospect_id
                AND NOT p.archived AND l.contact_city IS NOT DISTINCT FROM p.city)
            """,org,actor);
        db.update("""
            UPDATE baitly_crm_location_review r SET status='PENDING',updated_at=now()
            WHERE r.organization_id=? AND r.actor=? AND r.status='CONFIRMED' AND NOT EXISTS (
                SELECT 1 FROM baitly_crm_contact_locations l JOIN prospects p
                ON p.organization_id=l.organization_id AND p.id=l.prospect_id
                WHERE l.organization_id=r.organization_id AND l.prospect_id=r.prospect_id
                AND l.contact_city IS NOT DISTINCT FROM p.city)
            """,org,actor);
        List<Item> items=db.query("""
            SELECT r.prospect_id,r.status FROM baitly_crm_location_review r JOIN prospects p
            ON p.organization_id=r.organization_id AND p.id=r.prospect_id
            WHERE r.organization_id=? AND r.actor=? AND NOT p.archived ORDER BY r.created_at,r.prospect_id
            """,(rs,n)->new Item(rs.getLong(1),rs.getString(2)),org,actor);
        return new Progress(items,count(items,"PENDING"),count(items,"CONFIRMED"),count(items,"SKIPPED"),count(items,"NOT_FOUND"));
    }
    @Transactional
    public Progress skip(String actor,long id) {
        long org=access.lock(actor);requireItem(org,actor,id);
        db.update("UPDATE baitly_crm_location_review SET status='SKIPPED',updated_at=now() WHERE organization_id=? AND actor=? AND prospect_id=? AND status='PENDING'",org,actor,id);
        return progress(actor);
    }
    // No transaction held during a network call. A late response cannot overwrite a skip.
    public BaitlyCrmOsmMatching.Results search(String actor,long id) {
        long org=access.require(actor);requireItem(org,actor,id);
        BaitlyCrmOsmMatching.Results result=osm.search(actor,id);
        if(result.candidates().isEmpty()) db.update("UPDATE baitly_crm_location_review SET status='NOT_FOUND',updated_at=now() WHERE organization_id=? AND actor=? AND prospect_id=? AND status='PENDING'",org,actor,id);
        return result;
    }
    private void requireItem(long org,String actor,long id) {
        if(db.queryForObject("SELECT count(*) FROM baitly_crm_location_review r JOIN prospects p ON p.organization_id=r.organization_id AND p.id=r.prospect_id WHERE r.organization_id=? AND r.actor=? AND r.prospect_id=? AND NOT p.archived",Long.class,org,actor,id)!=1)
            throw new AccessDeniedException("File de localisation inaccessible");
    }
    private long count(List<Item> items,String status){return items.stream().filter(item->status.equals(item.status())).count();}
}
