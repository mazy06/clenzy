package com.clenzy.service.agent.supervision;

import com.clenzy.exception.NotFoundException;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.SimulationService;
import com.clenzy.service.SimulationService.PricingChangeResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pont entre les cartes HITL de prix (yield multi-segment) et le moteur de simulation /
 * l'exécuteur d'application. Utilisé par la modale « Ajuster les tarifs » :
 * <ul>
 *   <li>{@link #simulate} — prévision occupation/revenu par segment + cumul, sur les valeurs
 *       éditées par l'opérateur (aucun effet DB) ;</li>
 *   <li>{@link #applyCustom} — écrit les {@code RateOverride} sur les segments validés
 *       (via {@link SupervisionSuggestionService}), visibles dans « Prix dynamique ».</li>
 * </ul>
 * Org-scopé strict (ownership du logement / de la suggestion).
 */
@Service
public class PriceSuggestionService {

    private static final Logger log = LoggerFactory.getLogger(PriceSuggestionService.class);

    /** Segment édité : plage {@code [from, to)} (to exclusif) + remise en % (positif = baisse). */
    public record SegmentInput(LocalDate from, LocalDate to, int percent) {}

    /** Prévision : un résultat par segment + le cumul (base vs scénario). */
    public record SimulationResult(
            List<PricingChangeResult> segments,
            BigDecimal totalBaselineRevenue,
            BigDecimal totalScenarioRevenue,
            BigDecimal totalDeltaRevenue) {}

    private final SimulationService simulationService;
    private final PropertyRepository propertyRepository;
    private final SupervisionSuggestionService suggestionService;
    private final ObjectMapper objectMapper;

    public PriceSuggestionService(SimulationService simulationService,
                                  PropertyRepository propertyRepository,
                                  SupervisionSuggestionService suggestionService,
                                  ObjectMapper objectMapper) {
        this.simulationService = simulationService;
        this.propertyRepository = propertyRepository;
        this.suggestionService = suggestionService;
        this.objectMapper = objectMapper;
    }

    /**
     * Prévision de l'ajustement multi-segment (occupation/ADR/revenu base→projeté, par segment
     * et cumulé). Read-only, aucun effet DB. Ownership : le logement doit être dans l'org.
     */
    public SimulationResult simulate(Long orgId, String keycloakId, Long propertyId,
                                     List<SegmentInput> segments, boolean raise) {
        requirePropertyInOrg(propertyId, orgId);
        final List<PricingChangeResult> results = new ArrayList<>(segments.size());
        BigDecimal baseTotal = BigDecimal.ZERO;
        BigDecimal scenarioTotal = BigDecimal.ZERO;
        for (SegmentInput seg : segments) {
            validateSegment(seg);
            // Le moteur attend un pctChange SIGNÉ (hausse = positif, baisse = négatif) et des bornes
            // INCLUSIVES (nos segments sont [from, to) exclusifs → to.minusDays(1) = dernière nuit).
            final double pctChange = (raise ? 1 : -1) * Math.abs(seg.percent()) / 100.0;
            final PricingChangeResult r = simulationService.simulatePricingChange(
                    keycloakId, propertyId, pctChange, seg.from(), seg.to().minusDays(1));
            results.add(r);
            baseTotal = baseTotal.add(r.baseline().revenue());
            scenarioTotal = scenarioTotal.add(r.scenario().revenue());
        }
        return new SimulationResult(results, baseTotal, scenarioTotal, scenarioTotal.subtract(baseTotal));
    }

    /**
     * Applique les segments validés : force la suggestion en {@code PRICE_DROP} avec les params
     * édités, puis délègue à {@link SupervisionSuggestionService#apply} (CAS PENDING→APPLIED +
     * écriture {@code RateOverride}). Appels cross-service séparés (pas d'auto-invocation @Transactional).
     */
    public void applyCustom(Long orgId, Long suggestionId, List<SegmentInput> segments, boolean raise,
                            String appliedBy) {
        if (segments == null || segments.isEmpty()) {
            throw new IllegalArgumentException("Au moins un segment de prix est requis");
        }
        final List<Map<String, Object>> segJson = new ArrayList<>(segments.size());
        for (SegmentInput seg : segments) {
            validateSegment(seg);
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("from", seg.from().toString());
            m.put("to", seg.to().toString()); // exclusif
            m.put("percent", seg.percent());
            segJson.add(m);
        }
        final String params;
        try {
            params = objectMapper.writeValueAsString(Map.of(
                    "direction", raise ? "up" : "down", "segments", segJson));
        } catch (Exception e) {
            throw new IllegalStateException("Sérialisation des segments impossible", e);
        }
        suggestionService.setCustomPriceParams(orgId, suggestionId, params);
        suggestionService.apply(orgId, suggestionId, appliedBy);
        log.info("Prix ajusté (custom, {}) org={} suggestion={} : {} segment(s)",
                raise ? "hausse" : "baisse", orgId, suggestionId, segments.size());
    }

    private void validateSegment(SegmentInput seg) {
        if (seg == null || seg.from() == null || seg.to() == null || !seg.from().isBefore(seg.to())) {
            throw new IllegalArgumentException("Segment invalide (from/to)");
        }
        if (seg.percent() <= 0 || seg.percent() > 50) {
            throw new IllegalArgumentException("Remise hors bornes (1–50 %) : " + seg.percent());
        }
    }

    private void requirePropertyInOrg(Long propertyId, Long orgId) {
        if (propertyId == null) {
            throw new IllegalArgumentException("propertyId requis");
        }
        propertyRepository.findByIdWithOwner(propertyId, orgId)
                .orElseThrow(() -> new NotFoundException("Logement introuvable : " + propertyId));
    }
}
