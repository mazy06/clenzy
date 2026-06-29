package com.clenzy.service;

import com.clenzy.config.AiProperties;
import com.clenzy.config.ai.AiResponse;
import com.clenzy.dto.AiFeatureUsageBreakdownDto;
import com.clenzy.dto.AiUsageStatsDto;
import com.clenzy.exception.AiBudgetExceededException;
import com.clenzy.exception.AiNotConfiguredException;
import com.clenzy.model.AiFeature;
import com.clenzy.model.AiTokenBudget;
import com.clenzy.model.AiTokenUsage;
import com.clenzy.repository.AiTokenBudgetRepository;
import com.clenzy.repository.AiTokenUsageRepository;
import com.clenzy.service.ai.LlmPricingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service de gestion du budget tokens AI.
 *
 * Responsabilites :
 * - Verifier si une org/feature a du budget restant
 * - Enregistrer la consommation apres chaque appel LLM
 * - Fournir les statistiques d'utilisation pour le dashboard
 */
@Service
public class AiTokenBudgetService {

    private static final Logger log = LoggerFactory.getLogger(AiTokenBudgetService.class);

    private final AiProperties aiProperties;
    private final AiTokenBudgetRepository budgetRepository;
    private final AiTokenUsageRepository usageRepository;
    private final LlmPricingService pricingService;

    public AiTokenBudgetService(AiProperties aiProperties,
                                AiTokenBudgetRepository budgetRepository,
                                AiTokenUsageRepository usageRepository,
                                LlmPricingService pricingService) {
        this.aiProperties = aiProperties;
        this.budgetRepository = budgetRepository;
        this.usageRepository = usageRepository;
        this.pricingService = pricingService;
    }

    // ─── Feature toggles ─────────────────────────────────────────────────

    /**
     * Verifie si une feature IA est activee pour l'organisation.
     * Par defaut actif si aucune config n'existe (backward compatible).
     */
    public boolean isFeatureEnabled(Long organizationId, AiFeature feature) {
        return budgetRepository.findByOrganizationIdAndFeature(organizationId, feature)
                .map(AiTokenBudget::isEnabled)
                .orElse(true);
    }

    /**
     * Verifie que la feature est activee, sinon lance une exception.
     *
     * @throws AiNotConfiguredException si la feature est desactivee
     */
    public void requireFeatureEnabled(Long organizationId, AiFeature feature) {
        if (!isFeatureEnabled(organizationId, feature)) {
            throw new AiNotConfiguredException("AI_FEATURE_DISABLED", feature.name(),
                    "La fonctionnalite IA " + feature + " est desactivee pour cette organisation.");
        }
    }

    /**
     * Retourne l'etat de toutes les features IA pour l'organisation.
     * Utilisé par le panneau Parametres > IA.
     */
    @Transactional(readOnly = true)
    public Map<AiFeature, Boolean> getFeatureToggles(Long organizationId) {
        List<AiTokenBudget> budgets = budgetRepository.findByOrganizationId(organizationId);
        Map<AiFeature, Boolean> dbState = budgets.stream()
                .collect(Collectors.toMap(AiTokenBudget::getFeature, AiTokenBudget::isEnabled));

        Map<AiFeature, Boolean> toggles = new HashMap<>();
        for (AiFeature f : AiFeature.values()) {
            toggles.put(f, dbState.getOrDefault(f, true));
        }
        return toggles;
    }

    /**
     * Active ou desactive une feature IA pour l'organisation (upsert).
     */
    @Transactional
    public void setFeatureEnabled(Long organizationId, AiFeature feature, boolean enabled) {
        AiTokenBudget budget = budgetRepository.findByOrganizationIdAndFeature(organizationId, feature)
                .orElseGet(() -> {
                    AiTokenBudget b = new AiTokenBudget(organizationId, feature,
                            aiProperties.getTokenBudget().getDefaultMonthlyTokens());
                    return b;
                });
        budget.setEnabled(enabled);
        budgetRepository.save(budget);

        log.info("AI feature {} {} for org={}", feature, enabled ? "enabled" : "disabled", organizationId);
    }

    // ─── Budget checks ──────────────────────────────────────────────────

    /**
     * Verifie si l'organisation a du budget restant pour la feature donnee.
     *
     * @return true si le budget n'est pas depasse (ou si l'enforcement est desactive)
     */
    public boolean hasBudget(Long organizationId, AiFeature feature) {
        if (!aiProperties.getTokenBudget().isEnforced()) {
            return true;
        }

        String currentMonth = getCurrentMonthYear();
        long limit = getMonthlyLimit(organizationId, feature);
        long used = usageRepository.sumTokensByOrgAndFeatureAndMonth(organizationId, feature, currentMonth);

        return used < limit;
    }

    /**
     * Verifie le budget et lance une exception si depasse.
     *
     * @throws AiBudgetExceededException si le budget est depasse
     */
    public void requireBudget(Long organizationId, AiFeature feature) {
        if (!hasBudget(organizationId, feature)) {
            String currentMonth = getCurrentMonthYear();
            long limit = getMonthlyLimit(organizationId, feature);
            long used = usageRepository.sumTokensByOrgAndFeatureAndMonth(organizationId, feature, currentMonth);
            throw new AiBudgetExceededException(feature.name(), used, limit);
        }
    }

    /**
     * Verifie le budget en tenant compte de la source de la cle API.
     * Si l'organisation utilise sa propre cle (BYOK), le budget n'est pas enforce
     * mais l'usage sera toujours enregistre via {@link #recordUsage}.
     *
     * @param organizationId ID de l'organisation
     * @param feature        feature AI
     * @param keySource      source de la cle (PLATFORM_DB ou ORGANIZATION)
     */
    public void requireBudget(Long organizationId, AiFeature feature, KeySource keySource) {
        if (keySource == KeySource.ORGANIZATION) {
            log.debug("Skipping budget enforcement for org={} feature={} (BYOK)", organizationId, feature);
            return;
        }
        requireBudget(organizationId, feature);
    }

    // ─── Usage recording ────────────────────────────────────────────────

    /**
     * Enregistre la consommation de tokens apres un appel LLM.
     */
    @Transactional
    public void recordUsage(Long organizationId, AiFeature feature,
                            String providerName, AiResponse response) {
        AiTokenUsage usage = new AiTokenUsage(
                organizationId,
                feature,
                providerName,
                response.model(),
                response.promptTokens(),
                response.completionTokens(),
                response.totalTokens(),
                getCurrentMonthYear()
        );
        usageRepository.save(usage);

        log.debug("Recorded AI token usage: org={}, feature={}, provider={}, tokens={}",
                organizationId, feature, providerName, response.totalTokens());
    }

    // ─── Statistics ─────────────────────────────────────────────────────

    /**
     * Retourne les statistiques d'utilisation pour le dashboard.
     */
    @Transactional(readOnly = true)
    public AiUsageStatsDto getUsageStats(Long organizationId) {
        String currentMonth = getCurrentMonthYear();

        Map<String, Long> usageByFeature = new HashMap<>();
        Map<String, Long> budgetByFeature = new HashMap<>();
        long totalUsed = 0;
        long totalBudget = 0;

        for (AiFeature feature : AiFeature.values()) {
            long used = usageRepository.sumTokensByOrgAndFeatureAndMonth(
                    organizationId, feature, currentMonth);
            long limit = getMonthlyLimit(organizationId, feature);

            usageByFeature.put(feature.name(), used);
            budgetByFeature.put(feature.name(), limit);

            totalUsed += used;
            totalBudget += limit;
        }

        return new AiUsageStatsDto(usageByFeature, budgetByFeature, totalUsed, totalBudget, currentMonth);
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private long getMonthlyLimit(Long organizationId, AiFeature feature) {
        return budgetRepository.findByOrganizationIdAndFeature(organizationId, feature)
                .filter(AiTokenBudget::isEnabled)
                .map(AiTokenBudget::getMonthlyTokenLimit)
                .orElse(aiProperties.getTokenBudget().getDefaultMonthlyTokens());
    }

    /**
     * Retourne le mois courant au format YYYY-MM.
     * Package-private pour faciliter le testing.
     */
    String getCurrentMonthYear() {
        return YearMonth.now().toString();
    }

    // ─── Breakdown par provider/model (multi-provider awareness) ─────────

    /**
     * Retourne le breakdown detaille des consommations par feature, decompose
     * par (provider, model). Resout le probleme d'agregation aveugle de
     * {@link #getUsageStats(Long)} qui sommait tous les modeles dans un seul
     * compteur par feature, masquant le fait que 100k tokens Sonnet et 100k
     * Haiku ont des couts tres differents.
     *
     * <p>Utilise pour le tooltip "breakdown par modele" affiche au hover sur
     * le compteur d'une feature dans Settings &gt; IA.</p>
     */
    @Transactional(readOnly = true)
    public AiFeatureUsageBreakdownDto getUsageBreakdown(Long organizationId) {
        String currentMonth = getCurrentMonthYear();
        List<AiTokenUsage> allRecords = usageRepository.findByOrganizationIdAndMonthYear(
                organizationId, currentMonth);

        // Group by (feature, provider, model) -> [tokensIn, tokensOut, callCount]
        record GroupKey(AiFeature feature, String provider, String model) {}
        Map<GroupKey, long[]> grouped = new LinkedHashMap<>();
        for (AiTokenUsage r : allRecords) {
            String provider = r.getProvider() != null ? r.getProvider() : "unknown";
            String model = r.getModel() != null ? r.getModel() : "unknown";
            GroupKey key = new GroupKey(r.getFeature(), provider, model);
            grouped.merge(key, new long[]{r.getPromptTokens(), r.getCompletionTokens(), 1L},
                    (a, b) -> new long[]{a[0] + b[0], a[1] + b[1], a[2] + b[2]});
        }

        // Init result map avec toutes les features (meme vides) pour stabilite UI
        Map<String, List<AiFeatureUsageBreakdownDto.ModelUsage>> result = new LinkedHashMap<>();
        for (AiFeature f : AiFeature.values()) {
            result.put(f.name(), new ArrayList<>());
        }
        for (Map.Entry<GroupKey, long[]> entry : grouped.entrySet()) {
            GroupKey k = entry.getKey();
            long[] sums = entry.getValue();
            BigDecimal cost = pricingService.computeCost(k.model(), sums[0], sums[1]);
            result.get(k.feature().name()).add(
                    new AiFeatureUsageBreakdownDto.ModelUsage(
                            k.provider(), k.model(), sums[0], sums[1], cost, sums[2]));
        }
        // Tri descendant par cost dans chaque feature (le plus cher d'abord)
        for (List<AiFeatureUsageBreakdownDto.ModelUsage> list : result.values()) {
            list.sort(Comparator.comparing(
                    AiFeatureUsageBreakdownDto.ModelUsage::costUsd).reversed());
        }

        return new AiFeatureUsageBreakdownDto(currentMonth, result);
    }
}
