package com.clenzy.service;

import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareOrder;
import com.clenzy.model.OrderStatus;
import com.clenzy.repository.HardwareOrderRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopServiceTest {

    @Mock private HardwareOrderRepository hardwareOrderRepository;

    private TenantContext tenantContext;
    private ObjectMapper objectMapper;
    private ShopService service;

    private static final Long ORG_ID = 1L;
    private static final String USER_KC_ID = "kc-user-1";
    private static final String EMAIL = "buyer@test.com";

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        objectMapper = new ObjectMapper();
        service = new ShopService(hardwareOrderRepository, tenantContext, objectMapper);
        ReflectionTestUtils.setField(service, "stripeSecretKey", "sk_test_dummy");
        ReflectionTestUtils.setField(service, "successUrl", "http://localhost/success");
        ReflectionTestUtils.setField(service, "cancelUrl", "http://localhost/cancel");
    }

    private ShopCheckoutRequest validRequest() {
        return new ShopCheckoutRequest(List.of(
                new ShopCheckoutRequest.CartItem("CLENZY-NM-01", 1)
        ));
    }

    @Nested
    @DisplayName("createCheckoutSession - validation errors")
    class Validation {

        @Test
        void whenItemsNull_thenThrows() {
            ShopCheckoutRequest req = new ShopCheckoutRequest(null);

            assertThatThrownBy(() -> service.createCheckoutSession(req, EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("vide");
        }

        @Test
        void whenItemsEmpty_thenThrows() {
            ShopCheckoutRequest req = new ShopCheckoutRequest(List.of());

            assertThatThrownBy(() -> service.createCheckoutSession(req, EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenQuantityZero_thenThrows() {
            ShopCheckoutRequest req = new ShopCheckoutRequest(List.of(
                    new ShopCheckoutRequest.CartItem("CLENZY-NM-01", 0)
            ));

            assertThatThrownBy(() -> service.createCheckoutSession(req, EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Quantite");
        }

        @Test
        void whenQuantityNegative_thenThrows() {
            ShopCheckoutRequest req = new ShopCheckoutRequest(List.of(
                    new ShopCheckoutRequest.CartItem("CLENZY-NM-01", -2)
            ));

            assertThatThrownBy(() -> service.createCheckoutSession(req, EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenUnknownSku_thenThrows() {
            ShopCheckoutRequest req = new ShopCheckoutRequest(List.of(
                    new ShopCheckoutRequest.CartItem("UNKNOWN-SKU", 1)
            ));

            assertThatThrownBy(() -> service.createCheckoutSession(req, EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("SKU inconnu");
        }

        @Test
        void whenNoTenantContext_thenThrows() {
            tenantContext.setOrganizationId(null);

            assertThatThrownBy(() -> service.createCheckoutSession(validRequest(), EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("createCheckoutSession - happy path with mocked Stripe")
    class HappyPath {

        @Test
        void whenValid_thenPersistsOrderAndReturnsSessionDetails() throws StripeException {
            Session session = mock(Session.class);
            when(session.getId()).thenReturn("cs_test_123");
            when(session.getUrl()).thenReturn("https://checkout.stripe.com/cs_test_123");
            when(hardwareOrderRepository.save(any(HardwareOrder.class))).thenAnswer(inv -> {
                HardwareOrder o = inv.getArgument(0);
                if (o.getId() == null) o.setId(42L);
                return o;
            });

            try (MockedStatic<Session> stripeSession = mockStatic(Session.class)) {
                stripeSession.when(() -> Session.create(any(SessionCreateParams.class)))
                        .thenReturn(session);

                Map<String, String> result = service.createCheckoutSession(
                        new ShopCheckoutRequest(List.of(
                                new ShopCheckoutRequest.CartItem("CLENZY-NM-01", 2),
                                new ShopCheckoutRequest.CartItem("KIT-ESSENTIAL", 1)
                        )),
                        EMAIL, USER_KC_ID
                );

                assertThat(result).containsEntry("sessionId", "cs_test_123");
                assertThat(result).containsEntry("url", "https://checkout.stripe.com/cs_test_123");
                // Saved twice: once for PENDING order, once with stripe session id
                verify(hardwareOrderRepository, times(2)).save(any(HardwareOrder.class));
            }
        }

        @Test
        void whenStripeThrows_thenPropagatesException() throws StripeException {
            when(hardwareOrderRepository.save(any(HardwareOrder.class))).thenAnswer(inv -> {
                HardwareOrder o = inv.getArgument(0);
                if (o.getId() == null) o.setId(1L);
                return o;
            });

            try (MockedStatic<Session> stripeSession = mockStatic(Session.class)) {
                StripeException err = mock(StripeException.class);
                stripeSession.when(() -> Session.create(any(SessionCreateParams.class)))
                        .thenThrow(err);

                assertThatThrownBy(() -> service.createCheckoutSession(validRequest(), EMAIL, USER_KC_ID))
                        .isInstanceOf(StripeException.class);
            }
        }
    }

    @Nested
    @DisplayName("completeOrder")
    class CompleteOrder {

        @Test
        void whenOrderMissing_thenNoop() {
            when(hardwareOrderRepository.findByStripeSessionId("missing")).thenReturn(Optional.empty());

            service.completeOrder("missing");

            verify(hardwareOrderRepository, times(0)).save(any());
        }

        @Test
        void whenAlreadyPaid_thenIdempotentNoSave() {
            HardwareOrder paid = new HardwareOrder();
            paid.setId(1L);
            paid.setStatus(OrderStatus.PAID);
            when(hardwareOrderRepository.findByStripeSessionId("cs_x"))
                    .thenReturn(Optional.of(paid));

            service.completeOrder("cs_x");

            verify(hardwareOrderRepository, times(0)).save(any());
        }

        @Test
        void whenStripeRetrieveFails_thenStillMarksPaid() {
            HardwareOrder pending = new HardwareOrder();
            pending.setId(2L);
            pending.setStatus(OrderStatus.PENDING);
            when(hardwareOrderRepository.findByStripeSessionId("cs_y"))
                    .thenReturn(Optional.of(pending));

            try (MockedStatic<Session> stripeSession = mockStatic(Session.class)) {
                stripeSession.when(() -> Session.retrieve("cs_y"))
                        .thenThrow(new RuntimeException("stripe down"));

                service.completeOrder("cs_y");

                assertThat(pending.getStatus()).isEqualTo(OrderStatus.PAID);
                verify(hardwareOrderRepository).save(pending);
            }
        }

        @Test
        void whenStripeRetrieveReturnsSessionWithPaymentIntent_thenStoresIt() {
            HardwareOrder pending = new HardwareOrder();
            pending.setId(3L);
            pending.setStatus(OrderStatus.PENDING);
            Session session = mock(Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_test_123");
            when(session.getShippingDetails()).thenReturn(null);
            when(hardwareOrderRepository.findByStripeSessionId("cs_z"))
                    .thenReturn(Optional.of(pending));

            try (MockedStatic<Session> stripeSession = mockStatic(Session.class)) {
                stripeSession.when(() -> Session.retrieve("cs_z")).thenReturn(session);

                service.completeOrder("cs_z");

                assertThat(pending.getStatus()).isEqualTo(OrderStatus.PAID);
                assertThat(pending.getStripePaymentIntentId()).isEqualTo("pi_test_123");
            }
        }
    }

    @Nested
    @DisplayName("getOrders")
    class GetOrders {

        @Test
        void whenCalled_thenReturnsOrdersOrderedByCreatedDesc() {
            HardwareOrder o1 = new HardwareOrder();
            o1.setId(1L);
            HardwareOrder o2 = new HardwareOrder();
            o2.setId(2L);
            when(hardwareOrderRepository.findByOrganizationIdOrderByCreatedAtDesc(ORG_ID))
                    .thenReturn(List.of(o2, o1));

            List<HardwareOrder> result = service.getOrders();

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getId()).isEqualTo(2L);
        }

        @Test
        void whenNoOrders_thenEmptyList() {
            when(hardwareOrderRepository.findByOrganizationIdOrderByCreatedAtDesc(ORG_ID))
                    .thenReturn(List.of());

            assertThat(service.getOrders()).isEmpty();
        }
    }
}
