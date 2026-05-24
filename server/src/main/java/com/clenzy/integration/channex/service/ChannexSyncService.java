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
    private final com.clenzy.repository.BookingRestrictionRepository bookingRestrictionRepository;
    private final com.clenzy.repository.OccupancyPricingRepository occupancyPricingRepository;
    private final com.clenzy.repository.LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    private final com.clenzy.repository.RatePlanRepository ratePlanRepository;

    public ChannexSyncService(ChannexClient channexClient,
                                ChannexPropertyMappingRepository mappingRepository,
                                CalendarDayRepository calendarDayRepository,
                                PriceEngine priceEngine,
                                ObjectMapper objectMapper,
                                ChannexMetrics metrics,
                                ChannexSyncLogService syncLogService,
                                com.clenzy.repository.PropertyRepository propertyRepository,
                                com.clenzy.repository.BookingRestrictionRepository bookingRestrictionRepository,
                                com.clenzy.repository.OccupancyPricingRepository occupancyPricingRepository,
                                com.clenzy.repository.LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                                com.clenzy.repository.RatePlanRepository ratePlanRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.objectMapper = objectMapper;
        this.metrics = metrics;
        this.syncLogService = syncLogService;
        this.propertyRepository = propertyRepository;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
        this.occupancyPricingRepository = occupancyPricingRepository;
        this.lengthOfStayDiscountRepository = lengthOfStayDiscountRepository;
        this.ratePlanRepository = ratePlanRepository;
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
     * Resout les prix via PriceEngine + les restrictions de booking applicables,
     * et push tout vers Channex en batches de 500.
     *
     * <p>Phase 5 OTA pricing : pousse maintenant aussi les
     * {@link com.clenzy.model.BookingRestriction} (min_stay_through/arrival,
     * closed_to_arrival/departure) en plus du rate. Avant cette amelioration,
     * pushRates utilisait {@code ChannexRateUpdate.rateOnly()} et les 4 champs
     * restrictions du DTO etaient inutilises → asymmetrie import vs export.</p>
     */
    private boolean pushRatesForRange(ChannexPropertyMapping mapping, LocalDate from, LocalDate to) {
        long startMs = System.currentTimeMillis();
        try {
            Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(
                mapping.getClenzyPropertyId(), from, to, mapping.getOrganizationId()
            );

            // Phase 5 : pre-charge les BookingRestriction applicables sur la plage
            // pour enrichir chaque ChannexRateUpdate avec min_stay + CTA + CTD.
            // 1 query pour toute la plage (vs N pour chaque date = N+1).
            List<com.clenzy.model.BookingRestriction> applicableRestrictions =
                bookingRestrictionRepository.findApplicable(
                    mapping.getClenzyPropertyId(), from, to.plusDays(1),
                    mapping.getOrganizationId());

            List<ChannexRateUpdate> updates = new ArrayList<>(prices.size());
            for (Map.Entry<LocalDate, BigDecimal> entry : prices.entrySet()) {
                if (entry.getValue() == null) continue;
                LocalDate date = entry.getKey();
                com.clenzy.model.BookingRestriction restriction = pickHighestPriorityFor(
                    applicableRestrictions, date);
                updates.add(new ChannexRateUpdate(
                    mapping.getChannexPropertyId(),
                    mapping.getChannexDefaultRatePlanId(),
                    date,
                    entry.getValue(),
                    restriction != null ? restriction.getMinStay() : null,
                    null, // minStayArrival : pas modelise dans BookingRestriction
                    restriction != null ? restriction.getClosedToArrival() : null,
                    restriction != null ? restriction.getClosedToDeparture() : null
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

    /**
     * Selectionne la BookingRestriction qui couvre {@code date} avec la priority
     * la plus haute. Retourne null si aucune ne s'applique.
     *
     * <p>Note : findApplicable retourne deja les restrictions chevauchant la
     * plage tri par priority DESC. On filtre en memoire sur la date specifique
     * et on prend la premiere (== plus haute priority).</p>
     */
    private com.clenzy.model.BookingRestriction pickHighestPriorityFor(
            List<com.clenzy.model.BookingRestriction> applicables, LocalDate date) {
        for (com.clenzy.model.BookingRestriction br : applicables) {
            if (!date.isBefore(br.getStartDate()) && !date.isAfter(br.getEndDate())) {
                // Verifier aussi le filtre daysOfWeek si renseigne
                Integer[] dow = br.getDaysOfWeek();
                if (dow != null && dow.length > 0) {
                    int weekday = date.getDayOfWeek().getValue();
                    boolean dayMatches = false;
                    for (Integer d : dow) if (d != null && d == weekday) { dayMatches = true; break; }
                    if (!dayMatches) continue;
                }
                return br;
            }
        }
        return null;
    }

    /**
     * Phase 5 OTA pricing — Push complet bidirectionnel.
     *
     * <p>Pousse vers Channex (via PUT /rate_plans/{id}) les settings tarifaires
     * Clenzy qui n'etaient PAS repercutes par l'export {@link #pushRatesForRange}
     * (qui ne push que le rate quotidien + restrictions par date) :</p>
     * <ul>
     *   <li>{@code weekend_price} : depuis le {@link com.clenzy.model.RatePlan}(type=WEEKEND)
     *       le plus prioritaire (si present)</li>
     *   <li>{@code guests_included} + {@code price_per_extra_person} : depuis
     *       l'{@link com.clenzy.model.OccupancyPricing} actif</li>
     *   <li>{@code weekly_price_factor} : depuis le {@link com.clenzy.model.LengthOfStayDiscount}
     *       avec minNights >= 7 le plus pertinent</li>
     *   <li>{@code monthly_price_factor} : idem pour minNights >= 28</li>
     *   <li>{@code default_min_nights} + {@code default_max_nights} : depuis
     *       Property.minimumNights / maximumNights</li>
     * </ul>
     *
     * <p><b>Conditions de skip</b> :</p>
     * <ul>
     *   <li>{@code priceSourceOfTruth != CLENZY} (la prop n'est pas pilotee par Clenzy)</li>
     *   <li>Pas de mapping Channex pour cette property</li>
     *   <li>Aucune des sources tarifaires presente (payload vide → no-op)</li>
     * </ul>
     *
     * <p>Best-effort : un echec sur le PUT remonte un {@link ChannexException}
     * que le caller doit gerer. Pas de retry (le push manuel est synchrone).</p>
     *
     * @return {@link ChannexSyncResult} avec success + message contenant les
     *         champs effectivement pushed
     */
    @Transactional
    public ChannexSyncResult pushPricingSettings(Long propertyId, Long orgId) {
        java.time.Instant startedAt = java.time.Instant.now();
        Optional<ChannexPropertyMapping> mappingOpt = mappingRepository
            .findByClenzyPropertyId(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return new ChannexSyncResult(false,
                "Aucun mapping Channex pour property " + propertyId, 0, 0);
        }
        ChannexPropertyMapping mapping = mappingOpt.get();

        if (mapping.getChannexDefaultRatePlanId() == null) {
            return new ChannexSyncResult(false,
                "Mapping sans channex_default_rate_plan_id — impossible de PUT", 0, 0);
        }

        com.clenzy.model.Property property = propertyRepository.findById(propertyId)
            .orElse(null);
        if (property == null) {
            return new ChannexSyncResult(false, "Property " + propertyId + " introuvable", 0, 0);
        }
        if (property.getPriceSourceOfTruth() != com.clenzy.model.PriceSourceOfTruth.CLENZY) {
            log.info("ChannexSync[PUSH_SETTINGS]: skip property={} (source={})",
                propertyId, property.getPriceSourceOfTruth());
            return new ChannexSyncResult(true,
                "Skipped: price_source_of_truth=" + property.getPriceSourceOfTruth(), 0, 0);
        }

        // Build le payload depuis les sources Clenzy
        java.math.BigDecimal weekendPrice = findWeekendPrice(propertyId, orgId);
        com.clenzy.model.OccupancyPricing op = occupancyPricingRepository
            .findByPropertyId(propertyId, orgId).orElse(null);
        Double weeklyFactor = findLosFactor(propertyId, orgId, 7);
        Double monthlyFactor = findLosFactor(propertyId, orgId, 28);

        com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate update =
            new com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate(
                property.getNightlyPrice(),
                weekendPrice,
                op != null ? op.getBaseOccupancy() : null,
                op != null ? op.getExtraGuestFee() : null,
                weeklyFactor,
                monthlyFactor,
                property.getMinimumNights(),
                property.getMaximumNights()
            );

        if (!update.hasContent()) {
            log.info("ChannexSync[PUSH_SETTINGS]: payload vide property={}, skip", propertyId);
            return new ChannexSyncResult(true, "Skipped: aucune donnee tarifaire a pousser", 0, 0);
        }

        long apiStart = System.currentTimeMillis();
        try {
            channexClient.updateRatePlanSettings(mapping.getChannexDefaultRatePlanId(), update);
            metrics.recordSyncSuccess("push_pricing_settings",
                System.currentTimeMillis() - apiStart);
            String msg = buildPushedFieldsLabel(update);
            syncLogService.record(orgId, propertyId, mapping.getId(),
                com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
                com.clenzy.integration.channex.model.ChannexSyncLog.Status.SUCCESS,
                countFields(update), startedAt, "Pricing settings push OK : " + msg);
            return new ChannexSyncResult(true, msg, countFields(update), 0);
        } catch (ChannexException e) {
            metrics.recordSyncError("push_pricing_settings", e.getKind().name(),
                System.currentTimeMillis() - apiStart);
            log.error("ChannexSync[PUSH_SETTINGS]: KO property={}: {}",
                propertyId, e.getMessage());
            syncLogService.record(orgId, propertyId, mapping.getId(),
                com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
                com.clenzy.integration.channex.model.ChannexSyncLog.Status.FAIL,
                0, startedAt, "Pricing settings push KO : " + e.getMessage());
            return new ChannexSyncResult(false,
                "Push pricing settings KO : " + e.getMessage(), 0, 0);
        }
    }

    /** Recupere le tarif weekend depuis le RatePlan(type=WEEKEND) le plus prioritaire. */
    private java.math.BigDecimal findWeekendPrice(Long propertyId, Long orgId) {
        return ratePlanRepository.findByPropertyIdAndType(propertyId,
                com.clenzy.model.RatePlanType.WEEKEND, orgId).stream()
            .filter(rp -> Boolean.TRUE.equals(rp.getIsActive()))
            .findFirst()
            .map(com.clenzy.model.RatePlan::getNightlyPrice)
            .orElse(null);
    }

    /**
     * Recupere le pourcentage de remise LOS pour un seuil de nuits donne (7 = weekly,
     * 28 = monthly). Retourne null si aucune discount applicable.
     */
    private Double findLosFactor(Long propertyId, Long orgId, int threshold) {
        return lengthOfStayDiscountRepository.findApplicable(propertyId, threshold, orgId).stream()
            .filter(d -> d.getDiscountType() == com.clenzy.model.LengthOfStayDiscount.DiscountType.PERCENTAGE)
            .findFirst()
            .map(d -> d.getDiscountValue().doubleValue())
            .orElse(null);
    }

    /** Construit une string lisible des champs pushed pour le sync log. */
    private String buildPushedFieldsLabel(com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate u) {
        java.util.List<String> parts = new java.util.ArrayList<>();
        if (u.defaultDailyPrice() != null) parts.add("default=" + u.defaultDailyPrice());
        if (u.weekendPrice() != null) parts.add("weekend=" + u.weekendPrice());
        if (u.guestsIncluded() != null) parts.add("guests_inc=" + u.guestsIncluded());
        if (u.pricePerExtraPerson() != null) parts.add("extra=" + u.pricePerExtraPerson());
        if (u.weeklyPriceFactor() != null) parts.add("weekly=" + u.weeklyPriceFactor() + "%");
        if (u.monthlyPriceFactor() != null) parts.add("monthly=" + u.monthlyPriceFactor() + "%");
        if (u.defaultMinNights() != null) parts.add("min=" + u.defaultMinNights() + "n");
        if (u.defaultMaxNights() != null) parts.add("max=" + u.defaultMaxNights() + "n");
        return String.join(", ", parts);
    }

    private int countFields(com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate u) {
        int n = 0;
        if (u.defaultDailyPrice() != null) n++;
        if (u.weekendPrice() != null) n++;
        if (u.guestsIncluded() != null) n++;
        if (u.pricePerExtraPerson() != null) n++;
        if (u.weeklyPriceFactor() != null) n++;
        if (u.monthlyPriceFactor() != null) n++;
        if (u.defaultMinNights() != null) n++;
        if (u.defaultMaxNights() != null) n++;
        return n;
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
