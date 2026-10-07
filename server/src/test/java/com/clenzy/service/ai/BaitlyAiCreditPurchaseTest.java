package com.clenzy.service.ai;

import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.dto.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.PaymentOrchestrationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyAiCreditPurchaseTest {
    PaymentTransaction tx;
    @BeforeEach void setup() {
        tx=new PaymentTransaction();tx.setOrganizationId(7L);tx.setSourceId(7L);tx.setSourceType(AiCreditPurchaseService.SOURCE_TYPE);
        tx.setPaymentType(TransactionType.CHECKOUT);tx.setStatus(TransactionStatus.COMPLETED);tx.setProviderTxId("cs_pack");
        tx.setCurrency("EUR");tx.setAmount(new BigDecimal("12"));tx.setMetadata(new HashMap<>(Map.of("pack_key","pack_500","millicredits","500000")));
    }
    @Test void grantsExactPurchasedPack() { assertThat(AiCreditPurchaseService.purchasedMillicredits(tx)).isEqualTo(500000L); }
    @Test void rejectsCreditsReassignedToAnotherOrganization() { tx.setSourceId(8L);reject(); }
    @Test void rejectsInflatedCredits() { tx.getMetadata().put("millicredits","10000000");reject(); }
    @Test void rejectsWrongCurrency() { tx.setCurrency("SAR");reject(); }
    @Test void rejectsUnpaid() { tx.setStatus(TransactionStatus.PROCESSING);reject(); }
    @Test void rejectsWrongPrice() { tx.setAmount(new BigDecimal("0.01"));reject(); }
    @Test void rejectsRefundRecord() { tx.setPaymentType(TransactionType.REFUND);reject(); }
    @Test void checkoutUsesSelectedTenantAndStableRequestIdWithFixedEuroPrice() throws Exception {
        var users=mock(UserRepository.class);var orchestration=mock(PaymentOrchestrationService.class);var tenant=new TenantContext();tenant.setOrganizationId(7L);
        var organizations=mock(com.clenzy.repository.OrganizationRepository.class);var stripe=mock(com.clenzy.payment.StripeGateway.class);
        var organization=new Organization();organization.setBillingCountry("FR");when(organizations.findById(7L)).thenReturn(Optional.of(organization));when(stripe.requireSubscriptionSellerCountry("FR")).thenReturn("acct_baitly");
        var service=new AiCreditPurchaseService(users,orchestration,tenant,organizations,stripe,mock(com.clenzy.service.BaitlyPlatformCommerce.class));
        org.springframework.test.util.ReflectionTestUtils.setField(service,"frontendUrl","http://localhost:3000");
        var user=new User();user.setOrganizationId(2L);user.setEmail("sandbox@example.test");when(users.findByKeycloakId("staff")).thenReturn(Optional.of(user));
        when(orchestration.initiatePayment(eq(7L),eq("FR"),any())).thenReturn(new PaymentOrchestrationResult(null,PaymentResult.success("cs_pack","https://checkout.stripe.com/test"),PaymentProviderType.STRIPE));
        UUID requestId=UUID.randomUUID();service.createTopUpCheckout("staff","pack_500",requestId);service.createTopUpCheckout("staff","pack_500",requestId);
        var capture=org.mockito.ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);verify(orchestration,times(2)).initiatePayment(eq(7L),eq("FR"),capture.capture());
        assertThat(capture.getAllValues()).allSatisfy(r->{assertThat(r.sourceId()).isEqualTo(7L);assertThat(r.currency()).isEqualTo("EUR");assertThat(r.amount()).isEqualByComparingTo("12");assertThat(r.idempotencyKey()).isEqualTo("BAITLY-AI-7-"+requestId);});
    }
    private void reject() { assertThatThrownBy(()->AiCreditPurchaseService.purchasedMillicredits(tx)).isInstanceOf(IllegalStateException.class); }
}
