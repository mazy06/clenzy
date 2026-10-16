package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BaitlyReelAuthorsTest {
    final BaitlyPublicProfileRepository profiles = mock(BaitlyPublicProfileRepository.class);
    final MarketplaceProviderRepository providers = mock(MarketplaceProviderRepository.class);
    final MarketplaceCatalogService catalog = mock(MarketplaceCatalogService.class);
    final MarketplaceExposureService exposure = mock(MarketplaceExposureService.class);
    final ProviderDocumentaryService documentary = mock(ProviderDocumentaryService.class);
    final BaitlyReelAuthors service = new BaitlyReelAuthors(profiles, providers, catalog, exposure, documentary);

    BaitlySocialProfile social() {
        var p = new BaitlySocialProfile(); p.organizationId = 2L; p.authorUserId = 3L; p.displayName = "Réel public";
        return p;
    }
    BaitlyPublicProfile profile(boolean published) {
        var p = new BaitlyPublicProfile(); p.id = UUID.randomUUID(); p.published = published;
        p.name = "Salma Benali"; p.hideLastName = true; p.avatarUrl = "https://example.test/avatar.jpg";
        p.role = "CONCIERGE"; p.city = "Marrakech"; p.managementServices = List.of("GUESTS");
        when(profiles.findByOrganizationIdAndAuthorUserId(2L, 3L)).thenReturn(Optional.of(p));
        return p;
    }
    @Test void unpublishedIdentityNeverLeaksThroughAReel() {
        profile(false);
        var author = service.resolve(social());
        assertThat(author.name()).isEqualTo("Réel public");
        assertThat(author.publicProfileId()).isNull(); assertThat(author.avatarUrl()).isNull();
        assertThat(author.city()).isNull(); assertThat(author.offersManagement()).isFalse();
    }
    @Test void publicIdentityRespectsNamePrivacyAndUsesItsOwnProfileId() {
        var p = profile(true);
        var author = service.resolve(social());
        assertThat(author.name()).isEqualTo(BaitlyPublicNames.display(p.name, true)).doesNotContain("Benali");
        assertThat(author.publicProfileId()).isEqualTo(p.id.toString());
        assertThat(author.avatarUrl()).isEqualTo(p.avatarUrl); assertThat(author.offersManagement()).isTrue();
    }
    @Test void providerFromAnotherOrganizationCannotBeAttachedToAnAuthor() {
        var p = new MarketplaceProvider(); p.setId(8L); p.setHomeOrganizationId(9L);
        when(providers.findByUserId(3L)).thenReturn(Optional.of(p));
        assertThat(service.resolve(social()).providerId()).isNull();
        verifyNoInteractions(exposure, documentary, catalog);
    }
    @Test void hiddenProviderCannotReceiveProfileOrContactLinks() {
        var p = new MarketplaceProvider(); p.setId(8L); p.setHomeOrganizationId(2L);
        when(providers.findByUserId(3L)).thenReturn(Optional.of(p));
        when(exposure.visibilityOf(p)).thenReturn(new MarketplaceExposureService.Visibility(2L, true, Map.of(), ExposureEffect.DENY));
        assertThat(service.resolve(social()).providerId()).isNull();
        verifyNoInteractions(catalog);
    }
    @Test void documentaryRestrictionCannotBeBypassedByAReel() {
        var p = new MarketplaceProvider(); p.setId(8L); p.setHomeOrganizationId(2L);
        when(providers.findByUserId(3L)).thenReturn(Optional.of(p));
        when(exposure.visibilityOf(p)).thenReturn(new MarketplaceExposureService.Visibility(2L, true, Map.of(), null));
        when(documentary.unpublishableIds()).thenReturn(List.of(8L));
        assertThat(service.resolve(social()).providerId()).isNull();
        verifyNoInteractions(catalog);
    }
}
