package com.clenzy.integration.channex.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.service.PriceEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service de synchronisation sortante vers Channex.
 *
 * <p>Architecture : consomme le topic Kafka {@link KafkaConfig#TOPIC_CALENDAR_UPDATES}
 * en parallele de {@link com.clenzy.integration.channel.ChannelSyncService} (groupId
 * distinct : {@code clenzy-channex-sync}) pour pousser les changements de
 * disponibilite et de prix vers Channex, qui se charge ensuite de propager
 * vers les OTAs (Airbnb, Booking, Vrbo, ...).</p>
 *
 * <p><b>Regle metier importante :</b> si une property a un
 * {@link ChannexPropertyMapping} actif, on assume que ses OTAs sont gerees
 * par Channex et NON par les connectors directs. L'utilisateur doit
 * desactiver les mappings ChannelMapping correspondants pour eviter le double-push.</p>
 *
 * <p>Reference plan : {@code docs/strategy/channex-integration-plan.md} Sprint 3.</p>
 */
@Service
public class ChannexSyncService {

    private static final Logger log = LoggerFactory.getLogger(ChannexSyncService.class);
    private static final String KAFKA_GROUP_ID = "clenzy-channex-sync";

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;
    private final ObjectMapper objectMapper;
    private final ChannexMetrics metrics;
    private final ChannexSyncLogService syncLogService;
    private final com.clenzy.repository.PropertyRepository propertyRepository;

    public ChannexSyncService(ChannexClient channexClient,
                                ChannexPropertyMappingRepository mappingRepository,
                                CalendarDayRepository calendarDayRepository,
                                PriceEngine priceEngine,
                                ObjectMapper objectMapper,
                                ChannexMetrics metrics,
                                ChannexSyncLogService syncLogService,
                                com.clenzy.repository.PropertyRepository propertyRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
        this.syncLogService = syncLogService;
        this.propertyRepository = propertyRepository;
    }

    // ─── Kafka consumer ─────────────────────────────────────────────────────

    /**
     * Consomme les events emis par CalendarEngine / PriceEngine via OutboxRelay.
     *
     * <p>Filtre les properties qui n'ont PAS de mapping Channex actif (skip silencieux).
     * Les erreurs reseau sont catch et logguees : on n'echoue pas le consumer Kafka
     * pour eviter de bloquer le topic. Les retries sont gerees par le client HTTP
     * (backoff exponentiel) et le scheduler {@link #retryFailedMappings()}.</p>
     */
    @SuppressWarnings("unchecked")
    @Transactional
    @KafkaListener(topics = KafkaConfig.TOPIC_CALENDAR_UPDATES, groupId = KAFKA_GROUP_ID)
    public void onCalendarUpdate(Object payload) {
        try {
            Map<String, Object> event = unwrapPayload(payload);
            if (event == null) return;

            Long propertyId = extractLong(event, "propertyId");
            Long orgId = extractLong(event, "orgId");
            String action = (String) event.get("action");
            LocalDate from = parseDate(event, "from");
            LocalDate to = parseDate(event, "to");

            if (propertyId == null || orgId == null || from == null || to == null) {
                log.debug("ChannexSync: event incomplet, skip (propertyId={}, orgId={}, from={}, to={})",
                    propertyId, orgId, from, to);
                return;
            }

            Optional<ChannexPropertyMapping> mappingOpt =
                mappingRepository.findByClenzyPropertyId(propertyId, orgId);
            if (mappingOpt.isEmpty()) {
                // Property non geree par Channex — silence (les connectors directs s'en chargent)
                return;
            }

            ChannexPropertyMapping mapping = mappingOpt.get();
            ChannexSyncStatus status = mapping.getSyncStatus();
            if (status == ChannexSyncStatus.DISABLED) {
                log.debug("ChannexSync: mapping {} disabled, skip", mapping.getId());
                return;
            }

            // Gate OTA : meme regle que pushProperty() — pas de push tant qu'aucun
            // OTA n'est branche cote Channex (sinon les events Kafka generent des
            // appels API gaspilles vers Channex sans aucune distribution OTA).
            try {
                if (!channexClient.hasActiveOtaChannel(mapping.getChannexPropertyId())) {
                    log.debug("ChannexSync: event skip property={} (aucun OTA actif cote Channex)",
                        propertyId);
                    return;
                }
            } catch (Exception e) {
                // En cas d'erreur sur le check : continuer le push (preferable a un skip silencieux)
                log.warn("ChannexSync: check OTA actif KO ({}), push tente quand meme", e.getMessage());
            }

            log.info("ChannexSync: push declenche action={} property={} period=[{},{}]",
                action, propertyId, from, to);

            // Push availability + rates (les 2 sont independants — un echec n'impacte pas l'autre)
            boolean availabilityOk = pushAvailabilityForRange(mapping, from, to);
            boolean ratesOk = pushRatesForRange(mapping, from, to);

            updateMappingStatus(mapping, availabilityOk && ratesOk, null);
        } catch (Exception e) {
            log.error("ChannexSync: erreur traitement event (NON propagee pour ne pas bloquer le topic): {}",
                e.getMessage(), e);
        }
    }

    // ─── Push methods (visibles tests + appelables manuellement) ────────────

    /**
     * Force un push complet (availability + rates) d'une property sur une periode.
     * Utilise par l'UI onboarding apres creation d'un mapping (push initial).
     */
    @Transactional
    public ChannexSyncResult pushProperty(Long propertyId, Long orgId, LocalDate from, LocalDate to) {
        java.time.Instant startedAt = java.time.Instant.now();
        Optional<ChannexPropertyMapping> mappingOpt =
            mappingRepository.findByClenzyPropertyId(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            syncLogService.record(orgId, propertyId, null,
                com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
                com.clenzy.integration.channex.model.ChannexSyncLog.Status.FAIL,
                0, startedAt, "No Channex mapping for property " + propertyId);
            return new ChannexSyncResult(false, "No Channex mapping for property " + propertyId, 0, 0);
        }
        ChannexPropertyMapping mapping = mappingOpt.get();

        // Phase 3 OTA pricing : skip push si priceSourceOfTruth = OTA ou MANUAL
        // (sinon on ecraserait les prix que l'host gere de son cote).
        com.clenzy.model.PriceSourceOfTruth source = propertyRepository.findById(propertyId)
            .map(com.clenzy.model.Property::getPriceSourceOfTruth)
            .orElse(com.clenzy.model.PriceSourceOfTruth.CLENZY);
        if (source != com.clenzy.model.PriceSourceOfTruth.CLENZY) {
            log.info("ChannexSync: skip push property={} (price_source_of_truth={})", propertyId, source);
            syncLogService.record(orgId, propertyId, mapping.getId(),
                com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
                com.clenzy.integration.channex.model.ChannexSyncLog.Status.SKIPPED,
                0, startedAt, "Push skip — price_source_of_truth=" + source);
            return new ChannexSyncResult(true,
                "Skipped: price_source_of_truth=" + source + " (sync push desactivee)", 0, 0);
        }

        // Gate : ne push que si au moins un OTA (Airbnb, Booking, ...) est actif
        // pour cette property cote Channex. Tant qu'aucun OTA n'est branche,
        // push availability/rates est inutile (les donnees n'iront nulle part).
        // On evite ainsi les appels API gaspilles + la pollution Channex au stade
        // ou l'utilisateur n'a fait que connecter la property mais pas encore
        // l'OAuth Airbnb / les credentials Booking.
        try {
            if (!channexClient.hasActiveOtaChannel(mapping.getChannexPropertyId())) {
                log.info("ChannexSync: skip push property={} (aucun OTA actif cote Channex)",
                    propertyId);
                syncLogService.record(orgId, propertyId, mapping.getId(),
                    com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
                    com.clenzy.integration.channex.model.ChannexSyncLog.Status.SKIPPED,
                    0, startedAt, "Aucun OTA actif cote Channex");
                return new ChannexSyncResult(true,
                    "Skipped: no active OTA channel — connect Airbnb/Booking first", 0, 0);
            }
        } catch (Exception e) {
            // En cas d'erreur sur le check (network, 5xx Channex), on log mais on
            // continue le push : preferable de tenter qu'echouer silencieusement.
            log.warn("ChannexSync: impossible de verifier les OTA actifs ({}), on tente le push quand meme",
                e.getMessage());
        }

        boolean availOk = pushAvailabilityForRange(mapping, from, to);
        boolean ratesOk = pushRatesForRange(mapping, from, to);
        long days = java.time.temporal.ChronoUnit.DAYS.between(from, to.plusDays(1));
        boolean overallOk = availOk && ratesOk;

        updateMappingStatus(mapping, overallOk, null);

        syncLogService.record(orgId, propertyId, mapping.getId(),
            com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
            overallOk ? com.clenzy.integration.channex.model.ChannexSyncLog.Status.SUCCESS
                       : com.clenzy.integration.channex.model.ChannexSyncLog.Status.FAIL,
            (int) days, startedAt,
            overallOk ? null : "partial failure: avail=" + availOk + " rates=" + ratesOk);

        return new ChannexSyncResult(
            overallOk,
            overallOk ? "ok" : "partial failure (see logs)",
            (int) days,
            (int) days
        );
    }

    // ─── Internal helpers ───────────────────────────────────────────────────

    /**
     * Calcule les updates de disponibilite a partir des CalendarDay et push vers Channex.
     * Convention Clenzy : absence de ligne = AVAILABLE.
     */
    private boolean pushAvailabilityForRange(ChannexPropertyMapping mapping, LocalDate from, LocalDate to) {
        long startMs = System.currentTimeMillis();
        try {
            List<CalendarDay> days = calendarDayRepository.findByPropertyAndDateRange(
                mapping.getClenzyPropertyId(), from, to, mapping.getOrganizationId()
            );

            // Construire un index des jours bloques (BOOKED ou BLOCKED)
            java.util.Set<LocalDate> blockedDates = new java.util.HashSet<>();
            for (CalendarDay d : days) {
                CalendarDayStatus st = d.getStatus();
                if (st == CalendarDayStatus.BOOKED || st == CalendarDayStatus.BLOCKED) {
                    blockedDates.add(d.getDate());
                }
            }

            // Construire les updates pour TOUTE la plage : 1 = disponible, 0 = bloque
            List<ChannexAvailabilityUpdate> updates = new ArrayList<>();
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                int avail = blockedDates.contains(d) ? 0 : 1;
                updates.add(new ChannexAvailabilityUpdate(
                    mapping.getChannexPropertyId(),
                    mapping.getChannexRoomTypeId(),
                    d, avail
                ));
            }

            channexClient.pushAvailability(updates);
            metrics.recordSyncSuccess("push_availability", System.currentTimeMillis() - startMs);
            return true;
        } catch (ChannexException e) {
            metrics.recordSyncError("push_availability", e.getKind().name(),
                System.currentTimeMillis() - startMs);
            log.error("ChannexSync: push availability KO property={} [{}, {}]: {}",
                mapping.getClenzyPropertyId(), from, to, e.getMessage());
            updateMappingStatus(mapping, false, "availability push: " + e.getMessage());
            return false;
        }
    }

    /**
     * Resout les prix via PriceEngine et push vers Channex.
     */
    private boolean pushRatesForRange(ChannexPropertyMapping mapping, LocalDate from, LocalDate to) {
        long startMs = System.currentTimeMillis();
        try {
            Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(
                mapping.getClenzyPropertyId(), from, to, mapping.getOrganizationId()
            );

            List<ChannexRateUpdate> updates = new ArrayList<>(prices.size());
            for (Map.Entry<LocalDate, BigDecimal> entry : prices.entrySet()) {
                if (entry.getValue() == null) continue;
                updates.add(ChannexRateUpdate.rateOnly(
                    mapping.getChannexPropertyId(),
                    mapping.getChannexDefaultRatePlanId(),
                    entry.getKey(),
                    entry.getValue()
                ));
            }
            channexClient.pushRates(updates);
            metrics.recordSyncSuccess("push_rates", System.currentTimeMillis() - startMs);
            return true;
        } catch (ChannexException e) {
            metrics.recordSyncError("push_rates", e.getKind().name(),
                System.currentTimeMillis() - startMs);
            log.error("ChannexSync: push rates KO property={} [{}, {}]: {}",
                mapping.getClenzyPropertyId(), from, to, e.getMessage());
            updateMappingStatus(mapping, false, "rates push: " + e.getMessage());
            return false;
        }
    }

    /** Met a jour le status + lastSyncAt + lastSyncError du mapping. */
    private void updateMappingStatus(ChannexPropertyMapping mapping, boolean success, String error) {
        mapping.setLastSyncAt(Instant.now());
        if (success) {
            mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
            mapping.setLastSyncError(null);
        } else {
            mapping.setSyncStatus(ChannexSyncStatus.ERROR);
            if (error != null) mapping.setLastSyncError(error);
        }
        mappingRepository.save(mapping);
    }

    // ─── Scheduler de rattrapage ────────────────────────────────────────────

    /**
     * Job de rattrapage horaire : retente les mappings en status ERROR.
     * Couvre les cas ou un event Kafka n'a pas pu etre traite (Channex down,
     * rate limit prolonge, erreur transitoire).
     *
     * <p>Push les 7 prochains jours uniquement (suffisant pour rattraper les
     * derniers changements ; un re-push complet est manuellement declenchable
     * via pushProperty()).</p>
     */
    @Scheduled(fixedDelay = 60 * 60 * 1000L, initialDelay = 5 * 60 * 1000L)
    @Transactional
    public void retryFailedMappings() {
        List<ChannexPropertyMapping> failed = mappingRepository.findAllInError();
        if (failed.isEmpty()) return;

        log.info("ChannexSync retry: {} mappings en ERROR a re-tenter", failed.size());

        LocalDate from = LocalDate.now();
        LocalDate to = from.plusDays(7);
        int recovered = 0;

        for (ChannexPropertyMapping mapping : failed) {
            try {
                boolean availOk = pushAvailabilityForRange(mapping, from, to);
                boolean ratesOk = pushRatesForRange(mapping, from, to);
                if (availOk && ratesOk) {
                    updateMappingStatus(mapping, true, null);
                    recovered++;
                }
            } catch (Exception e) {
                log.error("ChannexSync retry KO mapping {}: {}", mapping.getId(), e.getMessage());
            }
        }
        log.info("ChannexSync retry: {} mappings recuperes sur {}", recovered, failed.size());
    }

    // ─── Payload helpers (factorises avec ChannelSyncService) ───────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> unwrapPayload(Object payload) throws Exception {
        if (payload instanceof Map) return (Map<String, Object>) payload;
        if (payload instanceof ConsumerRecord<?, ?> record) {
            Object value = record.value();
            if (value instanceof Map) return (Map<String, Object>) value;
            if (value instanceof String s) return objectMapper.readValue(s, Map.class);
        }
        if (payload instanceof String s) return objectMapper.readValue(s, Map.class);
        log.debug("ChannexSync: payload type inattendu {}, skip", payload != null ? payload.getClass().getName() : "null");
        return null;
    }

    private static Long extractLong(Map<String, Object> event, String key) {
        Object v = event.get(key);
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static LocalDate parseDate(Map<String, Object> event, String key) {
        Object v = event.get(key);
        if (v == null) return null;
        if (v instanceof LocalDate d) return d;
        if (v instanceof String s) {
            try { return LocalDate.parse(s); } catch (DateTimeParseException ignored) { return null; }
        }
        return null;
    }

    /** Resultat d'un push manuel pour reporting UI. */
    public record ChannexSyncResult(
        boolean success,
        String message,
        int availabilityUpdates,
        int rateUpdates
    ) {}
}
