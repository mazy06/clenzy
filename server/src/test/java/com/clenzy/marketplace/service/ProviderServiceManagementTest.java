package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.pricing.ProviderTariffService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ProviderServiceManagementTest {
    @Mock UserRepository users;
    @Mock ProviderTariffService tariffs;
    @Mock MarketplaceProviderRepository providers;
    @Mock MarketplaceProviderOfferRepository offers;
    @Mock MarketplaceServiceItemRepository items;
    ProviderServiceManagement service;
    @BeforeEach void setup() {
        service=new ProviderServiceManagement(users,tariffs,providers,offers,items, org.mockito.Mockito.mock(ProviderDocumentaryService.class));
        var user=new User(); user.setId(7L);
        lenient().when(users.findByKeycloakId("owner")).thenReturn(Optional.of(user));
    }
    ProviderServiceManagement.Command command() {
        return new ProviderServiceManagement.Command(PricingModel.FLAT,new BigDecimal("80"),"EUR",null,true);
    }
    @Test void identityComesFromTheAuthenticatedSubject() {
        assertThatThrownBy(() -> service.replace("stranger","cleaning",command()))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(tariffs,providers,offers,items);
    }
    @Test void unknownNewServiceCannotCreateATariff() {
        assertThatThrownBy(() -> service.replace("owner","made-up",command())).isInstanceOf(IllegalArgumentException.class);
        verify(tariffs,never()).set(any(),any(),any(),any(),any(),anyBoolean(),any());
    }
    @Test void aPublishedServiceReferencesTheCanonicalTariffAndDoesNotCopyItsPrice() {
        var category=new MarketplaceServiceCategory(); category.setActive(true);
        var item=new MarketplaceServiceItem(); item.setCode("cleaning"); item.setLabelFr("Ménage"); item.setCategory(category); item.setActive(true);
        when(items.findByCode("cleaning")).thenReturn(Optional.of(item));
        var tariff=new ProviderTariff(); tariff.setUserId(7L); tariff.setServiceKey("cleaning");
        tariff.setAmount(new BigDecimal("80")); tariff.setPricingModel(PricingModel.FLAT);
        org.springframework.test.util.ReflectionTestUtils.setField(tariff,"id",15L);
        when(tariffs.set(7L,"cleaning",PricingModel.FLAT,new BigDecimal("80"),"EUR",true,null)).thenReturn(tariff);
        var provider=new MarketplaceProvider(); provider.setId(4L); provider.setUserId(7L);
        when(providers.findByUserId(7L)).thenReturn(Optional.of(provider));
        service.replace("owner","cleaning",command());
        var capture=ArgumentCaptor.forClass(MarketplaceProviderOffer.class); verify(offers).save(capture.capture());
        assertThat(capture.getValue().getTariff()).isSameAs(tariff);
        assertThat(org.springframework.test.util.ReflectionTestUtils.getField(capture.getValue(),"amount")).isNull();
        assertThat(capture.getValue().getProvider()).isSameAs(provider);
    }
    @Test void anExistingFreeServiceCanBeDisabledWithoutInventingACatalogueEntry() {
        var tariff=new ProviderTariff(); tariff.setUserId(7L); tariff.setServiceKey("custom:service");
        when(tariffs.list(7L)).thenReturn(List.of(tariff));
        tariff.setEnabled(false);
        when(tariffs.set(7L,"custom:service",PricingModel.ON_QUOTE,null,"EUR",false,null)).thenReturn(tariff);
        service.replace("owner","custom:service",new ProviderServiceManagement.Command(PricingModel.ON_QUOTE,null,"EUR",null,false));
        verify(offers,never()).save(any());
    }
}

