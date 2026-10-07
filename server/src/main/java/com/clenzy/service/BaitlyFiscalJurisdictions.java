package com.clenzy.service;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.model.FiscalProfile;
import com.clenzy.model.Property;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Profils du vendeur client par pays immobilier ; distincts des sociétés d'exploitation Baitly. */
@Service
@Transactional(readOnly=true)
public class BaitlyFiscalJurisdictions {
    private final FiscalProfileRepository profiles;
    private final OrganizationRepository organizations;
    private final TenantContext tenant;
    public BaitlyFiscalJurisdictions(FiscalProfileRepository profiles,OrganizationRepository organizations,TenantContext tenant) {
        this.profiles=profiles;this.organizations=organizations;this.tenant=tenant;
    }
    public static String country(String raw) {
        String code=raw==null?"":raw.trim().toUpperCase(Locale.ROOT);
        code=switch(code){case "FRA"->"FR";case "MAR"->"MA";case "SAU"->"SA";default->code;};
        if(!Set.of("FR","MA","SA").contains(code))throw new IllegalArgumentException("Pays fiscal du logement à renseigner : FR, MA ou SA");
        return code;
    }
    public static FiscalProfile forProperty(FiscalProfileRepository profiles,Long orgId,Property property) {
        if(property==null || !Objects.equals(orgId,property.getOrganizationId()))
            throw new org.springframework.security.access.AccessDeniedException("Le logement n'appartient pas à cette organisation");
        String code=country(property.getCountryCode());
        // Profil historique réutilisé uniquement lorsque son pays correspond réellement au bien.
        return profiles.findByOrganizationId(orgId).filter(p->code.equalsIgnoreCase(p.getCountryCode()))
                .or(()->profiles.findByOrganizationIdAndCountryCode(orgId,code))
                .orElseThrow(()->new IllegalStateException("Configurez le profil fiscal "+code+" du logement avant de facturer"));
    }
    public List<FiscalProfileDto> list(){return profiles.findByOrganizationIdOrderByCountryCode(tenant.getRequiredOrganizationId()).stream().map(FiscalProfileDto::from).toList();}
    public FiscalProfileDto get(String raw) {
        String code=country(raw);Long org=tenant.getRequiredOrganizationId();
        return FiscalProfileDto.from(profiles.findByOrganizationIdAndCountryCode(org,code).orElseGet(()->empty(org,code)));
    }
    @Transactional
    public FiscalProfileDto update(String raw,FiscalProfileDto dto) {
        String code=country(raw);Long org=tenant.getRequiredOrganizationId();
        if(!code.equals(country(dto.countryCode())))throw new IllegalArgumentException("Le pays du profil ne peut pas être déplacé");
        if(dto.legalEntityName()==null || dto.legalEntityName().isBlank() || dto.legalAddress()==null || dto.legalAddress().isBlank())
            throw new IllegalArgumentException("Renseignez l'identité et l'adresse du vendeur dans ce pays");
        if(dto.defaultCurrency()==null || !Set.of("EUR","MAD","SAR").contains(dto.defaultCurrency()))
            throw new IllegalArgumentException("Devise fiscale non prise en charge");
        if(dto.fiscalRegime()==null)throw new IllegalArgumentException("Renseignez le régime fiscal du vendeur");
        organizations.lockById(org).orElseThrow();
        var profile=profiles.findByOrganizationIdAndCountryCode(org,code).orElseGet(()->empty(org,code));
        if(profile.getId()==null)profile.setPrimaryProfile(profiles.findByOrganizationId(org).isEmpty());
        dto.applyTo(profile);profile.setCountryCode(code);profile.setOrganizationId(org);
        return FiscalProfileDto.from(profiles.save(profile));
    }
    private static FiscalProfile empty(Long org,String country) {
        var profile=new FiscalProfile(org,country,switch(country){case "MA"->"MAD";case "SA"->"SAR";default->"EUR";});
        profile.setPrimaryProfile(false);profile.setVatRegistered(false);
        profile.setInvoiceLanguage("SA".equals(country)?"ar":"fr");
        return profile;
    }
}
