package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.BaitlySocialProfile;
import com.clenzy.marketplace.model.ExposureEffect;
import com.clenzy.marketplace.repository.BaitlyPublicProfileRepository;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public identities and destinations only, with the same consent and exposure rules as the directory. */
@Service
@Transactional(readOnly = true)
public class BaitlyReelAuthors {
    private final BaitlyPublicProfileRepository profiles;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceCatalogService catalog;
    private final MarketplaceExposureService exposure;
    private final ProviderDocumentaryService documentary;

    public BaitlyReelAuthors(BaitlyPublicProfileRepository profiles, MarketplaceProviderRepository providers,
            MarketplaceCatalogService catalog, MarketplaceExposureService exposure, ProviderDocumentaryService documentary) {
        this.profiles = profiles; this.providers = providers; this.catalog = catalog;
        this.exposure = exposure; this.documentary = documentary;
    }

    public record Author(String name, String avatarUrl, String role, String city,
            String publicProfileId, Long providerId, boolean offersManagement, boolean seekingManagement) {}

    public Author resolve(BaitlySocialProfile social) {
        var profile = profiles.findByOrganizationIdAndAuthorUserId(social.organizationId, social.authorUserId)
            .filter(p -> p.published).orElse(null);
        var provider = providers.findByUserId(social.authorUserId)
            .filter(p -> social.organizationId.equals(p.getHomeOrganizationId()))
            .filter(p -> {
                var visibility = exposure.visibilityOf(p);
                return visibility.exposable() && visibility.global() != ExposureEffect.DENY;
            }).filter(p -> !documentary.unpublishableIds().contains(p.getId()))
            .flatMap(p -> catalog.getCatalogEntry(p.getId(), null)).orElse(null);
        String name = profile != null ? BaitlyPublicNames.display(profile.name, profile.hideLastName)
            : provider != null ? provider.displayName() : social.displayName;
        String avatar = profile != null && profile.avatarUrl != null ? profile.avatarUrl
            : provider != null ? provider.avatarUrl() : null;
        return new Author(name, avatar, profile != null ? profile.role : provider != null ? "PROVIDER" : null,
            profile != null ? profile.city : provider != null ? provider.baseCity() : null,
            profile != null ? profile.id.toString() : null, provider != null ? provider.id() : null,
            profile != null && "CONCIERGE".equals(profile.role) && !profile.managementServices.isEmpty(),
            profile != null && profile.seekingManagement);
    }
}
