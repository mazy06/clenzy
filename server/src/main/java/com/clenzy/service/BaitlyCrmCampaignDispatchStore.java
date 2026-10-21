package com.clenzy.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.util.*;

/** Claims commit before SMTP is called. A lost acknowledgement never triggers an automatic retry. */
@Service
@Transactional
public class BaitlyCrmCampaignDispatchStore {
    private static final SecureRandom RANDOM=new SecureRandom();
    private final JdbcTemplate db;private final BaitlyCrmAccess access;private final BaitlyCrmCampaigns campaigns;
    public BaitlyCrmCampaignDispatchStore(JdbcTemplate db,BaitlyCrmAccess access,BaitlyCrmCampaigns campaigns){this.db=db;this.access=access;this.campaigns=campaigns;}
    public record Claim(long organizationId,long campaignId,long recipientId,UUID attemptId,String email,String name,String subject,String body,String organization,String language,String token,boolean sending) {}
    public Claim claim(String actor,long campaignId){
        long org=access.lockForCampaignSend(actor);var campaign=campaigns.campaign(org,campaignId);
        campaigns.reconcile(org,campaignId);
        if(!Set.of("READY","ACTIVE").contains(campaign.get("status").toString()))return null;
        var rows=db.queryForList("SELECT id,prospect_id,email,identity_version,contact_name,subject,body FROM baitly_crm_campaign_recipients WHERE organization_id=? AND campaign_id=? AND status='QUEUED' ORDER BY id LIMIT 1 FOR UPDATE",org,campaignId);
        if(rows.isEmpty()){complete(org,campaignId);return null;}
        var row=rows.getFirst();long recipient=((Number)row.get("id")).longValue(),contactId=((Number)row.get("prospect_id")).longValue();
        var current=db.queryForList("SELECT normalized_email,identity_version,contact_type FROM prospects WHERE organization_id=? AND id=?",org,contactId);
        var decision=campaigns.eligibility(org,contactId);String reason=decision.reason();
        boolean unchanged=!current.isEmpty() && Objects.equals(row.get("email"),current.getFirst().get("normalized_email")) && Objects.equals(row.get("identity_version"),current.getFirst().get("identity_version")) && Objects.equals(campaign.get("contact_type"),current.getFirst().get("contact_type"));
        if(!unchanged)reason="IDENTITY_CHANGED";
        db.update("UPDATE baitly_crm_campaigns SET status='ACTIVE' WHERE organization_id=? AND id=?",org,campaignId);
        if(!unchanged || !decision.eligible()){
            db.update("UPDATE baitly_crm_campaign_recipients SET status='SKIPPED',reason=? WHERE organization_id=? AND id=? AND status='QUEUED'",reason,org,recipient);
            complete(org,campaignId);
            return new Claim(org,campaignId,recipient,null,null,null,null,null,null,null,null,false);
        }
        byte[] bytes=new byte[32];RANDOM.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);UUID attempt=UUID.randomUUID();
        db.update("UPDATE baitly_crm_campaign_recipients SET status='SENDING',attempt_id=?,attempted_at=now(),attempted_by=?,response_token_hash=?,authorization_id=? WHERE organization_id=? AND id=? AND status='QUEUED'",attempt,actor,BaitlyCrmIdentity.hash(token),decision.authorizationId(),org,recipient);
        return new Claim(org,campaignId,recipient,attempt,row.get("email").toString(),row.get("contact_name").toString(),row.get("subject").toString(),row.get("body").toString(),campaign.get("organization_name").toString(),campaign.get("language").toString(),token,true);
    }
    public void finish(Claim claim,boolean accepted,String providerId){
        db.queryForList("SELECT id FROM organizations WHERE id=? FOR UPDATE",claim.organizationId());
        db.update("UPDATE baitly_crm_campaign_recipients SET status=?,reason=?,provider_message_id=?,accepted_at=CASE WHEN ? THEN now() ELSE NULL END WHERE organization_id=? AND id=? AND attempt_id=? AND status IN ('SENDING','UNKNOWN')",
            accepted?"ACCEPTED":"UNKNOWN",accepted?null:"ACK_UNKNOWN",providerId==null?null:providerId.substring(0,Math.min(500,providerId.length())),accepted,claim.organizationId(),claim.recipientId(),claim.attemptId());
        complete(claim.organizationId(),claim.campaignId());
    }
    private void complete(long org,long campaign){
        db.update("UPDATE baitly_crm_campaigns c SET status='COMPLETED' WHERE c.organization_id=? AND c.id=? AND c.status IN ('READY','ACTIVE') AND NOT EXISTS(SELECT 1 FROM baitly_crm_campaign_recipients r WHERE r.organization_id=c.organization_id AND r.campaign_id=c.id AND r.status IN ('QUEUED','SENDING'))",org,campaign);
    }
}
