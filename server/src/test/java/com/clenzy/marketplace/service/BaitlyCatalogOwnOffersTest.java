package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class BaitlyCatalogOwnOffersTest {
    @Test void ownOffersRemainSelectableButForeignUnreviewedOffersStayHidden() {
        var providers = mock(MarketplaceProviderRepository.class);
        var offers = mock(MarketplaceProviderOfferRepository.class);
        var zones = mock(MarketplaceProviderZoneRepository.class);
        var documents = mock(ProviderDocumentaryService.class);
        var service = new MarketplaceCatalogService(providers, offers, zones,
            null, null, null, null, null, null, null, Clock.systemUTC(), documents);
        var provider = new MarketplaceProvider();
        provider.setId(42L); provider.setHomeOrganizationId(1L); provider.setDisplayName("Salma");
        var category = new MarketplaceServiceCategory(); category.setCode("CLEANING");
        var item = new MarketplaceServiceItem(); item.setCode("cleaning-turnover"); item.setCategory(category);
        var offer = new MarketplaceProviderOffer(); offer.setId(3L); offer.setProvider(provider);
        offer.setCategory(category); offer.setServiceItem(item); offer.setLabel("Ménage entre deux séjours");
        when(providers.findById(42L)).thenReturn(Optional.of(provider));
        when(offers.findActiveByProviderIds(List.of(42L))).thenReturn(List.of(offer));
        when(zones.effectiveZones(List.of(42L))).thenReturn(List.of());
        var own = service.getCatalogEntry(42L, 1L).orElseThrow();
        assertThat(own.own()).isTrue();
        assertThat(own.offers()).extracting(o -> o.serviceItemCode()).containsExactly("cleaning-turnover");
        verifyNoInteractions(documents);
        assertThat(service.getCatalogEntry(42L, 2L).orElseThrow().offers()).isEmpty();
        assertThat(service.getCatalogEntry(42L, null).orElseThrow().offers()).isEmpty();
        verify(documents, times(2)).hasReviewedScope(42L, "ITEM:cleaning-turnover");
    }
}
