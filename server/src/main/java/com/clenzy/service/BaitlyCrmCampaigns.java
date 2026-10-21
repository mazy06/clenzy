package com.clenzy.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyCrmCampaignPolicy.*;

@Service
@Transactional
public class BaitlyCrmCampaigns {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final int MAX_SEGMENT=2000;
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    public BaitlyCrmCampaigns(JdbcTemplate db,BaitlyCrmAccess access){this.db=db;this.access=access;}
    public record Segment(@NotBlank @Pattern(regexp="OWNER|PROVIDER") String type,@Size(max=150) String city,
        @Size(max=40) String status,@Size(max=40) String category,@Size(max=40) String source,@Size(max=150) String specialty,@Size(max=40) String trade) {
        public Segment(String type,String city,String status,String category,String source,String specialty){this(type,city,status,category,source,specialty,null);}
    }
    public record Template(@NotBlank @Size(max=150) String name,@NotBlank @Pattern(regexp="OWNER|PROVIDER") String contactType,
        @NotBlank @Size(max=200) String subject,@NotBlank @Size(max=6000) String body) {}
    public record Create(@NotNull UUID requestId,@NotBlank @Size(max=150) String name,@NotNull Long templateId,
        @NotNull @Valid Segment segment,@NotBlank @Pattern(regexp="fr|en|ar") String language) {}
    public record Selection(Contact contact,Decision decision) {}
    public record Preview(long total,long eligible,Map<String,Long> exclusions,List<Map<String,Object>> content,int page,int size) {}

    public List<Map<String,Object>> templates(String subject){
        long org=access.require(subject);
        BaitlyCrmCampaignDefaults.ensure(db,org);
        return db.queryForList("SELECT id,name,contact_type,subject,body FROM baitly_crm_campaign_templates WHERE organization_id=? ORDER BY (default_key IS NULL) DESC,name,id",org);
    }
    public Map<String,Object> saveTemplate(String subject,Long id,Template template){
        long org=access.lock(subject);validateType(template.contactType());BaitlyCrmCampaignText.validate(template.subject(),template.body());
        String name=BaitlyCrmIdentity.text(template.name(),150);if(name==null)throw new IllegalArgumentException("Nom obligatoire");
        if(id==null)id=db.queryForObject("INSERT INTO baitly_crm_campaign_templates(organization_id,name,contact_type,subject,body) VALUES(?,?,?,?,?) RETURNING id",Long.class,org,name,template.contactType(),template.subject(),template.body());
        else if(db.update("UPDATE baitly_crm_campaign_templates SET name=?,contact_type=?,subject=?,body=?,updated_at=now() WHERE id=? AND organization_id=?",name,template.contactType(),template.subject(),template.body(),id,org)!=1)throw denied();
        return template(org,id);
    }
    @Transactional(readOnly=true)
    public Preview preview(String subject,Segment segment,int page){
        long org=access.require(subject);var selection=select(org,segment);var exclusions=new TreeMap<String,Long>();
        selection.stream().filter(s->!s.decision().eligible()).forEach(s->exclusions.merge(s.decision().reason(),1L,Long::sum));
        int current=Math.max(0,Math.min(page,10000));long offset=(long)current*25;
        var content=selection.stream().skip(offset).limit(25).map(s->{var row=new LinkedHashMap<String,Object>();row.put("id",s.contact().id());row.put("name",s.contact().name());row.put("city",s.contact().city());row.put("email",s.contact().email());row.put("reason",s.decision().reason());return (Map<String,Object>)row;}).toList();
        return new Preview(selection.size(),selection.stream().filter(s->s.decision().eligible()).count(),exclusions,content,current,25);
    }
    public Map<String,Object> create(String subject,Create command){
        long org=access.lock(subject);
        var existing=db.queryForList("SELECT id FROM baitly_crm_campaigns WHERE organization_id=? AND request_id=?",org,command.requestId());
        if(!existing.isEmpty())return campaign(org,((Number)existing.getFirst().get("id")).longValue());
        var template=template(org,command.templateId());
        if(!Objects.equals(template.get("contact_type"),command.segment().type()))throw new IllegalArgumentException("Modèle incompatible avec le segment");
        var selected=select(org,command.segment()).stream().filter(s->s.decision().eligible()).toList();
        if(selected.isEmpty())throw new IllegalArgumentException("Aucun destinataire autorisé");
        String organization=db.queryForObject("SELECT name FROM organizations WHERE id=?",String.class,org);
        long id=db.queryForObject("""
            INSERT INTO baitly_crm_campaigns(organization_id,request_id,template_id,name,contact_type,language,segment,subject,body,organization_name,created_by)
            VALUES(?,?,?,?,?,?,CAST(? AS jsonb),?,?,?,?) RETURNING id
            """,Long.class,org,command.requestId(),command.templateId(),BaitlyCrmIdentity.text(command.name(),150),command.segment().type(),command.language(),json(command.segment()),template.get("subject"),template.get("body"),organization,subject);
        for(var selection:selected){
            var contact=selection.contact();String title=BaitlyCrmCampaignText.render(template.get("subject").toString(),contact,organization).replaceAll("[\\r\\n]+"," ").trim();
            if(title.length()>255)title=title.substring(0,255);
            db.update("""
                INSERT INTO baitly_crm_campaign_recipients(organization_id,campaign_id,prospect_id,email,destination_hash,identity_version,contact_name,subject,body,authorization_id)
                VALUES(?,?,?,?,?,?,?,?,?,?)
                """,org,id,contact.id(),contact.email(),BaitlyCrmIdentity.hash(contact.email()),contact.version(),contact.name(),title,
                BaitlyCrmCampaignText.render(template.get("body").toString(),contact,organization),selection.decision().authorizationId());
        }
        return campaign(org,id);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> list(String subject,int page){
        long org=access.require(subject);return Map.of("content",db.queryForList("SELECT id,name,contact_type,status,created_at FROM baitly_crm_campaigns WHERE organization_id=? ORDER BY id DESC LIMIT 25 OFFSET ?",org,offset(page)),
            "totalElements",db.queryForObject("SELECT count(*) FROM baitly_crm_campaigns WHERE organization_id=?",Long.class,org));
    }
    public Map<String,Object> detail(String subject,long id,int page){
        long org=access.require(subject);
        db.queryForList("SELECT id FROM organizations WHERE id=? FOR UPDATE",org);
        var campaign=campaign(org,id);
        reconcile(org,id);campaign=campaign(org,id);
        var rows=db.queryForList("SELECT id,prospect_id,contact_name,email,subject,body,status,reason,attempted_at,attempted_by,accepted_at,provider_message_id FROM baitly_crm_campaign_recipients WHERE organization_id=? AND campaign_id=? ORDER BY id LIMIT 25 OFFSET ?",org,id,offset(page));
        for(var row:rows)row.put("responses",db.queryForList("SELECT id,decision,message,source,created_at,recorded_by FROM baitly_crm_campaign_responses WHERE organization_id=? AND recipient_id=? ORDER BY id DESC",org,row.get("id")));
        var counts=new LinkedHashMap<String,Long>();
        db.query("SELECT status,count(*) AS total FROM baitly_crm_campaign_recipients WHERE organization_id=? AND campaign_id=? GROUP BY status",rs->{counts.put(rs.getString("status"),rs.getLong("total"));},org,id);
        long total=counts.values().stream().mapToLong(Long::longValue).sum();
        long replies=db.queryForObject("SELECT count(DISTINCT r.id) FROM baitly_crm_campaign_recipients r JOIN baitly_crm_campaign_responses s ON s.organization_id=r.organization_id AND s.recipient_id=r.id WHERE r.organization_id=? AND r.campaign_id=?",Long.class,org,id);
        return Map.of("campaign",campaign,"content",rows,"counts",counts,"totalElements",total,"responded",replies);
    }
    /** Reconcile interrupted SMTP attempts even after cancellation, without sending or retrying. Caller holds the organization lock. */
    void reconcile(long org,long id){
        db.update("UPDATE baitly_crm_campaign_recipients SET status='UNKNOWN',reason='ACK_UNKNOWN' WHERE organization_id=? AND campaign_id=? AND status='SENDING' AND attempted_at<now()-interval '15 minutes'",org,id);
        db.update("UPDATE baitly_crm_campaigns c SET status='COMPLETED' WHERE c.organization_id=? AND c.id=? AND c.status IN ('READY','ACTIVE') AND NOT EXISTS(SELECT 1 FROM baitly_crm_campaign_recipients r WHERE r.organization_id=c.organization_id AND r.campaign_id=c.id AND r.status IN ('QUEUED','SENDING'))",org,id);
    }
    public void cancel(String subject,long id){
        long org=access.lock(subject);campaign(org,id);
        db.update("UPDATE baitly_crm_campaigns SET status='CANCELLED' WHERE organization_id=? AND id=?",org,id);
        db.update("UPDATE baitly_crm_campaign_recipients SET status='SKIPPED',reason='CANCELLED' WHERE organization_id=? AND campaign_id=? AND status='QUEUED'",org,id);
    }
    List<Selection> select(long org,Segment segment){
        validateType(segment.type());var args=new ArrayList<Object>();args.add(org);args.add(segment.type());
        var where=new StringBuilder(" WHERE p.organization_id=? AND p.contact_type=?");
        exact(where,args,"p.status",segment.status(),Set.of("TO_CONTACT","IN_DISCUSSION","PARTNER","REJECTED"));
        exact(where,args,"p.category",segment.category(),Set.of("CONCIERGERIES","MENAGE","ARTISANS","ENTRETIEN","BLANCHISSERIES","OWNERS","PROVIDERS"));
        exact(where,args,"p.source_type",segment.source(),Set.of("LEGACY","MANUAL","CSV","REFERRAL","PARTNER","OPEN_DATA","PUBLIC_FORM"));
        contains(where,args,"p.city",segment.city());contains(where,args,"p.specialty",segment.specialty());
        if(segment.trade()!=null && !segment.trade().isBlank()){
            if(!"PROVIDER".equals(segment.type()) || !BaitlyRecruitment.TRADES.contains(segment.trade()))throw new IllegalArgumentException("Métier incompatible avec le segment");
            where.append(" AND ").append("""
                coalesce((SELECT i.application_services FROM baitly_crm_management_inquiries i
                  WHERE i.organization_id=p.organization_id AND i.prospect_id=p.id AND i.purpose='APPLICATION' AND i.needs_review=false
                  AND i.email=p.normalized_email AND (i.phone IS NULL OR i.phone=p.normalized_phone)
                  ORDER BY i.id DESC LIMIT 1),'[]'::jsonb) @> CAST(? AS jsonb)
                """);
            args.add(BaitlyRecruitment.servicesJson(List.of(segment.trade())));
        }
        var contacts=db.query("""
            SELECT p.id,p.name,p.normalized_email,p.city,p.contact_type,p.contact_nature,p.status,p.archived,p.identity_version,
              (SELECT count(*) FROM prospects d WHERE d.organization_id=p.organization_id AND d.normalized_email=p.normalized_email AND d.archived=false) AS duplicates
            FROM prospects p
            """+where+" ORDER BY p.id LIMIT "+(MAX_SEGMENT+1),(r,i)->contact(r),args.toArray());
        if(contacts.size()>MAX_SEGMENT)throw new IllegalArgumentException("Affinez le segment : maximum 2000 contacts");
        var history=assertions(org,contacts);
        return contacts.stream().map(c->new Selection(c,evaluate(c,c.email()==null?List.of():history.getOrDefault(BaitlyCrmIdentity.hash(c.email()),List.of()),Instant.now()))).toList();
    }
    Decision eligibility(long org,long contactId){
        var rows=db.query("""
            SELECT p.id,p.name,p.normalized_email,p.city,p.contact_type,p.contact_nature,p.status,p.archived,p.identity_version,
              (SELECT count(*) FROM prospects d WHERE d.organization_id=p.organization_id AND d.normalized_email=p.normalized_email AND d.archived=false) AS duplicates
            FROM prospects p WHERE p.organization_id=? AND p.id=?
            """,(r,i)->contact(r),org,contactId);
        if(rows.isEmpty())return new Decision(false,"ARCHIVED",null);
        var c=rows.getFirst();return evaluate(c,c.email()==null?List.of():assertions(org,rows).getOrDefault(BaitlyCrmIdentity.hash(c.email()),List.of()),Instant.now());
    }
    private Map<String,List<Assertion>> assertions(long org,List<Contact> contacts){
        var hashes=contacts.stream().map(c->BaitlyCrmIdentity.hash(c.email())).filter(Objects::nonNull).distinct().toList();
        if(hashes.isEmpty())return Map.of();
        var args=new ArrayList<Object>();args.add(org);args.addAll(hashes);
        var result=new HashMap<String,List<Assertion>>();
        db.query("SELECT id,prospect_id,destination_hash,identity_version,purpose,basis,decision,evidence,occurred_at,expires_at FROM baitly_crm_contact_authorizations WHERE organization_id=? AND channel='EMAIL' AND destination_hash IN ("+String.join(",",Collections.nCopies(hashes.size(),"?"))+")",rs->{
            var expires=rs.getTimestamp("expires_at");var a=new Assertion(rs.getLong("id"),rs.getLong("prospect_id"),rs.getString("destination_hash"),rs.getInt("identity_version"),rs.getString("purpose"),rs.getString("basis"),rs.getString("decision"),rs.getString("evidence"),rs.getTimestamp("occurred_at").toInstant(),expires==null?null:expires.toInstant());
            result.computeIfAbsent(a.hash(),key->new ArrayList<>()).add(a);
        },args.toArray());return result;
    }
    private Contact contact(java.sql.ResultSet r)throws java.sql.SQLException{
        String email=r.getString("normalized_email");
        try{email=BaitlyCrmIdentity.email(email);}catch(IllegalArgumentException invalid){email=null;}
        return new Contact(r.getLong("id"),r.getString("name"),email,r.getString("city"),r.getString("contact_type"),r.getString("contact_nature"),r.getString("status"),r.getBoolean("archived"),r.getInt("identity_version"),r.getInt("duplicates"));
    }
    Map<String,Object> campaign(long org,long id){var rows=db.queryForList("SELECT id,name,contact_type,status,language,segment,subject,body,organization_name,created_at FROM baitly_crm_campaigns WHERE organization_id=? AND id=?",org,id);if(rows.isEmpty())throw denied();var row=rows.getFirst();try{row.put("segment",JSON.readTree(row.get("segment").toString()));}catch(JsonProcessingException invalid){throw new IllegalStateException("Segment enregistré invalide",invalid);}return row;}
    private Map<String,Object> template(long org,long id){var rows=db.queryForList("SELECT id,name,contact_type,subject,body FROM baitly_crm_campaign_templates WHERE organization_id=? AND id=?",org,id);if(rows.isEmpty())throw denied();return rows.getFirst();}
    private static String json(Object value){try{return JSON.writeValueAsString(value);}catch(JsonProcessingException invalid){throw new IllegalArgumentException("Segment invalide",invalid);}}
    private static void validateType(String type){if(type==null || !Set.of("OWNER","PROVIDER").contains(type))throw new IllegalArgumentException("Type invalide");}
    private static long offset(int page){return (long)Math.max(0,Math.min(page,10000))*25;}
    private static void exact(StringBuilder where,List<Object> args,String column,String value,Set<String> values){if(value==null || value.isBlank())return;if(!values.contains(value))throw new IllegalArgumentException("Filtre invalide");where.append(" AND ").append(column).append("=?");args.add(value);}
    private static void contains(StringBuilder where,List<Object> args,String column,String value){if(value==null || value.isBlank())return;String clean=BaitlyCrmIdentity.text(value,150);where.append(" AND lower(coalesce(").append(column).append(",'')) LIKE lower(?) ESCAPE '\\'");args.add("%"+clean.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%");}
    private static AccessDeniedException denied(){return new AccessDeniedException("Campagne ou modèle inaccessible");}
}
