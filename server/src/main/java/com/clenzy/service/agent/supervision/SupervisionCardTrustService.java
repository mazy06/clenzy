package com.clenzy.service.agent.supervision;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.supervision.SupervisionAutomatableTypes.AutomatableType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

/**
 * Règles de Confiance étendues aux CARTES (Vague 3) — miroir de
 * {@code AgentTrustRuleService.evaluateSuggestions()} pour la file HITL de la
 * constellation : détecte les (org, type d'action) systématiquement APPROUVÉS
 * par un humain et SUGGÈRE d'automatiser le type — suggestion INERTE tant qu'un
 * humain ne l'accepte pas (Activer dans le menu Automatisation) ; « Ignorer »
 * pose un cooldown de re-suggestion de {@link #RESUGGEST_COOLDOWN}.
 *
 * <p><b>Consécutivité</b> : cartes DÉCIDÉES du type, de la plus récente à la plus
 * ancienne (instant de décision) — une carte APPLIED par {@code user:<id>} compte,
 * un DISMISSED remet la série à zéro, une carte appliquée par {@code auto:gate}
 * (ou acteur inconnu, historique pré-V1) ne compte PAS et ne casse pas la série
 * (elle ne dit rien de la confiance de l'humain).</p>
 *
 * <p><b>INVARIANT</b> : seuls les types du catalogue {@link SupervisionAutomatableTypes}
 * sont évalués — le scan LLM (N0) et les MONEY_TOOLS ne sont jamais suggérés.</p>
 */
@Service
public class SupervisionCardTrustService {

    private static final Logger log = LoggerFactory.getLogger(SupervisionCardTrustService.class);

    /** Une suggestion écartée n'est pas re-proposée avant ce délai. */
    static final Duration RESUGGEST_COOLDOWN = Duration.ofDays(30);
    /** Fenêtre de lecture des décisions (bien au-delà du seuil : série + son éventuel stop). */
    static final int DECISIONS_FETCH_LIMIT = 50;

    private final SupervisionSettingsRepository settingsRepository;
    private final SupervisionAutoRuleRepository autoRuleRepository;
    private final SupervisionSuggestionRepository suggestionRepository;
    private final NotificationService notificationService;
    private final Clock clock;
    /** Nb d'approbations humaines consécutives requis pour suggérer (défaut 5). */
    private final int threshold;

    public SupervisionCardTrustService(SupervisionSettingsRepository settingsRepository,
                                       SupervisionAutoRuleRepository autoRuleRepository,
                                       SupervisionSuggestionRepository suggestionRepository,
                                       NotificationService notificationService,
                                       Clock clock,
                                       @Value("${clenzy.supervision.card-trust.threshold:5}") int threshold) {
        this.settingsRepository = settingsRepository;
        this.autoRuleRepository = autoRuleRepository;
        this.suggestionRepository = suggestionRepository;
        this.notificationService = notificationService;
        this.clock = clock;
        this.threshold = threshold;
    }

    /**
     * Évaluation quotidienne : pour chaque org avec la constellation active et
     * chaque type automatisable SANS règle enabled, compte les approbations
     * humaines consécutives et pose la suggestion si le seuil est atteint.
     *
     * @return nombre de suggestions posées
     */
    @Transactional
    public int evaluateSuggestions() {
        int suggested = 0;
        for (SupervisionSettings settings : settingsRepository.findByEnabledTrueAndPausedFalse()) {
            final Long orgId = settings.getOrganizationId();
            for (AutomatableType type : SupervisionAutomatableTypes.CATALOG) {
                if (evaluateType(orgId, type)) {
                    suggested++;
                }
            }
        }
        return suggested;
    }

    private boolean evaluateType(Long orgId, AutomatableType type) {
        final SupervisionAutoRule rule = autoRuleRepository
                .findByOrganizationIdAndActionType(orgId, type.actionType()).orElse(null);
        if (rule != null && !eligibleForSuggestion(rule)) {
            return false; // déjà ON, suggestion active, ou « Ignorer » récent
        }
        final long streak = consecutiveHumanApprovals(orgId, type.actionType());
        if (streak < threshold) {
            return false;
        }
        final SupervisionAutoRule target = rule != null
                ? rule : new SupervisionAutoRule(orgId, type.actionType());
        target.setSuggestedAt(clock.instant());
        autoRuleRepository.save(target);
        notifySuggestion(orgId, type, streak);
        log.info("[CARD-TRUST] org={} type={} : {} approbation(s) consecutive(s) → suggestion posee",
                orgId, type.actionType(), streak);
        return true;
    }

    /**
     * Une règle existante est éligible à une (re-)suggestion seulement si elle
     * est OFF, sans suggestion active, et hors cooldown après un « Ignorer ».
     */
    private boolean eligibleForSuggestion(SupervisionAutoRule rule) {
        if (rule.isEnabled() || rule.getSuggestedAt() != null) {
            return false;
        }
        return rule.getSuggestionDismissedAt() == null
                || rule.getSuggestionDismissedAt().isBefore(clock.instant().minus(RESUGGEST_COOLDOWN));
    }

    /**
     * Approbations HUMAINES consécutives (les plus récentes) d'un type : parcourt
     * les cartes décidées en ordre anti-chronologique de décision. Voir la javadoc
     * de classe pour la sémantique {@code auto:gate} / DISMISSED.
     */
    @Transactional(readOnly = true)
    public long consecutiveHumanApprovals(Long orgId, String actionType) {
        final List<SupervisionSuggestion> decided = suggestionRepository
                .findDecidedByTypeOrderByDecisionDesc(orgId, actionType,
                        PageRequest.ofSize(DECISIONS_FETCH_LIMIT));
        long streak = 0;
        for (SupervisionSuggestion suggestion : decided) {
            if (SupervisionSuggestion.STATUS_DISMISSED.equals(suggestion.getStatus())) {
                break; // un rejet remet la série à zéro
            }
            final String appliedBy = suggestion.getAppliedBy();
            if (appliedBy != null && appliedBy.startsWith(SupervisionSuggestion.APPLIED_BY_USER_PREFIX)) {
                streak++;
            }
            // APPLIED par auto:gate / acteur inconnu : ni compté, ni cassant.
        }
        return streak;
    }

    /** Notification in-app (best-effort) : l'org décide dans le menu Automatisation. */
    private void notifySuggestion(Long orgId, AutomatableType type, long streak) {
        try {
            notificationService.notifyAdminsAndManagersByOrgId(orgId,
                    NotificationKey.SUPERVISION_AUTO_RULE_SUGGESTED,
                    "Automatiser « " + frenchLabel(type.actionType()) + " » ?",
                    "Vous avez approuvé " + streak + " fois de suite ce type d'action de la "
                            + "constellation. Vous pouvez l'automatiser (sous enveloppe) depuis le "
                            + "menu Automatisation — ou ignorer la suggestion.",
                    "/automation-rules");
        } catch (Exception e) {
            log.debug("[CARD-TRUST] notification non émise (org={}) : {}", orgId, e.getMessage());
        }
    }

    /** Libellé FR court du type (les notifications in-app sont rédigées en français). */
    private static String frenchLabel(String actionType) {
        return switch (actionType) {
            case SupervisionActionType.CLEANING_REQUEST -> "Planifier le ménage manquant";
            case SupervisionActionType.REVIEW_DRAFT_REPLY -> "Préparer le brouillon de réponse d'avis";
            case SupervisionActionType.PRICE_DROP -> "Ajuster les tarifs des créneaux creux";
            case SupervisionActionType.CALENDAR_BLOCK -> "Bloquer le calendrier (incidents bruit)";
            case SupervisionActionType.DEPOSIT_RELEASE -> "Libérer la caution après le départ";
            case SupervisionActionType.DEPOSIT_REFUND -> "Rembourser la caution après annulation";
            case SupervisionActionType.PAYMENT_REMINDER -> "Relancer le paiement échoué";
            default -> actionType;
        };
    }
}
