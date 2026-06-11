package com.clenzy.booking.service;

import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.booking.service.PublicBookingService.OrgContext;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Lectures de configuration du Booking Engine pour l'organisation courante
 * (statut leger du dashboard + resolution d'OrgContext pour la preview admin).
 *
 * <p>Le CRUD multi-template reste dans {@link BookingEngineAdminService} ;
 * ce service ne fait que des lectures et n'auto-cree JAMAIS de config.</p>
 */
@Service
@Transactional(readOnly = true)
public class BookingEngineConfigService {

    private final BookingEngineConfigRepository configRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenantContext;

    public BookingEngineConfigService(BookingEngineConfigRepository configRepository,
                                      OrganizationRepository organizationRepository,
                                      TenantContext tenantContext) {
        this.configRepository = configRepository;
        this.organizationRepository = organizationRepository;
        this.tenantContext = tenantContext;
    }

    /** Statut leger du Booking Engine pour le widget dashboard (cle API masquee). */
    public record BookingEngineStatus(boolean configured, boolean enabled,
                                      int templateCount, String maskedApiKey) {}

    /**
     * Statut du Booking Engine de l'organisation courante.
     * Ne cree PAS de config par defaut (contrairement au CRUD admin).
     */
    public BookingEngineStatus getStatus() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<BookingEngineConfig> configs = configRepository.findAllByOrganizationId(orgId);
        if (configs.isEmpty()) {
            return new BookingEngineStatus(false, false, 0, null);
        }
        boolean anyEnabled = configs.stream().anyMatch(BookingEngineConfig::isEnabled);
        return new BookingEngineStatus(true, anyEnabled, configs.size(),
            maskApiKey(configs.get(0).getApiKey()));
    }

    /**
     * Resout l'OrgContext (org + premiere config active) d'une organisation TENANT
     * pour la preview admin du PMS.
     *
     * <p>Contrairement a {@link PublicBookingService#resolveOrgById}, une organisation
     * manquante leve {@link IllegalStateException} (500) : l'orgId vient du
     * TenantContext, son absence est une incoherence interne et non une erreur
     * de requete client.</p>
     */
    public OrgContext resolveEnabledOrgContext(Long orgId) {
        Organization org = organizationRepository.findById(orgId)
            .orElseThrow(() -> new IllegalStateException("Organisation introuvable : " + orgId));
        BookingEngineConfig config = configRepository.findAllByOrganizationId(orgId)
            .stream().filter(BookingEngineConfig::isEnabled).findFirst()
            .orElseThrow(() -> new IllegalStateException(
                "Booking Engine desactive pour l'organisation " + orgId));
        return new OrgContext(org, config);
    }

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.length() < 12) return "****";
        return apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length() - 4);
    }
}
