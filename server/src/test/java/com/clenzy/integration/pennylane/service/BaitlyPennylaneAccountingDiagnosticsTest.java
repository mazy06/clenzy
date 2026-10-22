package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.oauth.BaitlyOAuthBusyException;
import com.clenzy.integration.oauth.BaitlyOAuthCircuitBreakerConfiguration;
import com.clenzy.integration.pennylane.config.PennylaneConfig;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import com.clenzy.model.*;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.springboot3.circuitbreaker.autoconfigure.CircuitBreakerAutoConfiguration;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** HTTP intercepté, proxys Spring réels et données exclusivement synthétiques. */
class BaitlyPennylaneAccountingDiagnosticsTest {
    private static final String PRIVATE = "synthetic-private@example.invalid";
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class, CircuitBreakerAutoConfiguration.class))
            .withInitializer(context -> {
                try {
                    for (var source : new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))) {
                        context.getEnvironment().getPropertySources().addLast(source);
                    }
                } catch (java.io.IOException e) { throw new IllegalStateException("Configuration de recette indisponible", e); }
            })
            .withUserConfiguration(BaitlyOAuthCircuitBreakerConfiguration.class, ClientConfig.class);

    @ParameterizedTest @ValueSource(strings = {"find-customer", "find-supplier", "list-invoices"})
    void queryValuesRemainDataAfterOneStrictEncoding(String action) {
        runner.run(context -> {
            var client = context.getBean(PennylaneAccountingClient.class);
            var raw = (PennylaneAccountingClient) AopTestUtils.getUltimateTargetObject(client);
            var server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(raw, "restTemplate")).build();
            doReturn("synthetic-access-token").when(context.getBean(PennylaneOAuthService.class)).getValidAccessToken(7L);
            String value = "synthetic\"}{ref} + &=#%/é";
            server.expect(request -> {
                assertThat(request.getURI().getFragment()).isNull();
                var params = org.springframework.web.util.UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
                String key = action.equals("list-invoices") ? "cursor" : "filter";
                String decoded = java.net.URLDecoder.decode(params.getFirst(key), java.nio.charset.StandardCharsets.UTF_8);
                if (action.equals("list-invoices")) {
                    assertThat(params.keySet()).containsExactlyInAnyOrder("limit", "cursor");
                    assertThat(decoded).isEqualTo(value);
                } else {
                    assertThat(params.keySet()).containsExactly("filter");
                    var json = new ObjectMapper().readTree(decoded);
                    assertThat(json.size()).isEqualTo(1);
                    assertThat(json.get(0).get("field").asText()).isEqualTo("external_reference");
                    assertThat(json.get(0).get("operator").asText()).isEqualTo("eq");
                    assertThat(json.get(0).get("value").asText()).isEqualTo(value);
                }
            }).andRespond(withSuccess("{\"customers\":[],\"suppliers\":[],\"customer_invoices\":[]}", MediaType.APPLICATION_JSON));
            switch (action) {
                case "find-customer" -> assertThat(client.findCustomerByExternalRef(7L, value)).isEmpty();
                case "find-supplier" -> assertThat(client.findSupplierByExternalRef(7L, value)).isEmpty();
                default -> assertThat(client.listCustomerInvoices(7L, value, 10)).containsKey("customer_invoices");
            }
            server.verify();
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"customer-invoice", "supplier-invoice", "customer", "supplier", "find-customer", "find-supplier", "list-invoices", "journals"})
    void everyActualFallbackProtectsHttpErrorsAndPreservesOAuthContention(String action) {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            var client = context.getBean(PennylaneAccountingClient.class);
            var oauth = context.getBean(PennylaneOAuthService.class);
            var raw = (PennylaneAccountingClient) AopTestUtils.getUltimateTargetObject(client);
            var http = (RestTemplate) ReflectionTestUtils.getField(raw, "restTemplate");
            var server = MockRestServiceServer.bindTo(http).build();
            var breaker = context.getBean(CircuitBreakerRegistry.class).circuitBreaker("pennylane-accounting");
            Supplier<?> call = () -> switch (action) {
                case "customer-invoice" -> client.createCustomerInvoice(7L, Map.of("label", PRIVATE));
                case "supplier-invoice" -> client.createSupplierInvoice(7L, Map.of("label", PRIVATE));
                case "customer" -> client.createCustomer(7L, Map.of("name", PRIVATE));
                case "supplier" -> client.createSupplier(7L, Map.of("name", PRIVATE));
                case "find-customer" -> client.findCustomerByExternalRef(7L, PRIVATE);
                case "find-supplier" -> client.findSupplierByExternalRef(7L, PRIVATE);
                case "list-invoices" -> client.listCustomerInvoices(7L, PRIVATE, 10);
                default -> client.listJournals(7L);
            };
            var busy = new BaitlyOAuthBusyException();
            when(oauth.getValidAccessToken(7L)).thenThrow(busy);
            try (var logs = new Logs(PennylaneAccountingClient.class)) {
                for (int i = 0; i < 12; i++) assertThatThrownBy(call::get).isSameAs(busy);
                assertThat(breaker.getMetrics().getNumberOfBufferedCalls()).isZero();
                assertThat(logs.events.list).noneMatch(e -> e.getLevel().isGreaterOrEqual(ch.qos.logback.classic.Level.ERROR));
                doReturn("synthetic-access-token").when(oauth).getValidAccessToken(7L);
                server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://accounting.example.invalid/")))
                        .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).contentType(MediaType.APPLICATION_JSON)
                                .body("{\"error\":\"access_token=" + PRIVATE + " refresh_token=synthetic-private\"}"));
                assertThatThrownBy(call::get).isInstanceOf(BaitlyPennylaneDiagnostics.Failure.class)
                        .hasMessage("API Pennylane temporairement indisponible").hasNoCause()
                        .satisfies(e -> assertThat(e.getSuppressed()).isEmpty());
                assertThat(breaker.getMetrics().getNumberOfFailedCalls()).isEqualTo(1);
                logs.assertPrivateDataAbsent();
                server.verify();
            }
        });
    }

    static Stream<Arguments> failures() {
        return Stream.of("invoices", "expenses").flatMap(type ->
                Stream.of("unknown", "fake-vat", "unavailable", "invalid-response", "vat", "busy")
                        .map(reason -> Arguments.of(type, reason)));
    }

    @ParameterizedTest @MethodSource("failures")
    void mixedBatchReturnsOnlyBoundedReasonsAndLocalReferences(String type, String scenario) throws Exception {
        var client = mock(PennylaneAccountingClient.class);
        var oauth = mock(PennylaneOAuthService.class);
        var connections = mock(PennylaneConnectionRepository.class);
        var invoices = mock(InvoiceRepository.class);
        var expenses = mock(ProviderExpenseRepository.class);
        when(oauth.isConnected(7L)).thenReturn(true);
        RuntimeException failure = switch (scenario) {
            case "unavailable" -> BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.UNAVAILABLE);
            case "invalid-response" -> BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.INVALID_RESPONSE);
            case "vat" -> BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.UNSUPPORTED_VAT);
            case "busy" -> new BaitlyOAuthBusyException();
            default -> new IllegalStateException("Taux de TVA non reconnu access_token=" + PRIVATE,
                    new RuntimeException("refresh_token=" + PRIVATE));
        };
        failure.addSuppressed(new RuntimeException("suppressed=" + PRIVATE));
        Long id = scenario.equals("unknown") ? null : scenario.equals("fake-vat") ? -1L : 42L;
        var badInvoice = invoice(id);
        var goodInvoice = invoice(43L);
        var badExpense = expense(id);
        var goodExpense = expense(43L);
        if (type.equals("invoices")) {
            when(invoices.findPendingPennylaneSync(eq(7L), any())).thenReturn(List.of(badInvoice, goodInvoice));
            when(client.findCustomerByExternalRef(eq(7L), anyString())).thenReturn(Optional.of(Map.of("id", 1)));
            when(client.createCustomerInvoice(eq(7L), any())).thenThrow(failure).thenReturn(Map.of("id", "synthetic-private-id"));
        } else {
            when(expenses.findPendingPennylaneSync(eq(7L), any())).thenReturn(List.of(badExpense, goodExpense));
            when(client.findSupplierByExternalRef(eq(7L), anyString())).thenReturn(Optional.of(Map.of("id", 1)));
            when(client.createSupplierInvoice(eq(7L), any())).thenThrow(failure).thenReturn(Map.of("id", "synthetic-private-id"));
        }
        var service = new PennylaneAccountingSyncService(client, oauth, connections, invoices, expenses);
        try (var logs = new Logs(PennylaneAccountingSyncService.class)) {
            var result = type.equals("invoices") ? service.syncAllPendingInvoices(7L) : service.syncAllPendingExpenses(7L);
            assertThat(result.synced()).isEqualTo(1);
            assertThat(result.failed()).isEqualTo(1);
            assertThat(result.total()).isEqualTo(2);
            assertThat(result.errors()).hasSize(1);
            String reason = switch (scenario) {
                case "unavailable" -> "API Pennylane temporairement indisponible";
                case "invalid-response" -> "Réponse Pennylane invalide : identifiant absent ou invalide";
                case "vat" -> "Taux de TVA non reconnu pour l'export Pennylane";
                case "busy" -> "Opération OAuth déjà en cours ; réessayer ultérieurement";
                default -> "Synchronisation non confirmée ; vérifier le résultat avant de relancer";
            };
            String kind = type.equals("invoices") ? "Facture" : "Dépense";
            String reference = id != null && id > 0 ? " #42" : " (ligne 1)";
            assertThat(result.errors()).containsExactly(kind + reference + ": " + reason);
            assertThat(new ObjectMapper().writeValueAsString(result))
                    .doesNotContain(PRIVATE, "synthetic-private-id", "access_token", "refresh_token", "suppressed");
            logs.assertPrivateDataAbsent();
            if (type.equals("invoices")) {
                verify(invoices, never()).save(badInvoice);
                verify(invoices).save(goodInvoice);
                assertThat(badInvoice.getPennylaneSyncedAt()).isNull();
            } else {
                verify(expenses, never()).save(badExpense);
                verify(expenses).save(goodExpense);
                assertThat(badExpense.getPennylaneSyncedAt()).isNull();
            }
        }
    }

    private Invoice invoice(Long id) {
        var item = new Invoice(); item.setId(id); item.setOrganizationId(7L);
        item.setInvoiceNumber(PRIVATE); item.setBuyerName(PRIVATE);
        item.setInvoiceDate(LocalDate.of(2026, 10, 22)); item.setLines(List.of());
        return item;
    }

    private ProviderExpense expense(Long id) {
        var item = new ProviderExpense(); item.setId(id); item.setOrganizationId(7L);
        item.setDescription(PRIVATE); item.setExpenseDate(LocalDate.of(2026, 10, 22));
        item.setAmountHt(BigDecimal.TEN); item.setTaxRate(new BigDecimal("0.20"));
        return item;
    }

    private static class Logs implements AutoCloseable {
        final ch.qos.logback.classic.Logger logger;
        final ch.qos.logback.classic.Level previous;
        final ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> events = new ch.qos.logback.core.read.ListAppender<>();
        Logs(Class<?> type) {
            logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(type);
            previous = logger.getLevel(); logger.setLevel(ch.qos.logback.classic.Level.TRACE);
            events.start(); logger.addAppender(events);
        }
        void assertPrivateDataAbsent() {
            assertThat(events.list).isNotEmpty().allSatisfy(event -> {
                assertThat(event.getFormattedMessage()).doesNotContain(PRIVATE, "synthetic-private-id", "access_token", "refresh_token", "suppressed");
                assertThat(Arrays.deepToString(event.getArgumentArray())).doesNotContain(PRIVATE);
                assertThat(event.getThrowableProxy()).isNull();
            });
        }
        public void close() { logger.detachAppender(events); logger.setLevel(previous); events.stop(); }
    }

    @Configuration(proxyBeanMethods = false)
    static class ClientConfig {
        @Bean PennylaneOAuthService oauth() { return mock(PennylaneOAuthService.class); }
        @Bean PennylaneAccountingClient client(PennylaneOAuthService oauth) {
            var config = mock(PennylaneConfig.class);
            when(config.getAccountingApiBaseUrl()).thenReturn("https://accounting.example.invalid");
            return new PennylaneAccountingClient(config, oauth);
        }
    }
}
