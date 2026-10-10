package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.ProviderTariff;
import com.clenzy.repository.ProviderTariffRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class BaitlyProviderEditingTest {
    @Mock MarketplaceProviderRepository providers;
    @Mock MarketplaceServiceItemRepository items;
    @Mock MarketplaceProviderOfferRepository offers;
    @Mock ProviderTariffRepository tariffs;
    @Mock MarketplaceDecisionJournal journal;
    BaitlyProviderEditing editing;
    MarketplaceProvider provider;
    MarketplaceProviderOffer offer;
    ProviderTariff tariff;
    @BeforeEach void setup() {
        editing=new BaitlyProviderEditing(providers,items,offers,tariffs,journal);
        provider=new MarketplaceProvider();provider.setId(27L);provider.setUserId(35L);provider.setDisplayName("Salma");
        offer=new MarketplaceProviderOffer();offer.setId(32L);offer.setProvider(provider);
        tariff=new ProviderTariff();org.springframework.test.util.ReflectionTestUtils.setField(tariff,"id",38L);tariff.setUserId(35L);tariff.setServiceKey("custom:1:hourly");
        tariff.setAmount(new BigDecimal("35.00"));tariff.setCurrency("EUR");tariff.setPricingModel(PricingModel.HOURLY);
        offer.setTariff(tariff);offer.setLabel("Prestation à l’heure");
        when(providers.findById(27L)).thenReturn(Optional.of(provider));
        when(offers.findAllByProviderIdWithCategory(27L)).thenReturn(List.of(offer));
    }
    BaitlyProviderEditing.Command command(Long offerId) {
        return new BaitlyProviderEditing.Command("Salma Chraibi","","Ménage","Présentation","123","", "Marrakech","40000","ma",15,List.of("fr","ar"),true,
                List.of(new BaitlyProviderEditing.Reference(offerId,"cleaning-turnover")));
    }
    void catalogue() {
        var category=new MarketplaceServiceCategory();category.setCode("CLEANING");
        var item=new MarketplaceServiceItem();item.setCode("cleaning-turnover");item.setCategory(category);
        when(items.findByCode("cleaning-turnover")).thenReturn(Optional.of(item));
    }
    @Test void repairsTheReferenceWithoutCopyingOrChangingThePrice() {
        catalogue();editing.update(27L,command(32L),"admin");
        assertThat(offer.getServiceItem().getCode()).isEqualTo("cleaning-turnover");
        assertThat(tariff.getServiceKey()).isEqualTo("cleaning-turnover");
        assertThat(tariff.getAmount()).isEqualByComparingTo("35.00");
        assertThat(tariff.getPricingModel()).isEqualTo(PricingModel.HOURLY);
        assertThat(provider.getBaseCountryCode()).isEqualTo("MA");
        verify(journal).record(27L,"PROFILE_EDIT","Salma","Salma Chraibi","admin");
    }
    @Test void refusesAnOfferOwnedByAnotherProfile() {
        assertThatThrownBy(() -> editing.update(27L,command(99L),"admin")).isInstanceOf(AccessDeniedException.class);
        verify(offers,never()).save(any());verify(providers,never()).save(any());
    }
    @Test void neverOverwritesAnExistingCanonicalTariff() {
        catalogue();var existing=new ProviderTariff();org.springframework.test.util.ReflectionTestUtils.setField(existing,"id",100L);
        when(tariffs.findByUserIdAndServiceKey(35L,"cleaning-turnover")).thenReturn(Optional.of(existing));
        assertThatThrownBy(() -> editing.update(27L,command(32L),"admin")).isInstanceOf(IllegalArgumentException.class);
        assertThat(tariff.getServiceKey()).isEqualTo("custom:1:hourly");verify(tariffs,never()).save(any());
    }
    MarketplaceServiceItem item(String code,String categoryCode) {
        var category=new MarketplaceServiceCategory();category.setCode(categoryCode);
        var item=new MarketplaceServiceItem();item.setCode(code);item.setCategory(category);item.setLabelFr(code);
        return item;
    }
    @Test void selectsSeveralTradesAndPreservesExistingPrices() {
        var cleaning=item("cleaning-turnover","CLEANING");offer.setServiceItem(cleaning);offer.setCategory(cleaning.getCategory());
        tariff.setEnabled(true);
        when(items.findByCode("cleaning-turnover")).thenReturn(Optional.of(cleaning));
        when(items.findByCode("culinary-breakfast")).thenReturn(Optional.of(item("culinary-breakfast","CULINARY")));
        editing.selectServices(27L,new BaitlyProviderEditing.Services(List.of("cleaning-turnover","culinary-breakfast")),"admin");
        assertThat(offer.isActive()).isTrue();assertThat(offer.getAmount()).isEqualByComparingTo("35.00");
        var saved=ArgumentCaptor.forClass(MarketplaceProviderOffer.class);verify(offers,times(2)).save(saved.capture());
        var added=saved.getAllValues().get(1);assertThat(added.getCategory().getCode()).isEqualTo("CULINARY");
        assertThat(added.getPricingModel()).isEqualTo(PricingModel.ON_QUOTE);assertThat(added.getAmount()).isNull();
        verify(tariffs,never()).save(any());
    }
    @Test void uncheckingDeactivatesWithoutDeletingTheTariffOrCustomServices() {
        var cleaning=item("cleaning-turnover","CLEANING");offer.setServiceItem(cleaning);tariff.setEnabled(true);
        var custom=new MarketplaceProviderOffer();custom.setId(99L);custom.setLabel("Sur mesure");
        when(offers.findAllByProviderIdWithCategory(27L)).thenReturn(List.of(offer,custom));
        editing.selectServices(27L,new BaitlyProviderEditing.Services(List.of()),"admin");
        assertThat(offer.isActive()).isFalse();assertThat(custom.isActive()).isTrue();
        assertThat(tariff.getAmount()).isEqualByComparingTo("35.00");assertThat(tariff.isEnabled()).isTrue();
        verify(offers).save(offer);verify(offers,never()).delete(any());verify(tariffs,never()).save(any());
    }
    @Test void invalidSelectionDoesNotModifyAnyOffer() {
        assertThatThrownBy(() -> editing.selectServices(27L,new BaitlyProviderEditing.Services(List.of("unknown")),"admin"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(offers,never()).save(any());
    }
    @Test void refusesToBypassADisabledTariff() {
        var cleaning=item("cleaning-turnover","CLEANING");offer.setServiceItem(cleaning);tariff.setEnabled(false);
        when(items.findByCode("cleaning-turnover")).thenReturn(Optional.of(cleaning));
        assertThatThrownBy(() -> editing.selectServices(27L,new BaitlyProviderEditing.Services(List.of("cleaning-turnover")),"admin"))
            .isInstanceOf(IllegalArgumentException.class);
        verify(offers,never()).save(any());
    }
}
