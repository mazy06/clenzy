package com.clenzy.service;

import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static com.clenzy.service.BaitlyCrmIdentity.*;

/** Public intake uses explicit SQL scopes, independently of the visitor's selected tenant. */
@Service
@Transactional
public class BaitlyManagementInquiries {
    private final JdbcTemplate db;
    private final TenantContext tenant;
    public BaitlyManagementInquiries(JdbcTemplate db, TenantContext tenant) { this.db=db; this.tenant=tenant; }

    public record Command(@NotNull UUID requestId, @NotBlank @Size(max=40) String purpose,
        @NotBlank @Size(max=255) String name, @NotBlank @Email @Size(max=255) String email,
        @Size(max=40) String phone, @NotBlank @Size(max=150) String city,
        @NotBlank @Size(max=40) String propertyType, @Size(max=3000) String message,
        @NotBlank @Size(max=10) String replyChannel, @AssertTrue boolean requestContact,
        @Size(max=150) String utmSource, @Size(max=150) String utmMedium,
        @Size(max=150) String utmCampaign, @Size(max=255) String referrerHost,
        @Size(max=100) String website, @Size(max=4096) String captchaToken,
        @Pattern(regexp="[A-Z]{2}") String countryCode,
        @Size(max=6) List<@NotNull String> requestedServices,
        @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) java.math.BigDecimal maxManagementFeePct) {
        public Command(UUID requestId,String purpose,String name,String email,String phone,String city,String propertyType,String message,
            String replyChannel,boolean requestContact,String utmSource,String utmMedium,String utmCampaign,String referrerHost,String website,String captchaToken) {
            this(requestId,purpose,name,email,phone,city,propertyType,message,replyChannel,requestContact,utmSource,utmMedium,utmCampaign,referrerHost,website,captchaToken,null,List.of(),null);
        }
    }

    public void receive(UUID profileId, Command c) {
        if (c==null || c.requestId()==null || !c.requestContact()
            || !Set.of("MANAGEMENT","ESTIMATE").contains(c.purpose())
            || !Set.of("EMAIL","PHONE").contains(c.replyChannel())
            || c.propertyType()==null || Arrays.stream(com.clenzy.model.PropertyType.values()).noneMatch(type -> type.name().equals(c.propertyType())))
            throw new IllegalArgumentException("Demande invalide");
        String requestedServices=com.clenzy.marketplace.service.BaitlyConciergeMatching.servicesJson(c.requestedServices());
        if(c.countryCode()!=null && !c.countryCode().matches("[A-Z]{2}") || c.maxManagementFeePct()!=null &&
            (c.maxManagementFeePct().signum()<0 || c.maxManagementFeePct().compareTo(java.math.BigDecimal.valueOf(100))>0 || c.maxManagementFeePct().scale()>2))
            throw new IllegalArgumentException("Critères invalides");
        String name=text(c.name(),255), email=email(c.email()), phone=phone(c.phone()), city=text(c.city(),150);
        if(name==null || email==null || city==null || (c.replyChannel().equals("PHONE") && phone==null))
            throw new IllegalArgumentException("Coordonnées de réponse requises");
        if(c.website()!=null && !c.website().isBlank()) return; // Honeypot: identical public receipt.
        var targets=db.queryForList("SELECT organization_id FROM baitly_public_profiles WHERE id=? AND published=true AND role='CONCIERGE'",profileId);
        if(targets.isEmpty()) throw unavailable();
        long org=((Number)targets.getFirst().get("organization_id")).longValue();
        // Same lock as authenticated CRM writes, including CSV imports.
        if(db.queryForList("SELECT id FROM organizations WHERE id=? AND type IN ('CONCIERGE','SYSTEM') FOR UPDATE",org).isEmpty()) throw unavailable();
        var published=db.queryForList("SELECT id FROM baitly_public_profiles WHERE id=? AND organization_id=? AND published=true AND role='CONCIERGE' FOR SHARE",profileId,org);
        if(published.isEmpty()) throw unavailable();
        persist(profileId,org,c,requestedServices,null);
    }

    public void receiveApplication(UUID recruitmentId,BaitlyRecruitment.Application application) {
        if(application==null || application.requestId()==null || !application.requestContact())throw new IllegalArgumentException("Candidature invalide");
        String offered=BaitlyRecruitment.servicesJson(application.services());
        if(application.countryCode()!=null && !application.countryCode().matches("[A-Z]{2}"))throw new IllegalArgumentException("Pays invalide");
        if(application.replyChannel()==null || !Set.of("EMAIL","PHONE").contains(application.replyChannel()))throw new IllegalArgumentException("Canal invalide");
        if(application.website()!=null && !application.website().isBlank())return;
        var targets=db.queryForList("SELECT organization_id FROM baitly_crm_recruitment_pages WHERE id=? AND published=true",recruitmentId);
        if(targets.isEmpty())throw unavailable();
        long org=((Number)targets.getFirst().get("organization_id")).longValue();
        if(db.queryForList("SELECT id FROM organizations WHERE id=? AND type IN ('CONCIERGE','INDIVIDUAL','SYSTEM') FOR UPDATE",org).isEmpty())throw unavailable();
        var pages=db.queryForList("SELECT title,services FROM baitly_crm_recruitment_pages WHERE id=? AND organization_id=? AND published=true FOR SHARE",recruitmentId,org);
        if(pages.isEmpty())throw unavailable();
        var requested=BaitlyRecruitment.readServices(pages.getFirst().get("services").toString());
        if(application.services().stream().noneMatch(requested::contains))throw new IllegalArgumentException("Métier non recherché");
        var c=new Command(application.requestId(),"APPLICATION",application.name(),application.email(),application.phone(),application.city(),"OTHER",application.message(),
            application.replyChannel(),application.requestContact(),application.utmSource(),application.utmMedium(),application.utmCampaign(),application.referrerHost(),
            application.website(),application.captchaToken(),application.countryCode(),List.of(),null);
        persist(recruitmentId,org,c,"[]",new RecruitmentSnapshot(pages.getFirst().get("title").toString(),offered,text(application.availability(),500)));
    }
    private record RecruitmentSnapshot(String title,String services,String availability) {}

    private void persist(UUID profileId,long org,Command c,String requestedServices,RecruitmentSnapshot application) {
        String name=text(c.name(),255), email=email(c.email()), phone=phone(c.phone()), city=text(c.city(),150);
        if(name==null || email==null || city==null || (c.replyChannel().equals("PHONE") && phone==null))throw new IllegalArgumentException("Coordonnées de réponse requises");
        String contactType=application==null?"OWNER":"PROVIDER";
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_crm_management_inquiries WHERE organization_id=? AND request_id=?)",Boolean.class,org,c.requestId()))) return;
        var matches=db.queryForList("""
            SELECT p.id,p.archived,p.contact_type,p.normalized_email,p.normalized_phone FROM prospects p
            WHERE p.organization_id=? AND (p.normalized_email=? OR (CAST(? AS varchar) IS NOT NULL AND p.normalized_phone=?)
              OR EXISTS(SELECT 1 FROM baitly_crm_contact_authorizations a
                WHERE a.organization_id=p.organization_id AND a.prospect_id=p.id
                AND (a.destination_hash=? OR (CAST(? AS varchar) IS NOT NULL AND a.destination_hash=?)))) ORDER BY p.id
            """,org,email,phone,phone,hash(email),hash(phone),hash(phone));
        Long contact; boolean review=false;
        if(matches.isEmpty()) {
            contact=db.queryForObject("""
                INSERT INTO prospects(organization_id,name,email,phone,city,category,status,contact_type,contact_nature,
                  source_type,source_detail,source_recorded_at,normalized_email,normalized_phone,created_at,updated_at)
                VALUES (?,?,?,?,?,?,'TO_CONTACT',?,?,'PUBLIC_FORM',?,now(),?,?,now(),now()) RETURNING id
                """,Long.class,org,name,email,phone,city,application==null?"OWNERS":"PROVIDERS",contactType,application==null?"PRIVATE":"UNKNOWN",
                "Formulaire public Baitly "+(application==null?"/conciergeries/":"/recrutement/")+profileId,email,phone);
        } else {
            var match=matches.getFirst(); contact=((Number)match.get("id")).longValue();
            review=matches.size()>1 || Boolean.TRUE.equals(match.get("archived")) || !contactType.equals(match.get("contact_type"))
                || !Objects.equals(email,match.get("normalized_email")) || (phone!=null && !Objects.equals(phone,match.get("normalized_phone")));
        }
        // Snapshot each incoming request without overwriting an existing identity, provenance or refusal.
        db.update("""
            INSERT INTO baitly_crm_management_inquiries(organization_id,prospect_id,profile_id,source_profile_id,request_id,purpose,
              name,email,phone,city,property_type,message,reply_channel,utm_source,utm_medium,utm_campaign,
              referrer_host,needs_review,notice_version,country_code,requested_services,max_management_fee_pct,
              recruitment_id,recruitment_title,application_services,application_availability)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'2026-10-19',?,CAST(? AS jsonb),?,?,?,CAST(? AS jsonb),?)
            """,org,contact,application==null?profileId:null,profileId,c.requestId(),c.purpose(),name,email,phone,city,c.propertyType(),text(c.message(),3000),
            c.replyChannel(),text(c.utmSource(),150),text(c.utmMedium(),150),text(c.utmCampaign(),150),
            text(c.referrerHost(),255),review,c.countryCode(),requestedServices,c.maxManagementFeePct(),
            application==null?null:profileId,application==null?null:application.title(),application==null?"[]":application.services(),application==null?null:application.availability());
        // Requested replies remain scoped to this inquiry. No campaign authorization is inferred.
    }

    @Transactional(readOnly=true)
    public Map<String,Object> list(Long contactId,int page) {
        long org=tenant.getRequiredOrganizationId();
        if(contactId!=null && !Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM prospects WHERE id=? AND organization_id=?)",Boolean.class,contactId,org)))
            throw new org.springframework.security.access.AccessDeniedException("Contact inaccessible");
        String where=" WHERE organization_id=?"+(contactId==null?"":" AND prospect_id=?");
        var args=new ArrayList<Object>(); args.add(org); if(contactId!=null)args.add(contactId);
        Long count=db.queryForObject("SELECT count(*) FROM baitly_crm_management_inquiries"+where,Long.class,args.toArray());
        args.add((long)Math.max(0,page)*25);
        var content=db.query("""
            SELECT id,prospect_id,source_profile_id AS profile_id,purpose,name,email,phone,city,property_type,message,reply_channel,
              utm_source,utm_medium,utm_campaign,referrer_host,needs_review,status,created_at,country_code,requested_services,max_management_fee_pct,recruitment_title,application_services,application_availability
            FROM baitly_crm_management_inquiries
            """+where+" ORDER BY id DESC LIMIT 25 OFFSET ?",(rs,i) -> {
                var row=new LinkedHashMap<String,Object>();
                for(String key:List.of("id","prospect_id","profile_id","purpose","name","email","phone","city","property_type",
                    "message","reply_channel","utm_source","utm_medium","utm_campaign","referrer_host","needs_review","status"))row.put(key,rs.getObject(key));
                row.put("country_code",rs.getString("country_code"));
                row.put("recruitment_title",rs.getString("recruitment_title"));
                row.put("application_services",BaitlyRecruitment.readServices(rs.getString("application_services")));
                row.put("application_availability",rs.getString("application_availability"));
                row.put("requested_services",com.clenzy.marketplace.service.BaitlyConciergeMatching.readServices(rs.getString("requested_services")));
                row.put("max_management_fee_pct",rs.getBigDecimal("max_management_fee_pct"));
                row.put("created_at",rs.getTimestamp("created_at").toInstant().toString()); return row;
            },args.toArray());
        return Map.of("content",content,"totalElements",count);
    }
    public void status(Long id,String status) {
        if(status==null || !Set.of("NEW","IN_PROGRESS","CLOSED").contains(status))throw new IllegalArgumentException("Statut invalide");
        if(db.update("UPDATE baitly_crm_management_inquiries SET status=?,updated_at=now() WHERE id=? AND organization_id=?",status,id,tenant.getRequiredOrganizationId())!=1)
            throw new org.springframework.security.access.AccessDeniedException("Demande inaccessible");
    }
    private ResponseStatusException unavailable() { return new ResponseStatusException(HttpStatus.NOT_FOUND,"Profil indisponible"); }
}
