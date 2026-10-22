package com.clenzy.integration.channex.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;
import java.util.Set;

/**
 * Metriques Micrometer dediees a l'integration Channex.
 *
 * <p>Toutes les metriques sont exposees via {@code /actuator/prometheus} et
 * sont consommees par le dashboard Grafana "Baitly / Channel Manager".</p>
 *
 * <p>Nommage : prefixe {@code channex.*} pour distinguer des autres metriques
 * Sync (qui utilisent {@code pms.sync.*}). Channex est un middleware
 * d'agregation, pas un connector direct OTA → metriques separees.</p>
 */
@Component
public class ChannexMetrics {

    // The event name comes from a remote payload: never use arbitrary input as a label.
    private static final Set<String> EVENTS = Set.of("unknown", "whitelabel", "booking_new",
        "booking_modification", "booking_cancellation", "non_acked_booking", "booking", "sync_error",
        "booking_unmapped_room", "booking_unmapped_rate", "rate_error", "sync_warning", "new_channel",
        "updated_channel", "activate_channel", "deactivate_channel", "disconnect_channel", "disconnect_listing",
        "reservation_request", "alteration_request", "inquiry", "accepted_reservation", "declined_reservation",
        "message", "review", "updated_review");
    private static final Set<String> OUTCOMES = Set.of("ok", "invalid_signature", "malformed", "business_error",
        "technical_error", "ignored", "not_ready");

    private final MeterRegistry registry;

    public ChannexMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    // ─── HTTP client metrics ────────────────────────────────────────────────

    /** Compte les appels HTTP reussis vers l'API Channex (tag operation). */
    public void recordClientSuccess(String operation, long durationMs) {
        Counter.builder("channex.client.success")
            .description("Calls successfully completed to Channex API")
            .tag("operation", operation)
            .register(registry)
            .increment();
        Timer.builder("channex.client.latency_ms")
            .description("Channex API call latency in milliseconds")
            .tag("operation", operation)
            .tag("outcome", "success")
            .register(registry)
            .record(durationMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Compte les erreurs HTTP renvoyees par l'API Channex.
     * @param kind Categorie d'erreur (BAD_REQUEST, UNAUTHORIZED, RATE_LIMITED, SERVER_ERROR, TRANSPORT, NOT_FOUND)
     */
    public void recordClientError(String operation, String kind, long durationMs) {
        Counter.builder("channex.client.errors")
            .description("Errors raised by Channex API calls")
            .tag("operation", operation)
            .tag("kind", kind)
            .register(registry)
            .increment();
        Timer.builder("channex.client.latency_ms")
            .description("Channex API call latency in milliseconds")
            .tag("operation", operation)
            .tag("outcome", "error")
            .register(registry)
            .record(durationMs, TimeUnit.MILLISECONDS);
    }

    /** Compte les retries declenches (apres 429 ou 5xx). */
    public void recordClientRetry(String operation) {
        Counter.builder("channex.client.retries")
            .description("Number of retries attempted on Channex API calls")
            .tag("operation", operation)
            .register(registry)
            .increment();
    }

    // ─── Sync metrics (outbound : PMS → Channex → OTAs) ─────────────────────

    public void recordSyncSuccess(String operation, long durationMs) {
        Counter.builder("channex.sync.success")
            .description("Outbound sync events successfully pushed to Channex")
            .tag("operation", operation)
            .register(registry)
            .increment();
        Timer.builder("channex.sync.latency_ms")
            .description("Outbound sync end-to-end latency in milliseconds")
            .tag("operation", operation)
            .tag("outcome", "success")
            .register(registry)
            .record(durationMs, TimeUnit.MILLISECONDS);
    }

    public void recordSyncError(String operation, String kind, long durationMs) {
        Counter.builder("channex.sync.errors")
            .description("Outbound sync errors (Channex API or internal)")
            .tag("operation", operation)
            .tag("kind", kind)
            .register(registry)
            .increment();
        Timer.builder("channex.sync.latency_ms")
            .tag("operation", operation)
            .tag("outcome", "error")
            .register(registry)
            .record(durationMs, TimeUnit.MILLISECONDS);
    }

    // ─── Webhook metrics (inbound : OTAs → Channex → PMS) ───────────────────

    /** Compte les webhooks recus (tag event_type : booking_new/modification/cancellation/...). */
    public void recordWebhookReceived(String eventType, String outcome) {
        Counter.builder("channex.webhook.received")
            .description("Webhooks received from Channex")
            .tag("event_type", eventType != null && EVENTS.contains(eventType) ? eventType : "unknown")
            .tag("outcome", outcome != null && OUTCOMES.contains(outcome) ? outcome : "unknown")
            .register(registry)
            .increment();
    }

    /** Compte les bookings effectivement crees/modifies/annules cote Baitly. */
    public void recordBookingProcessed(String action) {
        Counter.builder("channex.booking.processed")
            .description("Bookings effectively processed (created, modified, cancelled)")
            .tag("action", action) // new | modification | cancellation | duplicate_skip
            .register(registry)
            .increment();
    }

    // ─── Onboarding metrics ─────────────────────────────────────────────────

    public void recordMappingCreated() {
        Counter.builder("channex.mapping.created")
            .description("New Channex property mappings created via onboarding")
            .register(registry)
            .increment();
    }

    public void recordMappingDeleted() {
        Counter.builder("channex.mapping.deleted")
            .description("Channex property mappings removed")
            .register(registry)
            .increment();
    }
}
