package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketplaceGeographicEligibilityTest {
    final PropertyRepository properties = mock(PropertyRepository.class);
    final MarketplaceProviderZoneRepository zones = mock(MarketplaceProviderZoneRepository.class);
    final MarketplaceGeographicEligibility service = new MarketplaceGeographicEligibility(properties, zones, mock(ProviderDocumentaryService.class));

    @Test void changedCoverageBlocksApprovalBeforeStateChange() {
        var requests = mock(com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository.class);
        var geography = mock(MarketplaceGeographicEligibility.class);
        var factory = new MarketplaceQuoteMissionFactory(mock(com.clenzy.repository.InterventionRepository.class),
            properties, mock(com.clenzy.marketplace.repository.MarketplaceProviderRepository.class),
            mock(com.clenzy.repository.UserRepository.class), requests, java.time.Clock.systemUTC(),
            mock(com.clenzy.service.InterventionAllocationGuard.class), mock(MarketplaceExposureService.class), geography);
        var request = new com.clenzy.marketplace.model.MarketplaceQuoteRequest();
        request.setId(9L); request.setProviderId(1L); request.setPropertyId(2L);
        request.setRequesterOrganizationId(3L);
        request.setStatus(com.clenzy.marketplace.model.QuoteRequestStatus.QUOTED);
        when(requests.findForDiscussion(9L)).thenReturn(Optional.of(request));
        var quote = new com.clenzy.model.ServiceQuote(); quote.setMarketplaceRequestId(9L);
        doThrow(new IllegalStateException("hors zone")).when(geography).requireCoverage(1L, 2L, 3L);
        assertThatThrownBy(() -> factory.decide(quote, 3L, true, null)).hasMessage("hors zone");
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
    }

    @Test void changedCoverageBlocksPricingBeforeStateChange() {
        var requests = mock(com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository.class);
        var geography = mock(MarketplaceGeographicEligibility.class);
        var quotes = new MarketplaceQuoteService(requests,
            mock(com.clenzy.marketplace.repository.MarketplaceProviderRepository.class),
            mock(MarketplaceExposureService.class), properties, java.time.Clock.systemUTC(),
            mock(com.clenzy.repository.TeamRepository.class), mock(com.clenzy.service.ServiceQuoteService.class),
            mock(MarketplaceQuoteMissionFactory.class), geography);
        var request = new com.clenzy.marketplace.model.MarketplaceQuoteRequest();
        request.setId(9L); request.setProviderId(1L); request.setPropertyId(2L);
        request.setRequesterOrganizationId(3L);
        when(requests.findById(9L)).thenReturn(Optional.of(request));
        doThrow(new IllegalStateException("hors zone")).when(geography).requireCoverage(1L, 2L, 3L);
        assertThatThrownBy(() -> quotes.quote(9L, 1L, java.math.BigDecimal.TEN, "EUR", null, null))
            .hasMessage("hors zone");
        verify(requests, never()).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
    }

    @Test void generalRequestDoesNotInventALocation() {
        service.requireCoverage(1L, null, 3L);
        verifyNoInteractions(properties, zones);
    }

    @Test void foreignPropertyCannotProbeCoverage() {
        when(properties.lockMarketplaceLocation(2L, 3L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.requireCoverage(1L, 2L, 3L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(zones);
    }

    @Test void readsCanonicalCoverageAfterSerializingZoneChanges() {
        var location = mock(PropertyRepository.MarketplaceLocation.class);
        when(location.getDepartment()).thenReturn("75");
        when(location.getArrondissement()).thenReturn("75101");
        when(properties.lockMarketplaceLocation(2L, 3L)).thenReturn(Optional.of(location));
        var owner = mock(MarketplaceProviderZoneRepository.CoverageOwner.class);
        when(owner.getUserId()).thenReturn(8L);
        when(zones.lockCoverageOwner(1L)).thenReturn(Optional.of(owner));
        when(zones.covers(1L, "FR", "75", "75101", null)).thenReturn(true);
        when(zones.acceptsProperty(1L, null)).thenReturn(true);
        service.requireCoverage(1L, 2L, 3L);
        var order = inOrder(properties, zones);
        order.verify(properties).lockMarketplaceLocation(2L, 3L);
        order.verify(zones).lockCoverageOwner(1L);
        order.verify(zones).lockIndividual(8L);
        order.verify(zones).covers(1L, "FR", "75", "75101", null);
        when(zones.covers(1L, "FR", "75", "75101", null)).thenReturn(false);
        assertThatThrownBy(() -> service.requireCoverage(1L, 2L, 3L)).isInstanceOf(IllegalStateException.class);
    }
}
