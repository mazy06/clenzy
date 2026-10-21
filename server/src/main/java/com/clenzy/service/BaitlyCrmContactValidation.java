package com.clenzy.service;
import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect;
import java.util.*;
import static com.clenzy.service.BaitlyCrmIdentity.*;

final class BaitlyCrmContactValidation {
    private BaitlyCrmContactValidation() {}
    static void apply(Prospect p,ProspectDto d) {
        String oldEmail=p.getNormalizedEmail(),oldPhone=p.getNormalizedPhone();
        String oldType=p.getContactType(),oldNature=p.getContactNature();
        if(d.name()!=null) p.setName(text(d.name(),255));
        if(p.getName()==null) throw new IllegalArgumentException("Nom obligatoire");
        if(d.email()!=null) p.setEmail(email(d.email()));
        if(d.phone()!=null) { phone(d.phone()); p.setPhone(text(d.phone(),40)); }
        if(d.city()!=null) p.setCity(text(d.city(),255));
        if(d.specialty()!=null) p.setSpecialty(text(d.specialty(),255));
        if(d.notes()!=null) p.setNotes(text(d.notes(),10000));
        if(d.category()!=null) p.setCategory(Prospect.ProspectCategory.valueOf(d.category()));
        if(d.status()!=null) p.setStatus(Prospect.ProspectStatus.valueOf(d.status()));
        if(d.contactType()!=null) p.setContactType(choice(d.contactType(),Set.of("OWNER","PROVIDER")));
        if(d.contactNature()!=null) p.setContactNature(choice(d.contactNature(),Set.of("PRIVATE","PROFESSIONAL","UNKNOWN")));
        if(p.getCategory()==null) p.setCategory("OWNER".equals(p.getContactType())?Prospect.ProspectCategory.OWNERS:Prospect.ProspectCategory.PROVIDERS);
        if((p.getCategory()==Prospect.ProspectCategory.OWNERS) != "OWNER".equals(p.getContactType()))
            throw new IllegalArgumentException("Catégorie incompatible avec le type de contact");
        if(d.website()!=null) p.setWebsite(url(text(d.website(),500)));
        if(d.linkedIn()!=null) p.setLinkedIn(url(text(d.linkedIn(),500)));
        if(d.revenue()!=null) p.setRevenue(text(d.revenue(),100));
        if(d.employees()!=null) p.setEmployees(text(d.employees(),50));
        p.setNormalizedEmail(email(p.getEmail())); p.setNormalizedPhone(phone(p.getPhone()));
        if(!Objects.equals(oldEmail,p.getNormalizedEmail()) || !Objects.equals(oldPhone,p.getNormalizedPhone())
            || !Objects.equals(oldType,p.getContactType()) || !Objects.equals(oldNature,p.getContactNature()))
            p.setIdentityVersion(p.getIdentityVersion()+1);
    }
    static void source(Prospect p,ProspectDto d,String fallback) {
        p.setSourceType(choice(d.sourceType()==null?fallback:d.sourceType(),
            Set.of("MANUAL","CSV","REFERRAL","PARTNER","OPEN_DATA")));
        String detail=text(d.sourceDetail(),1000);
        if(detail==null) throw new IllegalArgumentException("Précisez la provenance du contact");
        p.setSourceDetail(detail); p.setSourceUrl(url(d.sourceUrl()));
        p.setSourceRecordedAt(java.time.Instant.now());
    }
    static String choice(String value,Set<String> values) {
        if(value==null || !values.contains(value)) throw new IllegalArgumentException("Valeur non reconnue");
        return value;
    }
    static String url(String value) {
        String v=text(value,2000);
        if(v==null) return null;
        if(java.net.URI.create(v).getRawUserInfo()!=null)
            throw new IllegalArgumentException("Une URL source ne doit pas contenir d’identifiants");
        ICalUrlValidator.validateAndResolve(v);
        return v;
    }
}
