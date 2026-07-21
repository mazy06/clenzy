package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.LengthOfStayDiscount;
import com.clenzy.model.OccupancyPricing;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.RatePlan;
import com.clenzy.model.RatePlanType;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Importer specialise pour les artefacts tarifaires Clenzy depuis Channex —
 * Phase 5 audit O6 (refactor god service ChannexImportService).
 *
 * <p>Regroupe les 7 helpers d'import pricing extraits du
 * {@code ChannexImportService} qui avait 14 deps. Ce service en a 6 :
 * 5 repos + 1 client. ChannexImportService delegue ici pour tout ce qui touche
 * au pricing.</p>
 *
 * <p>Tous les helpers sont :</p>
 * <ul>
 *   <li><b>Idempotents</b> : skip si l'artefact existe deja pour la property</li>
 *   <li><b>Best-effort</b> : un echec d'un helper n'arrete pas les autres</li>
 *   <li><b>Visibilite package</b> pour faciliter les tests Mockito</li>
 * </ul>
 */
@Service
public class ChannexPricingImporter {

    private static final Logger log = LoggerFactory.getLogger(ChannexPricingImporter.class);

    private final ChannexClient channexClient;
    private final RatePlanRepository ratePlanRepository;
    private final OccupancyPricingRepository occupancyPricingRepository;
    private final LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    private final RateOverrideRepository rateOverrideRepository;
    private final BookingRestrictionRepository bookingRestrictionRepository;

    public ChannexPricingImporter(ChannexClient channexClient,
                                    RatePlanRepository ratePlanRepository,
                                    OccupancyPricingRepository occupancyPricingRepository,
                                    LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                                    RateOverrideRepository rateOverrideRepository,
                                    BookingRestrictionRepository bookingRestrictionRepository) {
        this.channexClient = channexClient;
        this.ratePlanRepository = ratePlanRepository;
        this.occupancyPricingRepository = occupancyPricingRepository;
        this.lengthOfStayDiscountRepository = lengthOfStayDiscountRepository;
        this.rateOverrideRepository = rateOverrideRepository;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
    }

    // ─── LengthOfStayDiscount (Phase 1) ──────────────────────────────────────

    public int createLengthOfStayDiscounts(Property prop, Long orgId,
                                             ChannexImportService.ChannelListingInfo info) {
        if (info == null) return 0;
        int created = 0;
        try {
            if (info.weeklyPriceFactor() != null && info.weeklyPriceFactor() > 0) {
                if (!hasExistingDiscount(prop.getId(), orgId, 7)) {
                    LengthOfStayDiscount d = new LengthOfStayDiscount();
                    d.setOrganizationId(orgId);
                    d.setProperty(prop);
                    d.setMinNights(7);
                    d.setMaxNights(27);
                    d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
                    d.setDiscountValue(BigDecimal.valueOf(info.weeklyPriceFactor()));
                    d.setActive(true);
                    lengthOfStayDiscountRepository.save(d);
                    created++;
                    log.info("ChannexPricing: created LengthOfStayDiscount weekly property={} -{}%",
                        prop.getId(), info.weeklyPriceFactor());
                }
            }
            if (info.monthlyPriceFactor() != null && info.monthlyPriceFactor() > 0) {
                if (!hasExistingDiscount(prop.getId(), orgId, 28)) {
                    LengthOfStayDiscount d = new LengthOfStayDiscount();
                    d.setOrganizationId(orgId);
                    d.setProperty(prop);
                    d.setMinNights(28);
                    d.setMaxNights(null);
                    d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
                    d.setDiscountValue(BigDecimal.valueOf(info.monthlyPriceFactor()));
                    d.setActive(true);
                    lengthOfStayDiscountRepository.save(d);
                    created++;
                    log.info("ChannexPricing: created LengthOfStayDiscount monthly property={} -{}%",
                        prop.getId(), info.monthlyPriceFactor());
                }
            }
        } catch (Exception e) {
            log.warn("ChannexPricing: creation LengthOfStayDiscount KO property={}: {}",
                prop.getId(), e.getMessage());
        }
        return created;
    }

    private boolean hasExistingDiscount(Long propertyId, Long orgId, int minNights) {
        return lengthOfStayDiscountRepository.findByPropertyId(propertyId, orgId).stream()
            .anyMatch(d -> d.getMinNights() == minNights);
    }

    // ─── RatePlan BASE (Phase 1) ─────────────────────────────────────────────

    public boolean createBaseRatePlan(Property prop, Long orgId,
                                       ChannexImportService.ChannelListingInfo info) {
        if (info == null || info.defaultPrice() == null || info.defaultPrice().signum() <= 0) {
            return false;
        }
        try {
            boolean exists = !ratePlanRepository
                .findByPropertyIdAndType(prop.getId(), RatePlanType.BASE, orgId).isEmpty();
            if (exists) return false;
            RatePlan plan = new RatePlan();
            plan.setProperty(prop);
            plan.setOrganizationId(orgId);
            plan.setName("OTA Base — " + (info.otaName() != null ? info.otaName() : "Channex"));
            plan.setType(RatePlanType.BASE);
            plan.setPriority(0);
            plan.setNightlyPrice(info.defaultPrice());
            plan.setCurrency(info.currency() != null
                ? info.currency().toUpperCase() : prop.getDefaultCurrency());
            plan.setIsActive(true);
            ratePlanRepository.save(plan);
            log.info("ChannexPricing: created BASE RatePlan property={} price={}{}",
                prop.getId(), plan.getNightlyPrice(), plan.getCurrency());
            return true;
        } catch (Exception e) {
            log.warn("ChannexPricing: creation BASE RatePlan KO property={}: {}",
                prop.getId(), e.getMessage());
            return false;
        }
    }

    // ─── RatePlan WEEKEND (Phase 1) ──────────────────────────────────────────

    public boolean createWeekendRatePlan(Property prop, Long orgId,
                                          ChannexImportService.ChannelListingInfo info) {
        if (info == null || info.weekendPrice() == null
            || info.weekendPrice().signum() <= 0) {
            return false;
        }
        if (info.defaultPrice() != null
            && info.weekendPrice().compareTo(info.defaultPrice()) == 0) {
            return false;
        }
        try {
            boolean exists = !ratePlanRepository
                .findByPropertyIdAndType(prop.getId(), RatePlanType.WEEKEND, orgId).isEmpty();
            if (exists) return false;
            RatePlan plan = new RatePlan();
            plan.setProperty(prop);
            plan.setOrganizationId(orgId);
            plan.setName("OTA Weekend — " + (info.otaName() != null ? info.otaName() : "Channex"));
            plan.setType(RatePlanType.WEEKEND);
            plan.setPriority(10);
            plan.setNightlyPrice(info.weekendPrice());
            plan.setCurrency(info.currency() != null
                ? info.currency().toUpperCase() : prop.getDefaultCurrency());
            plan.setDaysOfWeek(new Integer[] { 5, 6, 7 });
            plan.setIsActive(true);
            ratePlanRepository.save(plan);
            log.info("ChannexPricing: created WEEKEND RatePlan property={} price={}{}",
                prop.getId(), plan.getNightlyPrice(), plan.getCurrency());
            return true;
        } catch (Exception e) {
            log.warn("ChannexPricing: creation WEEKEND RatePlan KO property={}: {}",
                prop.getId(), e.getMessage());
            return false;
        }
    }

    // ─── OccupancyPricing (Phase 1) ──────────────────────────────────────────

    public boolean createOccupancyPricingFromOta(Property prop, Long orgId,
                                                  ChannexImportService.ChannelListingInfo info) {
        if (info == null || info.guestsIncluded() == null || info.guestsIncluded() <= 0) return false;
        if (info.pricePerExtraPerson() == null || info.pricePerExtraPerson().signum() <= 0) return false;
        try {
            boolean exists = occupancyPricingRepository
                .findByPropertyId(prop.getId(), orgId).isPresent();
            if (exists) return false;
            int maxOccupancy = prop.getMaxGuests() != null && prop.getMaxGuests() > 0
                ? prop.getMaxGuests()
                : Math.max(info.guestsIncluded() + 4, 6);
            OccupancyPricing op = new OccupancyPricing();
            op.setProperty(prop);
            op.setOrganizationId(orgId);
            op.setBaseOccupancy(info.guestsIncluded());
            op.setExtraGuestFee(info.pricePerExtraPerson());
            op.setMaxOccupancy(maxOccupancy);
            op.setActive(true);
            occupancyPricingRepository.save(op);
            log.info("ChannexPricing: created OccupancyPricing property={} base={} extra={} max={}",
                prop.getId(), op.getBaseOccupancy(), op.getExtraGuestFee(), op.getMaxOccupancy());
            return true;
        } catch (Exception e) {
            log.warn("ChannexPricing: creation OccupancyPricing KO property={}: {}",
                prop.getId(), e.getMessage());
            return false;
        }
    }

    // ─── RateOverride pull (Phase 2) ─────────────────────────────────────────

    public int importRateOverridesFromOta(Property prop, Long orgId,
                                            ChannexPropertyMapping mapping,
                                            ChannexImportService.ChannelListingInfo info) {
        if (mapping == null || mapping.getChannexDefaultRatePlanId() == null) return 0;
        if (info == null || info.defaultPrice() == null) return 0;
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusMonths(12);
        Optional<List<JsonNode>> opt = channexClient.fetchRatesForRange(
            mapping.getChannexPropertyId(), mapping.getChannexDefaultRatePlanId(), from, to);
        if (opt.isEmpty() || opt.get().isEmpty()) return 0;
        BigDecimal defaultPrice = info.defaultPrice();
        // Batch (audit perf P2-2) : les dates deja surchargees de la plage sont
        // prechargees en UNE requete (au lieu d'un SELECT par entree). Les saves
        // restent unitaires pour conserver la semantique best-effort par entree.
        Set<LocalDate> existingDates = rateOverrideRepository
            .findByPropertyIdAndDateRange(prop.getId(), from, to.plusDays(1), orgId).stream()
            .map(RateOverride::getDate)
            .collect(Collectors.toCollection(HashSet::new));
        int created = 0;
        for (JsonNode entry : opt.get()) {
            try {
                JsonNode attrs = entry.path("attributes");
                String dateStr = attrs.path("date").asText(null);
                String rateStr = attrs.path("rate").asText(null);
                if (dateStr == null || rateStr == null || rateStr.isBlank()) continue;
                LocalDate date;
                BigDecimal rate;
                try {
                    date = LocalDate.parse(dateStr);
                    rate = new BigDecimal(rateStr);
                } catch (Exception parseError) { continue; }
                if (rate.compareTo(defaultPrice) == 0) continue;
                if (existingDates.contains(date)) continue;
                RateOverride override = new RateOverride();
                override.setProperty(prop);
                override.setOrganizationId(orgId);
                override.setDate(date);
                override.setNightlyPrice(rate);
                override.setSource("OTA:" + (info.otaName() != null ? info.otaName() : "Channex"));
                override.setCurrency(info.currency() != null
                    ? info.currency().toUpperCase() : prop.getDefaultCurrency());
                override.setCreatedBy("channex-import");
                rateOverrideRepository.save(override);
                existingDates.add(date); // dedup au sein du meme run (doublons du feed)
                created++;
            } catch (Exception e) {
                log.warn("ChannexPricing[RATE_OVERRIDES]: erreur entry property={}: {}",
                    prop.getId(), e.getMessage());
            }
        }
        log.info("ChannexPricing[RATE_OVERRIDES]: property={} created={}",
            prop.getId(), created);
        return created;
    }

    // ─── Additional RatePlans (Phase 4 #4) ───────────────────────────────────

    public int importAdditionalRatePlansFromOta(Property prop, Long orgId,
                                                  ChannexImportService.ChannelListingInfo info) {
        if (info == null || info.additionalRatePlans() == null
            || info.additionalRatePlans().isEmpty()) {
            return 0;
        }
        List<RatePlan> existingPromos = ratePlanRepository
            .findByPropertyIdAndType(prop.getId(), RatePlanType.PROMOTIONAL, orgId);
        int created = 0;
        for (ChannexImportService.AdditionalRatePlan arp : info.additionalRatePlans()) {
            if (arp.defaultPrice() == null || arp.defaultPrice().signum() <= 0) continue;
            String stableTitle = arp.title() != null ? arp.title() : "Variant";
            String otaIdTag = arp.channexRatePlanId() != null
                ? "[" + arp.channexRatePlanId().substring(0, Math.min(8, arp.channexRatePlanId().length())) + "]"
                : "";
            String name = "OTA " + otaIdTag + " — " + stableTitle;
            boolean alreadyExists = arp.channexRatePlanId() != null
                && existingPromos.stream().anyMatch(rp ->
                    rp.getName() != null && rp.getName().contains(otaIdTag));
            if (alreadyExists) continue;
            try {
                RatePlan plan = new RatePlan();
                plan.setProperty(prop);
                plan.setOrganizationId(orgId);
                plan.setName(name);
                plan.setType(RatePlanType.PROMOTIONAL);
                plan.setPriority(5);
                plan.setNightlyPrice(arp.defaultPrice());
                plan.setCurrency(arp.currency() != null
                    ? arp.currency().toUpperCase()
                    : (info.currency() != null ? info.currency() : prop.getDefaultCurrency()));
                plan.setIsActive(true);
                ratePlanRepository.save(plan);
                created++;
                log.info("ChannexPricing[ADDITIONAL_RP]: created '{}' property={}", name, prop.getId());
            } catch (Exception e) {
                log.warn("ChannexPricing[ADDITIONAL_RP]: erreur '{}' property={}: {}",
                    name, prop.getId(), e.getMessage());
            }
        }
        return created;
    }

    // ─── BookingRestriction pull (Phase 4 #5) ────────────────────────────────

    public int importBookingRestrictionsFromOta(Property prop, Long orgId,
                                                  ChannexPropertyMapping mapping) {
        if (mapping == null || mapping.getChannexDefaultRatePlanId() == null) return 0;
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusMonths(12);
        Optional<List<JsonNode>> opt = channexClient.fetchRatesForRange(
            mapping.getChannexPropertyId(), mapping.getChannexDefaultRatePlanId(), from, to);
        if (opt.isEmpty() || opt.get().isEmpty()) return 0;

        TreeMap<LocalDate, Restriction> perDate = new TreeMap<>();
        for (JsonNode entry : opt.get()) {
            try {
                JsonNode attrs = entry.path("attributes");
                String dateStr = attrs.path("date").asText(null);
                if (dateStr == null) continue;
                Integer minStay = intOrNullFromAttr(attrs, "min_stay_through");
                if (minStay == null) minStay = intOrNullFromAttr(attrs, "min_stay_arrival");
                boolean cta = attrs.path("closed_to_arrival").asBoolean(false);
                boolean ctd = attrs.path("closed_to_departure").asBoolean(false);
                if (minStay == null && !cta && !ctd) continue;
                perDate.put(LocalDate.parse(dateStr), new Restriction(minStay, cta, ctd));
            } catch (Exception e) { /* skip */ }
        }
        if (perDate.isEmpty()) return 0;

        int created = 0;
        LocalDate groupStart = null;
        LocalDate groupEnd = null;
        Restriction groupRestriction = null;
        LocalDate prevDate = null;
        for (var entry : perDate.entrySet()) {
            LocalDate date = entry.getKey();
            Restriction r = entry.getValue();
            boolean newGroup = groupStart == null
                || !r.equals(groupRestriction)
                || !date.equals(prevDate.plusDays(1));
            if (newGroup) {
                if (groupStart != null
                    && createBookingRestrictionIfNew(prop, orgId, groupStart, groupEnd, groupRestriction)) {
                    created++;
                }
                groupStart = date;
                groupRestriction = r;
            }
            groupEnd = date;
            prevDate = date;
        }
        if (groupStart != null
            && createBookingRestrictionIfNew(prop, orgId, groupStart, groupEnd, groupRestriction)) {
            created++;
        }
        return created;
    }

    /** Restriction record interne pour grouping (equals auto via record). */
    record Restriction(Integer minStay, boolean closedToArrival, boolean closedToDeparture) {}

    private boolean createBookingRestrictionIfNew(Property prop, Long orgId,
                                                    LocalDate startDate, LocalDate endDate,
                                                    Restriction r) {
        try {
            var existing = bookingRestrictionRepository.findApplicable(
                prop.getId(), startDate, startDate.plusDays(1), orgId);
            if (!existing.isEmpty()) return false;
            BookingRestriction br = new BookingRestriction(prop, startDate, endDate, orgId);
            br.setMinStay(r.minStay());
            br.setClosedToArrival(r.closedToArrival());
            br.setClosedToDeparture(r.closedToDeparture());
            br.setPriority(5);
            bookingRestrictionRepository.save(br);
            log.info("ChannexPricing[BOOKING_RESTRICT]: created [{}-{}] property={}",
                startDate, endDate, prop.getId());
            return true;
        } catch (Exception e) {
            log.warn("ChannexPricing[BOOKING_RESTRICT]: KO [{}, {}] property={}: {}",
                startDate, endDate, prop.getId(), e.getMessage());
            return false;
        }
    }

    private static Integer intOrNullFromAttr(JsonNode attrs, String key) {
        JsonNode n = attrs.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        if (n.isInt()) return n.intValue();
        try {
            String s = n.asText();
            if (s == null || s.isBlank() || "null".equalsIgnoreCase(s)) return null;
            return Integer.parseInt(s);
        } catch (Exception e) { return null; }
    }
}
