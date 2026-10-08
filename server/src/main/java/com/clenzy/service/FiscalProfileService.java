package com.clenzy.service;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.model.FiscalProfile;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lecture du profil principal historique ; les écritures passent par BaitlyFiscalJurisdictions. */
@Service
@Transactional(readOnly = true)
public class FiscalProfileService {

    private final FiscalProfileRepository fiscalProfileRepository;
    private final TenantContext tenantContext;

    public FiscalProfileService(FiscalProfileRepository fiscalProfileRepository,
                                 TenantContext tenantContext) {
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.tenantContext = tenantContext;
    }

    /** Lecture sans création d'immatriculation implicite ; le brouillon n'est persisté qu'à l'enregistrement. */
    public FiscalProfileDto getCurrentProfile() {
        Long orgId=tenantContext.getRequiredOrganizationId();
        var profile=fiscalProfileRepository.findByOrganizationId(orgId).orElseGet(()->{
            var empty=new FiscalProfile(orgId,"FR","EUR");empty.setVatRegistered(false);return empty;
        });
        return FiscalProfileDto.from(profile);
    }

}
