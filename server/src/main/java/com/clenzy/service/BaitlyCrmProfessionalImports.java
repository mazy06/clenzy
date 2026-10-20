package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyProfessionalDirectory;
import com.clenzy.marketplace.service.BaitlyProfessionalData.Business;
import com.clenzy.marketplace.service.BaitlyProfessionalData;
import com.clenzy.marketplace.service.BaitlyProfessionalSearchFilters;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.constraints.*;
import java.util.*;
import static com.clenzy.marketplace.service.BaitlyProfessionalDirectory.*;

/** Organization-owned CRM copies with source coordinates. Discovery never grants marketing consent. */
@Service
public class BaitlyCrmProfessionalImports {
    public record References(@NotEmpty @Size(max=100) List<@NotNull @Positive Long> ids) {}
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyProfessionalDirectory directory;
    private final ObjectMapper mapper;
    public BaitlyCrmProfessionalImports(JdbcTemplate db,BaitlyCrmAccess access,BaitlyProfessionalDirectory directory,ObjectMapper mapper){
        this.db=db;this.access=access;this.directory=directory;this.mapper=mapper;
    }
    public com.fasterxml.jackson.databind.JsonNode cities(String actor,String name){require(actor,false);return directory.cities(name);}
    public Preview search(String actor,Search input){long org=require(actor,false);return directory.search(scopedActor(actor,org),input);}
    @Transactional
    public List<ImportResult> importSelection(String actor,BulkChoices input){
        long org=require(actor,true);
        // Resolve all actor-and-organization-bound tickets before the first mutation.
        var selected=directory.selectedBusinesses(scopedActor(actor,org),input);
        var results=selected.stream().map(source->importBusiness(actor,org,source,null)).toList();
        results.forEach(result->queueForReview(actor,org,result));
        return results;
    }
    @Transactional
    public ImportResult importReference(String actor,long id){
        return importReferences(actor,new References(List.of(id))).getFirst();
    }
    @Transactional
    public List<ImportResult> importReferences(String actor,References input){
        long org=require(actor,true);
        if(input==null||input.ids()==null||input.ids().isEmpty()||input.ids().size()>100||input.ids().stream().anyMatch(id->id==null||id<=0))throw new IllegalArgumentException("Sélectionnez entre 1 et 100 professionnels");
        // Resolve the complete authorized source selection before the first tenant write.
        var sources=new LinkedHashSet<>(input.ids()).stream().map(directory::referencedSource).toList();
        var results=new ArrayList<ImportResult>();
        for(var source:sources){
            var result=importBusiness(actor,org,source.identity(),source);
            if(result.status().equals("EXISTING")&&source.location()!=null){
                // Keep the original snapshot and all user edits; append the newer location proof only.
                String json;try{json=mapper.writeValueAsString(source);}catch(Exception e){throw new IllegalStateException("Invalid source evidence",e);}
                db.update("""
                    UPDATE baitly_crm_professional_imports i SET snapshot=jsonb_set(i.snapshot,'{directoryReference}',CAST(? AS jsonb),true),
                        licence=CASE WHEN ? THEN 'Licence Ouverte 2.0; ODbL 1.0' ELSE i.licence END
                    WHERE i.organization_id=? AND i.prospect_id=? AND NOT EXISTS(SELECT 1 FROM baitly_crm_contact_locations l WHERE l.organization_id=i.organization_id AND l.prospect_id=i.prospect_id)
                    """,json,source.osmKey()!=null,org,result.id());
            }
            queueForReview(actor,org,result);results.add(result);
        }
        return List.copyOf(results);
    }
    private void queueForReview(String actor,long org,ImportResult result){
        if(result.id()!=null&&Set.of("CREATED","EXISTING").contains(result.status())) {
            BaitlyCrmSireneLocations.restore(db,org,actor,result.id());
            db.update("INSERT INTO baitly_crm_location_review(organization_id,actor,prospect_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",org,actor,result.id());
        }
    }
    private long require(String actor,boolean lock){
        long org=lock?access.lock(actor):access.require(actor);
        String type=db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,org);
        if(!BaitlyCrmOrganizationRules.recruitment(type,access.isPlatformStaff()))throw new AccessDeniedException("Import réservé aux conciergeries et propriétaires");
        return org;
    }
    private ImportResult importBusiness(String actor,long org,SelectedBusiness source,ReferencedSource reference){
        Business b=source.business();
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_directory_professionals WHERE siret=? AND suppressed=true)",Boolean.class,b.siret())))
            return new ImportResult(b.siret(),b.name(),"REMOVED",null);
        var known=db.queryForList("""
            SELECT p.id,p.archived FROM baitly_crm_professional_imports i
            JOIN prospects p ON p.organization_id=i.organization_id AND p.id=i.prospect_id
            WHERE i.organization_id=? AND i.siret=?
            """,org,b.siret());
        if(!known.isEmpty())return existing(b,known.getFirst());
        String email=reference==null?null:validEmail(reference.email()),phone=reference==null?null:validPhone(reference.phone());
        String website=reference==null?null:BaitlyProfessionalData.website(Objects.toString(reference.website(),""));
        if(email!=null||phone!=null){
            var identities=db.queryForList("""
                SELECT p.id,p.archived FROM prospects p WHERE p.organization_id=? AND
                  (p.normalized_email=? OR p.normalized_phone=? OR EXISTS(
                    SELECT 1 FROM baitly_crm_contact_authorizations a WHERE a.organization_id=p.organization_id
                      AND a.prospect_id=p.id AND a.destination_hash IN (?,?))) ORDER BY p.archived DESC,p.id
                """,org,email,phone,BaitlyCrmIdentity.hash(email),BaitlyCrmIdentity.hash(phone));
            if(!identities.isEmpty())return review(b,identities.getFirst());
        }
        // Also catch pre-existing manual/CSV contacts, even when they have contact details or another category.
        // A name match is deliberately not merged with the source SIRET without reviewing its identity.
        var possible=db.queryForList("""
            SELECT id,archived FROM prospects WHERE organization_id=? AND contact_type='PROVIDER'
              AND lower(btrim(name))=lower(btrim(?)) AND lower(btrim(coalesce(city,'')))=lower(btrim(?)) ORDER BY archived DESC,id
            """,org,b.name(),b.city());
        if(!possible.isEmpty()){
            return review(b,possible.getFirst());
        }
        String url="https://annuaire-entreprises.data.gouv.fr/etablissement/"+b.siret();
        Long id=db.queryForObject("""
            INSERT INTO prospects(organization_id,name,city,specialty,category,status,contact_type,contact_nature,
                source_type,source_detail,source_url,source_recorded_at,created_at,updated_at,archived,identity_version,
                email,phone,website,normalized_email,normalized_phone)
            VALUES(?,?,?,?,?,'TO_CONTACT','PROVIDER','PROFESSIONAL','OPEN_DATA',?,?,now(),now(),now(),false,0,?,?,?,?,?) RETURNING id
            """,Long.class,org,b.name(),b.city(),b.activity(),category(b.activity()),
            "Sirene · Licence Ouverte 2.0 · SIRET "+b.siret()+" · "+b.address()
                +(reference!=null&&reference.contactSources().stream().anyMatch(s->s.source().equals("ADEME"))?" · ADEME RGE · Licence Ouverte 2.0 · https://data.ademe.fr/datasets/liste-des-entreprises-rge-2":"")
                +(reference!=null&&reference.osmKey()!=null?" · OpenStreetMap · ODbL 1.0 · https://www.openstreetmap.org/"+reference.osmKey():""),
            url,email,phone,website,email,phone);
        String snapshot;try{snapshot=mapper.writeValueAsString(reference==null?b:reference);}catch(Exception e){throw new IllegalStateException("Invalid source evidence",e);}
        db.update("""
            INSERT INTO baitly_crm_professional_imports(organization_id,prospect_id,siret,source_url,licence,retrieved_at,imported_by,snapshot)
            VALUES(?,?,?,?,?,?,?,CAST(? AS jsonb))
            """,org,id,b.siret(),url,reference!=null&&reference.osmKey()!=null?"Licence Ouverte 2.0; ODbL 1.0":"Licence Ouverte 2.0",java.sql.Timestamp.from(source.retrievedAt()),actor,snapshot);
        db.update("INSERT INTO baitly_crm_contact_details(organization_id,prospect_id,company_name,recorded_by) VALUES(?,?,?,?)",org,id,b.name(),actor);
        return new ImportResult(b.siret(),b.name(),"CREATED",id);
    }
    private static ImportResult existing(Business b,Map<String,Object> row){
        boolean archived=Boolean.TRUE.equals(row.get("archived"));
        return new ImportResult(b.siret(),b.name(),archived?"REMOVED":"EXISTING",archived?null:((Number)row.get("id")).longValue());
    }
    private static ImportResult review(Business b,Map<String,Object> row){
        var existing=existing(b,row);return existing.status().equals("REMOVED")?existing:new ImportResult(b.siret(),b.name(),"REVIEW",existing.id());
    }
    private static String validEmail(String value){try{return BaitlyCrmIdentity.email(value);}catch(IllegalArgumentException e){return null;}}
    private static String validPhone(String value){try{return BaitlyCrmIdentity.phone(value);}catch(IllegalArgumentException e){return null;}}
    private static String category(String activity){
        if(BaitlyProfessionalSearchFilters.activities("CONCIERGE").contains(activity))return "CONCIERGERIES";
        if(BaitlyProfessionalSearchFilters.activities("CLEANING").contains(activity))return "MENAGE";
        if(BaitlyProfessionalSearchFilters.activities("LAUNDRY").contains(activity))return "BLANCHISSERIES";
        if(BaitlyProfessionalSearchFilters.activities("EXTERIOR").contains(activity))return "ENTRETIEN";
        if(BaitlyProfessionalSearchFilters.activities("MAINTENANCE").contains(activity))return "ARTISANS";
        return "PROVIDERS";
    }
    private static String scopedActor(String actor,long org){return "crm:"+org+":"+actor;}
}
