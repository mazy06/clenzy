package com.clenzy.payment.subscription;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentCapability;
import com.clenzy.payment.PaymentResult;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

class StripeBillingSubscriptionProviderTest {

    private StripeBillingSubscriptionProvider provider;

    @BeforeEach
    void setUp() {
        provider = new StripeBillingSubscriptionProvider();
        ReflectionTestUtils.setField(provider, "secretKey", "sk_test_xxx");
    }

    private SubscriptionCheckoutRequest request(boolean embedded) {
        return new SubscriptionCheckoutRequest(
            1200L, "EUR", SubscriptionInterval.MONTH, 1L,
            "Baitly - Forfait", "Abonnement mensuel",
            "u@e.com", null, embedded,
            "https://return", embedded ? null : "https://cancel",
            null, Map.of("type", "inscription"));
    }

    @Test
    void capabilities_includeRecurring() {
        assertThat(provider.getProviderType()).isEqualTo(PaymentProviderType.STRIPE);
        assertThat(provider.getCapabilities()).contains(PaymentCapability.RECURRING);
        assertThat(provider.supports(PaymentCapability.RECURRING)).isTrue();
    }

    @Test
    void embedded_returnsClientSecret_inSubscriptionMode() {
        Session session = mock(Session.class);
        when(session.getId()).thenReturn("cs_sub_emb");
        when(session.getClientSecret()).thenReturn("cs_sub_emb_secret");

        try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
            ArgumentCaptor<SessionCreateParams> params = ArgumentCaptor.forClass(SessionCreateParams.class);
            sessionStatic.when(() -> Session.create(params.capture(), any())).thenReturn(session);

            PaymentResult result = provider.createSubscriptionCheckout(request(true));

            assertThat(result.success()).isTrue();
            assertThat(result.clientSecret()).isEqualTo("cs_sub_emb_secret");
            assertThat(result.redirectUrl()).isNull();
            SessionCreateParams captured = params.getValue();
            assertThat(captured.getMode()).isEqualTo(SessionCreateParams.Mode.SUBSCRIPTION);
            assertThat(captured.getUiMode()).isEqualTo(SessionCreateParams.UiMode.EMBEDDED);
            assertThat(captured.getLineItems().get(0).getPriceData().getRecurring().getInterval())
                    .isEqualTo(SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH);
            // Metadata posée sur session + subscription.
            assertThat(captured.getMetadata()).containsEntry("type", "inscription");
            assertThat(captured.getSubscriptionData().getMetadata()).containsEntry("type", "inscription");
        }
    }

    @Test
    void hosted_returnsRedirectUrl() {
        Session session = mock(Session.class);
        when(session.getId()).thenReturn("cs_sub_host");
        when(session.getUrl()).thenReturn("https://checkout.stripe/cs_sub_host");

        try (MockedStatic<Session> sessionStatic = mockStatic(Session.class)) {
            sessionStatic.when(() -> Session.create(any(SessionCreateParams.class), any())).thenReturn(session);

            PaymentResult result = provider.createSubscriptionCheckout(request(false));

            assertThat(result.success()).isTrue();
            assertThat(result.redirectUrl()).isEqualTo("https://checkout.stripe/cs_sub_host");
            assertThat(result.clientSecret()).isNull();
        }
    }
}
