package com.clenzy.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration des metriques Micrometer pour le monitoring de l'API Gateway.
 *
 * Metriques exposees :
 * - clenzy.api.request.duration  : Timer de la duree des requetes (tags: method, uri, status)
 * - clenzy.api.request.total     : Compteur du nombre total de requetes
 * - clenzy.api.error.client      : Compteur des erreurs client (4xx)
 * - clenzy.api.error.server      : Compteur des erreurs serveur (5xx)
 * - clenzy.api.webhook.airbnb    : Compteur des webhooks Airbnb traites
 *
 * Ces metriques sont collectees par Prometheus via /actuator/prometheus
 * et visualisees dans Grafana.
 */
@Configuration
public class ApiMetricsConfig {

    /**
     * Timer pour mesurer la duree de chaque requete API.
     * Tags disponibles : method, uri, status.
     * Utilisation : apiRequestTimer.record(() -> { ... }) ou via Timer.Sample
     */
    @Bean
    public Timer apiRequestTimer(MeterRegistry meterRegistry) {
        return Timer.builder("clenzy.api.request.duration")
                .description("Duree de traitement des requetes API")
                .register(meterRegistry);
    }

    /**
     * Compteur du nombre total de requetes recues par l'API.
     */
    @Bean
    public Counter apiRequestTotalCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.api.request.total")
                .description("Nombre total de requetes API")
                .register(meterRegistry);
    }

    /**
     * Compteur des erreurs client (reponses HTTP 4xx).
     * Permet de detecter les pics de requetes invalides ou non autorisees.
     */
    @Bean
    public Counter apiClientErrorCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.api.error.client")
                .description("Nombre d'erreurs client (4xx)")
                .register(meterRegistry);
    }

    /**
     * Compteur des erreurs serveur (reponses HTTP 5xx).
     * Alerte critique : un pic indique un probleme applicatif.
     */
    @Bean
    public Counter apiServerErrorCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.api.error.server")
                .description("Nombre d'erreurs serveur (5xx)")
                .register(meterRegistry);
    }

    /**
     * Compteur des webhooks Airbnb recus et traites.
     * Permet de monitorer le volume d'evenements entrants depuis Airbnb.
     */
    @Bean
    public Counter airbnbWebhookCounter(MeterRegistry meterRegistry) {
        return Counter.builder("clenzy.api.webhook.airbnb")
                .description("Nombre de webhooks Airbnb traites")
                .register(meterRegistry);
    }
}
