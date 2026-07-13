package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.dto.ShopCheckoutRequest;
import com.clenzy.model.HardwareOrder;
import com.clenzy.model.OrderStatus;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.payment.PaymentResult;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.HardwareOrderRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopServiceTest {

    @Mock private HardwareOrderRepository hardwareOrderRepository;
    @Mock private StripeGateway stripeGateway;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private PlatformTransactionManager transactionManager;

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
        service = new ShopService(hardwareOrderRepository, tenantContext, objectMapper, stripeGateway,
                orchestrationService, transactionManager);
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
    @DisplayName("createCheckoutSession - happy path via orchestrateur")
    class HappyPath {

        @Test
        void whenValid_thenPersistsOrderAndRoutesThroughOrchestrator() {
            when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            when(hardwareOrderRepository.save(any(HardwareOrder.class))).thenAnswer(inv -> {
                HardwareOrder o = inv.getArgument(0);
                if (o.getId() == null) o.setId(42L);
                return o;
            });
            when(hardwareOrderRepository.findById(42L)).thenAnswer(inv -> {
                HardwareOrder o = new HardwareOrder();
                o.setId(42L);
                return Optional.of(o);
            });
            when(orchestrationService.initiatePayment(any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null,
                            PaymentResult.success("cs_test_123", "https://checkout.stripe.com/cs_test_123"),
                            PaymentProviderType.STRIPE));

            Map<String, String> result = service.createCheckoutSession(
                    new ShopCheckoutRequest(List.of(
                            new ShopCheckoutRequest.CartItem("CLENZY-NM-01", 2),
                            new ShopCheckoutRequest.CartItem("KIT-ESSENTIAL", 1)
                    )),
                    EMAIL, USER_KC_ID
            );

            assertThat(result).containsEntry("sessionId", "cs_test_123");
            assertThat(result).containsEntry("url", "https://checkout.stripe.com/cs_test_123");
            // Sauvé deux fois : commande PENDING, puis rattachement de la réf de session.
            verify(hardwareOrderRepository, times(2)).save(any(HardwareOrder.class));

            // Provider épinglé Stripe + shipping + metadata via la requête d'orchestration.
            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                    ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(reqCaptor.capture());
            PaymentOrchestrationRequest req = reqCaptor.getValue();
            assertThat(req.sourceType()).isEqualTo(ShopService.SOURCE_TYPE);
            assertThat(req.sourceId()).isEqualTo(42L);
            assertThat(req.preferredProvider()).isEqualTo(PaymentProviderType.STRIPE);
            assertThat(req.shippingAddressCountries()).contains("FR", "MA");
            assertThat(req.metadata())
                    .containsEntry("type", "hardware_purchase")
                    .containsEntry("user_id", USER_KC_ID);
        }

        @Test
        void whenOrchestratorFails_thenThrows() {
            when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            when(hardwareOrderRepository.save(any(HardwareOrder.class))).thenAnswer(inv -> {
                HardwareOrder o = inv.getArgument(0);
                if (o.getId() == null) o.setId(1L);
                return o;
            });
            when(orchestrationService.initiatePayment(any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null, PaymentResult.failure("Stripe down"), null));

            assertThatThrownBy(() -> service.createCheckoutSession(validRequest(), EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Echec de creation");
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
        void whenStripeRetrieveFails_thenStillMarksPaid() throws StripeException {
            HardwareOrder pending = new HardwareOrder();
            pending.setId(2L);
            pending.setStatus(OrderStatus.PENDING);
            when(hardwareOrderRepository.findByStripeSessionId("cs_y"))
                    .thenReturn(Optional.of(pending));

            when(stripeGateway.retrieveSession("cs_y")).thenThrow(new RuntimeException("stripe down"));

            service.completeOrder("cs_y");

            assertThat(pending.getStatus()).isEqualTo(OrderStatus.PAID);
            verify(hardwareOrderRepository).save(pending);
        }

        @Test
        void whenStripeRetrieveReturnsSessionWithPaymentIntent_thenStoresIt() throws StripeException {
            HardwareOrder pending = new HardwareOrder();
            pending.setId(3L);
            pending.setStatus(OrderStatus.PENDING);
            Session session = mock(Session.class);
            when(session.getPaymentIntent()).thenReturn("pi_test_123");
            when(session.getShippingDetails()).thenReturn(null);
            when(hardwareOrderRepository.findByStripeSessionId("cs_z"))
                    .thenReturn(Optional.of(pending));

            when(stripeGateway.retrieveSession("cs_z")).thenReturn(session);

            service.completeOrder("cs_z");

            assertThat(pending.getStatus()).isEqualTo(OrderStatus.PAID);
            assertThat(pending.getStripePaymentIntentId()).isEqualTo("pi_test_123");
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
