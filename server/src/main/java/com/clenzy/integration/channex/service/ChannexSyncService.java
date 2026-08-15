package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexRateField;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.CalendarDay;
import com.clenzy.model.CalendarDayStatus;
import com.clenzy.repository.CalendarDayRepository;
import com.clenzy.service.PriceEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;

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
 * <p>Architecture : les events du topic {@code calendar.updates} sont consommes
 * par {@link ChannexCalendarUpdateListener}, agreges par propriete dans
 * {@link ChannexAriBatcher} (fenetre 30-60 s + rate limits Channex), puis
 * pousses ici via {@link #processCalendarRange}. Channex propage ensuite vers
 * les OTAs (Airbnb, Booking, Vrbo, ...).</p>
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

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final CalendarDayRepository calendarDayRepository;
    private final PriceEngine priceEngine;
    private final ChannexMetrics metrics;
    private final ChannexSyncLogService syncLogService;
    private final com.clenzy.repository.PropertyRepository propertyRepository;
    private final com.clenzy.repository.BookingRestrictionRepository bookingRestrictionRepository;
    private final com.clenzy.repository.OccupancyPricingRepository occupancyPricingRepository;
    private final com.clenzy.repository.LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    private final com.clenzy.repository.RatePlanRepository ratePlanRepository;
    private final com.clenzy.integration.channel.ChannelRoutingStrategy routingStrategy;
    private final com.clenzy.integration.channex.config.ChannexProperties channexProperties;

    public ChannexSyncService(ChannexClient channexClient,
                                ChannexPropertyMappingRepository mappingRepository,
                                CalendarDayRepository calendarDayRepository,
                                PriceEngine priceEngine,
                                ChannexMetrics metrics,
                                ChannexSyncLogService syncLogService,
                                com.clenzy.repository.PropertyRepository propertyRepository,
                                com.clenzy.repository.BookingRestrictionRepository bookingRestrictionRepository,
                                com.clenzy.repository.OccupancyPricingRepository occupancyPricingRepository,
                                com.clenzy.repository.LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                                com.clenzy.repository.RatePlanRepository ratePlanRepository,
                                com.clenzy.integration.channel.ChannelRoutingStrategy routingStrategy,
                                com.clenzy.integration.channex.config.ChannexProperties channexProperties) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.priceEngine = priceEngine;
        this.metrics = metrics;
        this.syncLogService = syncLogService;
        this.propertyRepository = propertyRepository;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
        this.occupancyPricingRepository = occupancyPricingRepository;
        this.lengthOfStayDiscountRepository = lengthOfStayDiscountRepository;
        this.ratePlanRepository = ratePlanRepository;
        this.routingStrategy = routingStrategy;
        this.channexProperties = channexProperties;
    }

    // ─── Push declenche par le batcher ARI ──────────────────────────────────

    /**
     * Pousse une plage agregee par {@link ChannexAriBatcher} (les events Kafka
     * {@code calendar.updates} n'appellent plus l'API directement — exigence de
     * certification Channex : batching par propriete + rate limits).
     *
     * <p>Skips silencieux (résultat success=true) : property sans mapping actif,
     * mapping DISABLED, routage natif prioritaire, aucun OTA actif cote Channex.
     * Les echecs de push OTA marquent le mapping ERROR ({@code updateMappingStatus})
     * et remontent success=false — le batcher re-tente avec backoff, puis
     * {@link #retryFailedMappings()} prend le relais.</p>
     *
     * <p>Pas de transaction englobante : les push sont des appels HTTP Channex
     * (regle « jamais d'appel HTTP externe dans une transaction DB »). Les
     * lectures et l'ecriture du statut mapping ({@link #updateMappingStatus})
     * se font dans les transactions courtes implicites des repositories,
     * APRES le resultat du push.</p>
     */
    public ChannexSyncResult processCalendarRange(Long propertyId, Long orgId,
                                                  LocalDate from, LocalDate to) {
        return processCalendarRange(propertyId, orgId, from, to,
            com.clenzy.integration.channex.model.ChannexAriScope.BOTH);
    }

    /**
     * Variante qui ne pousse que le canal concerne par le changement.
     *
     * <p>Un changement de prix ne doit toucher que les tarifs, un blocage de
     * dates que la disponibilite. Pousser les deux systematiquement a fait
     * echouer sept scenarios de certification le 2026-08-14 : « Expected
     * exactly one update, found: ["Property.UpdateRestrictions",
     * "Property.UpdateAvailability"] ».</p>
     */
    public ChannexSyncResult processCalendarRange(Long propertyId, Long orgId,
                                                  LocalDate from, LocalDate to,
                                                  com.clenzy.integration.channex.model.ChannexAriScope scope) {
        return processCalendarRange(propertyId, orgId, from, to, scope, ChannexRateField.ALL);
    }

    /**
     * Variante qui restreint aussi les CHAMPS du payload tarifs.
     *
     * <p>La portee dit quel canal pousser ; {@code rateFields} dit quoi mettre
     * dedans. Sans ce second filtre, un changement de prix partait avec les
     * sept champs renseignes — un instantane la ou Channex attend un delta
     * (quatre avertissements de certification le 2026-08-15).</p>
     */
    public ChannexSyncResult processCalendarRange(Long propertyId, Long orgId,
                                                  LocalDate from, LocalDate to,
                                                  com.clenzy.integration.channex.model.ChannexAriScope scope,
                                                  java.util.Set<ChannexRateField> rateFields) {
        Optional<ChannexPropertyMapping> mappingOpt =
            mappingRepository.findByClenzyPropertyId(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            // Property non geree par Channex — silence (les connectors directs s'en chargent)
            return new ChannexSyncResult(true, "skip: no mapping", 0, 0);
        }

        ChannexPropertyMapping mapping = mappingOpt.get();
        if (mapping.getSyncStatus() == ChannexSyncStatus.DISABLED) {
            log.debug("ChannexSync: mapping {} disabled, skip", mapping.getId());
            return new ChannexSyncResult(true, "skip: mapping disabled", 0, 0);
        }

        // Routage CM natif (anti double-push) : si la propriete a un mapping DIRECT actif, le
        // connecteur natif s'en charge (prioritaire) — Channex ne pousse pas pour eviter le doublon.
        if (routingStrategy.resolve(propertyId, orgId) != com.clenzy.integration.channel.ChannelRoute.CHANNEX) {
            log.debug("ChannexSync: property={} routee en direct (natif prioritaire), skip Channex", propertyId);
            return new ChannexSyncResult(true, "skip: routed to native connector", 0, 0);
        }

        // Gate OTA : pas de push tant qu'aucun OTA n'est branche cote Channex
        // (sinon appels API gaspilles sans aucune distribution OTA).
        // Bypass dev/staging (certification) : channexProperties.allowPushWithoutActiveOta.
        if (!channexProperties.isAllowPushWithoutActiveOta()) {
          try {
            if (!channexClient.hasActiveOtaChannel(mapping.getChannexPropertyId())) {
                log.debug("ChannexSync: push skip property={} (aucun OTA actif cote Channex)",
                    propertyId);
                return new ChannexSyncResult(true, "skip: no active OTA channel", 0, 0);
            }
          } catch (Exception e) {
            // En cas d'erreur sur le check : continuer le push (preferable a un skip silencieux)
            log.warn("ChannexSync: check OTA actif KO ({}), push tente quand meme", e.getMessage());
          }
        }

        var effectiveScope = scope != null
            ? scope : com.clenzy.integration.channex.model.ChannexAriScope.BOTH;
        log.info("ChannexSync: push batche property={} period=[{},{}] scope={}",
            propertyId, from, to, effectiveScope);

        // Seul le canal concerne part (les 2 sont independants — un echec
        // n'impacte pas l'autre). Un canal non pousse vaut succes : il n'avait
        // rien a dire. Les echecs OTA sont catch dans les methodes de push et
        // enregistres en ERROR.
        boolean availabilityOk = !effectiveScope.includesAvailability()
            || pushAvailabilityForRange(mapping, from, to);
        boolean ratesOk = !effectiveScope.includesRates()
            || pushRatesForRange(mapping, from, to, rateFields);

        updateMappingStatus(mapping, availabilityOk && ratesOk, null);
        boolean ok = availabilityOk && ratesOk;
        return new ChannexSyncResult(ok,
            ok ? "ok" : "partial failure: avail=" + availabilityOk + " rates=" + ratesOk, 0, 0);
    }

    // ─── Push methods (visibles tests + appelables manuellement) ────────────

    /**
     * Force un push complet (availability + rates) d'une property sur une periode.
     * Utilise par l'UI onboarding apres creation d'un mapping (push initial).
     *
     * <p>Pas de transaction englobante (appels HTTP Channex) : les ecritures DB
     * (statut mapping, sync log) se font en transactions courtes independantes
     * apres le resultat du push.</p>
     */
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
        // Bypass dev/staging (certification) : channexProperties.allowPushWithoutActiveOta.
        if (!channexProperties.isAllowPushWithoutActiveOta()) {
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

            // SEULE une reservation consomme l'inventaire. Un blocage manuel
            // (BLOCKED / MAINTENANCE) laisse l'unite existante et ferme la vente
            // par stop_sell, cote rates — cf. resolveStopSell.
            //
            // Avant, les deux ecrivaient 0, ce qui confondait « plus d'unite » et
            // « ne pas vendre ». La certification Channex l'a refuse le
            // 2026-08-14 : « Availability is 0, expected 1 or 3 (a vacation
            // rental is a single unit) », et « Property supports Stop Sell and
            // cannot skip this test: expected a stop sell update ... found none ».
            java.util.Set<LocalDate> bookedDates = new java.util.HashSet<>();
            for (CalendarDay d : days) {
                if (d.getStatus() == CalendarDayStatus.BOOKED) {
                    bookedDates.add(d.getDate());
                }
            }

            // 1 = l'unite est disponible, 0 = elle est occupee par une reservation
            List<ChannexAvailabilityUpdate> updates = new ArrayList<>();
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                int avail = bookedDates.contains(d) ? 0 : 1;
                updates.add(new ChannexAvailabilityUpdate(
                    mapping.getChannexPropertyId(),
                    mapping.getChannexRoomTypeId(),
                    d, avail
                ));
            }

            com.clenzy.integration.channex.dto.ChannexAriPushResult pushResult =
                channexClient.pushAvailability(updates);
            recordAriOutcome(mapping, "availability", pushResult);
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
        return pushRatesForRange(mapping, from, to,
            ChannexRateField.ALL);
    }

    /**
     * Variante qui ne met dans le payload que les champs demandes.
     *
     * <p>Un push ne doit porter que ce que l'action a change. Envoyer les sept
     * champs a chaque fois donne un instantane la ou Channex attend un delta —
     * quatre avertissements de certification le 2026-08-15, « this looks like a
     * snapshot-based update rather than a rate-only delta ».</p>
     *
     * <p>Les champs de restriction subissent un second filtre : meme demandes,
     * ils ne partent que s'ils sont <b>non nuls</b> dans la
     * {@code BookingRestriction} qui couvre la date. C'est ce qui separe le
     * scenario « sejour minimum seul » du scenario « restrictions combinees ».
     * Les defauts de propriete ne comblent plus les trous que pour un
     * instantane complet, jamais pour un delta.</p>
     */
    private boolean pushRatesForRange(ChannexPropertyMapping mapping, LocalDate from, LocalDate to,
                                      java.util.Set<ChannexRateField> fields) {
        var wanted = (fields == null || fields.isEmpty())
            ? ChannexRateField.ALL : fields;
        boolean snapshot = wanted.containsAll(
            ChannexRateField.ALL);
        long startMs = System.currentTimeMillis();
        try {
            // resolvePriceRange est EXCLUSIF sur `to` (PriceEngine: date.isBefore(to)).
            // On passe to.plusDays(1) pour couvrir [from, to] INCLUS — sinon le
            // dernier jour de la plage n'a jamais de prix, et une plage d'un seul
            // jour (from==to) ne pousse aucun prix. Cohérent avec l'availability
            // (itération inclusive) et les restrictions ci-dessous (to.plusDays(1)).
            Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(
                mapping.getClenzyPropertyId(), from, to.plusDays(1), mapping.getOrganizationId()
            );

            // Phase 5 : pre-charge les BookingRestriction applicables sur la plage
            // pour enrichir chaque ChannexRateUpdate avec min_stay + CTA + CTD.
            // 1 query pour toute la plage (vs N pour chaque date = N+1).
            List<com.clenzy.model.BookingRestriction> applicableRestrictions =
                bookingRestrictionRepository.findApplicable(
                    mapping.getClenzyPropertyId(), from, to.plusDays(1),
                    mapping.getOrganizationId());

            // Defauts de la propriete : ce que vaut une date qu'aucune
            // restriction explicite ne couvre. Sans eux, ces dates partaient
            // avec des champs nuls, donc ABSENTS du payload — la certification
            // les compte comme des restrictions declarees mais non envoyees
            // (« 154/181 restriction objects are missing... », 2026-08-14).
            RestrictionDefaults defaults = resolveRestrictionDefaults(mapping.getClenzyPropertyId());

            // Dates fermees a la vente : blocage manuel ou maintenance. Elles
            // gardent leur unite disponible (availability = 1) et se ferment par
            // stop_sell — le champ que Channex attend pour une fermeture.
            java.util.Set<LocalDate> stopSoldDates = resolveStopSoldDates(mapping, from, to);

            // Fan-out multi-rate-plan : pousse les prix/restrictions sur chaque rate plan cible
            // (le defaut + les additionnels mappes). getTargetRatePlanIds() renvoie [defaut] si
            // aucun additionnel -> comportement mono-rate-plan preserve.
            List<String> ratePlanIds = mapping.getTargetRatePlanIds();
            List<ChannexRateUpdate> updates = new ArrayList<>(prices.size() * Math.max(1, ratePlanIds.size()));
            for (String ratePlanId : ratePlanIds) {
                for (Map.Entry<LocalDate, BigDecimal> entry : prices.entrySet()) {
                    // Un prix absent ne disqualifie la date que si le prix est
                    // la SEULE chose a envoyer. Une mise a jour de restriction
                    // ou de stop_sell doit partir meme la ou aucun prix n'est
                    // resolu — sinon le delta se viderait de son contenu.
                    if (entry.getValue() == null
                        && !wanted.contains(ChannexRateField.MIN_STAY)
                        && !wanted.contains(ChannexRateField.MAX_STAY)
                        && !wanted.contains(ChannexRateField.CLOSED_TO_ARRIVAL)
                        && !wanted.contains(ChannexRateField.CLOSED_TO_DEPARTURE)
                        && !wanted.contains(ChannexRateField.STOP_SELL)) {
                        continue;
                    }
                    LocalDate date = entry.getKey();
                    com.clenzy.model.BookingRestriction restriction = pickHighestPriorityFor(
                        applicableRestrictions, date);
                    // `null` = champ ABSENT du payload (cf. compressRates). C'est
                    // le mecanisme qui rend le delta possible : on ne renseigne
                    // que ce qui est demande.
                    updates.add(new ChannexRateUpdate(
                        mapping.getChannexPropertyId(),
                        ratePlanId,
                        date,
                        wanted.contains(ChannexRateField.RATE) ? entry.getValue() : null,
                        wanted.contains(ChannexRateField.MIN_STAY)
                            ? (snapshot ? resolveMinStayThrough(restriction, defaults)
                                        : (restriction != null ? restriction.getMinStay() : null))
                            : null,
                        wanted.contains(ChannexRateField.MIN_STAY)
                            ? (snapshot ? resolveMinStayArrival(restriction, defaults)
                                        : (restriction != null ? restriction.getMinStay() : null))
                            : null,
                        wanted.contains(ChannexRateField.CLOSED_TO_ARRIVAL)
                            ? (restriction != null && restriction.getClosedToArrival() != null
                                ? restriction.getClosedToArrival()
                                : (snapshot ? Boolean.FALSE : null))
                            : null,
                        wanted.contains(ChannexRateField.CLOSED_TO_DEPARTURE)
                            ? (restriction != null && restriction.getClosedToDeparture() != null
                                ? restriction.getClosedToDeparture()
                                : (snapshot ? Boolean.FALSE : null))
                            : null,
                        wanted.contains(ChannexRateField.MAX_STAY)
                            ? (restriction != null && restriction.getMaxStay() != null
                                ? restriction.getMaxStay()
                                : (snapshot ? defaults.maxStay() : null))
                            : null,
                        wanted.contains(ChannexRateField.STOP_SELL) ? stopSoldDates.contains(date) : null
                    ));
                }
            }
            // Un push qui ne produit AUCUNE entree est un no-op silencieux, et
            // c'est ce qui rend un echec de certification indechiffrable :
            // « No valid rate set over the half-year range » (2026-08-15) vient
            // de la — la propriete n'a pas de prix de base, PriceEngine renvoie
            // null pour chaque date, et la boucle les saute toutes. Rien dans
            // les journaux ne le disait.
            if (updates.isEmpty()) {
                log.warn("ChannexSync: push rates SANS AUCUNE entree property={} [{}, {}] champs={} "
                    + "— aucun prix resolu (propriete sans prix de base ni plan tarifaire ?) "
                    + "ni restriction applicable. Rien n'a ete envoye a Channex.",
                    mapping.getClenzyPropertyId(), from, to, wanted);
            }
            com.clenzy.integration.channex.dto.ChannexAriPushResult pushResult =
                channexClient.pushRates(updates);
            recordAriOutcome(mapping, "rates", pushResult);
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
    /**
     * Trace le resultat d'un push ARI : les task IDs (traitement asynchrone
     * Channex, exiges pour la certification) en INFO, et les
     * {@code meta.warnings} en sync log — une entree en warning a ete IGNOREE
     * par Channex (200 OK trompeur), la passer sous silence = donnee perdue.
     */
    private void recordAriOutcome(ChannexPropertyMapping mapping, String kind,
                                  com.clenzy.integration.channex.dto.ChannexAriPushResult result) {
        if (result == null) return;
        if (!result.taskIds().isEmpty()) {
            log.info("ChannexSync[{}]: property={} task_ids={}", kind,
                mapping.getClenzyPropertyId(), result.taskIds());
        }
        if (result.hasWarnings()) {
            String detail = String.join(" | ", result.warnings());
            log.warn("ChannexSync[{}]: property={} {} warning(s) de validation Channex : {}",
                kind, mapping.getClenzyPropertyId(), result.warnings().size(), detail);
            syncLogService.record(mapping.getOrganizationId(), mapping.getClenzyPropertyId(),
                mapping.getId(),
                com.clenzy.integration.channex.model.ChannexSyncLog.SyncType.PUSH_PROPERTY,
                com.clenzy.integration.channex.model.ChannexSyncLog.Status.FAIL,
                result.warnings().size(), java.time.Instant.now(),
                "ARI " + kind + " — entrees ignorees par Channex (meta.warnings): "
                    + truncateForLog(detail));
        }
    }

    private static String truncateForLog(String s) {
        return s != null && s.length() > 900 ? s.substring(0, 900) + "…" : s;
    }

    /**
     * Dates fermees a la vente sans etre reservees : blocage manuel, maintenance.
     *
     * <p>Ces dates gardent leur unite disponible ({@code availability = 1}) et se
     * ferment par {@code stop_sell}. La distinction est celle de Channex :
     * {@code availability} porte un INVENTAIRE, {@code stop_sell} une decision
     * commerciale. Les confondre — ecrire 0 dans les deux cas — a fait echouer
     * les scenarios 6 et 10 de la certification le 2026-08-14.</p>
     */
    private java.util.Set<LocalDate> resolveStopSoldDates(ChannexPropertyMapping mapping,
                                                          LocalDate from, LocalDate to) {
        java.util.Set<LocalDate> closed = new java.util.HashSet<>();
        for (CalendarDay day : calendarDayRepository.findByPropertyAndDateRange(
                mapping.getClenzyPropertyId(), from, to, mapping.getOrganizationId())) {
            CalendarDayStatus status = day.getStatus();
            if (status == CalendarDayStatus.BLOCKED || status == CalendarDayStatus.MAINTENANCE) {
                closed.add(day.getDate());
            }
        }
        return closed;
    }

    /** Valeurs de repli d'une propriete pour les dates sans restriction explicite. */
    record RestrictionDefaults(int minStay, int maxStay) {}

    /**
     * Defauts de restriction d'une propriete.
     *
     * <p>Sejour minimum : celui de la propriete, au moins 1 — Channex refuse 0.
     * Sejour maximum : 0 signifie « pas de limite » dans leur convention, ce qui
     * est exactement ce qu'on veut dire quand la propriete n'en fixe aucun.</p>
     */
    private RestrictionDefaults resolveRestrictionDefaults(Long propertyId) {
        return propertyRepository.findById(propertyId)
            .map(p -> new RestrictionDefaults(
                p.getMinimumNights() != null && p.getMinimumNights() > 0 ? p.getMinimumNights() : 1,
                p.getMaximumNights() != null && p.getMaximumNights() > 0 ? p.getMaximumNights() : 0))
            .orElseGet(() -> new RestrictionDefaults(1, 0));
    }

    private static Integer resolveMinStayThrough(com.clenzy.model.BookingRestriction restriction,
                                                 RestrictionDefaults defaults) {
        if (restriction != null && restriction.getMinStay() != null && restriction.getMinStay() > 0) {
            return restriction.getMinStay();
        }
        return defaults.minStay();
    }

    /**
     * Sejour minimum a l'arrivee.
     *
     * <p>Nos restrictions ne renseignent en pratique que {@code minStay} : la
     * colonne {@code min_stay_arrival} etait nulle sur les cinq restrictions de
     * la propriete de certification, d'ou le « 181/181 missing » du rapport. On
     * retombe donc sur le sejour minimum general — deux champs que Channex
     * traite comme distincts mais que notre modele ne distingue pas encore.</p>
     */
    private static Integer resolveMinStayArrival(com.clenzy.model.BookingRestriction restriction,
                                                 RestrictionDefaults defaults) {
        if (restriction != null && restriction.getMinStayArrival() != null
            && restriction.getMinStayArrival() > 0) {
            return restriction.getMinStayArrival();
        }
        return resolveMinStayThrough(restriction, defaults);
    }

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
     * <p>Pas de @Transactional : le PUT rate_plan est un appel HTTP Channex
     * (regle « jamais d'appel HTTP externe dans une transaction DB »). Les
     * lectures preliminaires (mapping, property, sources tarifaires) se font
     * dans les transactions courtes implicites des repositories, et le sync
     * log ({@link ChannexSyncLogService#record}) commit deja dans sa propre
     * transaction REQUIRES_NEW — meme pattern que {@link #pushProperty}.</p>
     *
     * @return {@link ChannexSyncResult} avec success + message contenant les
     *         champs effectivement pushed
     */
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
     *
     * <p>Pas de @Transactional : chaque iteration fait des appels HTTP Channex
     * (30-80 s au total pour la boucle) — une transaction unique sur toute la
     * boucle tiendrait une connexion DB pendant tout ce temps. Chaque
     * updateMappingStatus commit dans sa propre transaction courte, mapping
     * par mapping.</p>
     *
     * <p>Inerte quand {@code clenzy.channex.enabled=false}. Le garde-fou est ici
     * et non sur la classe : ce service est injecte par le batcher ARI, les
     * controllers admin et les syncs a la demande — seul le declencheur
     * periodique doit disparaitre, pas le bean.</p>
     */
    @Scheduled(fixedDelay = 60 * 60 * 1000L, initialDelay = 5 * 60 * 1000L)
    @SchedulerLock(name = "channex-retry-failed-mappings", lockAtMostFor = "PT30M")
    public void retryFailedMappings() {
        if (!channexProperties.isEnabled()) return;

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

    /** Resultat d'un push manuel pour reporting UI. */
    public record ChannexSyncResult(
        boolean success,
        String message,
        int availabilityUpdates,
        int rateUpdates
    ) {}
}
