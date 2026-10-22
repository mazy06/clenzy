package com.clenzy.config;

import com.clenzy.integration.channex.config.ChannexMetrics;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class BaitlyWebhookMetricsPrivacyTest {
    @Test void remoteEventNamesCannotLeakIntoPrometheusOrCreateUnboundedSeries() {
        var registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
        try {
            var metrics = new ChannexMetrics(registry);
            for (int i = 0; i < 100; i++) metrics.recordWebhookReceived("private@example.test/" + i, "ignored");
            metrics.recordWebhookReceived("booking_new", "ok");
            assertThat(registry.get("channex.webhook.received").tags("event_type", "unknown", "outcome", "ignored").counter().count()).isEqualTo(100);
            assertThat(registry.get("channex.webhook.received").tags("event_type", "booking_new", "outcome", "ok").counter().count()).isEqualTo(1);
            assertThat(registry.scrape()).doesNotContain("private", "example.test");
            assertThat(registry.getMeters()).hasSize(2);
        } finally {
            registry.close();
        }
    }
}
