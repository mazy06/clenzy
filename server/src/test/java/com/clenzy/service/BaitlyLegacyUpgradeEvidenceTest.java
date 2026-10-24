package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.subscription.SubscriptionProviderRegistry;
import com.clenzy.repository.UserRepository;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyLegacyUpgradeEvidenceTest {
    @Mock UserRepository users;
    @Mock AuditLogService audit;
    @Mock PricingConfigService prices;
    @Mock StripeGateway stripe;
    @Mock SubscriptionProviderRegistry providers;
    SubscriptionService service;

    @BeforeEach void setup() { service = new SubscriptionService(users, audit, prices, stripe, providers); }

    private Session session() {
        Session s = new Session();
        s.setId("cs_synthetic"); s.setStatus("complete"); s.setPaymentStatus("paid");
        s.setMode("subscription"); s.setCustomer("cus_synthetic"); s.setSubscription("sub_new");
        s.setAmountTotal(3000L); s.setAmountSubtotal(3000L); s.setCurrency("eur");
        s.setMetadata(new HashMap<>(Map.of("type", "upgrade", "userId", "1", "forfait", "premium",
                "previousForfait", "confort", "previousSubscriptionId", "sub_old", "expectedAmount", "3000", "currency", "EUR")));
        return s;
    }
    private User payer() {
        User u = new User(); u.setId(1L); u.setEmail("private@example.invalid");
        u.setForfait("confort"); u.setStripeCustomerId("cus_synthetic"); u.setStripeSubscriptionId("sub_old");
        return u;
    }
    private Subscription subscription(String id, String customer, String status) {
        Subscription s = new Subscription(); s.setId(id); s.setCustomer(customer); s.setStatus(status); return s;
    }
    private void arrange(Session s, User u) throws Exception {
        when(stripe.retrieveSession("cs_synthetic")).thenReturn(s);
        when(users.lockSubscriptionPayer(1L)).thenReturn(Optional.of(u));
    }
    private void noEntitlementOrCancellation() throws Exception {
        verify(users, never()).save(any()); verifyNoInteractions(audit);
        verify(stripe, never()).cancelSubscription(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"wrong-total", "wrong-subtotal", "missing-total", "missing-subtotal",
            "wrong-currency", "missing-currency", "missing-expected", "invalid-expected", "zero-expected", "negative-expected"})
    void amountOrCurrencyMismatchCannotGrantAccessOrCancelPreviousSubscription(String scenario) throws Exception {
        Session s = session();
        switch (scenario) {
            case "wrong-total" -> s.setAmountTotal(1L);
            case "wrong-subtotal" -> s.setAmountSubtotal(1L);
            case "missing-total" -> s.setAmountTotal(null);
            case "missing-subtotal" -> s.setAmountSubtotal(null);
            case "wrong-currency" -> s.setCurrency("usd");
            case "missing-currency" -> s.getMetadata().remove("currency");
            case "missing-expected" -> s.getMetadata().remove("expectedAmount");
            case "invalid-expected" -> s.getMetadata().put("expectedAmount", "invalid");
            case "zero-expected" -> s.getMetadata().put("expectedAmount", "0");
            case "negative-expected" -> s.getMetadata().put("expectedAmount", "-3000");
        }
        User u = payer(); arrange(s, u);
        assertThatThrownBy(() -> service.completeUpgrade(s.getId())).isInstanceOf(IllegalStateException.class);
        assertThat(u.getForfait()).isEqualTo("confort");
        assertThat(u.getStripeSubscriptionId()).isEqualTo("sub_old");
        verify(stripe, never()).retrieveSubscription(anyString());
        noEntitlementOrCancellation();
    }

    @ParameterizedTest @ValueSource(strings = {"newer-subscription", "changed-plan"})
    void lateCheckoutCannotReplaceNewerSubscriptionOrRegressPlan(String scenario) throws Exception {
        Session s = session(); User u = payer();
        if (scenario.equals("newer-subscription")) u.setStripeSubscriptionId("sub_newer");
        else u.setForfait("premium");
        arrange(s, u);
        service.completeUpgrade(s.getId());
        verify(stripe, never()).retrieveSubscription(anyString());
        noEntitlementOrCancellation();
    }

    @ParameterizedTest
    @ValueSource(strings = {"open", "unpaid", "wrong-mode", "wrong-customer", "missing-subscription", "missing-customer"})
    void unconfirmedOrForeignCheckoutNeverChangesEntitlements(String scenario) throws Exception {
        Session s = session();
        switch (scenario) {
            case "open" -> s.setStatus("open");
            case "unpaid" -> s.setPaymentStatus("unpaid");
            case "wrong-mode" -> s.setMode("payment");
            case "wrong-customer" -> s.setCustomer("cus_other");
            case "missing-subscription" -> s.setSubscription((String) null);
            case "missing-customer" -> s.setCustomer((String) null);
        }
        User u = payer(); arrange(s, u);
        assertThatThrownBy(() -> service.completeUpgrade(s.getId())).isInstanceOf(IllegalStateException.class);
        verify(stripe, never()).retrieveSubscription(anyString());
        noEntitlementOrCancellation();
    }

    @ParameterizedTest @ValueSource(strings = {"past_due", "canceled", "incomplete", "unpaid", "trialing"})
    void inactiveReplacementNeverCancelsPaidContract(String state) throws Exception {
        Session s = session(); User u = payer(); arrange(s, u);
        when(stripe.retrieveSubscription("sub_new")).thenReturn(subscription("sub_new", s.getCustomer(), state));
        assertThatThrownBy(() -> service.completeUpgrade(s.getId())).isInstanceOf(IllegalStateException.class);
        verify(stripe, never()).retrieveSubscription("sub_old");
        noEntitlementOrCancellation();
    }

    @Test void replacementFromAnotherCustomerIsRejectedBeforeCancellation() throws Exception {
        Session s = session(); User u = payer(); arrange(s, u);
        when(stripe.retrieveSubscription("sub_new")).thenReturn(subscription("sub_new", "cus_other", "active"));
        assertThatThrownBy(() -> service.completeUpgrade(s.getId())).isInstanceOf(IllegalStateException.class);
        noEntitlementOrCancellation();
    }

    @Test void previousSubscriptionFromAnotherCustomerCannotBeCancelled() throws Exception {
        Session s = session(); User u = payer(); arrange(s, u);
        when(stripe.retrieveSubscription("sub_new")).thenReturn(subscription("sub_new", s.getCustomer(), "active"));
        when(stripe.retrieveSubscription("sub_old")).thenReturn(subscription("sub_old", "cus_other", "active"));
        assertThatThrownBy(() -> service.completeUpgrade(s.getId())).isInstanceOf(IllegalStateException.class);
        noEntitlementOrCancellation();
    }

    @Test void verifiedUpgradeIsIdempotentIncludingAuditAndCancellation() throws Exception {
        Session s = session(); User u = payer(); arrange(s, u);
        when(stripe.retrieveSubscription("sub_new")).thenReturn(subscription("sub_new", s.getCustomer(), "active"));
        Subscription previous = subscription("sub_old", s.getCustomer(), "active");
        when(stripe.retrieveSubscription("sub_old")).thenReturn(previous);
        service.completeUpgrade(s.getId());
        service.completeUpgrade(s.getId());
        assertThat(u.getForfait()).isEqualTo("premium");
        assertThat(u.getStripeSubscriptionId()).isEqualTo("sub_new");
        verify(users, times(1)).save(u);
        verify(audit, times(1)).logSync(eq("SubscriptionUpgrade"), eq("1"), argThat(value -> !value.contains("private@")));
        verify(stripe, times(1)).cancelSubscription(eq(previous), any());
        verify(stripe, times(1)).retrieveSubscription("sub_new");
    }

    @ParameterizedTest @ValueSource(strings = {"session-id", "missing-metadata", "missing-user", "missing-plan"})
    void incompleteSessionFailsClosed(String scenario) throws Exception {
        Session s = session();
        switch (scenario) {
            case "session-id" -> s.setId("cs_other");
            case "missing-metadata" -> s.setMetadata(null);
            case "missing-user" -> s.getMetadata().remove("userId");
            case "missing-plan" -> s.getMetadata().remove("forfait");
        }
        when(stripe.retrieveSession("cs_synthetic")).thenReturn(s);
        assertThatThrownBy(() -> service.completeUpgrade("cs_synthetic")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(users, audit);
    }
}
