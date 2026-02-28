package com.clenzy.service;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.model.FiscalProfile;
import com.clenzy.model.FiscalRegime;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service de gestion du profil fiscal d'une organisation.
 *
 * Responsabilites :
 * - Lecture du profil fiscal courant (via TenantContext)
 * - Mise a jour des parametres fiscaux
 * - Auto-creation du profil si absent (onboarding)
 */
@Service
@Transactional(readOnly = true)
public class FiscalProfileService {

    private static final Logger logger = LoggerFactory.getLogger(FiscalProfileService.class);

    private final FiscalProfileRepository fiscalProfileRepository;
    private final TenantContext tenantContext;

    public FiscalProfileService(FiscalProfileRepository fiscalProfileRepository,
                                 TenantContext tenantContext) {
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Retourne le profil fiscal de l'organisation courante.
     * Si aucun profil n'existe, en cree un avec les valeurs par defaut (FR/EUR).
     */
    public FiscalProfileDto getCurrentProfile() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        FiscalProfile fp = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseGet(() -> createDefaultProfile(orgId));
        return FiscalProfileDto.from(fp);
    }

    /**
     * Met a jour le profil fiscal de l'organisation courante.
     */
    @Transactional
    public FiscalProfileDto updateProfile(FiscalProfileDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        FiscalProfile fp = fiscalProfileRepository.findByOrganizationId(orgId)
            .orElseGet(() -> createDefaultProfile(orgId));

        dto.applyTo(fp);
        fp = fiscalProfileRepository.save(fp);
        logger.info("Profil fiscal mis a jour pour organisation {}: country={}, currency={}",
            orgId, fp.getCountryCode(), fp.getDefaultCurrency());

        // Invalider le cache Redis du tenant pour forcer le rechargement
        // (sera fait automatiquement au prochain request via TenantFilter)

        return FiscalProfileDto.from(fp);
    }

    /**
     * Cree un profil fiscal par defaut pour une organisation.
     * Appele lors de l'onboarding ou au premier acces.
     */
    @Transactional
    public FiscalProfile createDefaultProfile(Long organizationId) {
        logger.info("Creation du profil fiscal par defaut pour organisation {}", organizationId);
        FiscalProfile fp = new FiscalProfile();
        fp.setOrganizationId(organizationId);
        fp.setCountryCode("FR");
        fp.setDefaultCurrency("EUR");
        fp.setFiscalRegime(FiscalRegime.STANDARD);
        fp.setVatRegistered(true);
        fp.setInvoiceLanguage("fr");
        fp.setInvoicePrefix("FA");
        return fiscalProfileRepository.save(fp);
    }
}
