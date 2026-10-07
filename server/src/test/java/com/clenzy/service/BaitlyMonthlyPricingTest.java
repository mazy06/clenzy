package com.clenzy.service;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static com.clenzy.service.BaitlyMonthlyPricing.*;

class BaitlyMonthlyPricingTest {
    private final BaitlyMonthlyPricing pricing=new BaitlyMonthlyPricing();
    @Test void volumeIsMarginalAndLoyaltyStartsOnTheAdvertisedMonth() {
        assertThat(pricing.quote(Plan.essential,Market.EU,5,3).totalCents()).isEqualTo(14210);
        assertThat(pricing.quote(Plan.essential,Market.EU,5,4).totalCents()).isEqualTo(12789);
        assertThat(pricing.quote(Plan.essential,Market.EU,5,7).totalCents()).isEqualTo(11368);
        assertThat(pricing.quote(Plan.essential,Market.EU,5,13).totalCents()).isEqualTo(9947);
    }
    @Test void allMarketsAreFixedPricesWithoutFx() {
        assertThat(pricing.quote(Plan.pro,Market.MA,1,1).totalCents()).isEqualTo(49000);
        assertThat(pricing.quote(Plan.pro,Market.SA,1,1).totalCents()).isEqualTo(18900);
        assertThat(pricing.quote(Plan.pro,Market.EU,1,1).totalCents()).isEqualTo(4900);
    }
    @Test void discountsNeverRepriceEarlierBands() {
        var quote=pricing.quote(Plan.essential,Market.EU,20,1);
        assertThat(quote.bands()).extracting(Band::count).containsExactly(4,5,10,1);
        assertThat(quote.volumeCents()).isEqualTo(51620);
        assertThat(quote.totalCents()).isEqualTo(51620);
    }
    @Test void quoteRequiresValidCapacityAndTenure() {
        for(int count:new int[]{0,-1,50,Integer.MAX_VALUE})
            assertThatThrownBy(()->pricing.quote(Plan.pro,Market.EU,count,1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->pricing.quote(Plan.pro,Market.EU,1,0)).isInstanceOf(IllegalArgumentException.class);
    }
}
