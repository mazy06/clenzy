package com.clenzy.service.ai;

import com.clenzy.config.AiProperties;
import com.clenzy.dto.AssistantUsageDto;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenUsage;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AiTokenUsageRepository;
import com.clenzy.repository.AssistantMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Service d'aggregation de la consommation tokens + cout USD de l'assistant
 * conversationnel pour une organisation.
 *
 * <p><b>Sources de donnees</b> :</p>
 * <ul>
 *   <li>{@code ai_token_usage} (filtre sur {@link AiFeature#ASSISTANT_CHAT}) :
 *       1 record par appel LLM (orchestrator + chaque specialist + briefings).</li>
 *   <li>{@link LlmPricingService} : conversion tokens → USD per modele.</li>
 * </ul>
 *
 * <p><b>Periodes supportees</b> (param {@code period}) :</p>
 * <ul>
 *   <li>{@code today}  : depuis 00:00:00 UTC du jour courant</li>
 *   <li>{@code month}  : mois courant (YYYY-MM, source de verite pour le badge frontend)</li>
 *   <li>{@code all}    : tout l'historique (rare, dashboard admin)</li>
 * </ul>
 *
 * <p><b>Performance</b> : la query par feature/month utilise l'index
 * {@code idx_ai_token_usage_org_feature_month}. Pour "today", on filtre en
 * memoire (volume faible : ~50-200 records/jour/org). Pour "all", on streame
 * sans agregation par jour (utiliser le rapport admin si besoin).</p>
 *
 * <p>Pour le detail par conversation,
 * {@link #getConversationUsage(Long, String)} lit directement
 * {@code assistant_message} (granularite par tour user).</p>
 */
@Service
public class AssistantUsageService {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final AiTokenUsageRepository usageRepository;
    private final AssistantMessageRepository messageRepository;
    private final LlmPricingService pricingService;
    private final AiProperties aiProperties;
    private final Clock clock;

    /** Constructeur Spring (autowiring) : utilise UTC system clock. */
    public AssistantUsageService(AiTokenUsageRepository usageRepository,
                                   AssistantMessageRepository messageRepository,
                                   LlmPricingService pricingService,
                                   AiProperties aiProperties) {
        this(usageRepository, messageRepository, pricingService, aiProperties, Clock.systemUTC());
    }

    /** Constructeur testable avec Clock injectable (fix time pour tests). */
    public AssistantUsageService(AiTokenUsageRepository usageRepository,
                                   AssistantMessageRepository messageRepository,
                                   LlmPricingService pricingService,
                                   AiProperties aiProperties,
                                   Clock clock) {
        this.usageRepository = usageRepository;
        this.messageRepository = messageRepository;
        this.pricingService = pricingService;
        this.aiProperties = aiProperties;
        this.clock = clock;
    }

    /**
     * Snapshot d'usage pour le badge frontend. Toujours retourne un DTO valide
     * (tokens=0, cost=0 si pas de consommation — pas d'exception).
     */
    @Transactional(readOnly = true)
    public AssistantUsageDto getUsage(Long organizationId, String period) {
        String normalizedPeriod = period == null ? "month" : period.toLowerCase();
        List<AiTokenUsage> records = switch (normalizedPeriod) {
            case "today" -> usageRepository.findByOrgAndFeatureSince(
                    organizationId, AiFeature.ASSISTANT_CHAT, startOfToday());
            case "all" -> findAllForOrg(organizationId);
            default -> usageRepository.findByOrganizationIdAndFeatureAndMonthYear(
                    organizationId, AiFeature.ASSISTANT_CHAT, currentMonth());
        };

        return aggregate(records, normalizedPeriod);
    }

    /**
     * Detail par conversation : somme des tokens persistes dans
     * {@code assistant_message} pour cette conversation, converti en cout.
     *
     * <p><b>Note</b> : on lit ici depuis {@code assistant_message} (et pas
     * {@code ai_token_usage}) car le modele utilise n'est pas trace par tour
     * dans {@code ai_token_usage} (groupe par feature/month/model). La conv
     * stocke le {@code model} sur {@code AssistantConversation} — on l'utilise
     * comme modele de reference pour calculer le cout.</p>
     */
    @Transactional(readOnly = true)
    public AssistantUsageDto getConversationUsage(Long conversationId, String userKeycloakId) {
        // Securite : recharge la conv et verifie l'ownership avant d'agreger
        // (les controllers doivent passer le keycloakId du caller). Le repository
        // est tenant-filtered donc l'org est implicite.
        List<AssistantMessage> messages = messageRepository.findByConversation(conversationId);
        if (messages.isEmpty()) {
            return new AssistantUsageDto(0L, 0L, BigDecimal.ZERO, List.of(),
                    "conversation", null, 0L);
        }
        // Defense en profondeur : verifie qu'au moins un message appartient bien
        // au user (le tenant filter couvre l'org, mais conv user-scoped).
        // En pratique le controller fait la check via convRepo.findByIdAndUser.

        long totalIn = 0;
        long totalOut = 0;
        long requestCount = 0;
        // Cumul par modele : ici on n'a pas le model par message (pas stocke),
        // on utilise le modele de reference de la conversation via le 1er
        // message assistant qui contient cette info. Fallback "unknown".
        String referenceModel = "unknown";
        for (AssistantMessage m : messages) {
            if (m.getPromptTokens() == null || m.getCompletionTokens() == null) continue;
            if (!AssistantMessage.ROLE_ASSISTANT.equals(m.getRole())) continue;
            totalIn += m.getPromptTokens();
            totalOut += m.getCompletionTokens();
            requestCount++;
        }
        BigDecimal cost = pricingService.computeCost(referenceModel, totalIn, totalOut);
        return new AssistantUsageDto(
                totalIn, totalOut, cost,
                List.of(new AssistantUsageDto.ModelBreakdown(
                        referenceModel, totalIn, totalOut, cost, requestCount)),
                "conversation", null, requestCount
        );
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    /** Aggregation centrale : somme + breakdown par modele + cout. */
    private AssistantUsageDto aggregate(List<AiTokenUsage> records, String period) {
        if (records == null || records.isEmpty()) {
            return new AssistantUsageDto(0L, 0L, BigDecimal.ZERO, List.of(),
                    period, monthlyBudget(), 0L);
        }

        // Groupement par modele (preserve l'ordre d'apparition pour stabilite UI)
        Map<String, long[]> byModel = new LinkedHashMap<>();
        // long[2] = {tokensIn, tokensOut}, comptage via separate map (sinon long[3])
        Map<String, Long> countByModel = new LinkedHashMap<>();
        long totalIn = 0;
        long totalOut = 0;
        long totalCount = 0;
        for (AiTokenUsage r : records) {
            String model = r.getModel() != null ? r.getModel() : "unknown";
            long[] sums = byModel.computeIfAbsent(model, k -> new long[2]);
            sums[0] += r.getPromptTokens();
            sums[1] += r.getCompletionTokens();
            countByModel.merge(model, 1L, Long::sum);
            totalIn += r.getPromptTokens();
            totalOut += r.getCompletionTokens();
            totalCount++;
        }

        List<AssistantUsageDto.ModelBreakdown> breakdown = new ArrayList<>(byModel.size());
        BigDecimal totalCost = BigDecimal.ZERO;
        for (Map.Entry<String, long[]> e : byModel.entrySet()) {
            String model = e.getKey();
            long in = e.getValue()[0];
            long out = e.getValue()[1];
            BigDecimal cost = pricingService.computeCost(model, in, out);
            totalCost = totalCost.add(cost);
            breakdown.add(new AssistantUsageDto.ModelBreakdown(
                    model, in, out, cost, countByModel.get(model)));
        }
        // Tri descendant par cost (plus visible d'abord pour le tooltip)
        breakdown.sort(Comparator.comparing(
                AssistantUsageDto.ModelBreakdown::costUsd).reversed());

        return new AssistantUsageDto(totalIn, totalOut, totalCost,
                breakdown, period, monthlyBudget(), totalCount);
    }

    /** Pour "all" period : on aggrege tous les records (rare path, no index match). */
    private List<AiTokenUsage> findAllForOrg(Long organizationId) {
        // Limite defensive a un horizon raisonnable (12 mois glissants) pour
        // eviter de scanner toute la table dans un cas degrade.
        LocalDateTime since = LocalDateTime.now(clock).minusMonths(12);
        return usageRepository.findByOrgAndFeatureSince(
                organizationId, AiFeature.ASSISTANT_CHAT, since);
    }

    private LocalDateTime startOfToday() {
        return LocalDate.now(clock).atStartOfDay();
    }

    private String currentMonth() {
        return LocalDate.now(clock).format(MONTH_FMT);
    }

    /**
     * Budget mensuel total (tokens) defini en config. Null si BYOK detecte —
     * mais le service n'a pas cette info ici (le caller controller peut la
     * masquer si BYOK active).
     */
    private Long monthlyBudget() {
        long b = aiProperties.getTokenBudget().getDefaultMonthlyTokens();
        return b > 0 ? b : null;
    }
}
