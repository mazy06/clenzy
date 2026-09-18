package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.marketplace.service.*;
import com.clenzy.service.ProviderAvailabilityService;
import com.clenzy.service.catalog.ServiceCatalogReference;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.AccessDeniedException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class PublicServiceNeedsTest {
    final ServiceAssignmentService assignments=mock(ServiceAssignmentService.class);
    final ServiceRequestRepository needs=mock(ServiceRequestRepository.class);
    final MarketplaceProviderRepository providers=mock(MarketplaceProviderRepository.class);
    final MarketplaceProviderZoneRepository zones=mock(MarketplaceProviderZoneRepository.class);
    final MarketplaceExposureService exposure=mock(MarketplaceExposureService.class);
    final MarketplaceGeographicEligibility geography=mock(MarketplaceGeographicEligibility.class);
    final MarketplaceQuoteService quotes=mock(MarketplaceQuoteService.class);
    final MarketplaceQuoteRequestRepository quoteRequests=mock(MarketplaceQuoteRequestRepository.class);
    final ServiceCatalogReference catalog=mock(ServiceCatalogReference.class);
    final JdbcTemplate db=mock(JdbcTemplate.class);
    final ProviderDocumentaryService documents=mock(ProviderDocumentaryService.class);
    final ProviderAvailabilityService availability=mock(ProviderAvailabilityService.class);
    final PublicServiceNeeds service=new PublicServiceNeeds(assignments,needs,providers,zones,exposure,
            geography,quotes,quoteRequests,catalog,db,documents,availability);
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("provider").build();
    MarketplaceProvider provider;
    ServiceRequest need;
    @BeforeEach void setup() {
        provider=new MarketplaceProvider(); provider.setId(3L); provider.setUserId(4L); provider.setHomeOrganizationId(5L); provider.setStatus(ProviderStatus.ACTIVE);
        var category=new MarketplaceServiceCategory(); category.setCode("CLEANING"); category.setActive(true);
        var item=new MarketplaceServiceItem(); item.setCode("cleaning-turnover"); item.setCategory(category); item.setActive(true);
        var offer=new MarketplaceProviderOffer(); offer.setCategory(category); offer.setServiceItem(item); offer.setActive(true);
        provider.getOffers().add(offer);
        need=new ServiceRequest(); need.setId(1L); need.setOrganizationId(2L); need.setServiceItemCode(item.getCode()); need.setAssignmentPhase("PUBLIC");
        var property=new Property(); property.setName("Confidentiel"); property.setAddress("Adresse privée"); property.setCity("Paris"); property.setCountryCode("FR"); need.setProperty(property);
        need.setAccessNotes("Code privé"); need.setTitle("Voyageur privé");
        when(assignments.currentUser(jwt)).thenReturn(4L);
        when(providers.findByUserId(4L)).thenReturn(Optional.of(provider));
        when(exposure.isVisibleTo(provider,2L)).thenReturn(true);
        when(documents.assignmentEligible(any())).thenReturn(true);
        when(catalog.doesNotReserveSlot(item.getCode())).thenReturn(true);
        when(catalog.isRemote(item.getCode())).thenReturn(true);
        // Le depistage lit les regles d'exposition une fois pour toute la page,
        // et charge le lot de besoins en une requete.
        when(exposure.visibilityOf(provider)).thenReturn(new MarketplaceExposureService.Visibility(
            provider.getHomeOrganizationId(),true,Map.of(),null));
        when(db.queryForList(anyString(),eq(Long.class),any(),any())).thenReturn(List.of(1L));
        when(needs.findAllById(List.of(1L))).thenReturn(List.of(need));
        when(needs.findById(1L)).thenReturn(Optional.of(need));
        when(assignments.lock(1L)).thenReturn(need);
    }
    @Test void publicProjectionContainsNoPrivatePropertyOrGuestDetails() throws Exception {
        var page=service.list(jwt,null);
        assertThat(page.items()).hasSize(1);
        var json=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(page);
        assertThat(json).contains("Paris").doesNotContain("Confidentiel","Adresse privée","Code privé","Voyageur privé");
    }
    @Test void aPageOfNeedsSharesItsChecksInsteadOfRepeatingThemPerNeed() {
        var batch=new ArrayList<ServiceRequest>();
        var ids=new ArrayList<Long>();
        for (long id=1; id<=30; id++) {
            var other=new ServiceRequest();
            other.setId(id); other.setOrganizationId(2L); other.setServiceItemCode("cleaning-turnover");
            other.setAssignmentPhase("PUBLIC"); other.setProperty(need.getProperty());
            batch.add(other); ids.add(id);
        }
        when(db.queryForList(anyString(),eq(Long.class),any(),any())).thenReturn(ids);
        when(needs.findAllById(ids)).thenReturn(batch);

        assertThat(service.list(jwt,null).items()).hasSize(20);

        // Une seule lecture du lot : plus de findById par ligne examinee.
        verify(needs).findAllById(ids);
        verify(needs,never()).findById(any());
        // Les verifications communes a la page ne sont plus refaites par besoin.
        verify(exposure).visibilityOf(provider);
        verify(catalog,times(1)).isRemote("cleaning-turnover");
        verify(documents,times(1)).assignmentEligible(any());
    }

    @Test void internalProposalCannotReceiveAPublicOffer() {
        need.setAssignmentPhase("PROPOSED");
        assertThatThrownBy(() -> service.offer(1L,null,jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(quotes);
    }
    @Test void completedOrConvertedNeedsAreNeverExposedEvenFromAStaleList() {
        need.setConvertedInterventionId(9L);
        assertThat(service.list(jwt,null).items()).isEmpty();
    }
    @Test void MissingDocumentaryEligibilityRemovesTheNeed() {
        when(documents.assignmentEligible(any())).thenReturn(false);
        assertThat(service.list(jwt,null).items()).isEmpty();
    }
    @Test void providerCannotBidAgainstTheirOwnOrganization() {
        provider.setHomeOrganizationId(2L);
        assertThatThrownBy(() -> service.offer(1L,null,jwt)).isInstanceOf(AccessDeniedException.class);
    }
}
