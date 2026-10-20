package com.clenzy.service;

import java.time.Instant;
import java.util.*;

/** Campaign consent is deliberately stricter than permission to answer a single inquiry. */
public final class BaitlyCrmCampaignPolicy {
    private BaitlyCrmCampaignPolicy() {}
    public record Contact(long id,String name,String email,String city,String type,String nature,String status,boolean archived,int version,int duplicates) {}
    public record Assertion(long id,long contactId,String hash,int version,String purpose,String basis,String decision,String evidence,Instant occurred,Instant expires) {}
    public record Decision(boolean eligible,String reason,Long authorizationId) {}
    public static String purpose(String type){return "OWNER".equals(type)?"MANAGEMENT":"PROVIDER_RECRUITMENT";}
    public static Decision evaluate(Contact contact,List<Assertion> history,Instant now){
        if(contact.archived())return no("ARCHIVED");
        if("REJECTED".equals(contact.status()))return no("REJECTED");
        if(contact.email()==null)return no("NO_EMAIL");
        if(contact.duplicates()>1)return no("DUPLICATE");
        String hash=BaitlyCrmIdentity.hash(contact.email()),purpose=purpose(contact.type());
        var grant=history.stream().filter(a->a.contactId()==contact.id() && a.version()==contact.version() && hash.equals(a.hash()) && purpose.equals(a.purpose()))
            .max(Comparator.comparing(Assertion::occurred).thenComparingLong(Assertion::id));
        if(grant.isEmpty())return no("NO_AUTHORIZATION");
        var a=grant.get();
        if(a.occurred().isAfter(now))return no("NO_AUTHORIZATION");
        if(!"GRANTED".equals(a.decision()) || history.stream().anyMatch(r->hash.equals(r.hash()) && purpose.equals(r.purpose()) && "REVOKED".equals(r.decision()) && !r.occurred().isBefore(a.occurred())))return no("REVOKED");
        if(a.expires()!=null && !a.expires().isAfter(now))return no("EXPIRED");
        if(a.evidence()==null || a.evidence().isBlank())return no("NO_AUTHORIZATION");
        if("REQUESTED_CONTACT".equals(a.basis()))return no("REQUEST_ONLY");
        if(!"CONSENT".equals(a.basis()) && !("B2B_LEGITIMATE_INTEREST".equals(a.basis()) && "PROFESSIONAL".equals(contact.nature())))return no("NO_AUTHORIZATION");
        return new Decision(true,"ELIGIBLE",a.id());
    }
    private static Decision no(String reason){return new Decision(false,reason,null);}
}
