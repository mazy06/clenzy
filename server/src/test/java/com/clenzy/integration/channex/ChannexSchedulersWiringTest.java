package com.clenzy.integration.channex;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.client.ChannexSignatureValidator;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.controller.ChannexWebhookController;
import com.clenzy.integration.channex.repository.ChannexPriceDriftRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.integration.channex.service.ChannexBookingFeedScheduler;
import com.clenzy.integration.channex.service.ChannexBookingFeedService;
import com.clenzy.integration.channex.service.ChannexChannelEventService;
import com.clenzy.integration.channex.service.ChannexConnectService;
import com.clenzy.integration.channex.service.ChannexMessagingService;
import com.clenzy.integration.channex.service.ChannexRatesReconciliationScheduler;
import com.clenzy.integration.channex.service.ChannexRestrictionReconciliationScheduler;
import com.clenzy.integration.channex.service.ChannexSyncErrorService;
import com.clenzy.integration.channex.service.ChannexWatchdogScheduler;
import com.clenzy.integration.channex.service.RateParityService;
import com.clenzy.integration.channex.service.RestrictionDivergenceDetector;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.scheduler.RateParityScheduler;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.tenant.TenantScopedExecutor;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Verifie le <b>cablage par flag</b> des schedulers Channex : quels beans Spring
 * instancie selon {@code clenzy.channex.enabled}.
 *
 * <p>Enjeu concret : tant que le contrat de partenariat n'est pas signe, la cle
 * API n'ouvre aucun acces et les cinq schedulers echouent en boucle en
 * production ({@code Channex auth failed: unauthorized}) — ~270 passes par jour,
 * dont ~144 loguees en ERROR par le booking feed. Le flag doit reellement
 * <i>retirer</i> ces beans du contexte, pas seulement les faire echouer plus
 * discretement.</p>
 *
 * <p>Symetriquement, le defaut doit rester {@code true} : une regression sur
 * {@code matchIfMissing} couperait la synchronisation OTA en silence le jour ou
 * le contrat sera signe.</p>
 *
 * <p>On utilise un {@link ApplicationContextRunner} plutot qu'un
 * {@code @SpringBootTest} : il evalue reellement les {@code @ConditionalOnProperty}
 * sans demarrer l'application (cf. {@code PhotoStorageWiringTest}).</p>
 */
class ChannexSchedulersWiringTest {

    /** Les cinq schedulers portant un {@code @ConditionalOnProperty} Channex. */
    private static final List<Class<?>> SCHEDULERS = List.of(
            ChannexBookingFeedScheduler.class,
            ChannexWatchdogScheduler.class,
            ChannexRatesReconciliationScheduler.class,
            ChannexRestrictionReconciliationScheduler.class,
            RateParityScheduler.class);

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(StubDependencies.class, Schedulers.class);

    @Test
    @DisplayName("Sans flag : tous les schedulers sont presents (defaut historique)")
    void byDefault_allSchedulersArePresent() {
        runner.run(context -> SCHEDULERS.forEach(scheduler ->
                assertThat(context).hasSingleBean(scheduler)));
    }

    @Test
    @DisplayName("clenzy.channex.enabled=true : tous les schedulers sont presents")
    void explicitlyEnabled_allSchedulersArePresent() {
        runner.withPropertyValues("clenzy.channex.enabled=true").run(context ->
                SCHEDULERS.forEach(scheduler -> assertThat(context).hasSingleBean(scheduler)));
    }

    @Test
    @DisplayName("clenzy.channex.enabled=false : AUCUN scheduler n'est instancie")
    void disabled_noSchedulerIsInstantiated() {
        runner.withPropertyValues("clenzy.channex.enabled=false").run(context -> {
            assertThat(context).hasNotFailed();
            SCHEDULERS.forEach(scheduler -> assertThat(context).doesNotHaveBean(scheduler));
        });
    }

    /**
     * Le webhook entrant {@code POST /api/webhooks/channex} doit rester cable
     * integration coupee : c'est le seul flux qui ne depend pas de notre cle API
     * (Channex s'authentifie chez nous, pas l'inverse). Le jour ou le contrat
     * sera signe, un webhook tombant sur un controller absent renverrait 404/500
     * au lieu du 200/401 attendu.
     *
     * <p>Ce test verrouille le perimetre du flag : il echouera si quelqu'un
     * etend le {@code @ConditionalOnProperty} au controller ou a ses services.</p>
     */
    @Test
    @DisplayName("Desactive : le controller webhook et ses services restent cables")
    void disabled_webhookEndpointRemainsWired() {
        runner.withUserConfiguration(WebhookEndpoint.class)
                .withPropertyValues("clenzy.channex.enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(ChannexWebhookController.class);
                    assertThat(context).hasSingleBean(ChannexSignatureValidator.class);
                });
    }

    /**
     * Comportement <b>constate</b>, pas souhaite : {@code havingValue = "true"}
     * n'accepte que cette valeur exacte (comparaison insensible a la casse).
     * Toute autre — {@code yes}, {@code 1}, une faute de frappe — retire les
     * schedulers exactement comme {@code false}. Poser {@code CHANNEX_ENABLED=1}
     * en croyant activer l'integration la couperait donc silencieusement.
     */
    @Test
    @DisplayName("Valeur non booleenne : schedulers absents (ce test documente le piege)")
    void unknownValue_yieldsNoScheduler() {
        for (String value : new String[] {"1", "yes", "enabled"}) {
            runner.withPropertyValues("clenzy.channex.enabled=" + value).run(context ->
                    assertThat(context).doesNotHaveBean(ChannexBookingFeedScheduler.class));
        }
        // Contre-epreuve : "true" reste reconnu quelle que soit la casse.
        runner.withPropertyValues("clenzy.channex.enabled=TRUE").run(context ->
                assertThat(context).hasSingleBean(ChannexBookingFeedScheduler.class));
    }

    @Configuration(proxyBeanMethods = false)
    @Import({ChannexWebhookController.class, ChannexSignatureValidator.class})
    static class WebhookEndpoint {

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        ChannexMetrics channexMetrics(MeterRegistry registry) {
            return new ChannexMetrics(registry);
        }

        @Bean
        ChannexSyncErrorService channexSyncErrorService() {
            return mock(ChannexSyncErrorService.class);
        }

        @Bean
        ChannexMessagingService channexMessagingService() {
            return mock(ChannexMessagingService.class);
        }

        @Bean
        ChannexChannelEventService channexChannelEventService() {
            return mock(ChannexChannelEventService.class);
        }
    }

    @Configuration(proxyBeanMethods = false)
    @Import({ChannexBookingFeedScheduler.class,
             ChannexWatchdogScheduler.class,
             ChannexRatesReconciliationScheduler.class,
             ChannexRestrictionReconciliationScheduler.class,
             RateParityScheduler.class})
    static class Schedulers {
    }

    @Configuration(proxyBeanMethods = false)
    static class StubDependencies {

        /** Instance reelle : c'est le porteur du flag, pas une dependance a simuler. */
        @Bean
        ChannexProperties channexProperties() {
            return new ChannexProperties();
        }

        @Bean
        MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }

        @Bean
        ChannexClient channexClient() {
            return mock(ChannexClient.class);
        }

        @Bean
        ChannexPropertyMappingRepository channexPropertyMappingRepository() {
            return mock(ChannexPropertyMappingRepository.class);
        }

        @Bean
        ChannexPriceDriftRepository channexPriceDriftRepository() {
            return mock(ChannexPriceDriftRepository.class);
        }

        @Bean
        ChannexBookingFeedService channexBookingFeedService() {
            return mock(ChannexBookingFeedService.class);
        }

        @Bean
        ChannexConnectService channexConnectService() {
            return mock(ChannexConnectService.class);
        }

        @Bean
        RestrictionDivergenceDetector restrictionDivergenceDetector() {
            return mock(RestrictionDivergenceDetector.class);
        }

        @Bean
        RateParityService rateParityService() {
            return mock(RateParityService.class);
        }

        @Bean
        PropertyRepository propertyRepository() {
            return mock(PropertyRepository.class);
        }

        @Bean
        BookingRestrictionRepository bookingRestrictionRepository() {
            return mock(BookingRestrictionRepository.class);
        }

        @Bean
        AutomationRuleRepository automationRuleRepository() {
            return mock(AutomationRuleRepository.class);
        }

        @Bean
        NotificationService notificationService() {
            return mock(NotificationService.class);
        }

        @Bean
        PriceEngine priceEngine() {
            return mock(PriceEngine.class);
        }

        @Bean
        AutomationEngine automationEngine() {
            return mock(AutomationEngine.class);
        }

        @Bean
        TenantScopedExecutor tenantScopedExecutor() {
            return mock(TenantScopedExecutor.class);
        }

        @Bean
        SupervisionActivityService supervisionActivityService() {
            return mock(SupervisionActivityService.class);
        }

        @Bean
        SupervisionSuggestionService supervisionSuggestionService() {
            return mock(SupervisionSuggestionService.class);
        }
    }
}
