package com.clenzy.integration.oauth;

import com.clenzy.integration.docusign.config.DocuSignOAuthProviderConfig;
import com.clenzy.integration.docusign.service.DocuSignConnectionPersistence;
import com.clenzy.integration.docusign.service.DocuSignOAuthService;
import com.clenzy.integration.pennylane.config.PennylaneOAuthProviderConfig;
import com.clenzy.integration.pennylane.service.PennylaneConnectionPersistence;
import com.clenzy.integration.pennylane.service.PennylaneOAuthService;
import com.clenzy.repository.IntegrationPartnerRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.springboot3.circuitbreaker.autoconfigure.CircuitBreakerAutoConfiguration;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.client.ResourceAccessException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Configuration réelle et proxy Spring, sans connexion à un fournisseur. */
class BaitlyOAuthCircuitBreakerTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class, CircuitBreakerAutoConfiguration.class))
            .withInitializer(context -> {
                try {
                    for (var source : new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))) {
                        context.getEnvironment().getPropertySources().addLast(source);
                    }
                } catch (java.io.IOException e) {
                    throw new IllegalStateException("Configuration de recette indisponible", e);
                }
            })
            .withUserConfiguration(BaitlyOAuthCircuitBreakerConfiguration.class, Facades.class);

    @ParameterizedTest
    @ValueSource(strings = {"airbnb-oauth", "homeaway-oauth", "pennylane-api", "docusign-api"})
    void contentionIsIgnoredButTransportFailuresStillOpenCircuit(String name) {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            var breaker = context.getBean(CircuitBreakerRegistry.class).circuitBreaker(name);
            for (int i = 0; i < 20; i++) {
                assertThatThrownBy(() -> breaker.executeSupplier(() -> { throw new BaitlyOAuthBusyException(); }))
                        .isExactlyInstanceOf(BaitlyOAuthBusyException.class);
            }
            assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
            assertThat(breaker.getMetrics().getNumberOfBufferedCalls()).isZero();
            assertThat(breaker.executeSupplier(() -> "synthetic-success")).isEqualTo("synthetic-success");
            breaker.reset();
            int calls = breaker.getCircuitBreakerConfig().getMinimumNumberOfCalls();
            for (int i = 0; i < calls; i++) {
                assertThatThrownBy(() -> breaker.executeSupplier(() -> { throw new ResourceAccessException("synthetic transport failure"); }))
                        .isInstanceOf(ResourceAccessException.class);
            }
            assertThat(breaker.getMetrics().getNumberOfFailedCalls()).isEqualTo(calls);
            assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);
            breaker.transitionToHalfOpenState();
            for (int i = 0; i < 20; i++) {
                assertThatThrownBy(() -> breaker.executeSupplier(() -> { throw new BaitlyOAuthBusyException(); }))
                        .isExactlyInstanceOf(BaitlyOAuthBusyException.class);
            }
            assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.HALF_OPEN);
            assertThat(breaker.getMetrics().getNumberOfBufferedCalls()).isZero();
            int probes = breaker.getCircuitBreakerConfig().getPermittedNumberOfCallsInHalfOpenState();
            for (int i = 0; i < probes; i++) breaker.executeSupplier(() -> "synthetic-recovery");
            assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
        });
    }

    @ParameterizedTest
    @CsvSource({"pennylane,exchange", "pennylane,refresh", "docusign,exchange", "docusign,refresh"})
    void realFacadeFallbackPreservesBusyAndProtectsProviderDiagnostics(String provider, String action) {
        runner.run(context -> {
            var engine = context.getBean(OAuthFlowEngine.class);
            var busy = new BaitlyOAuthBusyException();
            when(engine.exchangeCodeForToken(any(), any(), anyString(), anyLong(), anyLong())).thenThrow(busy);
            when(engine.refreshToken(any(), any(), anyLong())).thenThrow(busy);
            Runnable operation = () -> {
                if (provider.equals("pennylane")) {
                    var service = context.getBean(PennylaneOAuthService.class);
                    if (action.equals("exchange")) service.exchangeCodeForToken("synthetic-code", 1L, 7L);
                    else service.refreshToken(7L);
                } else {
                    var service = context.getBean(DocuSignOAuthService.class);
                    if (action.equals("exchange")) service.exchangeCodeForToken("synthetic-code", 1L, 7L);
                    else service.refreshToken(7L);
                }
            };
            var breaker = context.getBean(CircuitBreakerRegistry.class).circuitBreaker(provider + "-api");
            for (int i = 0; i < 12; i++) assertThatThrownBy(operation::run).isSameAs(busy);
            assertThat(breaker.getMetrics().getNumberOfBufferedCalls()).isZero();

            // Données exclusivement synthétiques : ni le message ni le graphe de causes ne doivent sortir.
            var failure = new ResourceAccessException("access_token=synthetic-private",
                    new java.io.IOException("email=synthetic@example.invalid"));
            failure.addSuppressed(new RuntimeException("refresh_token=synthetic-private"));
            reset(engine);
            when(engine.exchangeCodeForToken(any(), any(), anyString(), anyLong(), anyLong())).thenThrow(failure);
            when(engine.refreshToken(any(), any(), anyLong())).thenThrow(failure);
            var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(
                    provider.equals("pennylane") ? PennylaneOAuthService.class : DocuSignOAuthService.class);
            var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
            logs.start();
            logger.addAppender(logs);
            try {
                int calls = breaker.getCircuitBreakerConfig().getMinimumNumberOfCalls();
                for (int i = 0; i < calls; i++) {
                    assertThatThrownBy(operation::run).hasMessageContaining("temporairement indisponible")
                            .hasNoCause().satisfies(error -> assertThat(error.getSuppressed()).isEmpty());
                }
                assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);
                clearInvocations(engine);
                assertThatThrownBy(operation::run).hasMessageContaining("temporairement indisponible").hasNoCause();
                verifyNoInteractions(engine);
                assertThat(logs.list).isNotEmpty().allSatisfy(event -> {
                    assertThat(event.getFormattedMessage()).doesNotContain("synthetic-private", "example.invalid", "access_token", "refresh_token");
                    assertThat(event.getThrowableProxy()).isNull();
                });
            } finally {
                logger.detachAppender(logs);
                logs.stop();
            }
        });
    }

    @Configuration(proxyBeanMethods = false)
    static class Facades {
        @Bean OAuthFlowEngine engine() { return mock(OAuthFlowEngine.class); }
        @Bean PennylaneOAuthService pennylane(OAuthFlowEngine engine) {
            return new PennylaneOAuthService(engine, mock(OAuthStateService.class), mock(PennylaneOAuthProviderConfig.class),
                    mock(PennylaneConnectionPersistence.class), mock(IntegrationPartnerRepository.class));
        }
        @Bean DocuSignOAuthService docusign(OAuthFlowEngine engine) {
            return new DocuSignOAuthService(engine, mock(OAuthStateService.class), mock(DocuSignOAuthProviderConfig.class),
                    mock(DocuSignConnectionPersistence.class));
        }
    }
}
