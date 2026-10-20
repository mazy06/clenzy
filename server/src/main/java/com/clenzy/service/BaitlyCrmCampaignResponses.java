package com.clenzy.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@Transactional
public class BaitlyCrmCampaignResponses {
    private final JdbcTemplate db;private final BaitlyCrmAccess access;
    public BaitlyCrmCampaignResponses(JdbcTemplate db,BaitlyCrmAccess access){this.db=db;this.access=access;}
    public record Token(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token) {}
    public record Response(@NotNull UUID requestId,@NotBlank @Pattern(regexp="INTERESTED|NOT_INTERESTED|QUESTION|UNSUBSCRIBE") String decision,@Size(max=4000) String message) {}
    public record PublicResponse(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,@NotNull @Valid Response response,@Size(max=100) String website,@Size(max=4096) String captchaToken) {}

    @Transactional(readOnly=true)
    public Map<String,Object> lookup(String token){
        var recipient=find(token);return Map.of("organization",recipient.get("organization_name"));
    }
    public void publicResponse(PublicResponse command){
        if(command.website()!=null && !command.website().isBlank())return;
        var recipient=lock(find(command.token()));
        long org=number(recipient,"organization_id"),id=number(recipient,"id");
        boolean retry=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_crm_campaign_responses WHERE organization_id=? AND recipient_id=? AND request_id=?)",Boolean.class,org,id,command.response().requestId()));
        if(!retry && !stops(command.response().decision()) && db.queryForObject("SELECT count(*) FROM baitly_crm_campaign_responses WHERE organization_id=? AND recipient_id=? AND source='PUBLIC_LINK'",Long.class,org,id)>=20)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Limite de réponses atteinte");
        record(recipient,command.response(),"PUBLIC_LINK","campaign-link");
    }
    public void oneClick(String token){
        var recipient=lock(find(token));UUID request=UUID.nameUUIDFromBytes(("unsubscribe:"+number(recipient,"id")).getBytes(StandardCharsets.UTF_8));
        record(recipient,new Response(request,"UNSUBSCRIBE",null),"ONE_CLICK","campaign-one-click");
    }
    public void manual(String actor,long recipientId,Response response){
        long org=access.lock(actor);var rows=db.queryForList("""
            SELECT r.id,r.organization_id,r.prospect_id,r.destination_hash,c.contact_type FROM baitly_crm_campaign_recipients r
            JOIN baitly_crm_campaigns c ON c.organization_id=r.organization_id AND c.id=r.campaign_id
            WHERE r.organization_id=? AND r.id=? AND r.status IN ('SENDING','ACCEPTED','UNKNOWN')
            """,org,recipientId);
        if(rows.isEmpty())throw new AccessDeniedException("Destinataire inaccessible");
        record(rows.getFirst(),response,"MANUAL",actor);
    }
    private Map<String,Object> find(String token){
        if(token==null || !token.matches("[A-Za-z0-9_-]{43}"))throw unavailable();
        var rows=db.queryForList("""
            SELECT r.id,r.organization_id,r.prospect_id,r.destination_hash,c.contact_type,c.organization_name
            FROM baitly_crm_campaign_recipients r JOIN baitly_crm_campaigns c ON c.organization_id=r.organization_id AND c.id=r.campaign_id
            WHERE r.response_token_hash=? AND r.status IN ('SENDING','ACCEPTED','UNKNOWN')
            """,BaitlyCrmIdentity.hash(token));
        if(rows.isEmpty())throw unavailable();return rows.getFirst();
    }
    private Map<String,Object> lock(Map<String,Object> recipient){
        if(db.queryForList("SELECT id FROM organizations WHERE id=? FOR UPDATE",number(recipient,"organization_id")).isEmpty())throw unavailable();
        return recipient;
    }
    private void record(Map<String,Object> recipient,Response response,String source,String actor){
        if(response==null || response.requestId()==null || response.decision()==null || !Set.of("INTERESTED","NOT_INTERESTED","QUESTION","UNSUBSCRIBE").contains(response.decision()))throw new IllegalArgumentException("Réponse invalide");
        if("QUESTION".equals(response.decision()) && BaitlyCrmIdentity.text(response.message(),4000)==null)throw new IllegalArgumentException("Précisez votre question");
        long org=number(recipient,"organization_id"),id=number(recipient,"id");
        var previous=db.queryForList("SELECT decision FROM baitly_crm_campaign_responses WHERE organization_id=? AND recipient_id=? AND request_id=?",org,id,response.requestId());
        if(!previous.isEmpty()){if(stops(previous.getFirst().get("decision").toString()))withdraw(recipient,actor);return;}
        db.update("INSERT INTO baitly_crm_campaign_responses(organization_id,recipient_id,request_id,decision,message,source,recorded_by) VALUES(?,?,?,?,?,?,?)",org,id,response.requestId(),response.decision(),BaitlyCrmIdentity.text(response.message(),4000),source,actor);
        if(stops(response.decision()))withdraw(recipient,actor);
    }
    private void withdraw(Map<String,Object> recipient,String actor){
        long org=number(recipient,"organization_id"),contact=number(recipient,"prospect_id");String hash=recipient.get("destination_hash").toString(),purpose=BaitlyCrmCampaignPolicy.purpose(recipient.get("contact_type").toString());
        boolean unrevoked=Boolean.TRUE.equals(db.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM baitly_crm_contact_authorizations a WHERE a.organization_id=? AND a.destination_hash=? AND a.purpose=? AND a.channel='EMAIL' AND a.decision='GRANTED'
              AND NOT EXISTS(SELECT 1 FROM baitly_crm_contact_authorizations r WHERE r.organization_id=a.organization_id AND r.destination_hash=a.destination_hash AND r.purpose=a.purpose AND r.channel='EMAIL' AND r.decision='REVOKED' AND r.occurred_at>=a.occurred_at))
            """,Boolean.class,org,hash,purpose));
        boolean withdrawal=Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM baitly_crm_contact_authorizations WHERE organization_id=? AND destination_hash=? AND purpose=? AND channel='EMAIL' AND decision='REVOKED')",Boolean.class,org,hash,purpose));
        if(withdrawal && !unrevoked)return;
        db.update("""
            INSERT INTO baitly_crm_contact_authorizations(organization_id,prospect_id,channel,purpose,basis,decision,evidence,destination_hash,identity_version,occurred_at,recorded_at,recorded_by)
            SELECT organization_id,id,'EMAIL',?,'CONSENT','REVOKED',?,?,identity_version,now(),now(),? FROM prospects WHERE organization_id=? AND id=?
            """,purpose,"Opposition reçue, destinataire de campagne Baitly "+number(recipient,"id"),hash,actor,org,contact);
    }
    private static boolean stops(String decision){return "UNSUBSCRIBE".equals(decision) || "NOT_INTERESTED".equals(decision);}
    private static long number(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.NOT_FOUND,"Lien indisponible");}
}
