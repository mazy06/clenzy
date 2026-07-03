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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Webhook Stripe SIGNE et REJOUE (strategie de tests, vague T3) : idempotence de
 * bout en bout de la dotation de credits IA — le meme evenement livre DEUX fois
 * (retry natif Stripe) ne credite qu'UNE poche ({@code ai_credit_grant.stripe_ref}
 * unique + check {@code existsByStripeRef}) et n'ecrit qu'UNE ligne GRANT au ledger.
 *
 * <p>Bout en bout REEL : le payload JSON passe par {@code Webhook.constructEvent}
 * (verification de signature HMAC-SHA256 contre le secret {@code stripe.webhook-secret}
 * du profil test) puis par la deserialisation SDK Stripe — pas de mock du SDK.
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

    private Long orgId;
    private String salt;

    @BeforeEach
    void seedOrgAndSubscriber() {
        salt = UUID.randomUUID().toString().substring(0, 8);
        orgId = organizationRepository.save(new Organization(
                "Stripe Replay " + salt, OrganizationType.INDIVIDUAL, "stripe-replay-" + salt)).getId();

        User payer = new User("Paul", "Payeur", "paul." + salt + "@test.com", "password123");
        payer.setOrganizationId(orgId);
        payer.setKeycloakId("kc-stripe-" + salt);
        payer.setStripeSubscriptionId("sub_IT_" + salt);
        payer.setForfait("premium");
        userRepository.save(payer);
    }

    // ─── invoice.paid rejoue : une seule dotation SUBSCRIPTION ──────────────

    @Test
    void invoicePaid_deliveredTwice_grantsCreditsOnlyOnce() {
        String invoiceId = "in_IT_" + salt;
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
    void checkoutTopUp_deliveredTwice_grantsCreditsOnlyOnce() {
        String sessionId = "cs_IT_" + salt;
        long millicredits = 2_500_000L;
        String payload = topUpCheckoutPayload(sessionId, orgId, millicredits);

        ResponseEntity<String> first = deliverSigned(payload);
        ResponseEntity<String> replay = deliverSigned(payload);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.OK);

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
                      "subscription": "%s"
                    }
                  }
                }
                """.formatted(UUID.randomUUID().toString().substring(0, 12),
                com.stripe.Stripe.API_VERSION, invoiceId, subscriptionId);
    }

    private static String topUpCheckoutPayload(String sessionId, Long orgId, long millicredits) {
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
                      "payment_status": "paid",
                      "metadata": {
                        "type": "ai_credit_topup",
                        "org_id": "%d",
                        "millicredits": "%d"
                      }
                    }
                  }
                }
                """.formatted(UUID.randomUUID().toString().substring(0, 12),
                com.stripe.Stripe.API_VERSION, sessionId, orgId, millicredits);
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
