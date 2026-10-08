package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.stripe.model.Account;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyBillingCountryTest {
    @Test void localPriceGridsAndOperatingCountriesRemainDistinct() {
        var pricing=new BaitlyMonthlyPricing();
        assertThat(pricing.quote(BaitlyMonthlyPricing.Plan.essential,BaitlyMonthlyPricing.marketForCountry("FR"),1,1).totalCents()).isEqualTo(2900);
        assertThat(pricing.quote(BaitlyMonthlyPricing.Plan.essential,BaitlyMonthlyPricing.marketForCountry("MA"),1,1).totalCents()).isEqualTo(29000);
        assertThat(pricing.quote(BaitlyMonthlyPricing.Plan.essential,BaitlyMonthlyPricing.marketForCountry("SA"),1,1).totalCents()).isEqualTo(10900);
        assertThat(BaitlyBillingCountry.sellerCountry("BE")).isEqualTo("FR");
        assertThat(BaitlyBillingCountry.sellerCountry("MA")).isEqualTo("MA");assertThat(BaitlyBillingCountry.sellerCountry("SA")).isEqualTo("SA");
        assertThatThrownBy(()->BaitlyBillingCountry.normalize(null)).hasMessageContaining("pays");
    }
    @Test void aFrenchStripeAccountCannotSilentlyBillForMoroccanOrSaudiEntity()throws Exception {
        var gateway=spy(new StripeGateway("sk_test_unused"));var account=new Account();account.setId("acct_fr");account.setCountry("FR");
        doReturn(account).when(gateway).retrievePlatformAccount();
        assertThat(gateway.requireSubscriptionSellerCountry("FR")).isEqualTo("acct_fr");
        assertThatThrownBy(()->gateway.requireSubscriptionSellerCountry("MA")).hasMessageContaining("Baitly MA");
        assertThatThrownBy(()->gateway.requireSubscriptionSellerCountry("SA")).hasMessageContaining("Baitly SA");
        assertThatThrownBy(()->gateway.verifySubscriptionSeller("FR","acct_other")).hasMessageContaining("contrat");
    }
    @Test void sameCurrencyDoesNotPermitChangingBillingCountryAfterPayment() {
        var order=BaitlyMonthlySubscriptionTest.order();order.setBillingCountry("FR");
        var session=BaitlyMonthlySubscriptionTest.paid();var details=new com.stripe.model.checkout.Session.CustomerDetails();
        var address=new com.stripe.model.Address();address.setCountry("BE");details.setAddress(address);session.setCustomerDetails(details);
        assertThatThrownBy(()->BaitlyMonthlySubscriptionService.verify(order,session)).hasMessageContaining("pays");
        address.setCountry("FR");assertThatCode(()->BaitlyMonthlySubscriptionService.verify(order,session)).doesNotThrowAnyException();
    }
}
