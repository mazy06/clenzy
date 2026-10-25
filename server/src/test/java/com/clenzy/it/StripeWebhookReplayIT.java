package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.controller.StripeWebhookController;
import com.clenzy.model.AiCreditGrant;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.User;
import com.clenzy.repository.AiCreditGrantRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Webhook Stripe SIGNE et REJOUE (strategie de tests, vague T3) : idempotence de
 * bout en bout de la dotation de credits IA — le meme evenement livre DEUX fois
 * (retry natif Stripe) ne credite qu'UNE poche ({@code ai_credit_grant.stripe_ref}
 * unique + check {@code existsByStripeRef}) et n'ecrit qu'UNE ligne GRANT au ledger.
 *
 * <p>Bout en bout REEL : le payload JSON passe par {@code Webhook.constructEvent}
 * (verification de signature HMAC-SHA256 contre le secret {@code stripe.webhook-secret}
 * du profil test) puis par la deserialisation SDK Stripe — pas de mock du SDK.
 * Les lectures distantes du gateway utilisent des preuves synthétiques ; aucun
 * appel au réseau Stripe. Le consumer réel est drainé depuis l'outbox commitée.
 * La signature est calculee comme Stripe la calcule : {@code v1 = HMAC(secret,
 * "{timestamp}.{payload}")}.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class StripeWebhookReplayIT extends AbstractIntegrationTest {

    /** Doit rester aligne sur stripe.webhook-secret de application-test.yml. */
    private static final String WEBHOOK_SECRET = "whsec_test_fake_secret";

    @Autowired private StripeWebhookController webhookController;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private AiCreditGrantRepository grantRepository;
    @Autowired private AiUsageLedgerRepository ledgerRepository;
    @Autowired private com.clenzy.repository.PaymentTransactionRepository payments;
    @Autowired private com.clenzy.repository.OutboxEventRepository outbox;
    @Autowired private com.clenzy.service.PaymentEventConsumer consumer;
    @Autowired private com.fasterxml.jackson.databind.ObjectMapper mapper;
    // Only remote reads are synthetic. Signature, persistence and reconciliation stay real.
    @org.springframework.boot.test.mock.mockito.MockBean private com.clenzy.payment.StripeGateway stripe;
    @org.springframework.boot.test.mock.mockito.MockBean
    private com.clenzy.service.assignment.AssignmentDeadlineDispatcher assignmentTimer;

    private Long orgId;
    private String salt;

    @BeforeEach
    void seedOrgAndSubscriber() {
        salt = UUID.randomUUID().toString().substring(0, 8);
        orgId = organizationRepository.save(new Organization(
                "Stripe Replay " + salt, OrganizationType.INDIVIDUAL, "stripe-replay-" + salt)).getId();

        User payer = new User("Paul", "Payeur", "paul." + salt + "@example.invalid", "password123");
        payer.setOrganizationId(orgId);
        payer.setKeycloakId("kc-stripe-" + salt);
        payer.setStripeSubscriptionId("sub_IT_" + salt);
        payer.setStripeCustomerId("cus_IT_" + salt);
        payer.setForfait("premium");
        userRepository.save(payer);
    }

    // ─── invoice.paid rejoue : une seule dotation SUBSCRIPTION ──────────────

    @Test
    void invoicePaid_deliveredTwice_grantsCreditsOnlyOnce() throws Exception {
        String invoiceId = "in_IT_" + salt;
        prepareInvoiceProof(invoiceId);
        String payload = invoicePaidPayload(invoiceId, "sub_IT_" + salt);

        ResponseEntity<String> first = deliverSigned(payload);
        ResponseEntity<String> replay = deliverSigned(payload); // retry Stripe : meme payload re-signe

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(replay.getStatusCode())
                .as("La re-livraison d'un evenement deja traite doit etre acquittee (200), pas 500")
                .isEqualTo(HttpStatus.OK);

        List<AiCreditGrant> grants = grantRepository.findAll().stream()
                .filter(g -> invoiceId.equals(g.getStripeRef()))
                .toList();
        assertThat(grants)
                .as("Une SEULE poche pour l'invoice rejouee (existsByStripeRef + contrainte unique)")
                .hasSize(1);
        AiCreditGrant grant = grants.get(0);
        assertThat(grant.getOrganizationId()).isEqualTo(orgId);
        assertThat(grant.getSource()).isEqualTo(AiCreditGrant.SOURCE_SUBSCRIPTION);
        assertThat(grant.getMillicreditsGranted())
                .as("Dotation du forfait premium (defaut clenzy.ai.credits.allotment.premium-millicredits)")
                .isEqualTo(8_000_000L);

        assertThat(grantLedgerLines())
                .as("Une SEULE ligne GRANT au ledger malgre la double livraison")
                .hasSize(1);
    }

    // ─── checkout.session.completed top-up rejoue : un seul grant TOPUP ─────

    @Test
    void checkoutTopUp_deliveredTwice_grantsCreditsOnlyOnce() throws Exception {
        String sessionId = "cs_IT_" + salt;
        long millicredits = 500_000L;
        String ref = "BAITLY-IT-" + salt;
        var tx = new com.clenzy.model.PaymentTransaction();
        tx.setOrganizationId(orgId);
        tx.setTransactionRef(ref);
        tx.setProviderType(com.clenzy.model.PaymentProviderType.STRIPE);
        tx.setProviderTxId(sessionId);
        tx.setPaymentType(com.clenzy.model.TransactionType.CHECKOUT);
        tx.setSourceType(com.clenzy.service.ai.AiCreditPurchaseService.SOURCE_TYPE);
        tx.setSourceId(orgId);
        tx.setAmount(new java.math.BigDecimal("12.00"));
        tx.setCurrency("EUR");
        tx.setMetadata(Map.of("pack_key", "pack_500", "millicredits", millicredits));
        payments.saveAndFlush(tx);
        String payload = topUpCheckoutPayload(sessionId, orgId, ref);

        ResponseEntity<String> first = deliverSigned(payload);
        ResponseEntity<String> replay = deliverSigned(payload);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.OK);

        assertThat(payments.findByTransactionRef(ref).orElseThrow().getStatus())
                .isEqualTo(com.clenzy.model.TransactionStatus.COMPLETED);
        var events = outbox.findAll().stream()
                .filter(e -> ref.equals(e.getAggregateId()) && "PAYMENT_COMPLETED".equals(e.getEventType())).toList();
        assertThat(events).as("One durable event despite the signed webhook replay").hasSize(1);
        Map<String, Object> event = mapper.readValue(events.getFirst().getPayload(),
                new com.fasterxml.jackson.core.type.TypeReference<>() {});
        // The shared IT fixture has no Kafka broker: drive the real consumer explicitly,
        // including duplicate delivery of the actual committed outbox payload.
        consumer.handlePaymentEvent(event);
        consumer.handlePaymentEvent(event);

        List<AiCreditGrant> grants = grantRepository.findAll().stream()
                .filter(g -> sessionId.equals(g.getStripeRef()))
                .toList();
        assertThat(grants)
                .as("Un SEUL grant TOPUP pour la session rejouee")
                .hasSize(1);
        assertThat(grants.get(0).getSource()).isEqualTo(AiCreditGrant.SOURCE_TOPUP);
        assertThat(grants.get(0).getMillicreditsGranted()).isEqualTo(millicredits);
        assertThat(grants.get(0).getOrganizationId()).isEqualTo(orgId);

        assertThat(grantLedgerLines()).hasSize(1);
    }

    // ─── Signature invalide : refusee AVANT tout effet ───────────────────────

    @Test
    void tamperedSignature_isRejected_noGrantCreated() {
        String payload = invoicePaidPayload("in_IT_tampered_" + salt, "sub_IT_" + salt);
        ResponseEntity<String> response = webhookController.handleStripeWebhook(
                payload, "t=123,v1=deadbeef");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(grantRepository.findAll().stream()
                .filter(g -> ("in_IT_tampered_" + salt).equals(g.getStripeRef())))
                .isEmpty();
        verifyNoInteractions(stripe);
    }

    @Test
    void legacyTopUpMetadata_doesNotProveFunding() {
        String payload = topUpCheckoutPayload("cs_unverified_" + salt, orgId, "unknown")
                .replace("\"sourceType\": \"AI_CREDIT_TOPUP\",", "");
        assertThat(deliverSigned(payload).getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(grantLedgerLines()).isEmpty();
        verifyNoInteractions(stripe);
    }

    // ─── Payloads + signature Stripe ─────────────────────────────────────────

    private ResponseEntity<String> deliverSigned(String payload) {
        long timestamp = System.currentTimeMillis() / 1000L;
        String signature = hmacSha256(WEBHOOK_SECRET, timestamp + "." + payload);
        return webhookController.handleStripeWebhook(
                payload, "t=" + timestamp + ",v1=" + signature);
    }

    private List<AiUsageLedgerEntry> grantLedgerLines() {
        return ledgerRepository.findAll().stream()
                .filter(e -> orgId.equals(e.getOrganizationId()))
                .filter(e -> AiUsageLedgerEntry.TYPE_GRANT.equals(e.getEntryType()))
                .toList();
    }

    /**
     * Event {@code invoice.paid} minimal mais REALISTE : {@code api_version}
     * alignee sur le SDK pour que {@code getDataObjectDeserializer().getObject()}
     * deserialise (le controller ignore silencieusement un event indeserialisable).
     */
    private static String invoicePaidPayload(String invoiceId, String subscriptionId) {
        return """
                {
                  "id": "evt_%s",
                  "object": "event",
                  "api_version": "%s",
                  "type": "invoice.paid",
                  "data": {
                    "object": {
                      "id": "%s",
                      "object": "invoice",
                      "parent": {"subscription_details": {"subscription": "%s"}}
                    }
                  }
                }
                """.formatted(UUID.randomUUID().toString().substring(0, 12),
                com.stripe.Stripe.API_VERSION, invoiceId, subscriptionId);
    }

    private static String topUpCheckoutPayload(String sessionId, Long orgId, String ref) {
        return """
                {
                  "id": "evt_%s",
                  "object": "event",
                  "api_version": "%s",
                  "type": "checkout.session.completed",
                  "data": {
                    "object": {
                      "id": "%s",
                      "object": "checkout.session",
                      "mode": "payment",
                      "status": "complete",
                      "payment_status": "paid",
                      "payment_intent": "pi_recipe",
                      "amount_total": 1200,
                      "currency": "eur",
                      "metadata": {
                        "type": "ai_credit_topup",
                        "orgId": "%d",
                        "sourceId": "%d",
                        "sourceType": "AI_CREDIT_TOPUP",
                        "transactionRef": "%s"
                      }
                    }
                  }
                }
                """.formatted(UUID.randomUUID().toString().substring(0, 12),
                com.stripe.Stripe.API_VERSION, sessionId, orgId, orgId, ref);
    }

    private void prepareInvoiceProof(String invoiceId) throws Exception {
        String customer = "cus_IT_" + salt, subscription = "sub_IT_" + salt;
        long now = java.time.Instant.now().getEpochSecond();
        var invoice = stripeObject(Map.ofEntries(
                Map.entry("id", invoiceId), Map.entry("object", "invoice"), Map.entry("customer", customer),
                Map.entry("parent", Map.of("subscription_details", Map.of("subscription", subscription))),
                Map.entry("status", "paid"), Map.entry("amount_paid", 1200), Map.entry("amount_remaining", 0),
                Map.entry("currency", "eur"), Map.entry("billing_reason", "subscription_cycle"),
                Map.entry("lines", Map.of("has_more", false, "data", List.of(Map.of(
                        "parent", Map.of("subscription_item_details", Map.of("subscription", subscription, "proration", false)),
                        "period", Map.of("start", now - 60, "end", now + 86400 * 30L)))))
        ), com.stripe.model.Invoice.class);
        when(stripe.retrieveInvoice(invoiceId)).thenReturn(invoice);
        when(stripe.retrieveSubscription(subscription)).thenReturn(stripeObject(
                Map.of("id", subscription, "metadata", Map.of()), com.stripe.model.Subscription.class));
        when(stripe.invoicePayments(invoiceId, null)).thenReturn(List.of(stripeObject(Map.of(
                "id", "inpay_" + salt, "invoice", invoiceId, "status", "paid", "amount_paid", 1200,
                "currency", "eur", "payment", Map.of("type", "payment_intent", "payment_intent", "pi_" + salt)),
                com.stripe.model.InvoicePayment.class)));
        when(stripe.retrievePaymentIntent("pi_" + salt)).thenReturn(stripeObject(Map.of(
                "id", "pi_" + salt, "customer", customer, "status", "succeeded", "latest_charge", "ch_" + salt),
                com.stripe.model.PaymentIntent.class));
        when(stripe.retrieveCharge("ch_" + salt)).thenReturn(stripeObject(Map.of(
                "object", "charge", "id", "ch_" + salt, "customer", customer, "amount", 1200, "amount_captured", 1200,
                "amount_refunded", 0, "paid", true, "captured", true, "currency", "eur"), com.stripe.model.Charge.class));
        when(stripe.refundsForCharge("ch_" + salt)).thenReturn(List.of());
        when(stripe.disputesForCharge("ch_" + salt)).thenReturn(List.of());
    }

    private static <T> T stripeObject(Map<String, ?> fields, Class<T> type) {
        return com.stripe.net.ApiResource.GSON.fromJson(com.stripe.net.ApiResource.GSON.toJson(fields), type);
    }

    private static String hmacSha256(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 indisponible", e);
        }
    }
}
