package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.PricingModel;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class BaitlyCatalogCurrencyTest {
    @Test
    void priceCurrencyBelongsToTheDisplayedOfferAndCountryDoesNotRelabelIt() {
        var provider = new MarketplaceProvider();
        provider.setBaseCountryCode("MA");
        provider.setCurrency("MAD");
        var expensive = offer("350", "MAD");
        var lowest = offer("100.00", "EUR");
        var result = CatalogProviderDto.from(provider, null, List.of(), List.of(),
                List.of(expensive, lowest), new BigDecimal("100"), false);
        assertThat(result.baseCountryCode()).isEqualTo("MA");
        assertThat(result.priceFrom()).isEqualByComparingTo("100");
        assertThat(result.currency()).isEqualTo("EUR");
    }

    private ProviderOfferDto offer(String amount, String currency) {
        return new ProviderOfferDto(1L, "cleaning", null, null, null, "Ménage", null,
                PricingModel.FLAT, new BigDecimal(amount), currency, null, null,
                true, null, null, null, false);
    }
}
