package com.clenzy.config.health;

import org.apache.kafka.common.Metric;
import org.apache.kafka.common.MetricName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * HealthIndicator custom pour Kafka.
 *
 * Verifie que le producer Kafka est fonctionnel en consultant
 * ses metriques internes. Expose l'etat sur /actuator/health.
 */
@Component("kafkaCustomHealth")
public class KafkaHealthIndicator implements HealthIndicator {

    private static final Logger log = LoggerFactory.getLogger(KafkaHealthIndicator.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public KafkaHealthIndicator(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @Override
    public Health health() {
        try {
            Map<MetricName, ? extends Metric> metrics = kafkaTemplate.metrics();

            if (metrics == null || metrics.isEmpty()) {
                return Health.unknown()
                        .withDetail("reason", "No Kafka producer metrics available")
                        .build();
            }

            // Chercher la metrique connection-count pour verifier la connectivite
            double connectionCount = -1;
            for (Map.Entry<MetricName, ? extends Metric> entry : metrics.entrySet()) {
                if ("connection-count".equals(entry.getKey().name())) {
                    Object value = entry.getValue().metricValue();
                    if (value instanceof Number) {
                        connectionCount = ((Number) value).doubleValue();
                    }
                    break;
                }
            }

            Health.Builder builder = Health.up()
                    .withDetail("metricsCount", metrics.size());

            if (connectionCount >= 0) {
                builder.withDetail("connectionCount", connectionCount);
            }

            return builder.build();

        } catch (Exception e) {
            log.warn("Kafka health check failed: {}", e.getMessage());
            return Health.down()
                    .withDetail("error", e.getClass().getSimpleName())
                    .withDetail("message", e.getMessage())
                    .build();
        }
    }
}
