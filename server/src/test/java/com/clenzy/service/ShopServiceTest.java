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
    @Mock private com.clenzy.repository.PaymentTransactionRepository payments;
    @Mock private PaymentOrchestrationService orchestrationService;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private BaitlyPurchaseRequests requests;
    @Mock private com.clenzy.repository.OrganizationRepository organizations;

    private TenantContext tenantContext;
    private ObjectMapper objectMapper;
    private ShopService service;

    private static final Long ORG_ID = 1L;
    private static final String USER_KC_ID = "kc-user-1";
    private static final String EMAIL = "buyer@test.com";

    @BeforeEach
    void setUp() throws Exception {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        objectMapper = new ObjectMapper();
        org.mockito.Mockito.lenient().when(stripeGateway.requireSubscriptionSellerCountry("FR")).thenReturn("acct_baitly");
        var organization=new com.clenzy.model.Organization();organization.setBillingCountry("FR");org.mockito.Mockito.lenient().when(organizations.findById(ORG_ID)).thenReturn(java.util.Optional.of(organization));
        org.mockito.Mockito.lenient().when(requests.prepare(any(),any(),any(),any(),any(),any())).thenAnswer(inv->((java.util.function.Supplier<Long>)inv.getArgument(5)).get());

        service = new ShopService(hardwareOrderRepository, tenantContext, objectMapper, stripeGateway,
                orchestrationService, transactionManager, payments,org.mockito.Mockito.mock(BaitlyHardwareInventory.class),requests,organizations,org.mockito.Mockito.mock(BaitlyPlatformCommerce.class));
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

        @Test void excessiveQuantityCannotOverflowTheChargedAmount() {
            var req=new ShopCheckoutRequest(List.of(new ShopCheckoutRequest.CartItem("CLENZY-NM-01",Integer.MAX_VALUE)));
            assertThatThrownBy(()->service.createCheckoutSession(req,EMAIL,USER_KC_ID)).isInstanceOf(IllegalArgumentException.class);
            verify(hardwareOrderRepository,times(0)).save(any());
        }

        @Test void duplicateSkuCannotBypassPerProductLimit() {
            var item=new ShopCheckoutRequest.CartItem("CLENZY-NM-01",100);
            assertThatThrownBy(()->service.createCheckoutSession(new ShopCheckoutRequest(List.of(item,item)),EMAIL,USER_KC_ID))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(hardwareOrderRepository,times(0)).save(any());
        }

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
                if (o.getId() == null) {o.setId(42L);
                o.setCreatedAt(java.time.LocalDateTime.now(java.time.Clock.systemUTC()));
                when(hardwareOrderRepository.findById(42L)).thenReturn(Optional.of(o));}
                return o;
            });

            when(orchestrationService.initiatePayment(eq(ORG_ID),eq("FR"),any(PaymentOrchestrationRequest.class)))
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

            // Pas d'épinglage provider : la collecte d'adresse s'exprime en capacité
            // SHIPPING_ADDRESS (resolver capability-aware), pas en preferredProvider.
            ArgumentCaptor<PaymentOrchestrationRequest> reqCaptor =
                    ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
            verify(orchestrationService).initiatePayment(eq(ORG_ID),eq("FR"),reqCaptor.capture());
            PaymentOrchestrationRequest req = reqCaptor.getValue();
            assertThat(req.sourceType()).isEqualTo(ShopService.SOURCE_TYPE);
            assertThat(req.sourceId()).isEqualTo(42L);
            assertThat(req.preferredProvider()).isNull();
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
                o.setCreatedAt(java.time.LocalDateTime.now(java.time.Clock.systemUTC()));
                when(hardwareOrderRepository.findById(1L)).thenReturn(Optional.of(o));
                return o;
            });
            when(orchestrationService.initiatePayment(eq(ORG_ID),eq("FR"),any(PaymentOrchestrationRequest.class)))
                    .thenReturn(new PaymentOrchestrationResult(null, PaymentResult.failure("Stripe down"), null));

            assertThatThrownBy(() -> service.createCheckoutSession(validRequest(), EMAIL, USER_KC_ID))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Echec de creation");
        }
    }

    @Nested
    @DisplayName("completeOrder")
    class CompleteOrder {
        HardwareOrder order;
        com.clenzy.model.PaymentTransaction tx;
        Session session;
        @BeforeEach void fixture() throws Exception {
            order=new HardwareOrder();order.setId(3L);order.setOrganizationId(1L);order.setTotalAmount(12000);
            order.setStripeSessionId("cs_order");
            tx=new com.clenzy.model.PaymentTransaction();tx.setOrganizationId(1L);tx.setTransactionRef("TX-shop");
            tx.setSourceType(ShopService.SOURCE_TYPE);tx.setSourceId(3L);tx.setProviderTxId("cs_order");
            tx.setProviderType(PaymentProviderType.STRIPE);tx.setPaymentType(com.clenzy.model.TransactionType.CHECKOUT);
            tx.setStatus(com.clenzy.model.TransactionStatus.PROCESSING);tx.setAmount(new java.math.BigDecimal("120"));tx.setCurrency("EUR");
            session=new Session();session.setId("cs_order");session.setMode("payment");session.setStatus("complete");
            session.setPaymentStatus("paid");session.setPaymentIntent("pi_order");session.setAmountTotal(12000L);session.setCurrency("eur");
            session.setMetadata(new java.util.HashMap<>(Map.of("transactionRef","TX-shop","sourceType",ShopService.SOURCE_TYPE,"sourceId","3","orgId","1")));
            var shipping=new Session.CollectedInformation.ShippingDetails();var address=new com.stripe.model.Address();
            address.setCountry("FR");address.setLine1("1 rue de test");shipping.setAddress(address);shipping.setName("Acheteur test");
            var collected=new Session.CollectedInformation();collected.setShippingDetails(shipping);session.setCollectedInformation(collected);
            org.mockito.Mockito.lenient().when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            org.mockito.Mockito.lenient().when(hardwareOrderRepository.lockByStripeSessionId("cs_order")).thenReturn(Optional.of(order));
            org.mockito.Mockito.lenient().when(payments.findByProviderTxId("cs_order")).thenReturn(Optional.of(tx));
            when(stripeGateway.retrieveSession("cs_order")).thenReturn(session);
        }
        @Test void verifiesBeforePaymentAndStoresShippingAndJournal() {
            service.completeOrder("cs_order");
            assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);assertThat(order.getStripePaymentIntentId()).isEqualTo("pi_order");
            assertThat(order.getShippingAddress()).isEqualTo("1 rue de test");verify(orchestrationService).completeTransaction("TX-shop");
        }
        @Test void confirmedPaymentRepairsTheReferenceLostAfterCheckoutCreation() {
            order.setStripeSessionId(null);
            when(hardwareOrderRepository.lockByStripeSessionId("cs_order")).thenReturn(Optional.empty());
            when(hardwareOrderRepository.lockForOrganization(1L,3L)).thenReturn(Optional.of(order));
            service.completeOrder("cs_order");
            assertThat(order.getStripeSessionId()).isEqualTo("cs_order");
            assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
            verify(orchestrationService).completeTransaction("TX-shop");
        }
        @Test void missingReferenceDoesNotBypassCanonicalAmountValidation() {
            order.setStripeSessionId(null);session.setAmountTotal(1L);
            when(hardwareOrderRepository.lockByStripeSessionId("cs_order")).thenReturn(Optional.empty());
            when(hardwareOrderRepository.lockForOrganization(1L,3L)).thenReturn(Optional.of(order));
            reject();assertThat(order.getStripeSessionId()).isNull();
        }
        @Test void lostReferenceCannotOverwriteAnotherCheckout() {
            order.setStripeSessionId("cs_other");
            when(hardwareOrderRepository.lockByStripeSessionId("cs_order")).thenReturn(Optional.empty());
            when(hardwareOrderRepository.lockForOrganization(1L,3L)).thenReturn(Optional.of(order));
            reject();assertThat(order.getStripeSessionId()).isEqualTo("cs_other");
        }
        @Test void missingOrderRemainsRetryableInsteadOfAcknowledgingPayment() {
            when(hardwareOrderRepository.lockByStripeSessionId("cs_order")).thenReturn(Optional.empty());reject();
        }
        @Test void stripeUnavailableDoesNotMarkPaid() throws Exception {
            when(stripeGateway.retrieveSession("cs_order")).thenThrow(new com.stripe.exception.ApiException("offline",null,null,503,null));reject();
        }
        @Test void rejectsUnpaid() { session.setPaymentStatus("unpaid");reject(); }
        @Test void rejectsOtherAmount() { session.setAmountTotal(1L);reject(); }
        @Test void rejectsOtherCurrency() { session.setCurrency("mad");reject(); }
        @Test void rejectsOtherOrganization() { session.getMetadata().put("orgId","2");reject(); }
        @Test void rejectsOtherSource() { tx.setSourceId(4L);reject(); }
        @Test void rejectsOtherReference() { session.getMetadata().put("transactionRef","TX-other");reject(); }
        @Test void rejectsMissingShipping() { session.setCollectedInformation(null);reject(); }
        @Test void neverDemotesDeliveredOrderOnReplay() {
            order.setStatus(OrderStatus.DELIVERED);service.completeOrder("cs_order");
            assertThat(order.getStatus()).isEqualTo(OrderStatus.DELIVERED);verify(hardwareOrderRepository,times(0)).save(any());
        }
        @Test void neverReopensCancelledOrder() {
            order.setStatus(OrderStatus.CANCELLED);
            assertThatThrownBy(()->service.completeOrder("cs_order")).isInstanceOf(IllegalStateException.class);
            assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);verify(orchestrationService,times(0)).completeTransaction(any());
        }
        void reject() {
            assertThatThrownBy(()->service.completeOrder("cs_order")).isInstanceOf(IllegalStateException.class);
            assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);verify(hardwareOrderRepository,times(0)).save(any());
            verify(orchestrationService,times(0)).completeTransaction(any());
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
