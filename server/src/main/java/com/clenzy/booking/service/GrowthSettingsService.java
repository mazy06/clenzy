package com.clenzy.booking.service;

import com.clenzy.booking.dto.GrowthSettingsDto;
import com.clenzy.model.AbandonedBookingStatus;
import com.clenzy.model.Organization;
import com.clenzy.repository.AbandonedBookingRepository;
import com.clenzy.repository.MarketingContactRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Réglages de croissance du booking engine (CLZ Domaine 2), org-scopés via le TenantContext.
 * Les drapeaux sont réellement appliqués ailleurs (LeadCaptureService, AbandonedBookingRecoveryScheduler) ;
 * ce service ne fait que les lire/écrire et exposer les compteurs.
 */
@Service
public class GrowthSettingsService {

    private final OrganizationRepository organizationRepository;
    private final MarketingContactRepository marketingContactRepository;
    private final AbandonedBookingRepository abandonedBookingRepository;
    private final TenantContext tenantContext;

    public GrowthSettingsService(OrganizationRepository organizationRepository,
                                 MarketingContactRepository marketingContactRepository,
                                 AbandonedBookingRepository abandonedBookingRepository,
                                 TenantContext tenantContext) {
        this.organizationRepository = organizationRepository;
        this.marketingContactRepository = marketingContactRepository;
        this.abandonedBookingRepository = abandonedBookingRepository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public GrowthSettingsDto getSettings() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return toDto(requireOrg(orgId), orgId);
    }

    @Transactional
    public GrowthSettingsDto updateSettings(boolean leadCaptureEnabled, boolean abandonedCartRecoveryEnabled) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Organization org = requireOrg(orgId);
        org.setLeadCaptureEnabled(leadCaptureEnabled);
        org.setAbandonedCartRecoveryEnabled(abandonedCartRecoveryEnabled);
        organizationRepository.save(org);
        return toDto(org, orgId);
    }

    private Organization requireOrg(Long orgId) {
        return organizationRepository.findById(orgId)
            .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable : " + orgId));
    }

    private GrowthSettingsDto toDto(Organization org, Long orgId) {
        long contacts = marketingContactRepository.countByOrganizationId(orgId);
        long recovered = abandonedBookingRepository.countByOrganizationIdAndStatus(orgId, AbandonedBookingStatus.RECOVERY_SENT);
        return new GrowthSettingsDto(org.isLeadCaptureEnabled(), org.isAbandonedCartRecoveryEnabled(), contacts, recovered);
    }
}
