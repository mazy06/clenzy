package com.clenzy.service.payout;

import com.clenzy.controller.StripeWebhookController;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.BankPayoutObservation;
import com.clenzy.model.PayoutTransfer;
import com.clenzy.model.PayoutTransferEvent;
import com.clenzy.payment.StripeGateway;
import com.clenzy.payment.payout.StripeBankPayoutHandler;
import com.clenzy.repository.BankPayoutObservationRepository;
import com.clenzy.repository.PayoutTransferEventRepository;
import com.clenzy.repository.PayoutTransferRepository;
import com.clenzy.tenant.RlsGuc;
import com.clenzy.tenant.RlsTenantConnectionProvider;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.model.BalanceTransaction;
import com.stripe.model.BalanceTransactionCollection;
import com.stripe.model.Payout;
import org.hibernate.cfg.Configuration;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP signé → transactions Spring → PostgreSQL/RLS → lecture bénéficiaire ; seul le réseau PSP est simulé. */
final class SignedPayoutWebhookPostgresAssertions {
    private final ObjectMapper json = new ObjectMapper();
    private final String signingSecret = "whsec_" + UUID.randomUUID();
    private final TenantContext tenant = new TenantContext();
    private final StripeGateway stripe = mock(StripeGateway.class);
    private MockMvc http;
    private BankPayoutObservationRepository observations;
    private BeneficiaryPayoutReader reader;
    private Long personalId;
    private Long companyId;
    private long initialObservationCount;

    static void runRecipe(String url, String user, String role) throws Exception {
        new SignedPayoutWebhookPostgresAssertions().run(url, user, role);
    }

    private void run(String url, String user, String role) throws Exception {
        seed(url, user);
        boolean previousStrict = RlsGuc.isStrictContext();
        tenant.clear();
        RlsGuc.setStrictContext(true);
        // Un rôle sans BYPASSRLS, même si le schéma jetable est provisionné par un administrateur.
        var dataSource = new DriverManagerDataSource(url, user, "") {
            @Override public Connection getConnection() throws SQLException {
                var connection = super.getConnection();
                try (var statement = connection.createStatement()) {
                    statement.execute("SET ROLE " + role);
                    return connection;
                } catch (SQLException e) { connection.close(); throw e; }
            }
        };
        var configuration = new Configuration().addPackage("com.clenzy.model")
                .addAnnotatedClass(PayoutTransfer.class).addAnnotatedClass(PayoutTransferEvent.class)
                .addAnnotatedClass(BankPayoutObservation.class).setProperty("hibernate.hbm2ddl.auto", "validate");
        configuration.getProperties().put("hibernate.connection.provider_class", new RlsTenantConnectionProvider(dataSource, tenant));
        try (var sessions = configuration.buildSessionFactory()) {
            var em = SharedEntityManagerCreator.createSharedEntityManager(sessions);
            var repositories = new JpaRepositoryFactory(em);
            var transfers = repositories.getRepository(PayoutTransferRepository.class);
            observations = repositories.getRepository(BankPayoutObservationRepository.class);
            var transactions = new JpaTransactionManager(sessions);
            var store = transactional(new BankPayoutStore(observations, transfers, json), transactions);
            reader = transactional(new BeneficiaryPayoutReader(transfers,
                    repositories.getRepository(PayoutTransferEventRepository.class), observations, org.mockito.Mockito.mock(com.clenzy.repository.BaitlyTransferRecoveryRepository.class)), transactions);
            var handler = new StripeBankPayoutHandler(stripe, store, tenant);
            // Les domaines checkout/abonnement ne participent pas à cette recette bancaire.
            var constructor = StripeWebhookController.class.getConstructors()[0];
            var parameters = constructor.getParameterTypes();
            var dependencies = new Object[parameters.length];
            for (int i = 0; i < parameters.length; i++) {
                dependencies[i] = parameters[i] == StripeBankPayoutHandler.class ? handler
                        : parameters[i] == StripeGateway.class ? stripe : mock(parameters[i]);
            }
            var controller = (StripeWebhookController) constructor.newInstance(dependencies);
            ReflectionTestUtils.setField(controller, "webhookSecret", signingSecret);
            http = MockMvcBuilders.standaloneSetup(controller).build();
            initialObservationCount = observationCount();

            rejectsInvalidSignaturesAndUnrelatedAccounts();
            canonicalStateReplayAndRecipientIsolation();
            retriesIncompletePaginationWithoutPartialProof();
            rejectsModeMismatchAndPreservesFailure();
            verifyNoMoreInteractions(stripe);
        } finally {
            tenant.clear();
            RlsGuc.setStrictContext(previousStrict);
        }
    }

    private void rejectsInvalidSignaturesAndUnrelatedAccounts() throws Exception {
        var body = payload("evt_recipe_invalid", "acct_recipe_personal", "po_recipe_personal", false);
        long now = Instant.now().getEpochSecond();
        deliver(body + " ", signature(body, now), 400); // Signature valide pour un AUTRE corps.
        deliver(body, signature(body, now - 600), 400); // Signature authentique, expirée.
        http.perform(post("/api/webhooks/stripe").contentType("application/json").content(body))
                .andExpect(status().isBadRequest());
        send(payload("evt_recipe_platform", null, "po_recipe_platform", false), 200);
        send(payload("evt_recipe_unknown", "acct_unknown", "po_recipe_unknown", false), 200);
        assertThat(observationCount()).isZero();
        verifyNoInteractions(stripe);
    }

    private void canonicalStateReplayAndRecipientIsolation() throws Exception {
        stubPayout("acct_recipe_personal", payout("po_recipe_personal", "pending", false));
        when(stripe.listConnectedPayoutTransactions("acct_recipe_personal", "po_recipe_personal", null))
                .thenAnswer(call -> outsideTransaction(page(false, "txn_recipe_personal", "py_recipe_personal")));
        var body = payload("evt_recipe_pending", "acct_recipe_personal", "po_recipe_personal", false);
        send(body, 200); // Le corps prétend paid, la relecture canonique dit pending.
        send(body, 200);
        assertThat(observationCount()).isEqualTo(1);
        assertBankStatus(personalId, 45L, null, "PENDING");
        verify(stripe).retrieveConnectedPayout("acct_recipe_personal", "po_recipe_personal");
        verify(stripe).listConnectedPayoutTransactions("acct_recipe_personal", "po_recipe_personal", null);
        verifyNoMoreInteractions(stripe);
        clearInvocations(stripe);

        tenant.setOrganizationId(9L);
        assertThat(reader.list(45L, null, 0)).isEmpty(); // Pas de bypass de lecture accidentel.
        tenant.setSystemOrg(true);
        try {
            assertThatThrownBy(() -> reader.detail(43L, null, personalId)).isInstanceOf(NotFoundException.class);
            assertThatThrownBy(() -> reader.detail(null, 9L, personalId)).isInstanceOf(NotFoundException.class);
        } finally { tenant.clear(); }
    }

    private void retriesIncompletePaginationWithoutPartialProof() throws Exception {
        var companyPayout = payout("po_recipe_company", "paid", false);
        companyPayout.setAmount(16000L); // Deux crédits de 80 EUR, dont un seul appartient à la société de cette recette.
        stubPayout("acct_recipe_company", companyPayout);
        when(stripe.listConnectedPayoutTransactions("acct_recipe_company", "po_recipe_company", null))
                .thenAnswer(call -> outsideTransaction(page(true, "txn_recipe_page1", "py_unrelated")));
        when(stripe.listConnectedPayoutTransactions("acct_recipe_company", "po_recipe_company", "txn_recipe_page1"))
                .thenThrow(new IllegalStateException("Simulated PSP network interruption"))
                .thenAnswer(call -> outsideTransaction(page(false, "txn_recipe_page2", "py_recipe_company")));
        var body = payload("evt_recipe_retry", "acct_recipe_company", "po_recipe_company", false);
        send(body, 500);
        assertThat(observationCount()).isEqualTo(1); // Aucune page partielle persistée.
        tenant.setSystemOrg(true);
        try { assertThat(reader.detail(null, 9L, companyId).bankPayouts()).isEmpty(); }
        finally { tenant.clear(); }
        send(body, 200);
        send(body, 200);
        assertThat(observationCount()).isEqualTo(2);
        assertBankStatus(companyId, null, 9L, "PAID");
        assertBankStatus(personalId, 45L, null, "PENDING");
        verify(stripe, times(2)).retrieveConnectedPayout("acct_recipe_company", "po_recipe_company");
        verify(stripe, times(2)).listConnectedPayoutTransactions("acct_recipe_company", "po_recipe_company", null);
        verify(stripe, times(2)).listConnectedPayoutTransactions("acct_recipe_company", "po_recipe_company", "txn_recipe_page1");
        verifyNoMoreInteractions(stripe);
        clearInvocations(stripe);
    }

    private void rejectsModeMismatchAndPreservesFailure() throws Exception {
        stubPayout("acct_recipe_personal", payout("po_recipe_personal", "paid", true));
        send(payload("evt_recipe_mode", "acct_recipe_personal", "po_recipe_personal", false), 500);
        assertThat(observationCount()).isEqualTo(2);
        assertBankStatus(personalId, 45L, null, "PENDING");

        var failed = payout("po_recipe_personal", "failed", false);
        failed.setFailureCode("account_closed");
        stubPayout("acct_recipe_personal", failed);
        send(payload("evt_recipe_failed", "acct_recipe_personal", "po_recipe_personal", false), 200);
        assertBankStatus(personalId, 45L, null, "FAILED");
        // Un ancien événement paid livré ensuite relit encore l'échec présent chez Stripe.
        send(payload("evt_recipe_late", "acct_recipe_personal", "po_recipe_personal", false), 200);
        assertBankStatus(personalId, 45L, null, "FAILED");
        assertThat(observationCount()).isEqualTo(4);
        verify(stripe, times(3)).retrieveConnectedPayout("acct_recipe_personal", "po_recipe_personal");
        verify(stripe, times(2)).listConnectedPayoutTransactions("acct_recipe_personal", "po_recipe_personal", null);
        verifyNoMoreInteractions(stripe);
        clearInvocations(stripe);
    }

    private void seed(String url, String user) throws Exception {
        try (var connection = DriverManager.getConnection(url, user, ""); var sql = connection.createStatement()) {
            sql.execute("INSERT INTO users(id,organization_id) VALUES(45,9)");
            sql.execute("""
                INSERT INTO payout_transfers(organization_id,source,source_id,beneficiary_user_id,beneficiary_organization_id,
                    amount,currency,provider,destination,description,idempotency_key,state)
                VALUES(7,'INTERVENTION',99501,45,null,80,'EUR','STRIPE','acct_recipe_personal','Recette personnelle','recipe-personal','SUBMITTING'),
                      (8,'INTERVENTION',99502,null,9,80,'EUR','STRIPE','acct_recipe_company','Recette société','recipe-company','SUBMITTING')
                """);
            sql.execute("""
                UPDATE payout_transfers SET state='TRANSFERRED',stripe_livemode=false,
                    external_reference=CASE WHEN source_id=99501 THEN 'tr_recipe_personal' ELSE 'tr_recipe_company' END,
                    destination_payment=CASE WHEN source_id=99501 THEN 'py_recipe_personal' ELSE 'py_recipe_company' END
                WHERE source_id IN (99501,99502)
                """);
            try (var rows = sql.executeQuery("SELECT id,source_id FROM payout_transfers WHERE source_id IN (99501,99502)")) {
                while (rows.next()) {
                    if (rows.getLong(2) == 99501) personalId = rows.getLong(1); else companyId = rows.getLong(1);
                }
            }
        }
    }

    private void assertBankStatus(Long id, Long user, Long organization, String expected) {
        tenant.setSystemOrg(true);
        try {
            assertThat(reader.detail(user, organization, id).bankPayouts()).singleElement()
                    .satisfies(bank -> assertThat(bank.status()).isEqualTo(expected));
        } finally { tenant.clear(); }
    }

    private long observationCount() {
        tenant.setSystemOrg(true);
        try { return observations.count() - initialObservationCount; }
        finally { tenant.clear(); }
    }

    private void stubPayout(String account, Payout payout) throws Exception {
        doAnswer(call -> outsideTransaction(payout)).when(stripe).retrieveConnectedPayout(account, payout.getId());
    }

    private static <T> T outsideTransaction(T value) {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive())
                .as("Le réseau Stripe ne doit jamais retenir une transaction SQL").isFalse();
        return value;
    }

    private static Payout payout(String id, String status, boolean live) {
        var payout = new Payout();
        payout.setId(id); payout.setStatus(status); payout.setLivemode(live); payout.setCreated(1791190000L);
        payout.setCurrency("eur"); payout.setAutomatic(true); payout.setReconciliationStatus("completed");
        payout.setAmount(8000L);
        return payout;
    }

    private static BalanceTransactionCollection page(boolean more, String id, String source) {
        var transaction = new BalanceTransaction();
        transaction.setId(id); transaction.setSource(source); transaction.setAmount(8000L);
        transaction.setNet(8000L); transaction.setCurrency("eur");
        var page = new BalanceTransactionCollection(); page.setData(List.of(transaction)); page.setHasMore(more);
        return page;
    }

    private String payload(String id, String account, String payout, boolean live) throws Exception {
        var event = json.createObjectNode().put("id", id).put("object", "event")
                .put("api_version", com.stripe.Stripe.API_VERSION).put("type", "payout.paid")
                .put("created", Instant.now().getEpochSecond()).put("livemode", live);
        if (account != null) event.put("account", account);
        event.putObject("data").putObject("object").put("id", payout).put("object", "payout").put("status", "paid");
        return json.writeValueAsString(event);
    }

    private void send(String body, int status) throws Exception {
        deliver(body, signature(body, Instant.now().getEpochSecond()), status);
    }

    private void deliver(String body, String signature, int expected) throws Exception {
        http.perform(post("/api/webhooks/stripe").contentType("application/json")
                .header("Stripe-Signature", signature).content(body)).andExpect(status().is(expected));
        assertThat(tenant.isSystemOrg()).as("Le bypass interne est restauré après chaque livraison").isFalse();
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
    }

    private String signature(String body, long timestamp) throws Exception {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "t=" + timestamp + ",v1=" + HexFormat.of().formatHex(mac.doFinal((timestamp + "." + body).getBytes(StandardCharsets.UTF_8)));
    }

    @SuppressWarnings("unchecked")
    private static <T> T transactional(T target, JpaTransactionManager manager) {
        var interceptor = new TransactionInterceptor();
        interceptor.setTransactionManager(manager);
        interceptor.setTransactionAttributeSource(new AnnotationTransactionAttributeSource());
        var factory = new ProxyFactory(target); factory.setProxyTargetClass(true); factory.addAdvice(interceptor);
        return (T) factory.getProxy();
    }
}
