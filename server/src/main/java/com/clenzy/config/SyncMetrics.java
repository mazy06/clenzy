package com.clenzy.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Bean central de metriques Micrometer pour le monitoring du PMS.
 *
 * Expose toutes les metriques requises par le Niveau 6 de la certification
 * Airbnb Partner :
 * - Sync success/failure/latency par channel
 * - Calendar operations latency par type
 * - Reservation creation latency par source
 * - Outbox queue depth
 * - Conflict detection et double-booking prevention
 *
 * Toutes les metriques sont exposees via /actuator/prometheus.
 */
@Component
public class SyncMetrics {

    private final MeterRegistry registry;

    // ---- Gauges (AtomicLong) ----
    private final AtomicLong pendingOutboxEvents;
    private final AtomicLong activeSyncConnections;

    // ---- Pre-registered counters (no dynamic tags) ----
    private final Counter conflictDetectedCounter;
    private final Counter lockContentionCounter;
    private final Counter doubleBookingPreventedCounter;

    public SyncMetrics(MeterRegistry registry) {
        this.registry = registry;

        // Gauges
        this.pendingOutboxEvents = registry.gauge(
                "pms.outbox.pending",
                new AtomicLong(0));
        this.activeSyncConnections = registry.gauge(
                "pms.sync.connections.active",
                new AtomicLong(0));

        // Counters sans tags dynamiques
        this.conflictDetectedCounter = Counter.builder("pms.calendar.conflict.detected")
                .description("Calendar conflicts detected (booking attempts on occupied dates)")
                .register(registry);

        this.lockContentionCounter = Counter.builder("pms.calendar.lock.contention")
                .description("Calendar advisory lock contention events")
                .register(registry);

        this.doubleBookingPreventedCounter = Counter.builder("pms.reservation.double_booking.prevented")
                .description("Double bookings prevented by conflict detection")
                .register(registry);
    }

    // ---- Sync metrics (dynamic channel tag) ----

    /**
     * Enregistre une sync channel reussie.
     *
     * @param channel nom du channel (AIRBNB, BOOKING, ICAL, etc.)
     * @param durationMs duree en millisecondes
     */
    public void recordSyncSuccess(String channel, long durationMs) {
        Counter.builder("pms.sync.success")
                .tag("channel", channel)
                .description("Successful channel synchronizations")
                .register(registry)
                .increment();

        Timer.builder("pms.sync.latency")
                .tag("channel", channel)
                .description("Channel sync latency")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry)
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Enregistre un echec de sync channel.
     *
     * @param channel   nom du channel
     * @param errorType type d'erreur (nom de la classe d'exception)
     * @param durationMs duree en millisecondes
     */
    public void recordSyncFailure(String channel, String errorType, long durationMs) {
        Counter.builder("pms.sync.failure")
                .tag("channel", channel)
                .tag("error_type", errorType != null ? errorType : "unknown")
                .description("Failed channel synchronizations")
                .register(registry)
                .increment();

        Timer.builder("pms.sync.latency")
                .tag("channel", channel)
                .description("Channel sync latency")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry)
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    // ---- Calendar operation metrics ----

    /**
     * Enregistre la duree d'une operation calendrier.
     *
     * @param operation type d'operation (book, cancel, block, unblock, updatePrice)
     * @param sample    Timer.Sample demarre en debut d'operation
     */
    public void recordCalendarOperation(String operation, Timer.Sample sample) {
        sample.stop(Timer.builder("pms.calendar.update.latency")
                .tag("operation", operation)
                .description("Calendar update processing time")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry));
    }

    /**
     * Incremente le compteur de conflits calendrier detectes.
     */
    public void incrementConflictDetected() {
        conflictDetectedCounter.increment();
    }

    /**
     * Incremente le compteur de contention de lock.
     */
    public void incrementLockContention() {
        lockContentionCounter.increment();
    }

    /**
     * Incremente le compteur de double-bookings empeches.
     */
    public void incrementDoubleBookingPrevented() {
        doubleBookingPreventedCounter.increment();
    }

    // ---- Reservation metrics ----

    /**
     * Enregistre la duree de creation d'une reservation.
     *
     * @param source source de la reservation (MANUAL, AIRBNB, ICAL, etc.)
     * @param sample Timer.Sample demarre en debut de creation
     */
    public void recordReservationCreation(String source, Timer.Sample sample) {
        sample.stop(Timer.builder("pms.reservation.creation.latency")
                .tag("source", source)
                .description("Reservation creation time including availability check")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry));
    }

    // ---- Outbox metrics ----

    /**
     * Met a jour le gauge de la profondeur de la queue outbox.
     *
     * @param count nombre d'events en attente
     */
    public void updateOutboxPending(long count) {
        pendingOutboxEvents.set(count);
    }

    /**
     * Met a jour le gauge du nombre de connexions sync actives.
     *
     * @param count nombre de connexions actives
     */
    public void updateActiveSyncConnections(long count) {
        activeSyncConnections.set(count);
    }

    // ---- Timer helpers ----

    /**
     * Demarre un Timer.Sample pour mesurer une operation.
     * Utiliser avec recordCalendarOperation() ou recordReservationCreation().
     *
     * @return Timer.Sample a stopper en fin d'operation
     */
    public Timer.Sample startTimer() {
        return Timer.start(registry);
    }

    /**
     * Expose le MeterRegistry pour les cas ou les services
     * ont besoin d'enregistrer des metriques ad-hoc.
     */
    public MeterRegistry getRegistry() {
        return registry;
    }
}
