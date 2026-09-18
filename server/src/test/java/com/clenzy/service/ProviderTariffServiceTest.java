package com.clenzy.service;

import com.clenzy.marketplace.model.PricingModel;
import com.clenzy.model.ProviderTariff;
import com.clenzy.repository.ProviderTariffRepository;
import com.clenzy.service.pricing.ProviderTariffService;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProviderTariffServiceTest {
    final ProviderTariffRepository repository = mock(ProviderTariffRepository.class);
    final ProviderTariffService service = new ProviderTariffService(repository, com.clenzy.service.CatalogTestFixture.reference());

    @Test void rejectsInvalidAmountsAndCurrenciesBeforeLockingOrWriting() {
        for (String amount : new String[]{"-1", "1000001", "12.001"})
            assertThatThrownBy(() -> service.set(1L,"cleaning-turnover",PricingModel.HOURLY,new BigDecimal(amount),"EUR",true))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.set(1L,"cleaning-turnover",PricingModel.HOURLY,BigDecimal.ONE,"INVALID",true))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository);
    }
    @Test void resolvingConflictUpdatesSameReferenceAfterTakingUserLock() {
        var tariff = new ProviderTariff();tariff.setNeedsReview(true);
        when(repository.findByUserIdAndServiceKey(1L,"cleaning-turnover")).thenReturn(Optional.of(tariff));
        service.set(1L,"cleaning-turnover",PricingModel.HOURLY,new BigDecimal("35"),"MAD",true);
        var order=inOrder(repository);order.verify(repository).lockUser(1L);
        order.verify(repository).findByUserIdAndServiceKey(1L,"cleaning-turnover");order.verify(repository).save(tariff);
        assertThat(tariff.getAmount()).isEqualByComparingTo("35");
        assertThat(tariff.getCurrency()).isEqualTo("MAD");assertThat(tariff.isNeedsReview()).isFalse();
    }
    @Test void billingUnitIsRequiredAndStoredAlongsidePrice() {
        assertThatThrownBy(() -> service.set(1L,"laundry-bed-linen",PricingModel.PER_UNIT,BigDecimal.TEN,"EUR",true))
            .isInstanceOf(IllegalArgumentException.class);
        service.set(1L,"laundry-bed-linen",PricingModel.PER_UNIT,BigDecimal.TEN,"EUR",true,"kg");
        verify(repository).save(argThat(t->t.getUnitLabel().equals("kg") && t.getAmount().compareTo(BigDecimal.TEN)==0));
    }
}
