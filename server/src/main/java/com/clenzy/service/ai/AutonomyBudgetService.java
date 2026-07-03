package com.clenzy.service.ai;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.model.Organization;
import com.clenzy.repository.AiAutonomyBudgetRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import com.clenzy.repository.OrganizationRepository;
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

    // Defauts du plafond premium PAR FORFAIT (grille campagne §9, validee avec X5) :
    // essentiel 0 (activable via top-up), confort 500 credits, premium 2 500 credits.
    // Appliques UNIQUEMENT quand l'org n'a pas de config explicite — les behaviors
    // restant OFF par defaut, rien ne s'execute tant que l'org n'active pas un toggle ;
    // mais quand elle le fait, le plafond de son forfait est deja en place.
    private static final long DEFAULT_CAP_ESSENTIEL_MC = 0L;
    private static final long DEFAULT_CAP_CONFORT_MC = 500_000L;
    private static final long DEFAULT_CAP_PREMIUM_MC = 2_500_000L;

    private final AiAutonomyBudgetRepository budgetRepository;
    private final AiUsageLedgerRepository ledgerRepository;
    private final OrganizationRepository organizationRepository;
    private final ObjectMapper objectMapper;

    public AutonomyBudgetService(AiAutonomyBudgetRepository budgetRepository,
                                 AiUsageLedgerRepository ledgerRepository,
                                 OrganizationRepository organizationRepository,
                                 ObjectMapper objectMapper) {
        this.budgetRepository = budgetRepository;
        this.ledgerRepository = ledgerRepository;
        this.organizationRepository = organizationRepository;
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
        AiAutonomyBudget budget = budgetRepository.findById(organizationId)
                .orElseGet(() -> defaultBudgetFor(organizationId));
        long cap = budget.getPremiumCapMillicredits();
        if (cap <= 0 || !isBehaviorEnabled(budget, behaviorKey)) {
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
                .orElseGet(() -> defaultBudgetFor(organizationId));
    }

    /**
     * Config TRANSIENTE par defaut d'une org sans ligne explicite : plafond de
     * la grille selon le forfait de l'org (behaviors vides = tout OFF). La ligne
     * n'est persistee qu'au premier updateConfig — une org qui ne touche a rien
     * suit automatiquement les evolutions de la grille et de son forfait.
     */
    private AiAutonomyBudget defaultBudgetFor(Long organizationId) {
        AiAutonomyBudget budget = new AiAutonomyBudget(organizationId);
        budget.setPremiumCapMillicredits(defaultCapForOrganization(organizationId));
        return budget;
    }

    /** Plafond de la grille §9 par forfait — repli essentiel (0), comme la dotation T-07. */
    private long defaultCapForOrganization(Long organizationId) {
        String forfait = organizationRepository.findById(organizationId)
                .map(Organization::getForfait)
                .orElse(null);
        String normalized = forfait == null ? "essentiel" : forfait.toLowerCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "premium" -> DEFAULT_CAP_PREMIUM_MC;
            case "confort" -> DEFAULT_CAP_CONFORT_MC;
            default -> DEFAULT_CAP_ESSENTIEL_MC;
        };
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
