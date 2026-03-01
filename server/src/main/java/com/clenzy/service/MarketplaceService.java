package com.clenzy.service;

import com.clenzy.dto.IntegrationPartnerDto;
import com.clenzy.model.IntegrationPartner;
import com.clenzy.model.IntegrationPartner.IntegrationCategory;
import com.clenzy.model.IntegrationPartner.IntegrationStatus;
import com.clenzy.repository.IntegrationPartnerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class MarketplaceService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceService.class);

    // Catalogue des integrations disponibles dans la marketplace
    private static final List<Map<String, String>> CATALOG = List.of(
        Map.of("name", "PriceLabs", "slug", "pricelabs", "category", "PRICING",
            "description", "Dynamic pricing optimization for short-term rentals"),
        Map.of("name", "Beyond Pricing", "slug", "beyond-pricing", "category", "PRICING",
            "description", "Revenue management with market data analysis"),
        Map.of("name", "Wheelhouse", "slug", "wheelhouse", "category", "PRICING",
            "description", "Smart pricing based on demand and competition"),
        Map.of("name", "KeyNest", "slug", "keynest", "category", "KEY_MANAGEMENT",
            "description", "Key exchange network for property access"),
        Map.of("name", "Igloohome", "slug", "igloohome", "category", "KEY_MANAGEMENT",
            "description", "Smart locks with remote access codes"),
        Map.of("name", "Turno", "slug", "turno", "category", "CLEANING",
            "description", "Automated cleaning scheduling and team management"),
        Map.of("name", "Properly", "slug", "properly", "category", "CLEANING",
            "description", "Quality inspection and cleaning verification"),
        Map.of("name", "Pennylane", "slug", "pennylane", "category", "ACCOUNTING",
            "description", "French accounting platform integration"),
        Map.of("name", "QuickBooks", "slug", "quickbooks", "category", "ACCOUNTING",
            "description", "Accounting and invoicing platform"),
        Map.of("name", "Autohost", "slug", "autohost", "category", "GUEST_SCREENING",
            "description", "AI-powered guest screening and verification"),
        Map.of("name", "Minut", "slug", "minut", "category", "HOME_AUTOMATION",
            "description", "Noise monitoring and occupancy detection"),
        Map.of("name", "Nuki", "slug", "nuki", "category", "HOME_AUTOMATION",
            "description", "Smart lock integration for keyless entry")
    );

    private final IntegrationPartnerRepository partnerRepository;

    public MarketplaceService(IntegrationPartnerRepository partnerRepository) {
        this.partnerRepository = partnerRepository;
    }

    public List<IntegrationPartnerDto> getAllIntegrations(Long orgId) {
        return partnerRepository.findAllByOrgId(orgId).stream()
            .map(IntegrationPartnerDto::from)
            .toList();
    }

    public List<IntegrationPartnerDto> getByCategory(IntegrationCategory category, Long orgId) {
        return partnerRepository.findByCategory(category, orgId).stream()
            .map(IntegrationPartnerDto::from)
            .toList();
    }

    public List<IntegrationPartnerDto> getConnected(Long orgId) {
        return partnerRepository.findByStatus(IntegrationStatus.CONNECTED, orgId).stream()
            .map(IntegrationPartnerDto::from)
            .toList();
    }

    /**
     * Initialise le catalogue marketplace pour une organisation.
     */
    @Transactional
    public int initializeCatalog(Long orgId) {
        List<IntegrationPartner> existing = partnerRepository.findAllByOrgId(orgId);
        int created = 0;

        for (Map<String, String> entry : CATALOG) {
            String slug = entry.get("slug");
            boolean alreadyExists = existing.stream()
                .anyMatch(p -> slug.equals(p.getPartnerSlug()));

            if (!alreadyExists) {
                IntegrationPartner partner = new IntegrationPartner();
                partner.setOrganizationId(orgId);
                partner.setPartnerName(entry.get("name"));
                partner.setPartnerSlug(slug);
                partner.setCategory(IntegrationCategory.valueOf(entry.get("category")));
                partner.setDescription(entry.get("description"));
                partner.setStatus(IntegrationStatus.AVAILABLE);
                partnerRepository.save(partner);
                created++;
            }
        }

        log.info("Initialized {} marketplace integrations for org {}", created, orgId);
        return created;
    }

    /**
     * Connecte une integration partenaire avec les credentials fournis.
     */
    @Transactional
    public IntegrationPartnerDto connectIntegration(Long id, Long orgId, String apiKey, String config) {
        IntegrationPartner partner = partnerRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Integration not found: " + id));

        partner.setStatus(IntegrationStatus.CONNECTED);
        partner.setApiKeyEncrypted(apiKey);
        if (config != null) partner.setConfig(config);
        partner.setConnectedAt(Instant.now());

        IntegrationPartner saved = partnerRepository.save(partner);
        log.info("Connected integration '{}' for org {}", partner.getPartnerName(), orgId);
        return IntegrationPartnerDto.from(saved);
    }

    @Transactional
    public IntegrationPartnerDto disconnectIntegration(Long id, Long orgId) {
        IntegrationPartner partner = partnerRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Integration not found: " + id));

        partner.setStatus(IntegrationStatus.DISCONNECTED);
        partner.setApiKeyEncrypted(null);

        IntegrationPartner saved = partnerRepository.save(partner);
        log.info("Disconnected integration '{}' for org {}", partner.getPartnerName(), orgId);
        return IntegrationPartnerDto.from(saved);
    }

    /**
     * Retourne le catalogue statique des integrations disponibles.
     */
    public List<Map<String, String>> getCatalog() {
        return CATALOG;
    }
}
