package com.clenzy.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.util.Map;

@Service
public class BaitlyCrmCampaignDelivery {
    private final BaitlyCrmCampaignDispatchStore store;private final EmailService emails;
    private final String siteOrigin,apiOrigin;
    public BaitlyCrmCampaignDelivery(BaitlyCrmCampaignDispatchStore store,EmailService emails,
        @Value("${baitly.crm.public-site-origin:https://baitly.fr}") String siteOrigin,
        @Value("${baitly.crm.public-api-origin:https://app.baitly.fr}") String apiOrigin){
        this.store=store;this.emails=emails;this.siteOrigin=origin(siteOrigin);this.apiOrigin=origin(apiOrigin);
    }
    public boolean available(){return emails.isCampaignMailAvailable();}
    @Transactional(propagation=Propagation.NEVER)
    public Map<String,Integer> dispatch(String actor,long campaignId,String replyTo){
        if(!available())throw new IllegalStateException("Envoi email non configuré");
        int accepted=0,unknown=0,skipped=0;
        for(int i=0;i<10;i++){
            var claim=store.claim(actor,campaignId);if(claim==null)break;
            if(!claim.sending()){skipped++;continue;}
            String response=siteOrigin+"/campagnes/reponse?lang="+claim.language()+"#"+claim.token();
            String unsubscribe=apiOrigin+"/api/public/baitly-campaign-replies/"+claim.token()+"/unsubscribe";
            boolean success=false;String providerId=null;
            try{providerId=emails.sendCrmCampaignMessage(claim.email(),claim.name(),claim.organization(),replyTo,claim.subject(),claim.body(),response,unsubscribe,claim.language());success=true;}
            catch(RuntimeException transportFailure){/* SMTP may have accepted the mail. Persist uncertainty and never resend automatically. */}
            store.finish(claim,success,providerId);
            if(success)accepted++;else unknown++;
        }
        return Map.of("accepted",accepted,"unknown",unknown,"skipped",skipped);
    }
    private static String origin(String value){
        URI uri=URI.create(value);if(!"https".equals(uri.getScheme()) || uri.getHost()==null || uri.getRawUserInfo()!=null || uri.getRawQuery()!=null || uri.getRawFragment()!=null || uri.getPath()!=null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))throw new IllegalArgumentException("Origine publique HTTPS invalide");
        return value.replaceAll("/+$","");
    }
}
