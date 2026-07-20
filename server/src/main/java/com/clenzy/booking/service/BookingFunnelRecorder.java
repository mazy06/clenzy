package com.clenzy.booking.service;

import com.clenzy.model.BookingFunnelEvent;
import com.clenzy.repository.BookingFunnelEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * Capture server-side du funnel booking engine (fondations RMS R1).
 *
 * <p>Asynchrone et non bloquant : un échec de télémétrie ne doit JAMAIS faire
 * échouer une recherche ou une réservation — l'exception est comptée
 * ({@link #failureCount}) et journalisée en warn, c'est l'exception assumée à la
 * règle « pas de catch avaleur » (télémétrie best-effort, documentée ici).</p>
 *
 * <p>Vie privée par construction : payload limité aux clés métier passées par les
 * appelants (dates, voyageurs, nuits, propriété) — jamais d'email, nom, IP.
 * {@code sessionKey} est un identifiant opaque optionnel envoyé par le SDK
 * (header {@code X-Booking-Session}), tronqué et filtré.</p>
 */
@Service
public class BookingFunnelRecorder {

    private static final Logger log = LoggerFactory.getLogger(BookingFunnelRecorder.class);

    /** Format accepté pour la clé de session SDK (UUID ou identifiant opaque). */
    private static final Pattern SESSION_KEY_PATTERN = Pattern.compile("[A-Za-z0-9_-]{8,64}");

    private final BookingFunnelEventRepository repository;
    private final AtomicLong failureCount = new AtomicLong();

    public BookingFunnelRecorder(BookingFunnelEventRepository repository) {
        this.repository = repository;
    }

    /**
     * Enregistre un événement de funnel (hors chemin critique — @Async).
     * Les valeurs null du payload sont ignorées.
     */
    @Async
    public void record(Long orgId, Long engineConfigId, String rawSessionKey,
                       BookingFunnelEvent.Type type, Long propertyId,
                       Map<String, Object> payload) {
        if (orgId == null || type == null) {
            return;
        }
        try {
            repository.save(new BookingFunnelEvent(
                    orgId, engineConfigId, sanitizeSessionKey(rawSessionKey),
                    type, propertyId, compact(payload)));
        } catch (RuntimeException e) {
            // Télémétrie best-effort : jamais bloquant (voir Javadoc de classe).
            long failures = failureCount.incrementAndGet();
            log.warn("Funnel booking : écriture échouée ({} échec(s) cumulés) : {}",
                    failures, e.getMessage());
        }
    }

    /** Payload de recherche/checkout : clés fixes, jamais de PII. */
    public static Map<String, Object> stayPayload(LocalDate checkIn, LocalDate checkOut, Integer guests) {
        Map<String, Object> payload = new HashMap<>();
        if (checkIn != null) {
            payload.put("checkIn", checkIn.toString());
        }
        if (checkOut != null) {
            payload.put("checkOut", checkOut.toString());
            if (checkIn != null) {
                payload.put("nights", java.time.temporal.ChronoUnit.DAYS.between(checkIn, checkOut));
            }
        }
        if (guests != null) {
            payload.put("guests", guests);
        }
        return payload;
    }

    long failureCount() {
        return failureCount.get();
    }

    static String sanitizeSessionKey(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return SESSION_KEY_PATTERN.matcher(trimmed).matches() ? trimmed : null;
    }

    private static Map<String, Object> compact(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        Map<String, Object> compacted = new HashMap<>(payload);
        compacted.values().removeIf(java.util.Objects::isNull);
        return compacted.isEmpty() ? null : compacted;
    }
}
