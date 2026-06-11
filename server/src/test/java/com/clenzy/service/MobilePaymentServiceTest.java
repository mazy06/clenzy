package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.EphemeralKey;
import com.stripe.model.Invoice;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Price;
import com.stripe.model.Subscription;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.EphemeralKeyCreateParams;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.PaymentIntentUpdateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.SubscriptionCancelParams;
import com.stripe.param.SubscriptionCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Tests for MobilePaymentService.
 *
 * <p>Depuis la migration T-SOLID-3, tous les appels Stripe passent par
 * {@link StripeGateway} (plus aucun appel statique au SDK) : les tests
 * mockent le gateway au lieu de {@code mockStatic}.</p>
 */
@ExtendWith(MockitoExtension.class)
class MobilePaymentServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private StripeGateway stripeGateway;

    private MobilePaymentService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new MobilePaymentService(userRepository, interventionRepository, auditLogService,
                pricingConfigService, stripeGateway);
        setField("publishableKey", "pk_test_xxx");
        setField("currency", "EUR");
    }

    private void setField(String name, String value) throws Exception {
        Field f = MobilePaymentService.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(service, value);
    }

    private User buildUser(Long id, String forfait, String stripeCustomerId, String subscriptionId) {
        User u = new User();
        u.setId(id);
        u.setEmail("user" + id + "@test.com");
        u.setFirstName("First");
        u.setLastName("Last");
        u.setKeycloakId("kc-" + id);
        u.setForfait(forfait);
        u.setStripeCustomerId(stripeCustomerId);
        u.setStripeSubscriptionId(subscriptionId);
        u.setRole(UserRole.HOST);     // host d'org 1 par defaut (ownership intervention)
        u.setOrganizationId(1L);
        return u;
    }

    // ─── createPaymentSheet ───────────────────────────────────────────────

    @Nested
    @DisplayName("createPaymentSheet")
    class CreatePaymentSheet {

        @Test
        @DisplayName("user not found throws RuntimeException")
        void whenUserNotFound_thenThrows() {
            when(userRepository.findByKeycloakId("kc-x")).thenReturn(Optional.empty());
            assertThatThrownBy(() ->
                    service.createPaymentSheet("kc-x", "subscription", "premium", null, null))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Utilisateur");
        }

        @Test
        @DisplayName("intervention type — happy path returns paymentIntent + ephemeral key")
        void whenInterventionType_thenReturnsClientSecret() throws StripeException {
            User user = buildUser(1L, "essentiel", null, null);
            user.setRole(UserRole.HOST);
            user.setOrganizationId(1L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Intervention inter = new Intervention();
            inter.setId(99L);
            inter.setOrganizationId(1L); // meme org que le user (ownership ok)
            inter.setEstimatedCost(new BigDecimal("80"));
            when(interventionRepository.findById(99L)).thenReturn(Optional.of(inter));

            Customer customer = mock(Customer.class);
            when(customer.getId()).thenReturn("cus_new");
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("ek_secret");
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_int_1");
            when(pi.getClientSecret()).thenReturn("pi_int_secret");

            when(stripeGateway.createCustomer(any(CustomerCreateParams.class))).thenReturn(customer);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);
            when(stripeGateway.createPaymentIntent(any(PaymentIntentCreateParams.class))).thenReturn(pi);

            Map<String, String> result = service.createPaymentSheet("kc-1", "intervention", null, 99L, 8000L);

            assertThat(result).containsEntry("paymentIntent", "pi_int_secret");
            assertThat(result).containsEntry("ephemeralKey", "ek_secret");
            assertThat(result).containsEntry("customer", "cus_new");
            assertThat(result).containsEntry("publishableKey", "pk_test_xxx");
            verify(interventionRepository).save(inter);
            assertThat(inter.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
            assertThat(inter.getStripeSessionId()).isEqualTo("pi_int_1");

            // T-SOLID-3 : verifie que le montant et la devise passent bien par le gateway
            ArgumentCaptor<PaymentIntentCreateParams> piCaptor =
                    ArgumentCaptor.forClass(PaymentIntentCreateParams.class);
            verify(stripeGateway).createPaymentIntent(piCaptor.capture());
            assertThat(piCaptor.getValue().getAmount()).isEqualTo(8000L);
            assertThat(piCaptor.getValue().getCurrency()).isEqualTo("eur");
        }

        @Test
        @DisplayName("intervention type — missing interventionId throws")
        void whenInterventionTypeNoId_thenThrows() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "intervention", null, null, 8000L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("interventionId");
        }

        @Test
        @DisplayName("intervention type — intervention not found throws")
        void whenInterventionMissing_thenThrows() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(interventionRepository.findById(404L)).thenReturn(Optional.empty());

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "intervention", null, 404L, 8000L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("intervention type — estimatedCost absent throws")
        void whenZeroAmount_thenThrows() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            user.setRole(UserRole.HOST);
            user.setOrganizationId(1L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            Intervention inter = new Intervention();
            inter.setId(99L);
            inter.setOrganizationId(1L);
            inter.setEstimatedCost(null);
            when(interventionRepository.findById(99L)).thenReturn(Optional.of(inter));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "intervention", null, 99L, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("indisponible");
        }

        @Test
        @DisplayName("intervention type — client-supplied amount différent du coût serveur est REJETÉ (Z3-SEC-01)")
        void whenClientAmountDiffersFromServerCost_thenRejected() throws StripeException {
            // Avant le fix : le montant client (amountCents) etait facture tel quel.
            // Apres : le serveur recalcule depuis estimatedCost, le montant client n'est
            // qu'un cross-check -> un montant arbitraire est rejete (400), aucun PaymentIntent cree.
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            user.setRole(UserRole.HOST);
            user.setOrganizationId(1L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Intervention inter = new Intervention();
            inter.setId(99L);
            inter.setOrganizationId(1L);
            inter.setEstimatedCost(new BigDecimal("80")); // cout serveur reel = 8000 cts
            when(interventionRepository.findById(99L)).thenReturn(Optional.of(inter));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");
            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            // Le client tente de payer 1 centime pour une intervention a 80€.
            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "intervention", null, 99L, 1L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("ne correspond pas");

            // Aucun PaymentIntent ne doit avoir ete cree au montant arbitraire.
            verify(stripeGateway, never()).createPaymentIntent(any(PaymentIntentCreateParams.class));
            verify(interventionRepository, never()).save(any(Intervention.class));
        }

        @Test
        @DisplayName("intervention type — intervention d'une autre org est REJETÉE (IDOR)")
        void whenInterventionFromAnotherOrg_thenAccessDenied() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            user.setRole(UserRole.HOST);
            user.setOrganizationId(1L);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Intervention inter = new Intervention();
            inter.setId(99L);
            inter.setOrganizationId(2L); // autre organisation
            inter.setEstimatedCost(new BigDecimal("80"));
            when(interventionRepository.findById(99L)).thenReturn(Optional.of(inter));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");
            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "intervention", null, 99L, 8000L))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            verify(stripeGateway, never()).createPaymentIntent(any(PaymentIntentCreateParams.class));
            verify(interventionRepository, never()).save(any(Intervention.class));
        }

        @Test
        @DisplayName("unknown payment type throws IllegalArgumentException")
        void whenUnknownType_thenThrows() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "BADTYPE", null, null, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Type de paiement");
        }

        @Test
        @DisplayName("subscription type — invalid forfait throws")
        void whenInvalidForfait_thenThrows() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "subscription", "bogus", null, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Forfait invalide");
        }

        @Test
        @DisplayName("subscription type — downgrade throws")
        void whenDowngradeForfait_thenThrows() throws StripeException {
            User user = buildUser(1L, "premium", "cus_existing", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);

            assertThatThrownBy(() -> service.createPaymentSheet("kc-1", "subscription", "essentiel", null, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("forfait superieur");
        }

        @Test
        @DisplayName("subscription upgrade — full path including subscription cancel + PI update")
        void whenSubscriptionUpgrade_thenReturnsClientSecret() throws StripeException {
            User user = buildUser(1L, "essentiel", null, "sub_old");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2999);

            Customer customer = mock(Customer.class);
            when(customer.getId()).thenReturn("cus_new");

            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("ek_secret");

            Subscription oldSub = mock(Subscription.class);
            when(oldSub.getStatus()).thenReturn("active");

            Price createdPrice = mock(Price.class);
            when(createdPrice.getId()).thenReturn("price_xyz");

            Invoice invoice = mock(Invoice.class);
            PaymentIntent piFromInvoice = mock(PaymentIntent.class);
            when(piFromInvoice.getId()).thenReturn("pi_inv");
            when(invoice.getPaymentIntentObject()).thenReturn(piFromInvoice);

            Subscription createdSub = mock(Subscription.class);
            when(createdSub.getId()).thenReturn("sub_new");
            when(createdSub.getLatestInvoiceObject()).thenReturn(invoice);

            PaymentIntent piRetrieved = mock(PaymentIntent.class);
            PaymentIntent piUpdated = mock(PaymentIntent.class);
            when(piUpdated.getId()).thenReturn("pi_inv");
            when(piUpdated.getClientSecret()).thenReturn("pi_inv_secret");

            when(stripeGateway.createCustomer(any(CustomerCreateParams.class))).thenReturn(customer);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);
            when(stripeGateway.retrieveSubscription("sub_old")).thenReturn(oldSub);
            when(stripeGateway.createSubscription(any(SubscriptionCreateParams.class))).thenReturn(createdSub);
            when(stripeGateway.createPrice(any(PriceCreateParams.class))).thenReturn(createdPrice);
            when(stripeGateway.retrievePaymentIntent("pi_inv")).thenReturn(piRetrieved);
            when(stripeGateway.updatePaymentIntent(eq(piRetrieved), any(PaymentIntentUpdateParams.class)))
                    .thenReturn(piUpdated);

            Map<String, String> result = service.createPaymentSheet("kc-1", "subscription", "premium", null, null);

            assertThat(result).containsEntry("paymentIntent", "pi_inv_secret");
            assertThat(result).containsEntry("customer", "cus_new");
            verify(stripeGateway).cancelSubscription(eq(oldSub), any(SubscriptionCancelParams.class));
        }

        @Test
        @DisplayName("subscription upgrade — cancel of old subscription swallowed if it errors")
        void whenCancelOldSubscriptionFails_thenContinues() throws StripeException {
            User user = buildUser(1L, "essentiel", null, "sub_old");
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            when(pricingConfigService.getPmsMonthlyPriceCents()).thenReturn(2999);

            Customer customer = mock(Customer.class);
            when(customer.getId()).thenReturn("cus_new");
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("ek_secret");

            Price createdPrice = mock(Price.class);
            when(createdPrice.getId()).thenReturn("price_xyz");
            Invoice invoice = mock(Invoice.class);
            PaymentIntent piFromInvoice = mock(PaymentIntent.class);
            when(piFromInvoice.getId()).thenReturn("pi_inv");
            when(invoice.getPaymentIntentObject()).thenReturn(piFromInvoice);
            Subscription createdSub = mock(Subscription.class);
            when(createdSub.getId()).thenReturn("sub_new");
            when(createdSub.getLatestInvoiceObject()).thenReturn(invoice);

            PaymentIntent piRetrieved = mock(PaymentIntent.class);
            PaymentIntent piUpdated = mock(PaymentIntent.class);
            when(piUpdated.getId()).thenReturn("pi_inv");
            when(piUpdated.getClientSecret()).thenReturn("pi_inv_secret");

            when(stripeGateway.createCustomer(any(CustomerCreateParams.class))).thenReturn(customer);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);
            when(stripeGateway.retrieveSubscription("sub_old"))
                    .thenThrow(new ApiException("retrieve down", null, "c", 500, null));
            when(stripeGateway.createSubscription(any(SubscriptionCreateParams.class))).thenReturn(createdSub);
            when(stripeGateway.createPrice(any(PriceCreateParams.class))).thenReturn(createdPrice);
            when(stripeGateway.retrievePaymentIntent("pi_inv")).thenReturn(piRetrieved);
            when(stripeGateway.updatePaymentIntent(eq(piRetrieved), any(PaymentIntentUpdateParams.class)))
                    .thenReturn(piUpdated);

            Map<String, String> result = service.createPaymentSheet("kc-1", "subscription", "premium", null, null);

            assertThat(result.get("paymentIntent")).isEqualTo("pi_inv_secret");
        }

        @Test
        @DisplayName("existing customer reused when not deleted")
        void whenExistingCustomerNotDeleted_thenReused() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_existing", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            Intervention inter = new Intervention();
            inter.setId(50L);
            inter.setOrganizationId(1L);
            inter.setEstimatedCost(new BigDecimal("100"));
            when(interventionRepository.findById(50L)).thenReturn(Optional.of(inter));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(false);
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi_use");
            when(pi.getClientSecret()).thenReturn("pi_use_s");

            when(stripeGateway.retrieveCustomer("cus_existing")).thenReturn(existingCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);
            when(stripeGateway.createPaymentIntent(any(PaymentIntentCreateParams.class))).thenReturn(pi);

            Map<String, String> result = service.createPaymentSheet("kc-1", "intervention", null, 50L, null);

            assertThat(result).containsEntry("customer", "cus_existing");
            verify(stripeGateway, never()).createCustomer(any(CustomerCreateParams.class));
        }

        @Test
        @DisplayName("existing customer deleted then recreates new")
        void whenExistingCustomerDeleted_thenCreatesNew() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_deleted", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            Intervention inter = new Intervention();
            inter.setId(50L);
            inter.setOrganizationId(1L);
            inter.setEstimatedCost(new BigDecimal("100"));
            when(interventionRepository.findById(50L)).thenReturn(Optional.of(inter));

            Customer existingCust = mock(Customer.class);
            when(existingCust.getDeleted()).thenReturn(true);
            Customer newCust = mock(Customer.class);
            when(newCust.getId()).thenReturn("cus_new");
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi");
            when(pi.getClientSecret()).thenReturn("pis");

            when(stripeGateway.retrieveCustomer("cus_deleted")).thenReturn(existingCust);
            when(stripeGateway.createCustomer(any(CustomerCreateParams.class))).thenReturn(newCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);
            when(stripeGateway.createPaymentIntent(any(PaymentIntentCreateParams.class))).thenReturn(pi);

            Map<String, String> result = service.createPaymentSheet("kc-1", "intervention", null, 50L, null);

            assertThat(result).containsEntry("customer", "cus_new");
        }

        @Test
        @DisplayName("retrieve customer fails — fallback creates new customer")
        void whenRetrieveCustomerFails_thenCreatesNew() throws StripeException {
            User user = buildUser(1L, "essentiel", "cus_bad", null);
            when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(user));
            Intervention inter = new Intervention();
            inter.setId(50L);
            inter.setOrganizationId(1L);
            inter.setEstimatedCost(new BigDecimal("100"));
            when(interventionRepository.findById(50L)).thenReturn(Optional.of(inter));

            Customer newCust = mock(Customer.class);
            when(newCust.getId()).thenReturn("cus_new");
            EphemeralKey ek = mock(EphemeralKey.class);
            when(ek.getSecret()).thenReturn("eks");
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getId()).thenReturn("pi");
            when(pi.getClientSecret()).thenReturn("pis");

            when(stripeGateway.retrieveCustomer("cus_bad"))
                    .thenThrow(new ApiException("not found", null, "c", 404, null));
            when(stripeGateway.createCustomer(any(CustomerCreateParams.class))).thenReturn(newCust);
            when(stripeGateway.createEphemeralKey(any(EphemeralKeyCreateParams.class))).thenReturn(ek);
            when(stripeGateway.createPaymentIntent(any(PaymentIntentCreateParams.class))).thenReturn(pi);

            Map<String, String> result = service.createPaymentSheet("kc-1", "intervention", null, 50L, null);

            assertThat(result).containsEntry("customer", "cus_new");
        }
    }

    // ─── completeSubscriptionUpgrade ──────────────────────────────────────

    @Nested
    @DisplayName("completeSubscriptionUpgrade")
    class CompleteSubscriptionUpgrade {
        @Test
        @DisplayName("nominal upgrade updates user forfait + audit log")
        void whenMetadataValid_thenUpdatesUser() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of(
                    "userId", "1",
                    "forfait", "premium",
                    "previousForfait", "essentiel",
                    "subscriptionId", "sub_x"
            ));
            when(pi.getId()).thenReturn("pi_x");
            when(pi.getCustomer()).thenReturn("cus_x");

            User user = buildUser(1L, "essentiel", null, null);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));

            service.completeSubscriptionUpgrade(pi);

            assertThat(user.getForfait()).isEqualTo("premium");
            assertThat(user.getStripeSubscriptionId()).isEqualTo("sub_x");
            assertThat(user.getStripeCustomerId()).isEqualTo("cus_x");
            verify(userRepository).save(user);
            verify(auditLogService).logSync(anyString(), eq("1"), anyString());
        }

        @Test
        @DisplayName("null metadata returns early")
        void whenNullMetadata_thenNoop() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(null);

            service.completeSubscriptionUpgrade(pi);

            verifyNoInteractions(userRepository, auditLogService);
        }

        @Test
        @DisplayName("missing userId returns early")
        void whenMetadataMissingUserId_thenNoop() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of("forfait", "premium"));
            when(pi.getId()).thenReturn("pi_x");

            service.completeSubscriptionUpgrade(pi);

            verifyNoInteractions(userRepository, auditLogService);
        }

        @Test
        @DisplayName("user not found throws RuntimeException")
        void whenUserNotFound_thenThrows() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of(
                    "userId", "9999",
                    "forfait", "premium"
            ));
            when(userRepository.findById(9999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.completeSubscriptionUpgrade(pi))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ─── completeInterventionPayment ──────────────────────────────────────

    @Nested
    @DisplayName("completeInterventionPayment")
    class CompleteInterventionPayment {
        @Test
        @DisplayName("AWAITING_PAYMENT intervention flips to PENDING + PAID")
        void whenAwaitingPayment_thenFlipsToPaid() {
            Intervention inter = new Intervention();
            inter.setId(1L);
            inter.setStatus(InterventionStatus.AWAITING_PAYMENT);
            when(interventionRepository.findById(1L)).thenReturn(Optional.of(inter));

            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of("interventionId", "1"));
            when(pi.getId()).thenReturn("pi_done");

            service.completeInterventionPayment(pi);

            assertThat(inter.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(inter.getStripeSessionId()).isEqualTo("pi_done");
            assertThat(inter.getStatus()).isEqualTo(InterventionStatus.PENDING);
            verify(interventionRepository).save(inter);
        }

        @Test
        @DisplayName("non-AWAITING status keeps original status, only flips to PAID")
        void whenAlreadyInProgress_thenKeepsStatus() {
            Intervention inter = new Intervention();
            inter.setId(2L);
            inter.setStatus(InterventionStatus.IN_PROGRESS);
            when(interventionRepository.findById(2L)).thenReturn(Optional.of(inter));

            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of("interventionId", "2"));
            when(pi.getId()).thenReturn("pi_done2");

            service.completeInterventionPayment(pi);

            assertThat(inter.getStatus()).isEqualTo(InterventionStatus.IN_PROGRESS);
            assertThat(inter.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("null metadata returns early without save")
        void whenNullMetadata_thenNoop() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(null);

            service.completeInterventionPayment(pi);

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("missing interventionId returns early")
        void whenMissingInterventionId_thenNoop() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of());
            when(pi.getId()).thenReturn("pi_no");

            service.completeInterventionPayment(pi);

            verify(interventionRepository, never()).save(any());
        }

        @Test
        @DisplayName("intervention not found returns early without save")
        void whenInterventionNotFound_thenNoop() {
            PaymentIntent pi = mock(PaymentIntent.class);
            when(pi.getMetadata()).thenReturn(Map.of("interventionId", "404"));
            when(pi.getId()).thenReturn("pi_404");
            when(interventionRepository.findById(404L)).thenReturn(Optional.empty());

            service.completeInterventionPayment(pi);

            verify(interventionRepository, never()).save(any());
        }
    }
}
