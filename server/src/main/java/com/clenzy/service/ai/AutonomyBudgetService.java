package com.clenzy.service.ai;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.repository.AiAutonomyBudgetRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * Sous-budget d'autonomie premium (campagne X4, ADR-007 / D-105).
 *
 * <p>Decide si un comportement autonome PREMIUM peut s'executer pour une org :
 * comportement active dans la config ET cumul de cycle PREMIUM_AUTO sous le
 * plafond. Au plafond, {@link Decision} porte le comportement a adopter (pause
 * vs notifier-seulement) — l'appelant (declencheur autonome X8) l'applique.</p>
 *
 * <p>L'interactif n'est JAMAIS impacte : ce service ne gate QUE l'autonomie
 * premium. Le socle et l'interactif passent sans le consulter.</p>
 */
@Service
public class AutonomyBudgetService {

    private static final Logger log = LoggerFactory.getLogger(AutonomyBudgetService.class);

    /** Verdict d'eligibilite d'un run autonome premium. */
    public enum Outcome { ALLOWED, CAPPED_PAUSE, CAPPED_NOTIFY_ONLY, DISABLED }

    public record Decision(Outcome outcome, long capMillicredits, long consumedMillicredits) {
        public boolean allowed() { return outcome == Outcome.ALLOWED; }
    }

    private final AiAutonomyBudgetRepository budgetRepository;
    private final AiUsageLedgerRepository ledgerRepository;
    private final ObjectMapper objectMapper;

    public AutonomyBudgetService(AiAutonomyBudgetRepository budgetRepository,
                                 AiUsageLedgerRepository ledgerRepository,
                                 ObjectMapper objectMapper) {
        this.budgetRepository = budgetRepository;
        this.ledgerRepository = ledgerRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Un comportement autonome premium peut-il s'executer maintenant ?
     *
     * @param organizationId org
     * @param behaviorKey    cle du comportement (ex. {@code "pricing_scan"}) —
     *                       doit etre active dans la config
     */
    @Transactional(readOnly = true)
    public Decision evaluate(Long organizationId, String behaviorKey) {
        AiAutonomyBudget budget = budgetRepository.findById(organizationId).orElse(null);
        long cap = budget != null ? budget.getPremiumCapMillicredits() : 0L;
        if (budget == null || cap <= 0 || !isBehaviorEnabled(budget, behaviorKey)) {
            return new Decision(Outcome.DISABLED, cap, 0L);
        }
        long consumed = ledgerRepository.sumBucketDebitSince(
                organizationId, AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO, currentCycleStart());
        if (consumed >= cap) {
            Outcome capped = AiAutonomyBudget.ON_CAP_PAUSE.equals(budget.getOnCapBehavior())
                    ? Outcome.CAPPED_PAUSE : Outcome.CAPPED_NOTIFY_ONLY;
            log.info("[AUTONOMY] Plafond premium atteint (org={}, cap={}mc, consomme={}mc) → {}",
                    organizationId, cap, consumed, capped);
            return new Decision(capped, cap, consumed);
        }
        return new Decision(Outcome.ALLOWED, cap, consumed);
    }

    /** Config d'autonomie de l'org (panneau UX) — creee a la volee si absente. */
    @Transactional(readOnly = true)
    public AiAutonomyBudget getConfig(Long organizationId) {
        return budgetRepository.findById(organizationId)
                .orElseGet(() -> new AiAutonomyBudget(organizationId));
    }

    /** Met a jour le plafond, le comportement au plafond et les toggles. */
    @Transactional
    public AiAutonomyBudget updateConfig(Long organizationId, long capMillicredits,
                                         String onCapBehavior, String behaviorsJson,
                                         String updatedBy) {
        if (capMillicredits < 0) {
            throw new IllegalArgumentException("Le plafond ne peut pas etre negatif");
        }
        if (!AiAutonomyBudget.ON_CAP_PAUSE.equals(onCapBehavior)
                && !AiAutonomyBudget.ON_CAP_NOTIFY_ONLY.equals(onCapBehavior)) {
            throw new IllegalArgumentException("on_cap_behavior invalide : " + onCapBehavior);
        }
        String behaviors = validateBehaviorsJson(behaviorsJson);
        AiAutonomyBudget budget = budgetRepository.findById(organizationId)
                .orElseGet(() -> new AiAutonomyBudget(organizationId));
        budget.setPremiumCapMillicredits(capMillicredits);
        budget.setOnCapBehavior(onCapBehavior);
        budget.setBehaviors(behaviors);
        budget.touch(updatedBy);
        return budgetRepository.save(budget);
    }

    /** Cumul premium du cycle courant (jauge UX). */
    @Transactional(readOnly = true)
    public long currentPremiumConsumption(Long organizationId) {
        return ledgerRepository.sumBucketDebitSince(
                organizationId, AiUsageLedgerEntry.BUCKET_PREMIUM_AUTO, currentCycleStart());
    }

    private boolean isBehaviorEnabled(AiAutonomyBudget budget, String behaviorKey) {
        if (behaviorKey == null) {
            return false;
        }
        try {
            Map<String, Object> toggles = objectMapper.readValue(budget.getBehaviors(), Map.class);
            return Boolean.TRUE.equals(toggles.get(behaviorKey));
        } catch (Exception e) {
            log.warn("[AUTONOMY] behaviors JSON illisible (org={}) → comportement desactive : {}",
                    budget.getOrganizationId(), e.getMessage());
            return false;
        }
    }

    private String validateBehaviorsJson(String behaviorsJson) {
        if (behaviorsJson == null || behaviorsJson.isBlank()) {
            return "{}";
        }
        try {
            objectMapper.readValue(behaviorsJson, Map.class);
            return behaviorsJson;
        } catch (Exception e) {
            throw new IllegalArgumentException("behaviors doit etre un objet JSON valide");
        }
    }

    /** Debut du cycle courant (mois calendaire UTC) — aligne sur la dotation mensuelle. */
    private static Instant currentCycleStart() {
        return YearMonth.now(ZoneOffset.UTC).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}
