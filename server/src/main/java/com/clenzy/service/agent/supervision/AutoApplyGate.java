package com.clenzy.service.agent.supervision;

import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Porte de décision de l'autonomie déterministe (Vague 1) : pour une carte
 * actionnable calculée par un scanner, décide si elle reste HITL ({@link
 * AutoDecision#CARD}) ou si elle est auto-appliquée — avec notification
 * ({@link AutoDecision#AUTO_NOTIFY}) ou silencieusement, feed seul
 * ({@link AutoDecision#AUTO_SILENT}).
 *
 * <p><b>Hiérarchie de commande (ordre EXACT des vérifications)</b> :</p>
 * <ol>
 *   <li>kill-switch global : {@link SupervisionSettings} absent / OFF / en pause → CARD ;</li>
 *   <li>niveau du module = <b>plafond</b> : module désactivé ou SUGGEST → CARD ;
 *       NOTIFY → au plus AUTO_NOTIFY ; FULL → au plus AUTO_SILENT ;</li>
 *   <li>règle du type ({@code supervision_auto_rules}) absente ou disabled → CARD ;
 *       sinon niveau effectif = min(niveau règle, plafond module) ;</li>
 *   <li>enveloppe du type (JSON de la règle, défauts documentés ci-dessous)
 *       non satisfaite → CARD ;</li>
 *   <li>budget premium ({@link AutonomyBudgetService}) pour les actions qui
 *       consomment des crédits (REVIEW_DRAFT_REPLY) : plafond atteint → CARD.</li>
 * </ol>
 *
 * <p>Hors enveloppe → JAMAIS silencieux : la carte HITL normale est produite
 * (garde-fou transverse du plan). Chaque décision est journalisée (INFO).</p>
 *
 * <p><b>Enveloppes V1 (défauts)</b> :</p>
 * <ul>
 *   <li>{@code CLEANING_REQUEST} : enveloppe vide — les garanties sont déjà
 *       structurelles (AFTER_EACH_STAY + idempotence de l'apply) ;</li>
 *   <li>{@code REVIEW_DRAFT_REPLY} : enveloppe vide — le gating est le budget
 *       premium (étape 5) ; la PUBLICATION reste manuelle dans tous les cas ;</li>
 *   <li>{@code PRICE_DROP} : {@code maxSegmentPercent} (défaut
 *       {@link #DEFAULT_PRICE_MAX_SEGMENT_PERCENT} = 12, aligné sur
 *       {@code clenzy.yield.v1.auto-hitl-impact-pct}) — chaque segment doit
 *       rester ≤ ce pourcentage (input {@code maxSegmentAbsPercent} requis,
 *       absent = CARD, fail-safe). Le cadre yield (mode AUTO, protections,
 *       cap journalier) est vérifié EN PLUS par le scanner : les deux doivent
 *       être verts.</li>
 * </ul>
 */
@Service
public class AutoApplyGate {

    private static final Logger log = LoggerFactory.getLogger(AutoApplyGate.class);

    /** Décision du gate pour une carte actionnable calculée. */
    public enum AutoDecision {
        /** HITL : carte normale, l'opérateur décide (défaut sûr). */
        CARD,
        /** N1 : auto-application + notification org (annulable/corrigeable). */
        AUTO_NOTIFY,
        /** N2 : auto-application silencieuse (entrée de feed seule). */
        AUTO_SILENT
    }

    /** Clé d'enveloppe PRICE_DROP : % max (abs) par segment auto-appliqué. */
    static final String ENVELOPE_PRICE_MAX_SEGMENT_PERCENT = "maxSegmentPercent";
    /** Défaut PRICE_DROP : aligné sur le garde-fou yield auto-HITL (12 %). */
    static final int DEFAULT_PRICE_MAX_SEGMENT_PERCENT = 12;
    /** Clé d'input scanner PRICE_DROP : plus grand |percent| des segments proposés. */
    public static final String INPUT_MAX_SEGMENT_ABS_PERCENT = "maxSegmentAbsPercent";

    private final SupervisionSettingsRepository settingsRepository;
    private final SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final SupervisionModuleRegistry moduleRegistry;
    private final SupervisionAutoRuleRepository autoRuleRepository;
    private final AutonomyBudgetService autonomyBudgetService;
    private final ObjectMapper objectMapper;

    public AutoApplyGate(SupervisionSettingsRepository settingsRepository,
                         SupervisionModuleSettingsRepository moduleSettingsRepository,
                         SupervisionModuleRegistry moduleRegistry,
                         SupervisionAutoRuleRepository autoRuleRepository,
                         AutonomyBudgetService autonomyBudgetService,
                         ObjectMapper objectMapper) {
        this.settingsRepository = settingsRepository;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.moduleRegistry = moduleRegistry;
        this.autoRuleRepository = autoRuleRepository;
        this.autonomyBudgetService = autonomyBudgetService;
        this.objectMapper = objectMapper;
    }

    /**
     * Décide du sort d'une carte actionnable calculée par un scanner.
     *
     * @param envelopeInputs mesures du déclencheur nécessaires à l'évaluation de
     *                       l'enveloppe (ex. {@link #INPUT_MAX_SEGMENT_ABS_PERCENT}
     *                       pour PRICE_DROP). Jamais null (Map.of() si aucun input).
     */
    @Transactional(readOnly = true)
    public AutoDecision decide(Long orgId, String moduleKey, String actionType,
                               Map<String, Object> envelopeInputs) {
        final AutoDecision decision = evaluate(orgId, moduleKey, actionType, envelopeInputs);
        log.info("[AUTO-GATE] org={} module={} type={} → {}", orgId, moduleKey, actionType, decision);
        return decision;
    }

    private AutoDecision evaluate(Long orgId, String moduleKey, String actionType,
                                  Map<String, Object> envelopeInputs) {
        // 1. Kill-switch global : feature OFF ou en pause → HITL.
        final SupervisionSettings settings =
                settingsRepository.findByOrganizationId(orgId).orElse(null);
        if (settings == null || !settings.isEnabled() || settings.isPaused()) {
            return AutoDecision.CARD;
        }

        // 2. Plafond du module (agent) : SUGGEST (ou module OFF) → HITL.
        final SupervisionAutonomy ceiling = moduleCeiling(orgId, moduleKey);
        if (ceiling == null || ceiling == SupervisionAutonomy.SUGGEST) {
            return AutoDecision.CARD;
        }

        // 3. Règle du type : opt-in explicite requis (absente/disabled → HITL).
        final SupervisionAutoRule rule = autoRuleRepository
                .findByOrganizationIdAndActionType(orgId, actionType).orElse(null);
        if (rule == null || !rule.isEnabled()) {
            return AutoDecision.CARD;
        }
        // Niveau effectif = min(niveau règle, plafond module).
        final SupervisionAutonomy effective =
                min(rule.getLevel() == null ? SupervisionAutonomy.NOTIFY : rule.getLevel(), ceiling);
        if (effective == SupervisionAutonomy.SUGGEST) {
            return AutoDecision.CARD;
        }

        // 4. Enveloppe du type non satisfaite → HITL (jamais silencieux hors enveloppe).
        if (!envelopeSatisfied(actionType, rule.getEnvelope(), envelopeInputs)) {
            return AutoDecision.CARD;
        }

        // 5. Budget premium pour les actions qui consomment des crédits.
        if (consumesPremiumCredits(actionType) && premiumBudgetExhausted(orgId)) {
            return AutoDecision.CARD;
        }

        return effective == SupervisionAutonomy.FULL ? AutoDecision.AUTO_SILENT : AutoDecision.AUTO_NOTIFY;
    }

    /**
     * Plafond d'autonomie du module : override org s'il existe, sinon défaut du
     * catalogue (SUGGEST au lancement). Module désactivé → null (jamais d'auto).
     */
    private SupervisionAutonomy moduleCeiling(Long orgId, String moduleKey) {
        final SupervisionModuleSettings override = moduleSettingsRepository
                .findByOrganizationIdAndModuleKey(orgId, moduleKey).orElse(null);
        if (override != null) {
            return override.isEnabled() ? override.getAutonomyLevel() : null;
        }
        return moduleRegistry.find(moduleKey)
                .map(SupervisionModuleRegistry.SupervisionModule::defaultAutonomy)
                .orElse(null);
    }

    /** Ordre SUGGEST &lt; NOTIFY &lt; FULL (ordinal de l'enum, documenté ici). */
    private static SupervisionAutonomy min(SupervisionAutonomy a, SupervisionAutonomy b) {
        return a.ordinal() <= b.ordinal() ? a : b;
    }

    /** Seul REVIEW_DRAFT_REPLY (appel LLM) consomme des crédits premium en V1. */
    private static boolean consumesPremiumCredits(String actionType) {
        return SupervisionActionType.REVIEW_DRAFT_REPLY.equals(actionType);
    }

    /**
     * Plafond premium atteint (ou nul) → l'action qui consomme des crédits repasse
     * en HITL. On ne gate QUE sur le plafond/consommation (les toggles de
     * comportements premium restent le contrat des scans autonomes X8, pas des
     * cartes) : cap ≤ 0 = aucune autonomie premium pour ce forfait.
     */
    private boolean premiumBudgetExhausted(Long orgId) {
        final long cap = autonomyBudgetService.getConfig(orgId).getPremiumCapMillicredits();
        return cap <= 0 || autonomyBudgetService.currentPremiumConsumption(orgId) >= cap;
    }

    /**
     * Évalue l'enveloppe du type. Fail-safe : JSON illisible, borne violée ou
     * input attendu manquant → false (carte HITL).
     */
    private boolean envelopeSatisfied(String actionType, String envelopeJson,
                                      Map<String, Object> envelopeInputs) {
        if (SupervisionActionType.PRICE_DROP.equals(actionType)) {
            final int maxAllowed = envelopeInt(envelopeJson, ENVELOPE_PRICE_MAX_SEGMENT_PERCENT,
                    DEFAULT_PRICE_MAX_SEGMENT_PERCENT);
            final Object input = envelopeInputs.get(INPUT_MAX_SEGMENT_ABS_PERCENT);
            if (!(input instanceof Number maxSegment)) {
                return false; // input requis absent → fail-safe HITL
            }
            return maxSegment.doubleValue() <= maxAllowed;
        }
        // CLEANING_REQUEST / REVIEW_DRAFT_REPLY : enveloppe vide en V1 (cf. javadoc classe).
        return true;
    }

    /** Lit une borne entière de l'enveloppe JSON, repli sur le défaut documenté. */
    private int envelopeInt(String envelopeJson, String key, int defaultValue) {
        if (envelopeJson == null || envelopeJson.isBlank()) {
            return defaultValue;
        }
        try {
            final JsonNode node = objectMapper.readTree(envelopeJson);
            return node.path(key).isNumber() ? node.path(key).asInt() : defaultValue;
        } catch (Exception e) {
            log.debug("[AUTO-GATE] enveloppe illisible ({}) — repli défaut : {}", key, e.getMessage());
            return defaultValue;
        }
    }
}
