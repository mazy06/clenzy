package com.clenzy.service;

import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.marketplace.service.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UpsellFulfillmentServiceTest {
    @Mock UpsellOfferRepository offers;
    @Mock UpsellTypeDefRepository types;
    @Mock MarketplaceServiceItemRepository items;
    @Mock MarketplaceCatalogService catalog;
    @Mock MarketplaceExposureService exposure;
    @Mock MarketplacePropertyContext properties;
    @Mock MarketplaceGeographicEligibility geography;
    @Mock JdbcTemplate db;
    UpsellFulfillmentService service;
    UpsellOffer offer;
    Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("owner").build();
    @BeforeEach void setup() {
        service=new UpsellFulfillmentService(offers,types,items,catalog,exposure,properties,db,geography);
        offer=new UpsellOffer(); offer.setId(11L); offer.setOrganizationId(1L); offer.setType("BREAKFAST"); offer.setPropertyId(7L);
    }
    void owned() { when(offers.findByIdAndOrganizationId(11L,1L)).thenReturn(Optional.of(offer)); }
    @Test void resolvesTheTypeBridgeAndKeepsSelectionManual() {
        owned(); var type=new UpsellTypeDef(); type.setServiceItemCode("culinary-breakfast");
        when(types.findByCodeInScope("BREAKFAST",1L)).thenReturn(List.of(type));
        var configuration=service.configuration(11L,1L,jwt);
        assertThat(configuration.serviceItemCode()).isEqualTo("culinary-breakfast");
        assertThat(configuration.selectionMode()).isEqualTo("MANUAL");
        verify(properties).require(7L,1L,jwt);
    }
    @Test void refusesAnOfferFromAnotherOrganization() {
        when(offers.findByIdAndOrganizationId(11L,2L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.configuration(11L,2L,jwt)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(catalog);
    }
    @Test void validatesPropertyOwnershipBeforeReadingProviders() {
        owned(); when(properties.require(7L,1L,jwt)).thenThrow(new AccessDeniedException("Not owned"));
        assertThatThrownBy(() -> service.configuration(11L,1L,jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(catalog);
    }
    @Test void doesNotReturnTheWholeCatalogueForAnUnqualifiedService() {
        owned(); when(types.findByCodeInScope("BREAKFAST",1L)).thenReturn(List.of());
        var result=service.candidates(11L,1L,jwt,7L,null,60,false,false,false,null,"name",0);
        assertThat(result.page().items()).isEmpty(); verifyNoInteractions(catalog);
    }
    @Test void rejectsAnUnknownServiceBeforeSaving() {
        owned(); when(items.findByCode("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.configure(11L,1L,jwt,"missing",null,7L)).isInstanceOf(IllegalArgumentException.class);
        verify(offers,never()).save(any());
    }
    @Test void doesNotExposeAHiddenPreferredProfile() {
        owned(); offer.setFulfillmentServiceCode("culinary-breakfast"); offer.setPreferredProviderId(99L);
        when(catalog.getProvider(99L)).thenReturn(Optional.empty());
        assertThat(service.configuration(11L,1L,jwt).preferredProvider()).isNull();
        verify(catalog,never()).getCatalogEntry(any(),any());
    }
    @Test void suggestsOnlyOtherActiveServicesInTheSameCategoryAndExecutionMode() {
        owned(); offer.setFulfillmentServiceCode("cleaning-mid-stay");
        var cleaning=new com.clenzy.marketplace.model.MarketplaceServiceCategory(); cleaning.setCode("CLEANING"); cleaning.setActive(true);
        var culinary=new com.clenzy.marketplace.model.MarketplaceServiceCategory(); culinary.setCode("CULINARY"); culinary.setActive(true);
        var selected=item("cleaning-mid-stay",cleaning,"ON_SITE");
        var turnover=item("cleaning-turnover",cleaning,"ON_SITE");
        var remote=item("cleaning-advice",cleaning,"REMOTE");
        var breakfast=item("culinary-breakfast",culinary,"ON_SITE");
        when(items.findByCode("cleaning-mid-stay")).thenReturn(Optional.of(selected));
        when(items.findAllActiveWithCategory()).thenReturn(List.of(selected,turnover,remote,breakfast));
        when(catalog.searchCatalog(any(),eq(1L),any(),any(),any())).thenReturn(new com.clenzy.marketplace.dto.CatalogPageDto(List.of(),0,12,0,0));
        var result=service.candidates(11L,1L,jwt,7L,null,60,false,false,false,null,"name",0,true);
        assertThat(result.serviceCodes()).containsExactly("cleaning-turnover");
        var criteria=org.mockito.ArgumentCaptor.forClass(com.clenzy.marketplace.dto.ProviderSearchCriteria.class);
        verify(catalog).searchCatalog(criteria.capture(),eq(1L),any(),any(),any());
        assertThat(criteria.getValue().serviceCodes()).containsExactly("cleaning-turnover");
        assertThat(offer.getFulfillmentServiceCode()).isEqualTo("cleaning-mid-stay");
        verify(offers,never()).save(any());
    }
    private com.clenzy.marketplace.model.MarketplaceServiceItem item(String code,
            com.clenzy.marketplace.model.MarketplaceServiceCategory category,String mode) {
        var item=new com.clenzy.marketplace.model.MarketplaceServiceItem();
        item.setCode(code); item.setCategory(category); item.setExecutionMode(mode); item.setActive(true);
        return item;
    }
}
