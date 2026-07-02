package com.clenzy.service.ai;

import com.clenzy.model.AiCreditRateCard;
import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.repository.AiCreditRateCardRepository;
import com.clenzy.repository.AiUsageLedgerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Metering en credits IA (campagne T-06, ADR-005/006) : convertit l'usage
 * tokens d'un appel LLM en debit du ledger {@code ai_usage_ledger}.
 *
 * <p><b>Phase actuelle (T-06)</b> : le ledger ENREGISTRE — l'enforcement de
 * solde (poches, Redis, pre-vol) arrive au ticket suivant. Toute erreur de
 * metering est donc avalee (best-effort) ; quand l'enforcement arrivera, le
 * pre-vol deviendra bloquant, pas cette ecriture.</p>
 *
 * <p>Regles ancrees :</p>
 * <ul>
 *   <li><b>ADR-006</b> : taux INPUT plein applique aux tokens d'entree tels que
 *       livres par les providers ; les tokens caches sont enregistres a part
 *       (marge), jamais de remise cote client dans la rate card ;</li>
 *   <li><b>ADR-008 (BYOK)</b> : facteur multiplicatif configurable
 *       ({@code clenzy.ai.credits.byok-factor}, defaut 0.30) — applique quand
 *       l'appelant indique une cle organisation ;</li>
 *   <li><b>Idempotence</b> : cle unique en DB ; un insert en double (retry)
 *       est rejete par la contrainte et ignore silencieusement ;</li>
 *   <li><b>Modele sans taux</b> : debit 0 + WARN (jamais silencieux — metrique
 *       T-01 {@code assistant.pricing.unknown_model} cote observabilite) ; le
 *       refus en pre-vol arrivera avec l'enforcement.</li>
 * </ul>
 */
@Service
public class CreditMeteringService {

    private static final Logger log = LoggerFactory.getLogger(CreditMeteringService.class);

    /** TTL du cache in-memory de la grille (les taux changent ~1-2 fois/an). */
    private static final long RATE_CACHE_TTL_MS = 5 * 60 * 1000L;

    private final AiCreditRateCardRepository rateCardRepository;
    private final AiUsageLedgerRepository ledgerRepository;
    /** Garde de run (T-06b) — nullable en test ; no-op sans run garde actif. */
    private final RunCreditGuard runCreditGuard;
    private final double byokFactor;

    private volatile List<AiCreditRateCard> cachedRates = List.of();
    private volatile long cacheLoadedAt = 0L;

    public CreditMeteringService(AiCreditRateCardRepository rateCardRepository,
                                 AiUsageLedgerRepository ledgerRepository,
                                 RunCreditGuard runCreditGuard,
                                 @Value("${clenzy.ai.credits.byok-factor:0.30}") double byokFactor) {
        this.rateCardRepository = rateCardRepository;
        this.ledgerRepository = ledgerRepository;
        this.runCreditGuard = runCreditGuard;
        this.byokFactor = byokFactor;
    }

    /**
     * Enregistre le debit d'un appel LLM au ledger. Best-effort : ne leve JAMAIS.
     *
     * @param runId          run persiste (nullable — usage hors run trace quand meme)
     * @param stepSeq        sequence de metering dans le run (nullable)
     * @param agent          origine (mono | multi_agent | router | ...)
     * @param feature        AiFeature name() (ASSISTANT_CHAT, EMBEDDINGS, ...)
     * @param byok           true si l'appel a consomme une cle organisation (ADR-008)
     * @param idempotencyKey cle unique du debit ; null → generee (pas de retry possible)
     */
    public void meterLlmUsage(Long organizationId, String keycloakUserId,
                              UUID runId, Integer stepSeq, String agent, String feature,
                              String provider, String model,
                              int promptTokens, int completionTokens, int cachedPromptTokens,
                              boolean byok, String idempotencyKey) {
        if (organizationId == null || (promptTokens <= 0 && completionTokens <= 0)) {
            return;
        }
        try {
            AiCreditRateCard inputRate = resolveRate(provider, model, AiCreditRateCard.TYPE_INPUT);
            AiCreditRateCard outputRate = resolveRate(provider, model, AiCreditRateCard.TYPE_OUTPUT);
            if (inputRate == null && outputRate == null) {
                log.warn("[CREDITS] Aucun taux pour provider='{}' model='{}' → debit 0 "
                        + "(completer ai_credit_rate_card)", provider, model);
            }

            long debit = ceilPer1k(promptTokens, rateOf(inputRate))
                    + ceilPer1k(completionTokens, rateOf(outputRate));
            if (byok) {
                debit = Math.round(debit * byokFactor);
            }
            long realCost = ceilPer1k(promptTokens, costOf(inputRate))
                    + ceilPer1k(completionTokens, costOf(outputRate));

            String key = idempotencyKey != null ? idempotencyKey
                    : "adhoc:" + UUID.randomUUID();
            ledgerRepository.save(new AiUsageLedgerEntry(
                    organizationId, keycloakUserId, runId, stepSeq, agent, feature,
                    AiUsageLedgerEntry.TYPE_DEBIT, AiUsageLedgerEntry.BUCKET_INTERACTIVE,
                    provider, model,
                    promptTokens, completionTokens, cachedPromptTokens,
                    inputRate != null ? inputRate.getId() : null,
                    outputRate != null ? outputRate.getId() : null,
                    -debit, realCost, key));
            // Enforcement (T-06b) : consommation appliquee aux poches + re-check
            // inter-tours. No-op si l'enforcement est off ou hors run garde.
            if (runCreditGuard != null && debit > 0) {
                runCreditGuard.onDebit(organizationId, debit);
            }
        } catch (DataIntegrityViolationException e) {
            // Retry du meme debit : la contrainte unique fait son travail — pas de double comptage.
            log.debug("[CREDITS] Debit deja enregistre (idempotence) : {}", idempotencyKey);
        } catch (Exception e) {
            log.warn("[CREDITS] Echec d'ecriture ledger (best-effort, phase sans enforcement) : {}",
                    e.getMessage());
        }
    }

    /**
     * Taux courant par (provider, tokenType) et prefix-match du modele (le plus
     * long gagne — meme convention que LlmPricingService). Null si aucun taux.
     */
    AiCreditRateCard resolveRate(String provider, String model, String tokenType) {
        if (provider == null || model == null || model.isBlank()) {
            return null;
        }
        String p = provider.toLowerCase(Locale.ROOT);
        AiCreditRateCard best = null;
        for (AiCreditRateCard rate : currentRates()) {
            if (!rate.getProvider().equalsIgnoreCase(p) || !rate.getTokenType().equals(tokenType)) {
                continue;
            }
            if (model.startsWith(rate.getModelPrefix())
                    && (best == null || rate.getModelPrefix().length() > best.getModelPrefix().length())) {
                best = rate;
            }
        }
        return best;
    }

    /** Arrondi superieur par tranche de 1k tokens : jamais de sous-facturation d'arrondi. */
    static long ceilPer1k(long tokens, long ratePer1k) {
        if (tokens <= 0 || ratePer1k <= 0) {
            return 0;
        }
        return (tokens * ratePer1k + 999) / 1000;
    }

    private static long rateOf(AiCreditRateCard rate) {
        return rate == null ? 0 : rate.getMillicreditsPer1k();
    }

    private static long costOf(AiCreditRateCard rate) {
        return rate == null ? 0 : rate.getProviderCostMicroUsdPer1k();
    }

    private List<AiCreditRateCard> currentRates() {
        long now = Instant.now().toEpochMilli();
        if (now - cacheLoadedAt > RATE_CACHE_TTL_MS) {
            try {
                cachedRates = rateCardRepository.findByEffectiveToIsNull();
                cacheLoadedAt = now;
            } catch (Exception e) {
                log.warn("[CREDITS] Rechargement de la grille en echec, on garde le cache : {}",
                        e.getMessage());
                cacheLoadedAt = now; // evite de marteler la DB en panne
            }
        }
        return cachedRates;
    }
}
