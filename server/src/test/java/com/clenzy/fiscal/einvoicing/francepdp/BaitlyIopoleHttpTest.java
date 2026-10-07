package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import static com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleFixture.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BaitlyIopoleHttpTest {
    BaitlyIopoleProperties properties;
    MockRestServiceServer server;
    BaitlyIopoleTransmission client;
    final Map<UUID, BaitlyIopoleInboxStore.Event> archived = new LinkedHashMap<>();
    boolean failPersistence;

    @BeforeEach void setup() {
        properties = config(); var http = new RestTemplate(); server = MockRestServiceServer.bindTo(http).build();
        var api = new BaitlyIopoleApi(properties, http, Clock.systemUTC());
        var store = new BaitlyIopoleInboxStore(null) {
            @Override public void retain(Long org, String env, UUID customer, List<Event> events) {
                if (failPersistence) throw new IllegalStateException("Test rollback");
                events.forEach(e -> archived.putIfAbsent(e.status(), e));
            }
            @Override public List<String> history(Long org, String env, UUID customer, UUID invoice) {
                return archived.values().stream().filter(e -> e.invoice().equals(invoice)).map(Event::body).toList();
            }
        };
        client = new BaitlyIopoleTransmission(properties, api, new BaitlyIopoleInbox(api, store));
    }
    @AfterEach void verifyHttpContract() { server.verify(); }

    void token() {
        server.expect(requestTo(properties.getEnvironment().tokenUrl())).andExpect(method(HttpMethod.POST))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
            .andExpect(content().string("grant_type=client_credentials&client_id=test-client&client_secret=test-secret"))
            .andRespond(withSuccess("{\"token_type\":\"Bearer\",\"access_token\":\"test-token\",\"expires_in\":300}", MediaType.APPLICATION_JSON));
    }
    void metadata(String body) {
        server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice/" + REMOTE))
            .andExpect(method(HttpMethod.GET)).andExpect(header("customer-id", CUSTOMER.toString()))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }
    void history(String body) {
        ArrayNode items = statuses(body);
        unseen(items);
        for (var item : items) {
            String id = item.path("statusId").asText();
            server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice/status/" + id + "/markAsSeen"))
                .andExpect(method(HttpMethod.PUT)).andExpect(header("customer-id", CUSTOMER.toString()))
                .andExpect(request -> assertThat(archived).containsKey(UUID.fromString(id)))
                .andRespond(withNoContent());
        }
    }
    ArrayNode statuses(String body) {
        try {
            var items = (ArrayNode) new ObjectMapper().readTree(body);
            for (var item : items) ((ObjectNode) item).put("statusId", UUID.nameUUIDFromBytes(item.toString().getBytes(StandardCharsets.UTF_8)).toString());
            return items;
        } catch (Exception e) { throw new AssertionError(e); }
    }
    void unseen(ArrayNode items) {
        String body = "[{\"invoiceId\":\"" + REMOTE + "\",\"newstatus\":" + items + "}]";
        server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice/status/notSeen"))
            .andExpect(method(HttpMethod.GET)).andExpect(header("customer-id", CUSTOMER.toString()))
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    @Test void depositThenCanonicalReadConfirmsDeliveryWithoutReissuing() {
        token();
        server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice"))
            .andExpect(method(HttpMethod.POST)).andExpect(header("customer-id", CUSTOMER.toString()))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
            .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("name=\"file\"; filename=\"invoice.xml\"")))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("<ram:GrandTotalAmount>120.00</ram:GrandTotalAmount>")))
            .andRespond(withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON)
                .body("{\"type\":\"INVOICE\",\"id\":\"" + REMOTE + "\"}"));
        metadata(BaitlyIopoleFixture.metadata()); history(BaitlyIopoleFixture.history("RECEIVED"));
        var receipt = client.transmit(invoice(), cii().getBytes(StandardCharsets.UTF_8));
        assertThat(receipt.status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(receipt.externalRef()).isEqualTo(REFERENCE);
        var result = client.reconcile(invoice(), receipt.externalRef());
        assertThat(result.status()).isEqualTo(EInvoiceStatus.REPORTED);
        assertThat(result.message()).contains("ne prouve pas un paiement");
    }

    @ParameterizedTest @ValueSource(strings = {"SUBMITTED", "ISSUED", "SUSPENDED", "DISPUTED", "UNKNOWN"})
    void intermediateOrUnknownStatusNeverClaimsDelivery(String status) {
        token(); metadata(BaitlyIopoleFixture.metadata()); history(BaitlyIopoleFixture.history(status));
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.PENDING);
    }

    @ParameterizedTest @ValueSource(strings = {"REJECTED", "UNACCEPTABLE", "REFUSED"})
    void aRejectedInvoiceRetainsItsReceiptAndNeedsCorrection(String status) {
        token(); metadata(BaitlyIopoleFixture.metadata()); history(BaitlyIopoleFixture.history(status));
        var result = client.reconcile(invoice(), REFERENCE);
        assertThat(result.status()).isEqualTo(EInvoiceStatus.FAILED); assertThat(result.externalRef()).isEqualTo(REFERENCE);
    }

    @Test void receiptForAnotherDocumentOrAmountCannotConfirmThisInvoice() {
        token(); metadata(BaitlyIopoleFixture.metadata().replace("\"amount\":120", "\"amount\":121"));
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.FAILED);
    }

    @Test void lostPostResponseNeverResendsAndDoesNotExposeProviderBody() {
        token(); server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice"))
            .andRespond(withServerError().body("test-secret upstream details"));
        var result = client.transmit(invoice(), cii().getBytes(StandardCharsets.UTF_8));
        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING); assertThat(result.externalRef()).isNull();
        assertThat(result.message()).doesNotContain("test-secret", "upstream");
    }

    @Test void outageKeepsKnownReferenceWithoutInventingSuccess() {
        token(); server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice/" + REMOTE)).andRespond(withServerError());
        var result = client.reconcile(invoice(), REFERENCE);
        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING); assertThat(result.externalRef()).isEqualTo(REFERENCE);
    }

    @Test void unconfiguredAccessTenantOrEnvironmentDoesNotContactPartner() {
        var invoice = invoice(); invoice.setOrganizationId(3L);
        assertThat(client.transmit(invoice, cii().getBytes(StandardCharsets.UTF_8)).status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(client.reconcile(invoice(), REFERENCE.replace("SANDBOX", "LIVE")).status()).isEqualTo(EInvoiceStatus.PENDING);
        properties.setEnabled(false); assertThat(client.configured()).isFalse();
        assertThat(client.transmit(invoice(), cii().getBytes(StandardCharsets.UTF_8)).status()).isEqualTo(EInvoiceStatus.PENDING);
    }

    @Test void anotherSellerIsNeverSentWithThisCustomersMandate() {
        var invoice = invoice(); invoice.setSellerTaxId("OTHER-SELLER");
        assertThat(client.readinessIssue(invoice, cii().getBytes(StandardCharsets.UTF_8))).contains("mandat");
    }

    @Test void latestCanonicalStatusWinsRegardlessOfOrder() {
        token(); metadata(BaitlyIopoleFixture.metadata());
        String older = BaitlyIopoleFixture.history("RECEIVED").replace("10:00:00", "09:00:00");
        history(BaitlyIopoleFixture.history("REJECTED").trim().replace("]", ",") + older.trim().substring(1));
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.FAILED);
    }

    @Test void oldPartialCiiCannotReachTheNetwork() {
        var invoice = invoice(); invoice.setXmlContent(null);
        var documents = org.mockito.Mockito.mock(com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments.class);
        org.mockito.Mockito.when(documents.preparedArtifact(invoice)).thenReturn(new byte[0]);
        var provider = new FrancePdpProvider(documents, client, org.mockito.Mockito.mock(BaitlyCiiValidator.class));
        assertThat(provider.readinessIssue(invoice)).contains("Préparation fiscale interne");
        assertThat(provider.report(invoice).status()).isEqualTo(EInvoiceStatus.PENDING);
    }

    @Test void conflictingOlderEventsDoNotMaskANewerDelivery() {
        token(); metadata(BaitlyIopoleFixture.metadata());
        String a = BaitlyIopoleFixture.history("SUBMITTED").trim().replace("10:00:00", "09:00:00");
        String b = BaitlyIopoleFixture.history("ISSUED").trim().replace("10:00:00", "09:00:00");
        String c = BaitlyIopoleFixture.history("RECEIVED").trim();
        history(a.substring(0, a.length() - 1) + "," + b.substring(1, b.length() - 1) + "," + c.substring(1));
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.REPORTED);
    }

    @Test void simultaneousContradictoryLatestEventsDoNotConfirmDelivery() {
        token(); metadata(BaitlyIopoleFixture.metadata());
        String a = BaitlyIopoleFixture.history("RECEIVED").trim();
        String b = BaitlyIopoleFixture.history("REJECTED").trim();
        history(a.substring(0, a.length() - 1) + "," + b.substring(1));
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.PENDING);
    }

    @Test void anEmptyMandateDoesNotMakeTheProviderConfigured() {
        properties.getCustomers().put(2L, new BaitlyIopoleProperties.Customer());
        assertThat(client.configured()).isFalse();
    }

    @Test void creditNoteNeedsAVerifiedOriginalLinkBeforeAnyNetworkCall() {
        var invoice = invoice();
        invoice.setOriginalInvoiceId(5L);
        byte[] cii = cii().replace(">380<", ">381<").replace("<ram:InvoiceCurrencyCode>",
            "<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>UNVERIFIED</ram:IssuerAssignedID></ram:InvoiceReferencedDocument><ram:InvoiceCurrencyCode>")
            .getBytes(StandardCharsets.UTF_8);
        var result = client.transmit(invoice, cii);
        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(result.message()).contains("facture d'origine");
        invoice.setOriginalInvoiceId(null);
        invoice.setStatus(com.clenzy.model.InvoiceStatus.CREDIT_NOTE);
        assertThat(client.transmit(invoice, cii).status()).isEqualTo(EInvoiceStatus.PENDING);
    }

    @Test void aFailedLocalCommitNeverAcknowledgesThePartnerEvents() {
        token(); metadata(BaitlyIopoleFixture.metadata()); unseen(statuses(BaitlyIopoleFixture.history("RECEIVED")));
        failPersistence = true;
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(archived).isEmpty();
    }

    @Test void anAcknowledgementFailureKeepsTheEventForTheNextRead() {
        token(); metadata(BaitlyIopoleFixture.metadata());
        var events = statuses(BaitlyIopoleFixture.history("RECEIVED")); unseen(events);
        server.expect(requestTo(properties.getEnvironment().api() + "/v1/invoice/status/" + events.get(0).path("statusId").asText() + "/markAsSeen"))
            .andExpect(method(HttpMethod.PUT)).andRespond(withServerError());
        metadata(BaitlyIopoleFixture.metadata()); history(BaitlyIopoleFixture.history("RECEIVED"));
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(archived).hasSize(1);
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.REPORTED);
        assertThat(archived).hasSize(1);
    }

    @Test void pullMustBeExplicitlyConfirmedForThisCustomer() {
        properties.getCustomers().get(2L).setPullModeConfirmed(false);
        assertThat(client.configured()).isFalse();
        assertThat(client.reconcile(invoice(), REFERENCE).status()).isEqualTo(EInvoiceStatus.PENDING);
    }
}
