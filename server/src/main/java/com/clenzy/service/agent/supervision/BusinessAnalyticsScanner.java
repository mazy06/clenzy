package com.clenzy.service.agent.supervision;

import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.PropertyPerformanceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Scanner analytics DÉTERMINISTE (Phase A) : porte côté serveur les heuristiques
 * métier historiquement calculées dans le front ({@code computeBusinessAlerts} /
 * {@code computeRecommendations}), sur données réelles (occupation plafonnée, marge
 * avec coûts d'intervention réels).
 *
 * <p>Émet des suggestions ORG-scopées via {@link SupervisionSuggestionService} :
 * certaines sont <b>actionnables</b> (ex. {@code PRICE_DROP} → bouton « Appliquer »
 * de la carte HITL), d'autres informationnelles. Aucun coût token (contrairement au
 * scan LLM). Dédupliqué par intitulé → un scan répété ne spamme pas la file.</p>
 */
@Service
public class BusinessAnalyticsScanner {

    private static final Logger log = LoggerFactory.getLogger(BusinessAnalyticsScanner.class);

    /** En-dessous : occupation FUTURE jugée faible → proposition de baisse tarifaire. */
    private static final double OCCUPANCY_LOW_PCT = 55.0;
    /** Au-dessus : occupation FUTURE élevée = prix possiblement sous-évalués → proposition de HAUSSE
     *  sur les nuits encore libres (revaloriser l'inventaire restant, corriger un manque à gagner). */
    private static final double OCCUPANCY_HIGH_PCT = 85.0;
    /** Fenêtre AVANT sur laquelle on juge l'occupation et cherche un créneau libre. */
    private static final int FORWARD_WINDOW_DAYS = 90;
    /** En-dessous : marge nette jugée insuffisante → alerte informationnelle. */
    private static final double MARGIN_LOW_PCT = 50.0;
    /** En-dessous : occupation RÉTROSPECTIVE (90 j) jugée basse → alerte « sous-performance »
     *  (annonce/photos/prix). Seuil aligné sur /reports « sous-performe » (< 40 %). */
    private static final double UNDERPERFORM_OCC_PCT = 40.0;
    /** Probabilité de remplissage retenue pour estimer l'impact € d'une remise (≈ /reports, 0.7). */
    private static final double FILL_PROBABILITY = 0.7;
    /** Baisse tarifaire de référence (%) — modulée par le délai en multi-segment. */
    private static final int PRICE_DROP_PERCENT = 12;
    /** Plafond de remise proposée (%) — garde-fou du yield multi-segment. */
    private static final int MAX_DISCOUNT_PERCENT = 25;
    /** Longueur max du créneau remisé (on ne brade pas un trimestre entier). */
    private static final int MAX_DISCOUNT_NIGHTS = 21;
    /** En-deçà, un trou n'est pas jugé assez significatif pour une remise. */
    private static final int MIN_GAP_NIGHTS = 2;

    /** Dates de la plage affichées à l'humain (ex. « 8 juil. »). */
    private static final DateTimeFormatter RANGE_FMT = DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH);

    private final PropertyPerformanceService performanceService;
    private final SupervisionSuggestionService suggestionService;
    private final ReservationRepository reservationRepository;
    private final com.clenzy.repository.CalendarDayRepository calendarDayRepository;
    private final com.clenzy.repository.SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public BusinessAnalyticsScanner(PropertyPerformanceService performanceService,
                                    SupervisionSuggestionService suggestionService,
                                    ReservationRepository reservationRepository,
                                    com.clenzy.repository.CalendarDayRepository calendarDayRepository,
                                    com.clenzy.repository.SupervisionModuleSettingsRepository moduleSettingsRepository,
                                    ObjectMapper objectMapper,
                                    Clock clock) {
        this.performanceService = performanceService;
        this.suggestionService = suggestionService;
        this.reservationRepository = reservationRepository;
        this.calendarDayRepository = calendarDayRepository;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /** Seuils résolus pour un scan (config org du module « rev », repli sur les défauts en dur). */
    private record Thresholds(double occupancyLow, double marginLow, int priceDropPercent) {}

    /**
     * Résout les seuils configurables (B5) depuis {@code SupervisionModuleSettings.thresholds}
     * (JSON du module « rev »). Toute clé absente / JSON illisible → repli sur le défaut en dur.
     */
    private Thresholds resolveThresholds(Long orgId) {
        double occ = OCCUPANCY_LOW_PCT;
        double margin = MARGIN_LOW_PCT;
        int drop = PRICE_DROP_PERCENT;
        try {
            final String json = moduleSettingsRepository.findByOrganizationIdAndModuleKey(orgId, "rev")
                    .map(com.clenzy.model.SupervisionModuleSettings::getThresholds)
                    .orElse(null);
            if (json != null && !json.isBlank()) {
                final com.fasterxml.jackson.databind.JsonNode n = objectMapper.readTree(json);
                if (n.path("occupancyLow").isNumber()) occ = n.path("occupancyLow").asDouble();
                if (n.path("marginLow").isNumber()) margin = n.path("marginLow").asDouble();
                if (n.path("priceDropPercent").isInt()) drop = n.path("priceDropPercent").asInt();
            }
        } catch (Exception e) {
            log.debug("thresholds parse failed org={} — repli défauts : {}", orgId, e.getMessage());
        }
        return new Thresholds(occ, margin, drop);
    }

    /**
     * Évalue les heuristiques d'un logement et émet les suggestions correspondantes.
     * Best-effort : toute erreur est absorbée (jamais sur le chemin critique d'un scan).
     */
    public void scanProperty(Long orgId, Long propertyId) {
        try {
            final Thresholds thr = resolveThresholds(orgId); // seuils configurables (B5), repli défauts
            // Perf rétrospective (90 j) : occupation, revenu, marge — et l'ADR en est dérivé
            // (prix moyen par nuit vendue) pour estimer l'impact € des cartes.
            final PropertyPerformanceDto perf = performanceService.compute(propertyId);
            final double adr = adrFrom(perf);

            // Occupation À VENIR : réservations ET blocages calendrier comptent comme occupés.
            // Un blocage (résa prise hors OTA/Baitly, blocage manuel) N'EST PAS un creux à remplir
            // → ni proposé à la remise, ni compté en sous-performance. On carde le logement si
            // l'occupation à venir reste faible :
            //  - créneau libre contigu → baisse tarifaire CIBLÉE (action, impact €) ;
            //  - sinon (vacance dispersée) → advisory « occupation à venir faible » (impact €).
            boolean forwardCarded = false;
            final LocalDate start = LocalDate.now(clock).plusDays(1);
            final LocalDate horizon = start.plusDays(FORWARD_WINDOW_DAYS);
            final Set<LocalDate> forwardOccupied = occupiedNights(orgId, propertyId, start, horizon);
            final double forwardOccupancy = forwardOccupied.size() * 100.0 / FORWARD_WINDOW_DAYS;
            if (forwardOccupancy < thr.occupancyLow()) {
                final List<LocalDate[]> gaps = findGaps(forwardOccupied, start, horizon);
                if (!gaps.isEmpty()) {
                    emitMultiSegment(orgId, propertyId, gaps, forwardOccupancy, thr, adr, false); // baisse
                } else {
                    emitForwardUnderperformance(orgId, propertyId, forwardOccupancy, thr, adr);
                }
                forwardCarded = true;
            } else if (forwardOccupancy > OCCUPANCY_HIGH_PCT) {
                // Sens INVERSE : occupation élevée = prix possiblement trop bas → proposer une
                // HAUSSE sur les nuits encore libres (l'inventaire rare se vend plus cher).
                final List<LocalDate[]> gaps = findGaps(forwardOccupied, start, horizon);
                if (!gaps.isEmpty()) {
                    emitMultiSegment(orgId, propertyId, gaps, forwardOccupancy, thr, adr, true); // hausse
                    forwardCarded = true;
                }
            }

            // Occupation RÉTROSPECTIVE (90 j), blocages inclus, pour la sous-performance.
            final double retroOccupancy = occupiedNights(orgId, propertyId,
                    LocalDate.now(clock).minusDays(FORWARD_WINDOW_DAYS), LocalDate.now(clock).plusDays(1))
                    .size() * 100.0 / FORWARD_WINDOW_DAYS;

            // Observabilité : trace les chiffres réels utilisés par le scanner (blocages inclus).
            log.info("BusinessAnalytics org={} property={} : forwardOcc={}% retroOcc={}% adr={}€ marge={}% → forwardCarded={}",
                    orgId, propertyId, Math.round(forwardOccupancy), Math.round(retroOccupancy),
                    Math.round(adr), Math.round(perf.netMargin()), forwardCarded);

            // Sous-performance RÉTROSPECTIVE (annonce/photos/prix) → advisory info. Seuil aligné
            // /reports « sous-performe » (< 40 %). Émise UNIQUEMENT si l'occupation à venir n'a
            // pas déjà cardé le logement (anti-doublon). Blocages inclus → un logement bloqué
            // (résas hors système) n'est pas vu comme sous-performant.
            if (!forwardCarded && retroOccupancy < UNDERPERFORM_OCC_PCT) {
                final long impactCents = Math.round(adr * 30 * 0.3 * 100);
                suggestionService.recordActionable(
                        orgId, propertyId, "rev",
                        "Logement en sous-performance",
                        String.format("Occupation de %d %% sur les 90 derniers jours (seuil %d %%). "
                                + "Revoir l'annonce, les photos ou le prix.",
                                Math.round(retroOccupancy), Math.round(UNDERPERFORM_OCC_PCT)),
                        null, null, impactCents > 0 ? impactCents : null, "info");
            }

            // Marge nette insuffisante → alerte informationnelle (module Finance).
            // Rétrospective (90 j passés) : la marge est un indicateur historique.
            if (perf.revenue().signum() > 0 && perf.netMargin() < thr.marginLow()) {
                suggestionService.recordActionable(
                        orgId, propertyId, "fin",
                        "Marge nette faible",
                        String.format("Marge nette de %d %% sur les 90 derniers jours (seuil 60 %%). "
                                + "Analyser les coûts d'intervention pour identifier des économies.",
                                Math.round(perf.netMargin())),
                        null, null, null, "warning");
            }
        } catch (Exception e) {
            log.debug("business analytics scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * Nuits OCCUPÉES sur {@code [from, to)} : réservations non annulées <b>ET</b> tout jour calendrier
     * indisponible (≠ AVAILABLE = BOOKED ou BLOCKED). Couvre les résas prises hors OTA/Baitly et les
     * blocages manuels → nuit indisponible, jamais un creux à remplir ni une sous-performance.
     */
    private Set<LocalDate> occupiedNights(Long orgId, Long propertyId, LocalDate from, LocalDate toExclusive) {
        final Set<LocalDate> occupied = new HashSet<>();
        for (Reservation r : reservationRepository.findByPropertyId(propertyId, orgId)) {
            if ("cancelled".equalsIgnoreCase(r.getStatus())) {
                continue;
            }
            final LocalDate s = r.getCheckIn().isBefore(from) ? from : r.getCheckIn();
            final LocalDate e = r.getCheckOut().isBefore(toExclusive) ? r.getCheckOut() : toExclusive;
            for (LocalDate d = s; d.isBefore(e); d = d.plusDays(1)) {
                occupied.add(d);
            }
        }
        occupied.addAll(calendarDayRepository.findUnavailableDatesInRange(propertyId, from, toExclusive, orgId));
        return occupied;
    }

    /**
     * TOUS les créneaux CONTIGUS de nuits libres sur {@code [start, horizon)}, chacun ≥
     * {@link #MIN_GAP_NIGHTS} et borné à {@link #MAX_DISCOUNT_NIGHTS} — base du yield
     * multi-segment. {@code occupied} = nuits indisponibles (réservations + blocages).
     * Chaque entrée = {@code [from, toExclusif)}.
     */
    private List<LocalDate[]> findGaps(Set<LocalDate> occupied, LocalDate start, LocalDate horizon) {
        final List<LocalDate[]> gaps = new ArrayList<>();
        LocalDate gapStart = null;
        for (LocalDate d = start; d.isBefore(horizon); d = d.plusDays(1)) {
            final boolean free = !occupied.contains(d);
            if (free && gapStart == null) {
                gapStart = d; // ouverture d'un nouveau créneau
                continue;
            }
            if (gapStart == null) {
                continue;
            }
            // Clôture à d (exclusif) si nuit réservée OU longueur max atteinte.
            final boolean maxed = ChronoUnit.DAYS.between(gapStart, d) >= MAX_DISCOUNT_NIGHTS;
            if (!free || maxed) {
                addGapIfLongEnough(gaps, gapStart, d);
                gapStart = (maxed && free) ? d : null; // un bloc maxé mais libre repart à d
            }
        }
        if (gapStart != null) {
            addGapIfLongEnough(gaps, gapStart, horizon);
        }
        return gaps;
    }

    private void addGapIfLongEnough(List<LocalDate[]> gaps, LocalDate from, LocalDate toExclusive) {
        if (ChronoUnit.DAYS.between(from, toExclusive) >= MIN_GAP_NIGHTS) {
            gaps.add(new LocalDate[]{from, toExclusive});
        }
    }

    /**
     * Remise proposée pour un créneau selon le DÉLAI (lead time) — logique yield :
     * un créneau creux proche se brade plus (urgence last-minute), un lointain moins.
     * Bornée autour du taux configuré {@code base} : proche = base+3, moyen = base, lointain = base−5.
     */
    private int discountForLeadTime(LocalDate gapStart, int base) {
        final long daysAhead = ChronoUnit.DAYS.between(LocalDate.now(clock), gapStart);
        final int pct;
        if (daysAhead < 14) {
            pct = base + 3;      // last-minute : incitation forte
        } else if (daysAhead <= 45) {
            pct = base;          // moyen terme : taux de référence
        } else {
            pct = base - 5;      // lointain : ajustement léger
        }
        return Math.max(3, Math.min(pct, MAX_DISCOUNT_PERCENT));
    }

    /**
     * ADR (prix moyen par nuit vendue) dérivé du DTO de perf : {@code revenue / nuits vendues},
     * où les nuits vendues = {@code occupancyRate% × fenêtre}. {@code 0} si aucune nuit vendue.
     * Évite d'élargir le DTO : tout est déjà porté par {@link PropertyPerformanceDto}.
     */
    private static double adrFrom(PropertyPerformanceDto perf) {
        if (perf == null || perf.revenue() == null) return 0.0;
        final double occupiedNights = (perf.occupancyRate() / 100.0) * perf.windowDays();
        return occupiedNights >= 1.0 ? perf.revenue().doubleValue() / occupiedNights : 0.0;
    }

    /**
     * Occupation à venir faible SANS créneau contigu remplissable (vacance dispersée) :
     * on ne peut pas cibler une remise sur un bloc, mais le logement sous-performe quand même
     * → carte advisory avec impact € estimé (nuits creuses à venir × ADR × probabilité).
     */
    private void emitForwardUnderperformance(Long orgId, Long propertyId, double forwardOccupancy,
                                             Thresholds thr, double adr) {
        final long vacantNights = Math.round((1.0 - forwardOccupancy / 100.0) * FORWARD_WINDOW_DAYS);
        final long impactCents = Math.round(vacantNights * adr * FILL_PROBABILITY * 100);
        suggestionService.recordActionable(
                orgId, propertyId, "rev",
                "Occupation à venir faible",
                String.format("Occupation de %d %% sur les %d prochains jours (seuil %d %%). "
                                + "Envisager une baisse de prix, une promo last-minute ou revoir l'annonce.",
                        Math.round(forwardOccupancy), FORWARD_WINDOW_DAYS, (long) Math.round(thr.occupancyLow())),
                null, null, impactCents > 0 ? impactCents : null, "warning");
    }

    /**
     * Yield MULTI-SEGMENT : pour chaque créneau creux à venir, une remise différenciée selon
     * le délai (last-minute plus fort). Émet UNE seule carte HITL portant TOUS les segments
     * (params {@code {"segments":[{from,to,percent}, …]}}), avec l'impact € cumulé. L'opérateur
     * ajuste/valide chaque segment dans la modale ; l'apply écrit un RateOverride par nuit de
     * chaque segment (visible dans « Prix dynamique »). Titre STABLE (dédup/cooldown) : ni dates ni %.
     */
    private void emitMultiSegment(Long orgId, Long propertyId, List<LocalDate[]> gaps,
                                  double forwardOccupancy, Thresholds thr, double adr, boolean raise) {
        final List<Map<String, Object>> segments = new ArrayList<>(gaps.size());
        double totalImpact = 0;
        final StringBuilder detail = new StringBuilder();
        for (int i = 0; i < gaps.size(); i++) {
            final LocalDate from = gaps.get(i)[0];
            final LocalDate toExclusive = gaps.get(i)[1];
            final long nights = ChronoUnit.DAYS.between(from, toExclusive);
            // Baisse : modulée par le délai (last-minute plus fort). Hausse : modulée par l'ampleur
            // de l'occupation (plus c'est plein, plus on peut revaloriser).
            final int percent = raise ? raiseForOccupancy(forwardOccupancy, thr)
                    : discountForLeadTime(from, thr.priceDropPercent());
            final Map<String, Object> seg = new LinkedHashMap<>();
            seg.put("from", from.toString());
            seg.put("to", toExclusive.toString()); // exclusif
            seg.put("percent", percent);
            segments.add(seg);
            // Impact € : baisse = remplissage attendu (nuits × ADR × proba) ; hausse = surplus de
            // prix sur les nuits encore vendables (nuits × ADR × %).
            totalImpact += nights * adr * (raise ? percent / 100.0 : FILL_PROBABILITY);
            detail.append(String.format("%s→%s %s%d %%%s",
                    RANGE_FMT.format(from), RANGE_FMT.format(toExclusive.minusDays(1)),
                    raise ? "+" : "−", percent, i < gaps.size() - 1 ? " · " : "."));
        }
        final String params;
        try {
            params = objectMapper.writeValueAsString(Map.of(
                    "direction", raise ? "up" : "down", "segments", segments));
        } catch (Exception e) {
            log.debug("multi-segment params serialization failed property={}: {}", propertyId, e.getMessage());
            return;
        }
        final long impactCents = Math.round(totalImpact * 100);
        final String title = raise
                ? "Relever les tarifs (demande forte)"
                : "Optimiser les tarifs des créneaux creux à venir";
        final String motif = raise
                ? String.format("Occupation de %d %% sur les %d prochains jours : demande forte, prix "
                                + "possiblement sous-évalués. %d créneau%s encore libre%s à revaloriser : %s",
                        Math.round(forwardOccupancy), FORWARD_WINDOW_DAYS,
                        gaps.size(), gaps.size() > 1 ? "x" : "", gaps.size() > 1 ? "s" : "", detail)
                : String.format("Occupation de %d %% sur les %d prochains jours (seuil %d %%). %d créneau%s creux à optimiser : %s",
                        Math.round(forwardOccupancy), FORWARD_WINDOW_DAYS, (long) Math.round(thr.occupancyLow()),
                        gaps.size(), gaps.size() > 1 ? "x" : "", detail);
        suggestionService.recordActionable(
                orgId, propertyId, "rev",
                title, motif,
                SupervisionActionType.PRICE_DROP, params, impactCents > 0 ? impactCents : null,
                raise ? "info" : "warning");
    }

    /** Hausse proposée selon l'ampleur de l'occupation : plus le logement est plein, plus on revalorise. */
    private int raiseForOccupancy(double forwardOccupancy, Thresholds thr) {
        final int base = thr.priceDropPercent(); // même magnitude de référence configurée
        final int pct = forwardOccupancy > 95.0 ? base + 3 : base;
        return Math.max(3, Math.min(pct, MAX_DISCOUNT_PERCENT));
    }
}
