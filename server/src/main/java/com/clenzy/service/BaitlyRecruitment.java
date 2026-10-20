package com.clenzy.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Explicit publication of an organization's recruitment page, separate from its concierge profile. */
@Service
@Transactional
public class BaitlyRecruitment {
    public static final Set<String> TRADES=Set.of("CLEANING","LAUNDRY","KEYS","MAINTENANCE","EXTERIOR","POOL","PHOTOGRAPHY","OTHER");
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    public BaitlyRecruitment(JdbcTemplate db,BaitlyCrmAccess access){this.db=db;this.access=access;}

    public record Publication(boolean published,@NotBlank @Size(max=150) String recipientName,
        @NotBlank @Size(max=160) String title,@NotBlank @Size(max=150) String city,
        @Pattern(regexp="[A-Z]{2}") String countryCode,@Size(max=3000) String description,
        @NotEmpty @Size(max=8) List<@NotNull String> services) {}
    public record Application(@NotNull UUID requestId,@NotBlank @Size(max=255) String name,
        @NotBlank @Email @Size(max=255) String email,@Size(max=40) String phone,
        @NotBlank @Size(max=150) String city,@Pattern(regexp="[A-Z]{2}") String countryCode,
        @NotEmpty @Size(max=8) List<@NotNull String> services,@Size(max=500) String availability,
        @Size(max=3000) String message,@NotBlank @Pattern(regexp="EMAIL|PHONE") String replyChannel,
        @AssertTrue boolean requestContact,@Size(max=150) String utmSource,@Size(max=150) String utmMedium,
        @Size(max=150) String utmCampaign,@Size(max=255) String referrerHost,
        @Size(max=100) String website,@Size(max=4096) String captchaToken) {}
    public record Page(UUID id,boolean published,String recipientName,String title,String city,String countryCode,String description,List<String> services) {}

    @Transactional(readOnly=true)
    public Map<String,Object> own(String subject){
        long org=access.require(subject);
        boolean available=available(org);
        var pages=available?rows(" WHERE organization_id=?",org):List.<Page>of();
        return Map.of("available",available,"page",pages.isEmpty()?Map.of():pages.getFirst());
    }
    public Page save(String subject,Publication command){
        long org=access.lock(subject);
        if(!available(org))throw new AccessDeniedException("Organisation propriétaire ou conciergerie requise");
        String services=servicesJson(command.services());
        String recipient=BaitlyCrmIdentity.text(command.recipientName(),150),title=BaitlyCrmIdentity.text(command.title(),160),city=BaitlyCrmIdentity.text(command.city(),150);
        if(recipient==null || title==null || city==null || command.countryCode()!=null && !command.countryCode().matches("[A-Z]{2}"))throw new IllegalArgumentException("Publication invalide");
        db.update("""
            INSERT INTO baitly_crm_recruitment_pages(id,organization_id,published,recipient_name,title,city,country_code,description,services)
            VALUES (?,?,?,?,?,?,?,?,CAST(? AS jsonb)) ON CONFLICT (organization_id) DO UPDATE SET
              published=excluded.published,recipient_name=excluded.recipient_name,title=excluded.title,city=excluded.city,
              country_code=excluded.country_code,description=excluded.description,services=excluded.services,updated_at=now()
            """,UUID.randomUUID(),org,command.published(),recipient,title,city,command.countryCode(),BaitlyCrmIdentity.text(command.description(),3000),services);
        return rows(" WHERE organization_id=?",org).getFirst();
    }
    @Transactional(readOnly=true)
    public Page publicPage(UUID id){
        var pages=rows(" JOIN organizations o ON o.id=p.organization_id WHERE p.id=? AND p.published=true AND o.type IN ('CONCIERGE','INDIVIDUAL','SYSTEM')",id);
        if(pages.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Recrutement indisponible");
        return pages.getFirst();
    }
    private boolean available(long org){
        return BaitlyCrmOrganizationRules.recruitment(db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,org),access.isPlatformStaff());
    }
    private List<Page> rows(String where,Object arg){
        return db.query("SELECT p.id,p.published,p.recipient_name,p.title,p.city,p.country_code,p.description,p.services FROM baitly_crm_recruitment_pages p"+where,
            (r,i)->new Page(r.getObject("id",UUID.class),r.getBoolean("published"),r.getString("recipient_name"),r.getString("title"),r.getString("city"),r.getString("country_code"),r.getString("description"),readServices(r.getString("services"))),arg);
    }
    public static String servicesJson(List<String> services){
        if(services==null || services.isEmpty() || services.size()>8 || services.stream().anyMatch(s->s==null || !TRADES.contains(s)))throw new IllegalArgumentException("Métiers invalides");
        try{return JSON.writeValueAsString(services.stream().distinct().sorted().toList());}
        catch(JsonProcessingException impossible){throw new IllegalStateException("Métiers non sérialisables",impossible);}
    }
    public static List<String> readServices(String json){
        try{return JSON.readValue(json,new TypeReference<List<String>>(){});}
        catch(JsonProcessingException invalid){throw new IllegalStateException("Métiers enregistrés invalides",invalid);}
    }
}
