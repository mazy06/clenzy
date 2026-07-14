package com.clenzy.service.agent.supervision;

import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
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
 *       NOTIFY → au plus AUTO_NOTIFY ; FULL → au plus AUTO_SILENT ;
 *       <b>2 bis</b> — niveau MAX du type ({@link SupervisionAutomatableTypes},
 *       matrice du plan) : type hors catalogue → CARD ;</li>
 *   <li>règle du type ({@code supervision_auto_rules}) absente ou disabled → CARD ;
 *       sinon niveau effectif = min(niveau règle, plafond module, max du type) ;</li>
 *   <li>enveloppe du type (JSON de la règle, défauts documentés ci-dessous)
 *       non satisfaite → CARD ;</li>
 *   <li>budget premium ({@link AutonomyBudgetService}) pour les actions qui
 *       consomment des crédits (REVIEW_DRAFT_REPLY) : plafond atteint → CARD.</li>
 * </ol>
 *
 * <p>Hors enveloppe → JAMAIS silencieux : la carte HITL normale est produite
 * (garde-fou transverse du plan). Chaque décision est journalisée (INFO).</p>
 *
 * <p><b>Enveloppes (défauts)</b> :</p>
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
 *       être verts ;</li>
 *   <li>{@code CALENDAR_BLOCK} (V2) : {@code maxAutoBlockDays} (défaut 7) +
 *       cap dur « 1 blocage auto / bien / 7 jours » (suggestions APPLIED par
 *       {@code auto:gate}) — inputs {@code blockDays} et {@code propertyId}
 *       requis ;</li>
 *   <li>{@code DEPOSIT_RELEASE} / {@code DEPOSIT_REFUND} (V2) : AUCUNE Issue
 *       OPEN/QUALIFIED sur le logement (input {@code hasOpenIssues} requis) ;
 *       RELEASE exige en plus {@code daysSinceCheckout} ≥
 *       {@code minDaysAfterCheckout} (défaut 2) ; REFUND exige
 *       {@code cancellationConfirmed} (statut résa re-lu). INVARIANT : ces
 *       types ne portent que des libérations de hold (zéro débit) ;</li>
 *   <li>{@code PAYMENT_REMINDER} (V3) : 1ʳᵉ relance UNIQUEMENT — une relance
 *       déjà APPLIED pour la réservation (quel que soit l'acteur) ou une carte
 *       relance créée &lt; 72 h → CARD. Input {@code paymentReservationId}
 *       requis. Les conditions métier (PARTIALLY_PAID, solde &gt; 0, email)
 *       sont RE-résolues à l'apply par l'exécuteur existant.</li>
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

    // ── Enveloppe CALENDAR_BLOCK (Vague 2, N1 max) ───────────────────────────
    /** Clé d'enveloppe : nb max de jours qu'un blocage AUTO peut poser. */
    static final String ENVELOPE_CALENDAR_MAX_AUTO_BLOCK_DAYS = "maxAutoBlockDays";
    /** Défaut : 7 jours (au-delà, la carte reste HITL — même si elle propose plus). */
    static final int DEFAULT_CALENDAR_MAX_AUTO_BLOCK_DAYS = 7;
    /** Clé d'input producteur : jours de blocage portés par la carte. */
    public static final String INPUT_BLOCK_DAYS = "blockDays";
    /** Clé d'input producteur : logement visé (cap hebdo par bien). */
    public static final String INPUT_PROPERTY_ID = "propertyId";
    /** Cap dur : au plus UN blocage auto par bien par fenêtre glissante de 7 jours. */
    static final Duration CALENDAR_AUTO_BLOCK_CAP_WINDOW = Duration.ofDays(7);

    // ── Enveloppe DEPOSIT_RELEASE / DEPOSIT_REFUND (Vague 2, N1 max) ─────────
    // INVARIANT argent : ces types ne portent que des LIBÉRATIONS de hold Stripe
    // (releaseHold — aucun débit). Tout flux qui débiterait reste HITL (MONEY_TOOLS).
    /** Clé d'enveloppe RELEASE : délai minimal (jours) après le check-out. */
    static final String ENVELOPE_MIN_DAYS_AFTER_CHECKOUT = "minDaysAfterCheckout";
    /** Défaut : J+2 (rythme de la règle CHECK_OUT_PASSED recommandée). */
    static final int DEFAULT_MIN_DAYS_AFTER_CHECKOUT = 2;
    /** Clé d'input producteur : une Issue OPEN/QUALIFIED existe sur le logement. */
    public static final String INPUT_HAS_OPEN_ISSUES = "hasOpenIssues";
    /** Clé d'input producteur (RELEASE) : jours écoulés depuis le check-out. */
    public static final String INPUT_DAYS_SINCE_CHECKOUT = "daysSinceCheckout";
    /** Clé d'input producteur (REFUND) : annulation confirmée (statut résa re-lu). */
    public static final String INPUT_CANCELLATION_CONFIRMED = "cancellationConfirmed";

    // ── Enveloppe PAYMENT_REMINDER (V3, N1 max — email irréversible) ─────────
    /** Clé d'input producteur : réservation ciblée par la relance. */
    public static final String INPUT_PAYMENT_RESERVATION_ID = "paymentReservationId";
    /** Anti-rafale : jamais deux cartes relance à moins de 72 h pour une même résa. */
    static final Duration PAYMENT_REMINDER_MIN_INTERVAL = Duration.ofHours(72);

    private final SupervisionSettingsRepository settingsRepository;
    private final SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final SupervisionModuleRegistry moduleRegistry;
    private final SupervisionAutoRuleRepository autoRuleRepository;
    private final SupervisionSuggestionRepository suggestionRepository;
    private final AutonomyBudgetService autonomyBudgetService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public AutoApplyGate(SupervisionSettingsRepository settingsRepository,
                         SupervisionModuleSettingsRepository moduleSettingsRepository,
                         SupervisionModuleRegistry moduleRegistry,
                         SupervisionAutoRuleRepository autoRuleRepository,
                         SupervisionSuggestionRepository suggestionRepository,
                         AutonomyBudgetService autonomyBudgetService,
                         ObjectMapper objectMapper,
                         Clock clock) {
        this.settingsRepository = settingsRepository;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.moduleRegistry = moduleRegistry;
        this.autoRuleRepository = autoRuleRepository;
        this.suggestionRepository = suggestionRepository;
        this.autonomyBudgetService = autonomyBudgetService;
        this.objectMapper = objectMapper;
        this.clock = clock;
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

        // 2 bis. Niveau MAX du type (catalogue serveur, matrice du plan) : un type
        // hors catalogue n'est JAMAIS automatisable (PAYMENT_REMINDER V3, scan LLM).
        final SupervisionAutonomy typeMax = SupervisionAutomatableTypes.find(actionType)
                .map(SupervisionAutomatableTypes.AutomatableType::maxLevel)
                .orElse(null);
        if (typeMax == null) {
            return AutoDecision.CARD;
        }

        // 3. Règle du type : opt-in explicite requis (absente/disabled → HITL).
        final SupervisionAutoRule rule = autoRuleRepository
                .findByOrganizationIdAndActionType(orgId, actionType).orElse(null);
        if (rule == null || !rule.isEnabled()) {
            return AutoDecision.CARD;
        }
        // Niveau effectif = min(niveau règle, plafond module, MAX du type).
        final SupervisionAutonomy effective = min(
                min(rule.getLevel() == null ? SupervisionAutonomy.NOTIFY : rule.getLevel(), ceiling),
                typeMax);
        if (effective == SupervisionAutonomy.SUGGEST) {
            return AutoDecision.CARD;
        }

        // 4. Enveloppe du type non satisfaite → HITL (jamais silencieux hors enveloppe).
        if (!envelopeSatisfied(orgId, actionType, rule.getEnvelope(), envelopeInputs)) {
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
     * input attendu manquant → false (carte HITL — jamais silencieux hors enveloppe).
     */
    private boolean envelopeSatisfied(Long orgId, String actionType, String envelopeJson,
                                      Map<String, Object> envelopeInputs) {
        return switch (actionType) {
            case SupervisionActionType.PRICE_DROP ->
                    priceDropEnvelope(envelopeJson, envelopeInputs);
            case SupervisionActionType.CALENDAR_BLOCK ->
                    calendarBlockEnvelope(orgId, envelopeJson, envelopeInputs);
            case SupervisionActionType.DEPOSIT_RELEASE ->
                    noOpenIssues(envelopeInputs) && checkoutDelayReached(envelopeJson, envelopeInputs);
            case SupervisionActionType.DEPOSIT_REFUND ->
                    noOpenIssues(envelopeInputs)
                            && Boolean.TRUE.equals(envelopeInputs.get(INPUT_CANCELLATION_CONFIRMED));
            case SupervisionActionType.PAYMENT_REMINDER ->
                    paymentReminderEnvelope(orgId, envelopeInputs);
            // CLEANING_REQUEST / REVIEW_DRAFT_REPLY : enveloppe vide (cf. javadoc classe).
            default -> true;
        };
    }

    /**
     * PAYMENT_REMINDER (V3) : auto pour la PREMIÈRE relance seulement — dès
     * qu'une relance a été APPLIED pour cette réservation (par l'humain OU par
     * l'auto), les suivantes restent HITL ; et aucune carte relance créée dans
     * les {@link #PAYMENT_REMINDER_MIN_INTERVAL} dernières heures (anti-rafale
     * sur les échecs répétés d'un même paiement, quel que soit son statut).
     */
    private boolean paymentReminderEnvelope(Long orgId, Map<String, Object> envelopeInputs) {
        if (!(envelopeInputs.get(INPUT_PAYMENT_RESERVATION_ID) instanceof Number reservationId)) {
            return false; // réservation inévaluable → fail-safe HITL
        }
        final boolean alreadyReminded = suggestionRepository
                .existsByOrganizationIdAndReservationIdAndActionTypeAndStatus(
                        orgId, reservationId.longValue(),
                        SupervisionActionType.PAYMENT_REMINDER, SupervisionSuggestion.STATUS_APPLIED);
        if (alreadyReminded) {
            return false; // 2ᵉ relance et suivantes : toujours HITL
        }
        return !suggestionRepository
                .existsByOrganizationIdAndReservationIdAndActionTypeAndCreatedAtAfter(
                        orgId, reservationId.longValue(), SupervisionActionType.PAYMENT_REMINDER,
                        clock.instant().minus(PAYMENT_REMINDER_MIN_INTERVAL));
    }

    private boolean priceDropEnvelope(String envelopeJson, Map<String, Object> envelopeInputs) {
        final int maxAllowed = envelopeInt(envelopeJson, ENVELOPE_PRICE_MAX_SEGMENT_PERCENT,
                DEFAULT_PRICE_MAX_SEGMENT_PERCENT);
        final Object input = envelopeInputs.get(INPUT_MAX_SEGMENT_ABS_PERCENT);
        if (!(input instanceof Number maxSegment)) {
            return false; // input requis absent → fail-safe HITL
        }
        return maxSegment.doubleValue() <= maxAllowed;
    }

    /**
     * CALENDAR_BLOCK : la carte ne peut être auto-appliquée que si (a) sa durée
     * reste ≤ {@code maxAutoBlockDays} (défaut 7 — au-delà, carte HITL même si
     * elle propose plus) et (b) le cap dur « 1 blocage auto par bien / 7 jours »
     * est libre (suggestions CALENDAR_BLOCK APPLIED par {@code auto:gate} sur la
     * fenêtre). Les protections d'apply (nuits BOOKED refusées, ownership,
     * MAX_BLOCK_DAYS=30) restent la deuxième ligne : un refus → carte PENDING.
     */
    private boolean calendarBlockEnvelope(Long orgId, String envelopeJson,
                                          Map<String, Object> envelopeInputs) {
        final int maxDays = envelopeInt(envelopeJson, ENVELOPE_CALENDAR_MAX_AUTO_BLOCK_DAYS,
                DEFAULT_CALENDAR_MAX_AUTO_BLOCK_DAYS);
        if (!(envelopeInputs.get(INPUT_BLOCK_DAYS) instanceof Number days)
                || days.intValue() <= 0 || days.intValue() > maxDays) {
            return false;
        }
        if (!(envelopeInputs.get(INPUT_PROPERTY_ID) instanceof Number propertyId)) {
            return false; // cap par bien inévaluable → fail-safe HITL
        }
        final Instant windowStart = clock.instant().minus(CALENDAR_AUTO_BLOCK_CAP_WINDOW);
        final boolean capConsumed = suggestionRepository
                .existsByOrganizationIdAndPropertyIdAndActionTypeAndStatusAndAppliedByAndAppliedAtAfter(
                        orgId, propertyId.longValue(), SupervisionActionType.CALENDAR_BLOCK,
                        SupervisionSuggestion.STATUS_APPLIED,
                        SupervisionSuggestion.APPLIED_BY_AUTO, windowStart);
        return !capConsumed;
    }

    /** Enveloppe commune cautions : AUCUNE Issue ouverte (input requis et false). */
    private static boolean noOpenIssues(Map<String, Object> envelopeInputs) {
        return Boolean.FALSE.equals(envelopeInputs.get(INPUT_HAS_OPEN_ISSUES));
    }

    /** DEPOSIT_RELEASE : le check-out doit dater d'au moins {@code minDaysAfterCheckout} jours. */
    private boolean checkoutDelayReached(String envelopeJson, Map<String, Object> envelopeInputs) {
        final int minDays = envelopeInt(envelopeJson, ENVELOPE_MIN_DAYS_AFTER_CHECKOUT,
                DEFAULT_MIN_DAYS_AFTER_CHECKOUT);
        return envelopeInputs.get(INPUT_DAYS_SINCE_CHECKOUT) instanceof Number days
                && days.longValue() >= minDays;
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
